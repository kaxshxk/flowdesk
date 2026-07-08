"""
Google Meet Service Client
===========================
Generates live Google Meet links programmatically by creating a short-lived
Google Calendar event with auto-provisioned conference data.

Fallback / Mock mode:
    If GOOGLE_CALENDAR_CREDENTIALS is not configured or the Google API fails,
    returns a mock URL of format 'https://meet.google.com/abc-defg-hij' (with a
    randomised string to simulate distinct rooms) so local development works.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)


class GoogleMeetClient:
    """
    Client for generating Meet links via the Google Calendar API.
    """

    def __init__(self) -> None:
        self.service = None
        self._mock_mode = True
        self.credentials_path = None
        self.scopes = ["https://www.googleapis.com/auth/calendar.events"]

        credentials_path: Optional[str] = settings.GOOGLE_CALENDAR_CREDENTIALS

        # If no dedicated calendar credentials, fallback to other configured credentials
        if not credentials_path:
            credentials_path = (
                settings.GOOGLE_DRIVE_CREDENTIALS or settings.GOOGLE_SHEETS_CREDENTIALS
            )

        if not credentials_path:
            logger.warning(
                "No Google API credentials set. "
                "GoogleMeetClient running in mock/fallback mode."
            )
            return

        if not os.path.isfile(credentials_path):
            logger.warning(
                "Credentials file '%s' not found. "
                "GoogleMeetClient running in mock/fallback mode.",
                credentials_path,
            )
            return

        self.credentials_path = credentials_path

        try:
            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            # Initialise standard credentials for validation
            creds = service_account.Credentials.from_service_account_file(
                self.credentials_path, scopes=self.scopes
            )
            self.service = build("calendar", "v3", credentials=creds, cache_discovery=False)
            self._mock_mode = False
            logger.info("GoogleMeetClient successfully initialised using Calendar API.")
        except ImportError:
            logger.warning(
                "google-api-python-client is not installed. "
                "GoogleMeetClient running in mock/fallback mode."
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to initialise GoogleMeetClient: %s. "
                "Running in mock/fallback mode.",
                exc,
            )

    def get_calendar_service(self, delegate_email: Optional[str] = None):
        """Build a calendar service instance, optionally delegating (impersonating) a user."""
        if not self.credentials_path:
            return None
        
        try:
            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            creds = service_account.Credentials.from_service_account_file(
                self.credentials_path, scopes=self.scopes
            )
            
            # Prefer specified delegate, fallback to global settings config
            target_email = delegate_email or settings.GOOGLE_CALENDAR_DELEGATED_EMAIL
            if target_email:
                creds = creds.with_subject(target_email)
                logger.info("Building calendar service impersonating user: %s", target_email)
                
            return build("calendar", "v3", credentials=creds, cache_discovery=False)
        except Exception as exc:
            logger.warning("Failed to build delegated Calendar service: %s. Using default credentials.", exc)
            return None

    def create_instant_meet_room(self, topic: str, delegate_email: Optional[str] = None) -> str:
        """
        Create a calendar event with a Google Meet conference solution.

        Args:
            topic: The summary / topic of the meeting.
            delegate_email: Optional email of the user to impersonate.

        Returns:
            The live Google Meet URL, or a mock URL fallback.
        """
        # Generate a distinct mock identifier containing only lowercase letters (abc-defg-hij)
        import random
        import string
        letters = string.ascii_lowercase
        part1 = "".join(random.choice(letters) for _ in range(3))
        part2 = "".join(random.choice(letters) for _ in range(4))
        part3 = "".join(random.choice(letters) for _ in range(3))
        mock_meet_url = f"https://meet.google.com/{part1}-{part2}-{part3}"

        if self._mock_mode:
            logger.warning(
                "[MOCK] Created virtual Google Meet room '%s' -> %s",
                topic,
                mock_meet_url,
            )
            return mock_meet_url

        # Try to build service using Domain-Wide Delegation first
        service = self.get_calendar_service(delegate_email)
        using_delegation = (delegate_email or settings.GOOGLE_CALENDAR_DELEGATED_EMAIL) is not None
        
        if service is None:
            service = self.service
            using_delegation = False

        if service is None:
            return mock_meet_url

        try:
            now = datetime.now(timezone.utc)
            start_iso = now.isoformat()
            end_iso = (now + timedelta(minutes=30)).isoformat()
            request_id = uuid.uuid4().hex

            event_payload = {
                "summary": topic,
                "description": "Programmatic instant sync generated by HR-Productivity Hub",
                "start": {"dateTime": start_iso, "timeZone": "UTC"},
                "end": {"dateTime": end_iso, "timeZone": "UTC"},
                "conferenceData": {
                    "createRequest": {
                        "requestId": request_id,
                        "conferenceSolutionKey": {"type": "hangoutsMeet"},
                    }
                },
            }

            # If we are NOT impersonating (delegation failed/unsupported), but we have a configured
            # delegated email, write directly to that user's shared calendar instead of using "primary"
            # (which resolves to the license-less service account calendar and throws 400).
            calendar_id = "primary"
            if not using_delegation and settings.GOOGLE_CALENDAR_DELEGATED_EMAIL:
                calendar_id = settings.GOOGLE_CALENDAR_DELEGATED_EMAIL
                logger.info("Using direct shared calendar ID: %s", calendar_id)

            created_event = (
                service.events()
                .insert(
                    calendarId=calendar_id,
                    body=event_payload,
                    conferenceDataVersion=1,
                )
                .execute()
            )

            # Extract hangoutLink
            hangout_link: Optional[str] = created_event.get("hangoutLink")
            if hangout_link:
                logger.info("Google Meet link successfully provisioned: %s", hangout_link)
                return hangout_link

            logger.warning("Calendar event created but no Meet hangoutLink returned. Using mock fallback.")
            return mock_meet_url

        except Exception as exc:  # noqa: BLE001
            # If we attempted impersonation and got unauthorized/invalid_grant,
            # retry with the base service account credentials writing to the shared calendar ID!
            if using_delegation and self.service:
                logger.warning(
                    "Delegated event creation failed: %s. Retrying using direct service account credentials on shared calendar.",
                    exc,
                )
                try:
                    calendar_id = settings.GOOGLE_CALENDAR_DELEGATED_EMAIL or delegate_email or "primary"
                    created_event = (
                        self.service.events()
                        .insert(
                            calendarId=calendar_id,
                            body=event_payload,
                            conferenceDataVersion=1,
                        )
                        .execute()
                    )
                    hangout_link = created_event.get("hangoutLink")
                    if hangout_link:
                        return hangout_link
                except Exception as exc2:  # noqa: BLE001
                    logger.error("Retry event creation failed: %s", exc2)

            logger.error(
                "Failed to provision Google Meet room via Calendar API: %s. "
                "Returning mock link.",
                exc,
            )
            return mock_meet_url


# Module-level singleton
meet_client = GoogleMeetClient()
