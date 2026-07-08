"""
Chat Relay Endpoints
=====================
Local workspace chat — messages are persisted in the DB and polled by clients.

  GET  /api/v1/chat/spaces            — List available chat spaces
  POST /api/v1/chat/send              — Send a message to a space
  GET  /api/v1/chat/history/{id}      — Full history for a space (all users)
  POST /api/v1/chat/webhook           — Public Google Chat event listener
"""

import hashlib
import hmac
import logging
import anyio
import random
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status, UploadFile, File
from sqlmodel import Session, select
from sqlalchemy import asc

from core.config import settings
from core.database import get_session
from models.chatmessage import ChatMessage, MessageDirection
from models.user import User, UserRole
from schemas.chat import (
    ChatHistoryResponse,
    ChatMessageResponse,
    ChatSpaceInfo,
    SendMessageRequest,
    WebhookAck,
    WebhookEvent,
)
from services.auth import get_current_user, require_role
from services.google_chat import chat_client
from utils.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Static space registry
# ---------------------------------------------------------------------------

SPACES: List[ChatSpaceInfo] = [
    ChatSpaceInfo(id="spaces/general_sync",      label="#general-sync"),
    ChatSpaceInfo(id="spaces/hr_room",           label="#hr-announcements"),
    ChatSpaceInfo(id="spaces/engineering_sync",  label="#engineering-sync"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_sender_name(user_id: int, session: Session) -> Optional[str]:
    """Return the email-prefix of the user, e.g. 'alice' for 'alice@corp.com'."""
    user = session.get(User, user_id)
    if user:
        return user.company_email.split("@")[0]
    return f"user_{user_id}"


def _build_response(msg: ChatMessage, session: Session) -> ChatMessageResponse:
    """Build a ChatMessageResponse with sender_name resolved."""
    data = {
        "id": msg.id,
        "user_id": msg.user_id,
        "sender_name": _resolve_sender_name(msg.user_id, session),
        "space_id": msg.space_id,
        "message_text": msg.message_text,
        "direction": msg.direction,
        "timestamp": msg.timestamp,
    }
    return ChatMessageResponse(**data)


def _verify_webhook_signature(
    raw_body: bytes,
    signature_header: Optional[str],
) -> bool:
    secret: Optional[str] = settings.GOOGLE_CHAT_WEBHOOK_SECRET
    if not secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning("Webhook received with missing or malformed signature header.")
        return False
    expected_sig = signature_header[len("sha256="):]
    computed_sig = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(computed_sig, expected_sig)


def _verify_pubsub_jwt(authorization: Optional[str]) -> bool:
    if settings.DEV_MODE:
        return True
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Pub/Sub webhook missing or malformed Authorization header.")
        return False
    token = authorization.split(" ")[1]
    from google.oauth2 import id_token
    from google.auth.transport import requests
    try:
        id_token.verify_oauth2_token(token, requests.Request())
        return True
    except Exception as exc:
        logger.error("Pub/Sub JWT verification failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/spaces",
    response_model=List[ChatSpaceInfo],
    summary="List available chat spaces",
)
def list_spaces(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
):
    """Return the static list of workspace chat spaces."""
    return SPACES


@router.post(
    "/send",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message to a workspace space",
)
def send_message(
    payload: SendMessageRequest,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
    _rate_limit=Depends(rate_limit(60, 60)),
):
    """
    Persist a message from the current user into the given space.
    All participants polling that space will see it immediately.
    """
    # Validate space_id is a known space
    known_ids = {s.id for s in SPACES}
    if payload.space_id not in known_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown space_id '{payload.space_id}'. Use GET /chat/spaces to list valid spaces.",
        )

    chat_msg = ChatMessage(
        user_id=current_user.id,
        space_id=payload.space_id,
        message_text=payload.message_text,
        direction=MessageDirection.OUTBOUND,
        timestamp=datetime.utcnow(),
    )
    session.add(chat_msg)
    session.commit()
    session.refresh(chat_msg)

    # Best-effort Google Chat relay (no-op in mock mode)
    result = chat_client.send_message_to_google_chat(
        space_id=payload.space_id,
        text=payload.message_text,
    )
    if result.get("error"):
        logger.info("Google Chat relay skipped (mock mode): %s", result["error"])

    return _build_response(chat_msg, session)


@router.get(
    "/history/{space_id:path}",
    response_model=ChatHistoryResponse,
    summary="Retrieve full chat history for a space (all users)",
)
def get_chat_history(
    space_id: str,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Return ALL messages for the given space sorted chronologically.
    Messages from ALL users are returned — this enables the local workspace
    chat experience where every participant sees the shared conversation.
    """
    statement = (
        select(ChatMessage)
        .where(ChatMessage.space_id == space_id)
        .order_by(asc(ChatMessage.timestamp))
    )
    messages = session.exec(statement).all()

    return ChatHistoryResponse(
        space_id=space_id,
        total=len(messages),
        messages=[_build_response(m, session) for m in messages],
    )


@router.post(
    "/webhook",
    response_model=WebhookAck,
    status_code=status.HTTP_200_OK,
    summary="Google Chat event webhook listener (public)",
)
async def chat_webhook(
    request: Request,
    session: Session = Depends(get_session),
    authorization: Optional[str] = Header(default=None),
    x_goog_signature: Optional[str] = Header(
        default=None,
        alias="X-Goog-Signature",
    ),
):
    if not _verify_pubsub_jwt(authorization):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pub/Sub JWT verification failed.",
        )

    raw_body = await request.body()

    if settings.GOOGLE_CHAT_WEBHOOK_SECRET and not _verify_webhook_signature(raw_body, x_goog_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature verification failed.",
        )

    try:
        import json as _json
        body_dict = _json.loads(raw_body)
        event = WebhookEvent.model_validate(body_dict)
    except Exception as exc:
        logger.error("Failed to parse webhook payload: %s", exc)
        return WebhookAck(status="error", detail="Malformed JSON payload.")

    if event.type != "MESSAGE":
        return WebhookAck(status="ok", detail=f"Event type '{event.type}' acknowledged.")

    message_data: dict = event.message or {}
    space_data:   dict = event.space or {}

    message_text: str = message_data.get("text", "").strip()
    space_id: str     = space_data.get("name", "").strip()
    sender: dict      = message_data.get("sender", {})
    sender_email: str = sender.get("email", "").strip()
    message_name: str = message_data.get("name", "").strip()

    if not message_text or not space_id:
        return WebhookAck(status="ok", detail="Empty message or space — skipped.")

    if message_name:
        def get_existing(sess: Session):
            return sess.exec(
                select(ChatMessage).where(ChatMessage.google_message_name == message_name)
            ).first()
        existing = await anyio.to_thread.run_sync(get_existing, session)
        if existing:
            return WebhookAck(status="ok", detail="Duplicate event ignored.")

    resolved_user_id: int = 0
    if sender_email:
        def get_user(sess: Session):
            stmt = select(User).where(User.company_email == sender_email)
            return sess.exec(stmt).first()
        local_user = await anyio.to_thread.run_sync(get_user, session)
        if local_user:
            resolved_user_id = local_user.id

    def save_message(sess: Session) -> ChatMessage:
        inbound_msg = ChatMessage(
            user_id=resolved_user_id,
            space_id=space_id,
            message_text=message_text,
            direction=MessageDirection.INBOUND,
            timestamp=datetime.utcnow(),
            google_message_name=message_name or None,
        )
        sess.add(inbound_msg)
        sess.commit()
        sess.refresh(inbound_msg)
        return inbound_msg

    await anyio.to_thread.run_sync(save_message, session)
    return WebhookAck(status="ok", detail="Message stored.")


@router.post(
    "/upload-local",
    summary="Upload a file locally to the chat server",
)
async def upload_local_file(
    file: UploadFile = File(..., description="Binary file to upload locally."),
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
):
    """
    Save the uploaded file locally in the static/uploads folder
    and return the local URL to access it.
    """
    import os
    import shutil
    import re
    
    # Resolve absolute path for static/uploads
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(base_dir, "static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Sanitize the filename
    safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename or "file")
    
    # Avoid collisions
    file_path = os.path.join(upload_dir, safe_name)
    base_name, ext = os.path.splitext(safe_name)
    counter = 1
    while os.path.exists(file_path):
        safe_name = f"{base_name}_{counter}{ext}"
        file_path = os.path.join(upload_dir, safe_name)
        counter += 1
        
    # Write to local disk
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    local_url = f"http://localhost:8000/static/uploads/{safe_name}"
    return {
        "file_name": safe_name,
        "url": local_url
    }
