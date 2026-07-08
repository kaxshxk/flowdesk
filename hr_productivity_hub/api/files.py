"""
File Upload Endpoints
=====================
Handles multipart file uploads to Google Drive with database persistence.

Security enforced:
  - Role: employee only (upload + own list).
  - Maximum file size: 50 MB (enforced by streaming chunk reader).
  - File name sanitation: path traversal prevented, dangerous characters stripped.
  - MIME type detection: passed through to Drive but never trusted for access control.
"""

import io
import anyio
import logging
from utils.rate_limit import rate_limit
import mimetypes
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import desc
from sqlmodel import Session, select

from core.config import settings
from core.database import get_session
from models.filelog import FileLog
from models.user import User, UserRole
from schemas.file import FileListResponse, FileLogResponse
from services.auth import require_role
from services.google_drive import drive_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/files", tags=["files"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maximum allowed upload size: 50 MB
_MAX_FILE_BYTES = 50 * 1024 * 1024  # 52,428,800 bytes

# Read file from the UploadFile in 64 KB chunks to bound memory usage.
_READ_CHUNK_SIZE = 64 * 1024


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sanitize_filename(raw_name: str) -> str:
    """
    Produce a safe, filesystem-clean file name from *raw_name*.

    Rules applied (in order):
    1. Strip any directory component to block path traversal.
    2. Replace characters outside [A-Za-z0-9._-] with underscores.
    3. Collapse consecutive dots to a single dot (prevents '..' tricks).
    4. Strip leading/trailing dots and spaces.
    5. Enforce a 255-character ceiling, preserving the extension.
    6. Fall back to 'unnamed_file' if the result is empty.
    """
    # 1. Path traversal guard — keep only the base name.
    name = os.path.basename(raw_name).replace("\\", "/").split("/")[-1]

    # 2. Replace dangerous characters.
    name = re.sub(r"[^\w.\-]", "_", name)  # \w covers [A-Za-z0-9_]

    # 3. Collapse multiple dots.
    name = re.sub(r"\.{2,}", ".", name)

    # 4. Strip boundary dots / spaces.
    name = name.strip(". ")

    # 5. Enforce max length, preserving the extension.
    if len(name) > 255:
        base, ext = os.path.splitext(name)
        name = base[: 255 - len(ext)] + ext

    # 6. Empty fallback.
    return name or "unnamed_file"


async def read_upload_with_size_limit(upload: UploadFile) -> io.BytesIO:
    """
    Stream *upload* into an in-memory BytesIO buffer while enforcing the
    50 MB size cap.  Raises HTTP 413 if the limit is exceeded.
    """
    buffer = bytearray()
    while True:
        chunk = await upload.read(_READ_CHUNK_SIZE)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > _MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File exceeds the maximum allowed size of "
                    f"{_MAX_FILE_BYTES // (1024 * 1024)} MB."
                ),
            )
    return io.BytesIO(bytes(buffer))


def resolve_mime_type(file_name: str, content_type: str | None) -> str:
    """
    Return the best-effort MIME type for *file_name*.
    Falls back to the browser-supplied content_type, then to
    application/octet-stream if neither can be determined.
    """
    guessed, _ = mimetypes.guess_type(file_name)
    return guessed or content_type or "application/octet-stream"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/upload",
    response_model=FileLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file to Google Drive",
)
async def upload_file(
    file: UploadFile = File(..., description="Binary file to upload (max 50 MB)."),
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
    _rate_limit = Depends(rate_limit(5, 60)),
):
    """
    Upload a file to the employee's date-partitioned Google Drive folder.

    Processing steps
    ----------------
    1. Sanitize the original file name.
    2. Stream the upload into memory, enforcing the 50 MB size limit.
    3. Resolve (or create) the Drive folder hierarchy:
           <root>/<YYYY>/<MM>/<YYYY-MM-DD>
    4. Push the file stream to Drive; capture the returned Drive file ID.
    5. Persist a `FileLog` record to the database.
    6. Return the database record with HTTP 201.
    """
    # --- 1. Sanitize file name ------------------------------------------------
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No file name was provided in the upload.",
        )
    safe_name = sanitize_filename(file.filename)
    mime_type = resolve_mime_type(safe_name, file.content_type)

    # --- 2. Read + size-check -------------------------------------------------
    file_stream = await read_upload_with_size_limit(file)

    # --- 3. Resolve Drive date folder -----------------------------------------
    root_folder_id: str = settings.GOOGLE_DRIVE_ROOT_FOLDER_ID or "DRIVE_ROOT_NOT_CONFIGURED"
    folder_id, folder_path = await anyio.to_thread.run_sync(
        drive_client.get_or_create_date_folders, root_folder_id
    )

    # --- 4. Upload to Drive ---------------------------------------------------
    drive_file_id = await anyio.to_thread.run_sync(
        drive_client.upload_file_stream,
        file_stream,
        safe_name,
        folder_id,
        mime_type,
    )

    # --- 5. Persist metadata --------------------------------------------------
    file_log = FileLog(
        user_id=current_user.id,
        file_name=safe_name,
        google_drive_file_id=drive_file_id,
        drive_folder_path=folder_path,
        timestamp=datetime.utcnow(),
    )
    session.add(file_log)
    
    # Trigger real-time activity alert hook (Phase 9)
    from utils.alerts import log_file_activity_alert
    log_file_activity_alert(user_id=current_user.id, file_name=safe_name, session=session)

    session.commit()
    session.refresh(file_log)

    return FileLogResponse.model_validate(file_log)


@router.get(
    "",
    response_model=FileListResponse,
    summary="List files uploaded by the authenticated employee",
)
def list_my_files(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Return all `FileLog` records belonging to the authenticated employee,
    ordered by timestamp descending (most recent first).
    """
    statement = (
        select(FileLog)
        .where(FileLog.user_id == current_user.id)
        .order_by(desc(FileLog.timestamp))
    )
    files = session.exec(statement).all()

    return FileListResponse(
        total=len(files),
        files=[FileLogResponse.model_validate(f) for f in files],
    )
