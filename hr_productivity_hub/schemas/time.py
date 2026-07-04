from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TimeLogCreate(BaseModel):
    pass  # No fields needed as clock_in is set automatically


class TimeLogResponse(BaseModel):
    id: int
    user_id: int
    clock_in: datetime
    clock_out: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TimeStatusResponse(BaseModel):
    is_clocked_in: bool
    last_clock_in: Optional[datetime] = None


class TimeStatsResponse(BaseModel):
    weekly_hours: float
    monthly_hours: float


class HRTimeStatsResponse(BaseModel):
    user_id: int
    weekly_hours: float
    monthly_hours: float