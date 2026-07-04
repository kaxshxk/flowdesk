"""
Google Drive Service Client
============================
Wraps the Google Drive API v3 for two purposes:

1. Dynamic date-folder resolution:
   Ensures a three-level hierarchy exists under a configured root folder:
       <root>/<YYYY>/<MM>/<YYYY-MM-DD>
   Any missing layer is created on-demand via the API.

2. Streaming file upload:
   Uploads a binary stream to the resolved date folder and returns the
   Drive file ID for database persistence.

Dev-mode fallback:
    If GOOGLE_DRIVE_CREDENTIALS is absent or the credential file cannot be
    read, the client initialises in mock mode. All operations return sentinel
    values (MOCK_FOLDER_* / MOCK_DRIVE_ID_*) so development is never blocked.

Dependencies:
    google-api-python-client>=2.0.0
    google-auth>=2.0.0  (pulled in transitively)
"""

import io
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)

# MIME type used by Drive to identify folders.
_FOLDER_MIME = "application/vnd.google-apps.folder"

# Drive API fields to request on file resources.
_FILE_FIELDS = "id, name, mimeType"

# Chunk size for resumable uploads: 5 MB (must be a multiple of 256 KB).
_CHUNK_SIZE = 5 * 1024 * 1024


class GoogleDriveClient:
    """
    Thin wrapper around the Drive API v3.

    Attributes
    ----------
    service     : googleapiclient Resource object, or None in mock mode.
    _mock_mode  : True when credentials are unavailable.
    """

    def __init__(self) -> None:
        self.service = None
        self._mock_mode = True

        credentials_path: Optional[str] = settings.GOOGLE_DRIVE_CREDENTIALS

        if not credentials_path:
            logger.warning(
                "GOOGLE_DRIVE_CREDENTIALS is not set. "
                "GoogleDriveClient running in mock/fallback mode."
            )
            return

        if not os.path.isfile(credentials_path):
            logger.warning(
                "GOOGLE_DRIVE_CREDENTIALS path '%s' does not exist. "
                "GoogleDriveClient running in mock/fallback mode.",
                credentials_path,
            )
            return

        try:
            from googleapiclient.discovery import build
            from google.oauth2 import service_account

            scopes = ["https://www.googleapis.com/auth/drive.file"]
            creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=scopes
            )
            self.service = build("drive", "v3", credentials=creds, cache_discovery=False)
            self._mock_mode = False
            logger.info("GoogleDriveClient initialised with service account credentials.")

        except ImportError:
            logger.warning(
                "google-api-python-client is not installed. "
                "GoogleDriveClient running in mock/fallback mode. "
                "Install with: pip install google-api-python-client google-auth"
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to initialise GoogleDriveClient: %s. "
                "Running in mock/fallback mode.",
                exc,
            )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _find_folder(self, name: str, parent_id: str) -> Optional[str]:
        """
        Search for a folder with *name* directly inside *parent_id*.

        Returns the folder's Drive ID if found, otherwise None.
        """
        query = (
            f"name = '{name}' "
            f"and '{parent_id}' in parents "
            f"and mimeType = '{_FOLDER_MIME}' "
            f"and trashed = false"
        )
        response = (
            self.service.files()
            .list(q=query, spaces="drive", fields=f"files({_FILE_FIELDS})")
            .execute()
        )
        files = response.get("files", [])
        return files[0]["id"] if files else None

    def _create_folder(self, name: str, parent_id: str) -> str:
        """
        Create a Drive folder named *name* inside *parent_id*.

        Returns the new folder's Drive ID.
        """
        metadata = {
            "name": name,
            "mimeType": _FOLDER_MIME,
            "parents": [parent_id],
        }
        folder = (
            self.service.files()
            .create(body=metadata, fields="id")
            .execute()
        )
        logger.info("Created Drive folder '%s' (id=%s) under parent '%s'.", name, folder["id"], parent_id)
        return folder["id"]

    def _get_or_create_folder(self, name: str, parent_id: str) -> str:
        """Return the Drive ID for *name* under *parent_id*, creating it if absent."""
        folder_id = self._find_folder(name, parent_id)
        if folder_id:
            return folder_id
        return self._create_folder(name, parent_id)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_or_create_date_folders(self, parent_root_id: str) -> tuple[str, str]:
        """
        Ensure the three-level date hierarchy exists under *parent_root_id*:
            <root>/<YYYY>/<MM>/<YYYY-MM-DD>

        Args:
            parent_root_id: Drive folder ID of the top-level root.

        Returns:
            A tuple of (folder_id, folder_path) where:
              - folder_id   is the Drive ID of the innermost YYYY-MM-DD folder.
              - folder_path is the human-readable path, e.g. '2026/07/2026-07-03'.

        In mock mode, returns sentinel values without hitting the API.
        """
        now = datetime.now(tz=timezone.utc)
        year_str  = now.strftime("%Y")        # e.g. '2026'
        month_str = now.strftime("%m")        # e.g. '07'
        day_str   = now.strftime("%Y-%m-%d")  # e.g. '2026-07-03'
        folder_path = f"{year_str}/{month_str}/{day_str}"

        if self._mock_mode or self.service is None:
            mock_id = f"MOCK_FOLDER_{day_str.replace('-', '')}"
            logger.warning(
                "[MOCK] Would resolve Drive folder path '%s' → id='%s'.",
                folder_path,
                mock_id,
            )
            return mock_id, folder_path

        try:
            year_id  = self._get_or_create_folder(year_str,  parent_root_id)
            month_id = self._get_or_create_folder(month_str, year_id)
            day_id   = self._get_or_create_folder(day_str,   month_id)
            return day_id, folder_path

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Failed to resolve/create Drive date folders: %s. "
                "Falling back to mock sentinel.",
                exc,
            )
            mock_id = f"MOCK_FOLDER_{day_str.replace('-', '')}"
            return mock_id, folder_path

    def upload_file_stream(
        self,
        file_stream: io.IOBase,
        file_name: str,
        folder_id: str,
        mime_type: str = "application/octet-stream",
    ) -> str:
        """
        Upload *file_stream* to Drive inside *folder_id*.

        Uses resumable (chunked) upload to handle large files without
        loading the entire payload into memory.

        Args:
            file_stream : Binary stream (e.g. io.BytesIO or SpooledTemporaryFile).
            file_name   : Target file name on Drive.
            folder_id   : Drive folder ID returned by get_or_create_date_folders.
            mime_type   : MIME type hint; defaults to application/octet-stream.

        Returns:
            The Google Drive file ID string.
            In mock mode or on error, returns a MOCK_DRIVE_ID_* sentinel.
        """
        if self._mock_mode or self.service is None:
            mock_id = f"MOCK_DRIVE_ID_{file_name}"
            logger.warning(
                "[MOCK] Would upload '%s' to folder '%s' → Drive id='%s'.",
                file_name,
                folder_id,
                mock_id,
            )
            return mock_id

        try:
            from googleapiclient.http import MediaIoBaseUpload

            media = MediaIoBaseUpload(
                file_stream,
                mimetype=mime_type,
                chunksize=_CHUNK_SIZE,
                resumable=True,
            )
            file_metadata = {
                "name": file_name,
                "parents": [folder_id],
            }
            uploaded = (
                self.service.files()
                .create(
                    body=file_metadata,
                    media_body=media,
                    fields="id",
                )
                .execute()
            )
            drive_id: str = uploaded["id"]
            logger.info(
                "Uploaded '%s' to Drive folder '%s' → file id='%s'.",
                file_name,
                folder_id,
                drive_id,
            )
            return drive_id

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Failed to upload '%s' to Drive: %s. "
                "File metadata will still be saved to the database.",
                file_name,
                exc,
            )
            return f"MOCK_DRIVE_ID_{file_name}_ERROR"


# ---------------------------------------------------------------------------
# Module-level singleton — import this directly in route handlers.
# ---------------------------------------------------------------------------
drive_client = GoogleDriveClient()
