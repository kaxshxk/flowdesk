from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from datetime import datetime, timedelta
import pytz
from sqlalchemy import and_, func

from core.database import get_session
from services.auth import require_role, get_current_user
from models.user import User, UserRole
from models.timelog import TimeLog
from schemas.time import (
    TimeLogCreate, 
    TimeLogResponse, 
    TimeStatusResponse, 
    TimeStatsResponse,
    HRTimeStatsResponse
)

router = APIRouter(prefix="/api/v1/time", tags=["time"])


def get_week_range(dt: datetime) -> tuple[datetime, datetime]:
    """Get the start and end of the week (Monday to Sunday) for a given date."""
    # Convert to UTC if timezone aware, otherwise assume UTC
    if dt.tzinfo:
        dt = dt.astimezone(pytz.UTC)
    else:
        dt = pytz.utc.localize(dt)
    
    # Calculate start of week (Monday)
    start_of_week = dt - timedelta(days=dt.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate end of week (Sunday)
    end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    return start_of_week, end_of_week


def get_month_range(dt: datetime) -> tuple[datetime, datetime]:
    """Get the start and end of the month for a given date."""
    # Convert to UTC if timezone aware, otherwise assume UTC
    if dt.tzinfo:
        dt = dt.astimezone(pytz.UTC)
    else:
        dt = pytz.utc.localize(dt)
    
    # Calculate start of month
    start_of_month = dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate end of month
    if start_of_month.month == 12:
        end_of_month = start_of_month.replace(
            year=start_of_month.year + 1, 
            month=1, 
            day=1,
            hour=23, 
            minute=59, 
            second=59
        ) - timedelta(microseconds=1)
    else:
        end_of_month = start_of_month.replace(
            month=start_of_month.month + 1, 
            day=1,
            hour=23, 
            minute=59, 
            second=59
        ) - timedelta(microseconds=1)
    
    return start_of_month, end_of_month


def calculate_total_hours(
    session: Session, 
    user_id: int, 
    start_date: datetime, 
    end_date: datetime
) -> float:
    """Calculate total hours worked by a user within a date range."""
    statement = select(TimeLog).where(
        and_(
            TimeLog.user_id == user_id,
            TimeLog.clock_in >= start_date,
            TimeLog.clock_in <= end_date,
            TimeLog.clock_out.isnot(None)
        )
    )
    
    time_logs = session.exec(statement).all()
    
    total_seconds = 0
    for log in time_logs:
        if log.clock_out:
            duration = log.clock_out - log.clock_in
            total_seconds += duration.total_seconds()
    
    # Convert seconds to hours
    return round(total_seconds / 3600, 2)


@router.get("/status", response_model=TimeStatusResponse)
def get_time_status(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Check if the current user is clocked in.
    """
    statement = select(TimeLog).where(
        and_(
            TimeLog.user_id == current_user.id,
            TimeLog.clock_out.is_(None)
        )
    )
    active_log = session.exec(statement).first()
    
    if active_log:
        return TimeStatusResponse(
            is_clocked_in=True,
            last_clock_in=active_log.clock_in
        )
    else:
        return TimeStatusResponse(is_clocked_in=False)


@router.post("/clock-in", response_model=TimeLogResponse, status_code=status.HTTP_201_CREATED)
def clock_in(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Clock in the current user.
    """
    # Check if user is already clocked in
    statement = select(TimeLog).where(
        and_(
            TimeLog.user_id == current_user.id,
            TimeLog.clock_out.is_(None)
        )
    )
    active_log = session.exec(statement).first()
    
    if active_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already clocked in"
        )
    
    # Create new time log
    time_log = TimeLog(user_id=current_user.id)
    session.add(time_log)
    session.commit()
    session.refresh(time_log)
    
    return TimeLogResponse(
        id=time_log.id,
        user_id=time_log.user_id,
        clock_in=time_log.clock_in,
        clock_out=time_log.clock_out,
        created_at=time_log.created_at
    )


@router.post("/clock-out", response_model=TimeLogResponse)
def clock_out(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Clock out the current user.
    """
    # Find active time log
    statement = select(TimeLog).where(
        and_(
            TimeLog.user_id == current_user.id,
            TimeLog.clock_out.is_(None)
        )
    )
    active_log = session.exec(statement).first()
    
    if not active_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not clocked in"
        )
    
    # Update clock out time
    active_log.clock_out = datetime.utcnow()
    session.add(active_log)
    session.commit()
    session.refresh(active_log)
    
    return TimeLogResponse(
        id=active_log.id,
        user_id=active_log.user_id,
        clock_in=active_log.clock_in,
        clock_out=active_log.clock_out,
        created_at=active_log.created_at
    )


@router.get("/stats", response_model=TimeStatsResponse)
def get_time_stats(
    current_user: User = Depends(require_role([UserRole.EMPLOYEE, UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Get weekly and monthly time stats for the current user.
    """
    now = datetime.utcnow()
    
    # Get week range
    week_start, week_end = get_week_range(now)
    
    # Get month range
    month_start, month_end = get_month_range(now)
    
    # Calculate weekly hours
    weekly_hours = calculate_total_hours(session, current_user.id, week_start, week_end)
    
    # Calculate monthly hours
    monthly_hours = calculate_total_hours(session, current_user.id, month_start, month_end)
    
    return TimeStatsResponse(
        weekly_hours=weekly_hours,
        monthly_hours=monthly_hours
    )


# HR-only endpoint
@router.get("/stats/{user_id}", response_model=HRTimeStatsResponse)
def get_user_time_stats(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.HR])),
    session: Session = Depends(get_session)
):
    """
    Get weekly and monthly time stats for a specific user (HR only).
    """
    # Check if user exists
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    now = datetime.utcnow()
    
    # Get week range
    week_start, week_end = get_week_range(now)
    
    # Get month range
    month_start, month_end = get_month_range(now)
    
    # Calculate weekly hours
    weekly_hours = calculate_total_hours(session, user_id, week_start, week_end)
    
    # Calculate monthly hours
    monthly_hours = calculate_total_hours(session, user_id, month_start, month_end)
    
    return HRTimeStatsResponse(
        user_id=user_id,
        weekly_hours=weekly_hours,
        monthly_hours=monthly_hours
    )