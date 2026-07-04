"""
Chat Relay Endpoints
=====================
Three endpoints forming the Google Chat sync layer:

  POST /api/v1/chat/send          — Authenticated send (outbound relay)
  GET  /api/v1/chat/history/{id}  — Authenticated space history read
  POST /api/v1/chat/webhook        — Public Google Chat event listener
"""

import hashlib
import hmac
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlmodel import Session, select
from sqlalchemy import asc

from core.config import settings
from core.database import get_session
from models.chatmessage import ChatMessage, MessageDirection
from models.user import User, UserRole
from schemas.chat import (
    ChatHistoryResponse,
    ChatMessageResponse,
    SendMessageRequest,
    WebhookAck,
    WebhookEvent,
)
from services.auth import get_current_user, require_role
from services.google_chat import chat_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verify_webhook_signature(
    raw_body: bytes,
    signature_header: Optional[str],
) -> bool:
    """
    Optionally verify an HMAC-SHA256 signature on incoming webhook payloads.

    Google Cloud Pub/Sub does not natively sign push messages with HMAC,
    but if a reverse-proxy or Cloud Function layer adds one, this validates it.

    The header format expected: "sha256=<hex_digest>"

    If GOOGLE_CHAT_WEBHOOK_SECRET is not set, all requests pass through —
    allowing development without signature verification while keeping
    the hook for production hardening.
    """
    secret: Optional[str] = settings.GOOGLE_CHAT_WEBHOOK_SECRET
    if not secret:
        return True  # Verification disabled — accept all.

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
    """
    Verify the Pub/Sub OIDC token in the Authorization header.
    If settings.DEV_MODE is True, verification is bypassed.
    """
    if settings.DEV_MODE:
        return True

    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Pub/Sub webhook missing or malformed Authorization header.")
        return False

    token = authorization.split(" ")[1]
    from google.oauth2 import id_token
    from google.auth.transport import requests

    try:
        # Verify OAuth ID token. Passing None for audience will verify the token signature
        # and validate that it is a Google-signed account token.
        id_token.verify_oauth2_token(token, requests.Request())
        return True
    except Exception as exc:
        logger.error("Pub/Sub JWT verification failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/send",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message to a Google Chat space",
)
async def send_message(
    payload: SendMessageRequest,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Relay a message to a Google Chat space and persist the outbound record.

    Steps
    -----
    1. Validate the payload (non-blank space_id and message_text).
    2. Persist an `outbound` ChatMessage record to the database.
    3. Dispatch the message to Google Chat (non-blocking on failure —
       the DB record is always saved regardless of dispatch outcome).
    4. Return the persisted record.
    """
    # --- Persist outbound record first -------------------------------------
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

    # --- Dispatch to Google Chat (best-effort) -----------------------------
    result = chat_client.send_message_to_google_chat(
        space_id=payload.space_id,
        text=payload.message_text,
    )
    if result.get("error"):
        logger.error(
            "Chat dispatch failed for space '%s': %s",
            payload.space_id,
            result["error"],
        )
    # Dispatch outcome is informational — never raises an HTTP error.

    return ChatMessageResponse.model_validate(chat_msg)


@router.get(
    "/history/{space_id:path}",
    response_model=ChatHistoryResponse,
    summary="Retrieve chat history for a specific space",
)
async def get_chat_history(
    space_id: str,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Return all messages for the given *space_id*, sorted by timestamp
    ascending so the UI can render them in chronological order.

    The `{space_id:path}` converter allows slashes in the space identifier
    (e.g. `spaces/AAABBB`) without URL-encoding.
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
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
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
        description="Optional HMAC-SHA256 signature added by a proxy layer.",
    ),
):
    """
    Public listener for Google Chat / Pub/Sub push events.

    Security
    --------
    - Verifies the Google Pub/Sub OIDC JWT token in Authorization header.
    - If GOOGLE_CHAT_WEBHOOK_SECRET is set, also verifies the `X-Goog-Signature` header.
    """
    # --- Verify Pub/Sub JWT OIDC token ------------------------------------
    if not _verify_pubsub_jwt(authorization):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pub/Sub JWT verification failed.",
        )

    # --- Read raw body for optional legacy signature verification --------
    raw_body = await request.body()

    if settings.GOOGLE_CHAT_WEBHOOK_SECRET and not _verify_webhook_signature(raw_body, x_goog_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature verification failed.",
        )

    # --- Parse event payload -----------------------------------------------
    try:
        import json as _json
        body_dict = _json.loads(raw_body)
        event = WebhookEvent.model_validate(body_dict)
    except Exception as exc:
        logger.error("Failed to parse webhook payload: %s", exc)
        return WebhookAck(status="error", detail="Malformed JSON payload.")

    # --- Ignore non-MESSAGE events -----------------------------------------
    if event.type != "MESSAGE":
        logger.info("Received Chat event type '%s' — acknowledged, not stored.", event.type)
        return WebhookAck(status="ok", detail=f"Event type '{event.type}' acknowledged.")

    # --- Extract message fields -------------------------------------------
    message_data: dict = event.message or {}
    space_data:   dict = event.space or {}

    message_text: str = message_data.get("text", "").strip()
    space_id: str     = space_data.get("name", "").strip()
    sender: dict      = message_data.get("sender", {})
    sender_email: str = sender.get("email", "").strip()
    message_name: str = message_data.get("name", "").strip()

    if not message_text or not space_id:
        logger.warning(
            "Webhook MESSAGE event missing 'text' or 'space.name'. Skipping."
        )
        return WebhookAck(status="ok", detail="Empty message or space — skipped.")

    # --- Idempotency/Deduplication check ----------------------------------
    if message_name:
        existing = session.exec(
            select(ChatMessage).where(ChatMessage.google_message_name == message_name)
        ).first()
        if existing:
            logger.info("Duplicate webhook event received for message '%s'. Acknowledging with 200.", message_name)
            return WebhookAck(status="ok", detail="Duplicate event ignored.")

    # --- Resolve sender to a local User record ----------------------------
    resolved_user_id: int = 0  # Fallback sentinel for unknown senders.
    if sender_email:
        stmt = select(User).where(User.company_email == sender_email)
        local_user: Optional[User] = session.exec(stmt).first()
        if local_user:
            resolved_user_id = local_user.id
        else:
            logger.warning(
                "Webhook: sender email '%s' not found in local users. "
                "Storing with user_id=0.",
                sender_email,
            )

    # --- Persist inbound message ------------------------------------------
    inbound_msg = ChatMessage(
        user_id=resolved_user_id,
        space_id=space_id,
        message_text=message_text,
        direction=MessageDirection.INBOUND,
        timestamp=datetime.utcnow(),
        google_message_name=message_name or None,
    )
    session.add(inbound_msg)
    session.commit()

    logger.info(
        "Inbound message from '%s' in space '%s' stored (id=%s, name=%s).",
        sender_email or "unknown",
        space_id,
        inbound_msg.id,
        message_name,
    )

    return WebhookAck(status="ok", detail="Message stored.")
