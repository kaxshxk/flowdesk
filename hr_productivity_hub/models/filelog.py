from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from .user import User


class FileLog(SQLModel, table=True):
    """
    Persists metadata for every file uploaded to Google Drive by an employee.

    Fields
    ------
    id                  : Auto-incrementing primary key.
    user_id             : FK → user.id — owner of the upload.
    file_name           : Sanitized original file name (max 255 chars).
    google_drive_file_id: Unique file identifier returned by the Drive API.
                          Set to a MOCK_* value when Drive credentials are absent.
    drive_folder_path   : Human-readable path of the destination folder,
                          e.g. '2026/07/2026-07-03'.
    timestamp           : UTC datetime when the record was created.
    """

    __tablename__ = "filelog"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="user.id", index=True, nullable=False)

    # Sanitized file name; VARCHAR(255) is sufficient and avoids TEXT overhead.
    file_name: str = Field(max_length=255, nullable=False)

    # Returned by the Drive API (or a MOCK_ sentinel in dev mode).
    google_drive_file_id: str = Field(nullable=False, index=True)

    # Path string, e.g. '2026/07/2026-07-03'
    drive_folder_path: str = Field(nullable=False)

    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # ORM back-reference
    user: Optional["User"] = Relationship(back_populates="file_logs")
