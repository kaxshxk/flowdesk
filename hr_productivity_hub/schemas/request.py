from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date, datetime
from typing import Optional, List

from models.leavewfhrequest import RequestType, RequestStatus


# ---------------------------------------------------------------------------
# Inbound schemas (requests)
# ---------------------------------------------------------------------------

class RequestCreate(BaseModel):
    """
    Payload for submitting a new leave / WFH request.

    Validation rules
    ----------------
    - request_type must be 'leave' or 'wfh'.
    - end_date must be >= start_date.
    - employee_note is optional; no length constraint (employees may need space).
    """

    request_type: RequestType
    start_date: date
    end_date: date
    employee_note: Optional[str] = None

    @model_validator(mode="after")
    def end_date_not_before_start(self) -> "RequestCreate":
        if self.end_date < self.start_date:
            raise ValueError(
                f"end_date ({self.end_date}) must be greater than or equal to "
                f"start_date ({self.start_date})."
            )
        return self


class RequestReview(BaseModel):
    """
    Payload for an HR user to process (approve / decline) a request.

    Validation rules
    ----------------
    - status must be 'approved' or 'declined' (HR cannot set back to 'pending').
    - hr_note is optional but strictly capped at 300 characters.
    - updated_request_type is optional; lets HR switch 'leave' → 'wfh' or vice versa.
    - updated_end_date is optional; lets HR shorten the approved duration.
      Must not be earlier than the request's start_date — enforced at endpoint level
      where the existing record is accessible.
    """

    status: RequestStatus = Field(
        ...,
        description="New status: 'approved' or 'declined'.",
    )
    hr_note: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Optional HR note, maximum 300 characters.",
    )
    updated_request_type: Optional[RequestType] = Field(
        default=None,
        description="Override the request type (e.g. switch leave to wfh).",
    )
    updated_end_date: Optional[date] = Field(
        default=None,
        description="Override / shorten the end date.",
    )

    @field_validator("status")
    @classmethod
    def status_must_be_terminal(cls, v: RequestStatus) -> RequestStatus:
        if v == RequestStatus.PENDING:
            raise ValueError(
                "HR cannot set a request back to 'pending'. "
                "Choose 'approved' or 'declined'."
            )
        return v

    @field_validator("hr_note")
    @classmethod
    def strip_hr_note(cls, v: Optional[str]) -> Optional[str]:
        """Strip surrounding whitespace; return None for blank strings."""
        if v is not None:
            v = v.strip()
            return v if v else None
        return v


# ---------------------------------------------------------------------------
# Outbound schemas (responses)
# ---------------------------------------------------------------------------

class RequestResponse(BaseModel):
    """
    Full representation of a LeaveWFHRequest record.
    """

    id: int
    user_id: int
    request_type: RequestType
    start_date: date
    end_date: date
    employee_note: Optional[str] = None
    status: RequestStatus
    hr_note: Optional[str] = None
    reviewed_by_hr_id: Optional[int] = None
    updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class RequestListResponse(BaseModel):
    """
    Paginated list wrapper for request records.
    """

    total: int
    requests: List[RequestResponse]
