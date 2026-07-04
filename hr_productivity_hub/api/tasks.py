from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from sqlalchemy import desc
from typing import List
from datetime import datetime

from core.database import get_session
from core.config import settings
from services.auth import require_role
from services.google_sheets import sheets_client
from models.user import User, UserRole
from models.tasklog import TaskLog
from schemas.task import TaskCreate, TaskResponse, TaskListResponse
from utils.security import generate_task_hmac


router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE])),
    session: Session = Depends(get_session),
):
    """
    Log a new task entry for the authenticated employee.

    Steps:
    1. Generate a UTC timestamp for this entry.
    2. Compute an HMAC-SHA256 signature over (user_id, description, timestamp).
    3. Attempt to append the row to the user's Google Sheet (non-blocking).
    4. Persist the record (with signature and sheet reference) to the database.
    5. Return the created record with 201 Created.
    """
    timestamp = datetime.utcnow()
    timestamp_iso = timestamp.isoformat(timespec='seconds') + 'Z'

    # --- HMAC signature -------------------------------------------------
    hmac_hash = generate_task_hmac(
        user_id=current_user.id,
        description=payload.description,
        timestamp=timestamp_iso,
    )

    # --- Google Sheets integration ---------------------------------------
    # TODO: Replace FALLBACK_SHEET_ID with a per-user sheet mapping once
    # the employee → sheet_id lookup table is implemented.
    sheet_id: str = settings.FALLBACK_SHEET_ID or "FALLBACK_NOT_CONFIGURED"
    date_str = timestamp_iso

    sheet_written = sheets_client.append_task_to_sheet(
        sheet_id=sheet_id,
        date_str=date_str,
        task_desc=payload.description,
        hmac_sig=hmac_hash,
    )

    # Record the sheet ID only if the write actually succeeded.
    recorded_sheet_id: str | None = sheet_id if sheet_written else None

    # --- Persist to database --------------------------------------------
    task_log = TaskLog(
        user_id=current_user.id,
        description=payload.description,
        timestamp=timestamp,
        hmac_hash=hmac_hash,
        google_sheet_id=recorded_sheet_id,
    )
    session.add(task_log)
    
    # Trigger real-time task activity alert hook (Phase 9)
    from utils.alerts import log_task_activity_alert
    log_task_activity_alert(user_id=current_user.id, task_desc=payload.description, session=session)

    session.commit()
    session.refresh(task_log)

    return task_log


@router.get("", response_model=TaskListResponse)
def list_my_tasks(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role([UserRole.EMPLOYEE])),
    session: Session = Depends(get_session),
):
    """
    Return tasks logged by the authenticated employee with pagination, sorted by
    timestamp descending (most recent first).
    """
    from sqlmodel import func
    total = session.exec(select(func.count(TaskLog.id)).where(TaskLog.user_id == current_user.id)).one()

    statement = (
        select(TaskLog)
        .where(TaskLog.user_id == current_user.id)
        .order_by(desc(TaskLog.timestamp))
        .offset(offset)
        .limit(limit)
    )
    tasks = session.exec(statement).all()

    return TaskListResponse(
        total=total,
        tasks=[TaskResponse.model_validate(t) for t in tasks],
    )
