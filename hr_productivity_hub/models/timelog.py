from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
from .user import User


class TimeLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    clock_in: datetime = Field(default_factory=datetime.utcnow)
    clock_out: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship to user
    user: "User" = Relationship(back_populates="time_logs")


# Add relationship to User model
User.time_logs = Relationship(back_populates="user")