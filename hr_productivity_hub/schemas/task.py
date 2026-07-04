from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List


class TaskCreate(BaseModel):
    """
    Inbound payload for creating a task log entry.

    Validation rules:
    - description must not be empty or whitespace-only.
    - description is capped at 500 characters to keep entries single-purpose.
    """

    description: str

    @field_validator("description")
    @classmethod
    def description_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("description must not be empty or contain only whitespace")
        if len(stripped) > 500:
            raise ValueError("description must be 500 characters or fewer")
        return stripped


class TaskResponse(BaseModel):
    """
    Outbound representation of a single TaskLog record.
    timestamp is serialized as an ISO-8601 string for consistent API contracts.
    """

    id: int
    user_id: int
    description: str
    timestamp: datetime
    hmac_hash: str
    google_sheet_id: Optional[str] = None

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    """
    Wrapper for paginated / full task list responses, including a total count.
    """

    total: int
    tasks: List[TaskResponse]
