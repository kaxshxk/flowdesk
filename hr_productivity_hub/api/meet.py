"""
Meet Provisioning & Notification Endpoints
==========================================
Enables instant video conferencing generation and relay to Google Chat spaces.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select
from sqlalchemy import desc

from core.database import get_session
from models.meetlog import MeetLog
from models.chatmessage import ChatMessage, MessageDirection
from models.user import User, UserRole
from schemas.meet import MeetCreateRequest, MeetLogResponse, MeetHistoryResponse
from services.auth import require_role
from services.google_meet import meet_client
from services.google_chat import chat_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/meet", tags=["meet"])


@router.post(
    "/create",
    response_model=MeetLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an instant Google Meet room",
)
def create_meet_room(
    payload: MeetCreateRequest,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Generate a live Google Meet room link and optionally broadcast it.

    Workflow
    --------
    1. Call the Google Meet Client to provision a Meet link (live or mock).
    2. Write a MeetLog record to the database under the current user's ID.
    3. If `broadcast_space_id` is supplied:
       - Send the meeting URL as a message to Google Chat.
       - Store an outbound `ChatMessage` in the database to maintain consistency.
    4. Return the logged Meet details.
    """
    topic = payload.topic or "Instant Sync"

    # --- 1. Provision Meet Link ----------------------------------------------
    meet_url = meet_client.create_instant_meet_room(topic, delegate_email=current_user.company_email)

    # --- 2. Persist Meet Log -------------------------------------------------
    meet_log = MeetLog(
        creator_id=current_user.id,
        meet_url=meet_url,
        target_space_id=payload.broadcast_space_id,
        topic=topic,
        timestamp=datetime.utcnow(),
    )
    session.add(meet_log)
    session.commit()
    session.refresh(meet_log)

    # --- 3. Optional Google Chat Broadcast ------------------------------------
    if payload.broadcast_space_id:
        space_id = payload.broadcast_space_id
        message_text = f"Join the meeting now: {meet_url}"

        # Dispatch external message via Google Chat client
        dispatch_result = chat_client.send_message_to_google_chat(
            space_id=space_id,
            text=message_text,
        )

        if dispatch_result.get("error"):
            logger.error(
                "Meet broadcast failed for space '%s': %s",
                space_id,
                dispatch_result["error"],
            )

        # Log the broadcast message locally in ChatMessage table for auditing/history
        chat_msg = ChatMessage(
            user_id=current_user.id,
            space_id=space_id,
            message_text=message_text,
            direction=MessageDirection.OUTBOUND,
            timestamp=datetime.utcnow(),
        )
        session.add(chat_msg)
        session.commit()

    return MeetLogResponse.model_validate(meet_log)


@router.get(
    "/history",
    response_model=MeetHistoryResponse,
    summary="List all generated Meet links relevant to the user",
)
def list_meet_history(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Return all Meet link generations created by the authenticated employee/HR,
    sorted by timestamp descending (most recent first).
    """
    statement = (
        select(MeetLog)
        .where(MeetLog.creator_id == current_user.id)
        .order_by(desc(MeetLog.timestamp))
    )
    meetings = session.exec(statement).all()

    return MeetHistoryResponse(
        total=len(meetings),
        meetings=[MeetLogResponse.model_validate(m) for m in meetings],
    )
