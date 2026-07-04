from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from enum import Enum

if TYPE_CHECKING:
    from .user import User


class MessageDirection(str, Enum):
    OUTBOUND = "outbound"  # Sent from our app → Google Chat
    INBOUND  = "inbound"   # Received from Google Chat → our app


class ChatMessage(SQLModel, table=True):
    """
    Persists every message that passes through the Chat relay engine.

    Fields
    ------
    id           : Auto-incrementing primary key.
    user_id      : FK → user.id. For outbound messages this is the sender;
                   for inbound messages it is the resolved local user
                   matching the Google Chat sender email.
    space_id     : Google Chat Space/Room identifier (e.g. 'spaces/XXXXX').
    message_text : Full text content of the message (stored as TEXT).
    direction    : 'outbound' (app → Chat) or 'inbound' (Chat → app).
    timestamp    : UTC datetime when the record was created.
    """

    __tablename__ = "chatmessage"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="user.id", index=True, nullable=False)

    # Google Chat space identifier, e.g. "spaces/AAABBBCCC"
    space_id: str = Field(nullable=False, index=True)

    # Full message body — TEXT to avoid any length truncation.
    message_text: str = Field(sa_column=Column(Text, nullable=False))

    direction: MessageDirection = Field(nullable=False, index=True)

    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Unique Google Chat message resource name for idempotency and deduplication
    google_message_name: Optional[str] = Field(
        default=None,
        index=True,
        nullable=True,
        sa_column_kwargs={"unique": True}
    )

    # ORM back-reference to the owning user.
    user: Optional["User"] = Relationship(back_populates="chat_messages")
