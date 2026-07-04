from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text
from typing import Optional, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from .user import User


class TaskLog(SQLModel, table=True):
    """
    Stores a single-line task logged by an employee.
    Each entry is cryptographically signed with an HMAC-SHA256 hash
    and optionally synced to a Google Sheet row.
    """

    __tablename__ = "tasklog"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="user.id", index=True, nullable=False)

    # Store as TEXT to avoid VARCHAR(n) length constraints on task descriptions
    description: str = Field(sa_column=Column(Text, nullable=False))

    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Hex-encoded HMAC-SHA256 signature
    hmac_hash: str = Field(nullable=False)

    # ID of the Google Sheet this row was appended to (None if sheets unavailable)
    google_sheet_id: Optional[str] = Field(default=None, nullable=True)

    # ORM relationship back to the owning user
    user: Optional["User"] = Relationship(back_populates="task_logs")
