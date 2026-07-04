from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text
from typing import Optional, TYPE_CHECKING
from datetime import date, datetime
from enum import Enum

if TYPE_CHECKING:
    from .user import User


class RequestType(str, Enum):
    LEAVE = "leave"
    WFH = "wfh"


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DECLINED = "declined"


class LeaveWFHRequest(SQLModel, table=True):
    """
    Tracks employee leave and work-from-home requests through their full
    lifecycle: submission → HR review → approved / declined.

    Two nullable FK columns (user_id and reviewed_by_hr_id) both reference
    the same `user` table.  SQLAlchemy/SQLModel requires explicit
    `foreign_keys` hints when a model has more than one FK pointing at the
    same table — handled via sa_relationship_kwargs on each Relationship.

    Fields
    ------
    id                 : Auto-incrementing primary key.
    user_id            : FK → user.id — the employee who raised the request.
    request_type       : 'leave' or 'wfh'.
    start_date         : Inclusive start date of the request period.
    end_date           : Inclusive end date (>= start_date).
    employee_note      : Optional free-text note from the employee (TEXT, no cap).
    status             : Current workflow status; defaults to 'pending'.
    hr_note            : Optional short note from reviewing HR (max 300 chars).
    reviewed_by_hr_id  : FK → user.id — the HR user who processed the request.
    updated_at         : Timestamp of the last status change (or creation).
    created_at         : Timestamp when the record was first inserted.
    """

    __tablename__ = "leavewfhrequest"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="user.id", index=True, nullable=False)

    request_type: RequestType = Field(nullable=False)

    start_date: date = Field(nullable=False)
    end_date: date = Field(nullable=False)

    # Unlimited text column — employees may need to provide context.
    employee_note: Optional[str] = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
    )

    status: RequestStatus = Field(default=RequestStatus.PENDING, nullable=False, index=True)

    # VARCHAR(300) enforced at both DB and Pydantic layer.
    hr_note: Optional[str] = Field(default=None, max_length=300, nullable=True)

    reviewed_by_hr_id: Optional[int] = Field(
        default=None, foreign_key="user.id", nullable=True
    )

    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False, index=True)

    # ------------------------------------------------------------------
    # ORM relationships
    # Two FK columns reference the same table, so we must specify
    # foreign_keys explicitly on each side.
    # ------------------------------------------------------------------
    employee: Optional["User"] = Relationship(
        back_populates="leave_wfh_requests",
        sa_relationship_kwargs={
            "foreign_keys": "[LeaveWFHRequest.user_id]",
            "lazy": "select",
        },
    )

    reviewed_by: Optional["User"] = Relationship(
        back_populates="reviewed_requests",
        sa_relationship_kwargs={
            "foreign_keys": "[LeaveWFHRequest.reviewed_by_hr_id]",
            "lazy": "select",
        },
    )
