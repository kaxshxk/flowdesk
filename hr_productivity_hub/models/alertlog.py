from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from enum import Enum

if TYPE_CHECKING:
    from .user import User


class AlertType(str, Enum):
    TAMPER_DETECTED = "tamper_detected"
    FILE_UPLOADED = "file_uploaded"
    TASK_LOGGED = "task_logged"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertLog(SQLModel, table=True):
    """
    Tracks security alerts, system actions, and database/sheet integrity warnings.
    """

    __tablename__ = "alertlog"

    id: Optional[int] = Field(default=None, primary_key=True)

    # The employee involved in the event causing the alert
    user_id: int = Field(foreign_key="user.id", index=True, nullable=False)

    alert_type: AlertType = Field(nullable=False, index=True)

    severity: AlertSeverity = Field(nullable=False, index=True)

    description: str = Field(nullable=False)

    resolved: bool = Field(default=False, nullable=False, index=True)

    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # ORM relationship back to user
    user: Optional["User"] = Relationship(back_populates="alert_logs")
