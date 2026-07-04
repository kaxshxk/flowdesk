from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List, Any, Dict

from models.chatmessage import MessageDirection


# ---------------------------------------------------------------------------
# Inbound schemas (request payloads)
# ---------------------------------------------------------------------------

class SendMessageRequest(BaseModel):
    """
    Payload for POST /api/v1/chat/send.

    Validation rules
    ----------------
    - space_id must not be blank.
    - message_text must not be blank or whitespace-only.
    """

    space_id: str
    message_text: str

    @field_validator("space_id")
    @classmethod
    def space_id_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("space_id must not be empty.")
        return v.strip()

    @field_validator("message_text")
    @classmethod
    def message_text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message_text must not be empty or whitespace-only.")
        return v.strip()


class WebhookEvent(BaseModel):
    """
    Top-level schema for a Google Chat event callback (Pub/Sub or direct push).

    Google Chat sends events with a `type` field and nested `message` / `space`
    objects.  We only process 'MESSAGE' type events; all others are acknowledged
    and ignored.

    Reference:
        https://developers.google.com/chat/api/reference/rest/v1/EventType
    """

    type: Optional[str] = None          # e.g. "MESSAGE", "ADDED_TO_SPACE"
    message: Optional[Dict[str, Any]] = None
    space: Optional[Dict[str, Any]] = None
    # Accept any extra fields Google may send without breaking validation.
    model_config = {"extra": "allow"}


# ---------------------------------------------------------------------------
# Outbound schemas (response payloads)
# ---------------------------------------------------------------------------

class ChatMessageResponse(BaseModel):
    """
    Serialised representation of a single ChatMessage DB record.
    """

    id: int
    user_id: int
    space_id: str
    message_text: str
    direction: MessageDirection
    timestamp: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    """
    Paginated chat history for a given space.
    """

    space_id: str
    total: int
    messages: List[ChatMessageResponse]


class WebhookAck(BaseModel):
    """
    Minimal acknowledgement returned to Google Chat after processing a webhook.
    Google requires a 200 response; the body is informational only.
    """

    status: str
    detail: Optional[str] = None
