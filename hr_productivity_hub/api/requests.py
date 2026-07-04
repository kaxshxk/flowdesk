"""
Leave & WFH Request Endpoints
==============================
Handles submission and retrieval of leave / work-from-home requests for
both employees (own requests) and HR (all requests + review workflow).
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlmodel import Session, select

from core.database import get_session
from models.leavewfhrequest import LeaveWFHRequest, RequestStatus
from models.user import User, UserRole
from schemas.request import (
    RequestCreate,
    RequestListResponse,
    RequestResponse,
    RequestReview,
)
from services.auth import require_role

router = APIRouter(prefix="/api/v1/requests", tags=["requests"])


# ---------------------------------------------------------------------------
# Employee endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=RequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a leave or WFH request",
)
async def create_request(
    payload: RequestCreate,
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Submit a new leave or WFH request on behalf of the authenticated user.

    - `end_date` must be >= `start_date` (enforced by Pydantic schema).
    - Request is created with `status = 'pending'`.
    - Returns the created record with HTTP 201.
    """
    new_request = LeaveWFHRequest(
        user_id=current_user.id,
        request_type=payload.request_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        employee_note=payload.employee_note,
        status=RequestStatus.PENDING,
    )
    session.add(new_request)
    session.commit()
    session.refresh(new_request)

    return RequestResponse.model_validate(new_request)


@router.get(
    "",
    response_model=RequestListResponse,
    summary="List own leave / WFH requests",
)
async def list_my_requests(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Return all requests submitted by the authenticated user, sorted by
    `created_at` descending (most recent first).
    """
    statement = (
        select(LeaveWFHRequest)
        .where(LeaveWFHRequest.user_id == current_user.id)
        .order_by(desc(LeaveWFHRequest.created_at))
    )
    requests = session.exec(statement).all()

    return RequestListResponse(
        total=len(requests),
        requests=[RequestResponse.model_validate(r) for r in requests],
    )
