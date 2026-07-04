"""
Google Chat Service Client
============================
Provides a thin relay layer for dispatching messages to Google Chat spaces.

Two delivery modes are supported, selected automatically based on available
configuration:

1. Incoming Webhook (simpler, no OAuth required):
   Set GOOGLE_CHAT_WEBHOOK_URL in the environment.  The client posts a JSON
   `{"text": "..."}` body directly to that URL using standard `urllib`.

2. Google Chat API v1 (full service account integration):
   Set GOOGLE_CHAT_CREDENTIALS to the path of a service account JSON key.
   The client uses `googleapiclient.discovery` to call
   `spaces.messages.create`.

Dev-mode fallback:
   If neither credential is configured, every `send_message_to_google_chat`
   call is logged as a warning and returns a mock response dict, so the
   application starts cleanly without any Google Workspace setup.

Dependencies:
   google-api-python-client>=2.0.0  (already in requirements.txt)
   google-auth>=2.0.0               (already in requirements.txt)
"""

import json
import logging
import urllib.error
import urllib.request
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)

# The JSON body Google Chat webhooks expect.
_WEBHOOK_HEADERS = {"Content-Type": "application/json; charset=UTF-8"}


class GoogleChatClient:
    """
    Relay client for Google Chat.

    Priority order
    --------------
    1. Incoming webhook URL  (GOOGLE_CHAT_WEBHOOK_URL)
    2. Service account API   (GOOGLE_CHAT_CREDENTIALS)
    3. Mock / dev-fallback   (neither set)
    """

    def __init__(self) -> None:
        self._webhook_url: Optional[str] = settings.GOOGLE_CHAT_WEBHOOK_URL or None
        self._service = None
        self._mock_mode = True

        if self._webhook_url:
            self._mock_mode = False
            logger.info(
                "GoogleChatClient initialised in webhook mode (URL configured)."
            )
            return

        credentials_path: Optional[str] = settings.GOOGLE_CHAT_CREDENTIALS
        if not credentials_path:
            logger.warning(
                "Neither GOOGLE_CHAT_WEBHOOK_URL nor GOOGLE_CHAT_CREDENTIALS "
                "is set.  GoogleChatClient running in mock/fallback mode."
            )
            return

        try:
            import os
            if not os.path.isfile(credentials_path):
                logger.warning(
                    "GOOGLE_CHAT_CREDENTIALS path '%s' does not exist. "
                    "GoogleChatClient running in mock/fallback mode.",
                    credentials_path,
                )
                return

            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            scopes = ["https://www.googleapis.com/auth/chat.bot"]
            creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=scopes
            )
            self._service = build("chat", "v1", credentials=creds, cache_discovery=False)
            self._mock_mode = False
            logger.info(
                "GoogleChatClient initialised with service account credentials."
            )

        except ImportError:
            logger.warning(
                "google-api-python-client is not installed. "
                "GoogleChatClient running in mock/fallback mode."
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to initialise GoogleChatClient: %s. "
                "Running in mock/fallback mode.",
                exc,
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def send_message_to_google_chat(self, space_id: str, text: str) -> dict:
        """
        Dispatch *text* to the Google Chat space identified by *space_id*.

        Args:
            space_id : Google Chat space resource name, e.g. 'spaces/AAABBB'.
            text     : Plain-text message body.

        Returns:
            The Google Chat API response dict on success, or a mock/error
            sentinel dict so callers always receive a dict regardless of mode.
        """
        if self._mock_mode:
            mock_response = {
                "mock": True,
                "space_id": space_id,
                "text": text,
                "detail": "GoogleChatClient in mock mode — message not dispatched.",
            }
            logger.warning(
                "[MOCK] Would send to space '%s': %s",
                space_id,
                text[:120],
            )
            return mock_response

        # --- Webhook delivery ---
        if self._webhook_url:
            return self._send_via_webhook(text)

        # --- API delivery ---
        return self._send_via_api(space_id, text)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _send_via_webhook(self, text: str) -> dict:
        """POST the message to the configured incoming webhook URL."""
        payload = json.dumps({"text": text}).encode("utf-8")
        req = urllib.request.Request(
            self._webhook_url,
            data=payload,
            headers=_WEBHOOK_HEADERS,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
                logger.info(
                    "Message dispatched via webhook. HTTP %s.", resp.status
                )
                # Google webhooks return an empty body on success.
                return {"webhook": True, "status": resp.status, "body": body}
        except urllib.error.HTTPError as exc:
            logger.error(
                "Webhook HTTP error %s: %s", exc.code, exc.read().decode("utf-8")
            )
            return {"webhook": True, "error": str(exc), "status": exc.code}
        except Exception as exc:  # noqa: BLE001
            logger.error("Webhook delivery failed: %s", exc)
            return {"webhook": True, "error": str(exc)}

    def _send_via_api(self, space_id: str, text: str) -> dict:
        """Create a message via the Chat API in the given space."""
        try:
            response = (
                self._service.spaces()
                .messages()
                .create(
                    parent=space_id,
                    body={"text": text},
                )
                .execute()
            )
            logger.info(
                "Message sent via Chat API to space '%s'.", space_id
            )
            return response
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Chat API delivery to space '%s' failed: %s", space_id, exc
            )
            return {"api": True, "error": str(exc)}


# ---------------------------------------------------------------------------
# Module-level singleton — import this directly in route handlers.
# ---------------------------------------------------------------------------
chat_client = GoogleChatClient()
