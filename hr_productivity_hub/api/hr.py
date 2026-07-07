from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from sqlalchemy import desc
from typing import List, Optional
import re
from pydantic import BaseModel, validator
from datetime import datetime

from core.config import settings
from core.database import get_session
from services.auth import require_role
from utils.rate_limit import rate_limit
from models.user import User, AccessWhitelist, UserRole
from models.tasklog import TaskLog
from models.filelog import FileLog
from models.leavewfhrequest import LeaveWFHRequest, RequestStatus
from models.timelog import TimeLog
from models.alertlog import AlertLog
from schemas.task import TaskResponse, TaskListResponse
from schemas.file import FileLogResponse, FileListResponse
from schemas.request import RequestResponse, RequestListResponse, RequestReview
from schemas.alert import AlertListResponse, AlertLogResponse, IntegrityTriggerResponse
from schemas.analytics import HRDashboardSummary, PayrollReportResponse, PayrollReportItem
from schemas.time import TimeLogResponse, HRTimeStatsResponse
from services.integrity_worker import verify_sheet_integrity
from fastapi.responses import StreamingResponse
import io
import csv
from datetime import date

router = APIRouter(prefix="/api/v1/hr", tags=["hr"])


from utils.validation import is_valid_email


# Validation schemas
class WhitelistCreate(BaseModel):
    allowed_email: str
    assigned_role: UserRole
    
    @validator('allowed_email')
    def validate_email(cls, v):
        if not is_valid_email(v):
            raise ValueError('Invalid email format')
        return v


class WhitelistResponse(BaseModel):
    id: int
    allowed_email: str
    assigned_role: UserRole
    created_by_hr_id: Optional[int] = None
    created_at: str


class UserResponse(BaseModel):
    id: int
    company_email: str
    role: UserRole
    is_active: bool
    created_at: str


class UserRoleUpdate(BaseModel):
    new_role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


