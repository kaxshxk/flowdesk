from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

from models.alertlog import AlertType, AlertSeverity


class AlertLogResponse(BaseModel):
    """
    Outbound representation of an AlertLog entry.
    """

    id: int
    user_id: int
    alert_type: AlertType
    severity: AlertSeverity
    description: str
    resolved: bool
    timestamp: datetime

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    """
    Wrapper for lists of alerts.
    """

    total: int
    alerts: List[AlertLogResponse]


class IntegrityTriggerResponse(BaseModel):
    """
    Response message for manual integrity triggers.
    """

    status: str
    message: str
    tamper_detected: bool
    issues_found: int
