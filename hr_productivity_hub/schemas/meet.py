from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List


class MeetCreateRequest(BaseModel):
    """
    Inbound payload to generate a new Google Meet room.
    """

    topic: Optional[str] = Field(
        default="Instant Sync",
        description="Optional summary or topic for the meeting.",
    )
    broadcast_space_id: Optional[str] = Field(
        default=None,
        description="Optional Google Chat space to broadcast the meeting link to.",
    )

    @field_validator("topic")
    @classmethod
    def clean_topic(cls, v: Optional[str]) -> str:
        if v is None or not v.strip():
            return "Instant Sync"
        return v.strip()


class MeetLogResponse(BaseModel):
    """
    Outbound schema for a logged Meet session.
    """

    id: int
    creator_id: int
    meet_url: str
    target_space_id: Optional[str] = None
    topic: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class MeetHistoryResponse(BaseModel):
    """
    Wrapper payload for meet history listings.
    """

    total: int
    meetings: List[MeetLogResponse]