# HR Whitelist Management Endpoints
@router.post("/whitelist", response_model=WhitelistResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit(20, 60))])
def create_whitelist_entry(
    whitelist_data: WhitelistCreate,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Add a new email to the access whitelist.
    Only HR users can access this endpoint.
    """
    # Check if email already exists in whitelist
    statement = select(AccessWhitelist).where(AccessWhitelist.allowed_email == whitelist_data.allowed_email)
    existing_entry = session.exec(statement).first()
    
    if existing_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists in whitelist"
        )
    
    # Create new whitelist entry
    new_entry = AccessWhitelist(
        allowed_email=whitelist_data.allowed_email,
        assigned_role=whitelist_data.assigned_role,
        created_by_hr_id=current_user.id
    )
    
    session.add(new_entry)
    session.commit()
    session.refresh(new_entry)
    
    return WhitelistResponse(
        id=new_entry.id,
        allowed_email=new_entry.allowed_email,
        assigned_role=new_entry.assigned_role,
        created_by_hr_id=new_entry.created_by_hr_id,
        created_at=new_entry.created_at.isoformat()
    )


@router.get("/whitelist", response_model=List[WhitelistResponse])
def get_whitelist(
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Get all entries in the access whitelist.
    Only HR users can access this endpoint.
    """
    statement = select(AccessWhitelist)
    whitelist_entries = session.exec(statement).all()
    
    return [
        WhitelistResponse(
            id=entry.id,
            allowed_email=entry.allowed_email,
            assigned_role=entry.assigned_role,
            created_by_hr_id=entry.created_by_hr_id,
            created_at=entry.created_at.isoformat()
        )
        for entry in whitelist_entries
    ]


@router.delete("/whitelist/{whitelist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_whitelist_entry(
    whitelist_id: int,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Remove an email from the access whitelist.
    Only HR users can access this endpoint.
    """
    whitelist_entry = session.get(AccessWhitelist, whitelist_id)
    
    if not whitelist_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Whitelist entry not found"
        )
    
    session.delete(whitelist_entry)
    session.commit()
    
    return


# HR Employee Roster & Lifecycle Endpoints
@router.get("/employees", response_model=List[UserResponse])
def get_employees(
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Get a consolidated list of all registered accounts.
    Only HR users can access this endpoint.
    """
    statement = select(User)
    users = session.exec(statement).all()
    
    return [
        UserResponse(
            id=user.id,
            company_email=user.company_email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat()
        )
        for user in users
    ]


@router.patch("/users/{user_id}/role", status_code=status.HTTP_200_OK)
def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Update a user's role.
    Only HR users can access this endpoint.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-action security guard: You cannot change your own role."
        )

    target_user = session.get(User, user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if target is an HR user being demoted, and ensure at least one active HR remains
    if target_user.role == UserRole.HR and role_update.new_role != UserRole.HR:
        active_hr_stmt = select(User).where(User.role == UserRole.HR).where(User.is_active == True)
        active_hrs = session.exec(active_hr_stmt).all()
        if len(active_hrs) <= 1 and target_user in active_hrs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security constraint: At least one active HR user must remain in the system."
            )

    # Update user role
    target_user.role = role_update.new_role
    session.add(target_user)
    session.commit()
    session.refresh(target_user)
    
    return {
        "message": "User role updated successfully",
        "user_id": target_user.id,
        "new_role": target_user.role
    }


@router.patch("/users/{user_id}/status", status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Update a user's active status.
    Only HR users can access this endpoint.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-action security guard: You cannot modify your own active status."
        )

    target_user = session.get(User, user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if target is an HR user being deactivated, and ensure at least one active HR remains
    if target_user.role == UserRole.HR and not status_update.is_active:
        active_hr_stmt = select(User).where(User.role == UserRole.HR).where(User.is_active == True)
        active_hrs = session.exec(active_hr_stmt).all()
        if len(active_hrs) <= 1 and target_user in active_hrs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security constraint: At least one active HR user must remain in the system."
            )

    # Update user status
    target_user.is_active = status_update.is_active
    session.add(target_user)
    session.commit()
    session.refresh(target_user)
    
    status_text = "activated" if status_update.is_active else "deactivated"
    
    return {
        "message": f"User {status_text} successfully",
        "user_id": target_user.id,
        "is_active": target_user.is_active
    }


# HR Task Ledger Endpoint
@router.get("/tasks/{user_id}", response_model=TaskListResponse)
def get_user_task_ledger(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Pull the complete task ledger for a specific employee (HR only).

    Returns all TaskLog entries for the given user_id, sorted by
    timestamp descending (most recent first).
    """
    # Verify the target user exists before querying their logs.
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )

    from sqlmodel import func
    total = session.exec(select(func.count(TaskLog.id)).where(TaskLog.user_id == user_id)).one()

    statement = (
        select(TaskLog)
        .where(TaskLog.user_id == user_id)
        .order_by(desc(TaskLog.timestamp))
        .offset(offset)
        .limit(limit)
    )
    tasks = session.exec(statement).all()

    return TaskListResponse(
        total=total,
        tasks=[TaskResponse.model_validate(t) for t in tasks],
    )


# HR File Catalog Endpoint
@router.get("/files/{user_id}", response_model=FileListResponse)
def get_user_file_catalog(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Pull the complete Drive file catalog for a specific employee (HR only).

    Returns all FileLog entries for the given user_id, sorted by
    timestamp descending (most recent first).
    """
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )

    from sqlmodel import func
    total = session.exec(select(func.count(FileLog.id)).where(FileLog.user_id == user_id)).one()

    statement = (
        select(FileLog)
        .where(FileLog.user_id == user_id)
        .order_by(desc(FileLog.timestamp))
        .offset(offset)
        .limit(limit)
    )
    files = session.exec(statement).all()

    return FileListResponse(
        total=total,
        files=[FileLogResponse.model_validate(f) for f in files],
    )


# HR Time stats & logs endpoints for individual employee detail dashboards
@router.get("/time/stats/{user_id}", response_model=HRTimeStatsResponse)
def get_user_time_stats(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Get weekly and monthly time stats for a specific user (HR only).
    """
    from api.time import get_week_range, get_month_range, calculate_total_hours
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )
    
    now = datetime.utcnow()
    week_start, week_end = get_week_range(now)
    month_start, month_end = get_month_range(now)
    
    weekly_hours = calculate_total_hours(session, user_id, week_start, week_end)
    monthly_hours = calculate_total_hours(session, user_id, month_start, month_end)
    
    return HRTimeStatsResponse(
        user_id=user_id,
        weekly_hours=weekly_hours,
        monthly_hours=monthly_hours
    )


@router.get("/time/logs/{user_id}", response_model=List[TimeLogResponse])
def get_user_time_logs(
    user_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Get all time logs for a specific user (HR only).
    """
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )
    
    statement = (
        select(TimeLog)
        .where(TimeLog.user_id == user_id)
        .order_by(desc(TimeLog.clock_in))
        .offset(offset)
        .limit(limit)
    )
    time_logs = session.exec(statement).all()
    return time_logs



# ---------------------------------------------------------------------------
# HR Request Management Endpoints
# ---------------------------------------------------------------------------


@router.get("/requests", response_model=RequestListResponse)
def list_all_requests(
    status_filter: Optional[RequestStatus] = Query(
        default=None,
        alias="status",
        description="Filter by request status: 'pending', 'approved', or 'declined'.",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Return all leave / WFH requests in the system (HR only).

    Optionally filter by status using the `?status=` query parameter,
    e.g. `GET /api/v1/hr/requests?status=pending`.
    Results are sorted by `created_at` descending.
    """
    from sqlmodel import func
    count_stmt = select(func.count(LeaveWFHRequest.id))
    if status_filter is not None:
        count_stmt = count_stmt.where(LeaveWFHRequest.status == status_filter)
    total = session.exec(count_stmt).one()

    statement = select(LeaveWFHRequest).order_by(desc(LeaveWFHRequest.created_at))
    if status_filter is not None:
        statement = statement.where(LeaveWFHRequest.status == status_filter)

    requests = session.exec(statement.offset(offset).limit(limit)).all()

    return RequestListResponse(
        total=total,
        requests=[RequestResponse.model_validate(r) for r in requests],
    )


@router.patch(
    "/requests/{request_id}/review",
    response_model=RequestResponse,
    summary="Approve or decline a leave / WFH request",
    dependencies=[Depends(rate_limit(30, 60))]
)
def review_request(
    request_id: int,
    payload: RequestReview,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Process a leave / WFH request as an HR user (HR only).

    Actions performed
    -----------------
    - Sets `status` to 'approved' or 'declined'.
    - Optionally overrides `request_type` (e.g. switch 'leave' → 'wfh').
    - Optionally overrides `end_date` to shorten the approved duration.
    - Records the reviewing HR user's ID in `reviewed_by_hr_id`.
    - Stamps `updated_at` with the current UTC time.
    - Persists and returns the finalized record.

    Errors
    ------
    - 404 if `request_id` does not exist.
    - 422 if `updated_end_date` is earlier than the request's `start_date`.
    """
    target = session.get(LeaveWFHRequest, request_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with id {request_id} not found.",
        )

    # Validate the optional end-date override against the (potentially
    # unchanged) start_date before writing anything.
    if payload.updated_end_date is not None:
        if payload.updated_end_date < target.start_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"updated_end_date ({payload.updated_end_date}) cannot be "
                    f"earlier than the request's start_date ({target.start_date})."
                ),
            )
        target.end_date = payload.updated_end_date

    # Apply mandatory fields.
    target.status = payload.status
    target.hr_note = payload.hr_note
    target.reviewed_by_hr_id = current_user.id
    target.updated_at = datetime.utcnow()

    # Apply optional overrides.
    if payload.updated_request_type is not None:
        target.request_type = payload.updated_request_type

    session.add(target)
    session.commit()
    session.refresh(target)

    return RequestResponse.model_validate(target)


# ---------------------------------------------------------------------------
# HR Alert & Integrity Auditing Endpoints
# ---------------------------------------------------------------------------


@router.get("/alerts", response_model=AlertListResponse)
def list_alerts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Get a consolidated feed of all alert log entries, sorted by timestamp
    descending (newest first) for real-time security monitoring (HR only).
    """
    from sqlmodel import func
    total = session.exec(select(func.count(AlertLog.id))).one()

    statement = select(AlertLog).order_by(desc(AlertLog.timestamp)).offset(offset).limit(limit)
    alerts = session.exec(statement).all()

    return AlertListResponse(
        total=total,
        alerts=[AlertLogResponse.model_validate(a) for a in alerts],
    )


@router.post("/alerts/{alert_id}/resolve", response_model=AlertLogResponse)
def resolve_alert(
    alert_id: int,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Mark an active security or activity alert as resolved (HR only).
    """
    alert = session.get(AlertLog, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found.",
        )

    alert.resolved = True
    session.add(alert)
    session.commit()
    session.refresh(alert)

    return AlertLogResponse.model_validate(alert)


@router.post("/integrity/trigger/{user_id}", response_model=IntegrityTriggerResponse)
def trigger_integrity_check(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Manually force a background cryptographic integrity check on a specific
    employee's Google Sheets task ledger (HR only).
    """
    # 1. Verify target employee exists
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found.",
        )

    # 2. Determine target Google Sheet ID
    # Try to find the most recent task logged with a valid sheet ID
    stmt = (
        select(TaskLog)
        .where(TaskLog.user_id == user_id)
        .where(TaskLog.google_sheet_id.isnot(None))
        .order_by(desc(TaskLog.timestamp))
    )
    latest_task = session.exec(stmt).first()

    sheet_id = None
    if latest_task:
        sheet_id = latest_task.google_sheet_id
    else:
        # Fallback to configured settings Sheet ID
        sheet_id = settings.FALLBACK_SHEET_ID

    if not sheet_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Google Sheet ID configured or found for this employee.",
        )

    # 3. Perform scan
    try:
        is_authentic = verify_sheet_integrity(user_id=user_id, sheet_id=sheet_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform integrity check due to unexpected error: {exc}",
        )

    # 4. Count newly generated unresolved alerts (if any)
    alert_stmt = (
        select(AlertLog)
        .where(AlertLog.user_id == user_id)
        .where(AlertLog.alert_type == "tamper_detected")
        .where(AlertLog.resolved == False)
    )
    unresolved_issues = len(session.exec(alert_stmt).all())

    if is_authentic:
        return IntegrityTriggerResponse(
            status="success",
            message="Integrity check completed. No tampering or mismatches detected.",
            tamper_detected=False,
            issues_found=0,
        )
    else:
        return IntegrityTriggerResponse(
            status="warning",
            message="Integrity check completed. Tampering or signature mismatches were detected.",
            tamper_detected=True,
            issues_found=unresolved_issues,
        )


# ---------------------------------------------------------------------------
# HR Dashboard & Reporting Endpoints (Phase 10)
# ---------------------------------------------------------------------------


@router.get("/dashboard/summary", response_model=HRDashboardSummary)
def get_dashboard_summary(
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Get a consolidated snapshot of company metrics (HR only).
    """
    # 1. Total active employees
    emp_stmt = select(User).where(User.role == UserRole.EMPLOYEE).where(User.is_active == True)
    total_employees = len(session.exec(emp_stmt).all())

    # 2. Currently clocked in employees
    clocked_stmt = select(TimeLog).where(TimeLog.clock_out.is_(None))
    currently_clocked_in = len(session.exec(clocked_stmt).all())

    # 3. Pending leave requests
    pending_leaves_stmt = select(LeaveWFHRequest).where(LeaveWFHRequest.status == RequestStatus.PENDING)
    pending_leaves_count = len(session.exec(pending_leaves_stmt).all())

    # 4. Unresolved security/activity alerts
    alerts_stmt = select(AlertLog).where(AlertLog.resolved == False)
    unresolved_alerts_count = len(session.exec(alerts_stmt).all())

    return HRDashboardSummary(
        total_employees=total_employees,
        currently_clocked_in=currently_clocked_in,
        pending_leaves_count=pending_leaves_count,
        unresolved_alerts_count=unresolved_alerts_count,
    )


@router.get("/reports/payroll")
def get_payroll_report(
    start_date: Optional[date] = Query(default=None, description="Report start window"),
    end_date: Optional[date] = Query(default=None, description="Report end window"),
    format: Optional[str] = Query(default="json", description="Response format: 'json' or 'csv'"),
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session),
):
    """
    Compile a global payroll and compliance report for all employees (HR only).
    Supports JSON output and downloadable CSV stream.
    """
    # Fetch all employees
    stmt = select(User).where(User.role == UserRole.EMPLOYEE)
    employees = session.exec(stmt).all()

    if not employees:
        return PayrollReportResponse(
            total=0,
            start_date=start_date,
            end_date=end_date,
            records=[],
        )

    emp_ids = [emp.id for emp in employees]

    # Batch Fetch Time Logs
    time_stmt = select(TimeLog).where(TimeLog.user_id.in_(emp_ids)).where(TimeLog.clock_out.isnot(None))
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        time_stmt = time_stmt.where(TimeLog.clock_in >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        time_stmt = time_stmt.where(TimeLog.clock_out <= end_dt)

    time_logs = session.exec(time_stmt).all()
    time_logs_by_user = {}
    for log in time_logs:
        time_logs_by_user.setdefault(log.user_id, []).append(log)

    # Batch Fetch Requests
    req_stmt = select(LeaveWFHRequest).where(LeaveWFHRequest.user_id.in_(emp_ids)).where(LeaveWFHRequest.status == RequestStatus.APPROVED)
    requests = session.exec(req_stmt).all()
    requests_by_user = {}
    for req in requests:
        requests_by_user.setdefault(req.user_id, []).append(req)

    # Batch Fetch Task Logs
    task_stmt = select(TaskLog).where(TaskLog.user_id.in_(emp_ids))
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        task_stmt = task_stmt.where(TaskLog.timestamp >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        task_stmt = task_stmt.where(TaskLog.timestamp <= end_dt)

    task_logs = session.exec(task_stmt).all()
    tasks_count_by_user = {}
    for task in task_logs:
        tasks_count_by_user[task.user_id] = tasks_count_by_user.get(task.user_id, 0) + 1

    records = []

    for emp in employees:
        # A. Total Regular Hours Worked
        emp_time_logs = time_logs_by_user.get(emp.id, [])
        hours_worked = 0.0
        for log in emp_time_logs:
            if log.clock_out:
                duration = log.clock_out - log.clock_in
                hours_worked += duration.total_seconds() / 3600.0

        # B. Count of Approved Leave / WFH days
        emp_requests = requests_by_user.get(emp.id, [])
        leave_days = 0
        wfh_days = 0

        for req in emp_requests:
            # Calculate overlapping days with start_date & end_date query window
            eff_start = max(req.start_date, start_date) if start_date else req.start_date
            eff_end = min(req.end_date, end_date) if end_date else req.end_date

            if eff_end >= eff_start:
                days_count = (eff_end - eff_start).days + 1
                if req.request_type == "leave":
                    leave_days += days_count
                elif req.request_type == "wfh":
                    wfh_days += days_count

        # C. Total Tasks Logged (ledger entries)
        tasks_count = tasks_count_by_user.get(emp.id, 0)

        records.append(
            PayrollReportItem(
                user_id=emp.id,
                company_email=emp.company_email,
                total_hours_worked=round(hours_worked, 2),
                approved_leave_days=leave_days,
                approved_wfh_days=wfh_days,
                tasks_logged_count=tasks_count,
            )
		)

    # Return CSV if requested
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        # Headers
        writer.writerow([
            "Employee ID",
            "Email Address",
            "Total Hours Worked",
            "Approved Leave Days",
            "Approved WFH Days",
            "Tasks Logged"
        ])
        # Rows
        for rec in records:
            writer.writerow([
                rec.user_id,
                rec.company_email,
                rec.total_hours_worked,
                rec.approved_leave_days,
                rec.approved_wfh_days,
                rec.tasks_logged_count
            ])
        output.seek(0)
        filename = f"payroll_report_{start_date or 'all'}_to_{end_date or 'all'}.csv"
        return StreamingResponse(
            io.StringIO(output.getvalue()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # Default to JSON response
    return PayrollReportResponse(
        total=len(records),
        start_date=start_date,
        end_date=end_date,
        records=records,
    )