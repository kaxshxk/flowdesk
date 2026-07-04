import logging
from datetime import datetime
from sqlmodel import Session

from models.alertlog import AlertLog, AlertSeverity, AlertType

logger = logging.getLogger(__name__)


def log_file_activity_alert(user_id: int, file_name: str, session: Session) -> None:
    """
    Log an 'info' alert when a file is successfully uploaded to Google Drive.
    """
    description = f"File successfully uploaded: '{file_name}' to Google Drive."
    alert = AlertLog(
        user_id=user_id,
        alert_type=AlertType.FILE_UPLOADED,
        severity=AlertSeverity.INFO,
        description=description,
        resolved=False,
        timestamp=datetime.utcnow(),
    )
    session.add(alert)
    # Note: caller commits the transaction or session handles it.
    logger.info("File upload alert logged for user_id=%d: %s", user_id, file_name)


def log_task_activity_alert(user_id: int, task_desc: str, session: Session) -> None:
    """
    Log an 'info' alert when a task log entry is successfully recorded.
    """
    description = f"Task logged: '{task_desc}'."
    alert = AlertLog(
        user_id=user_id,
        alert_type=AlertType.TASK_LOGGED,
        severity=AlertSeverity.INFO,
        description=description,
        resolved=False,
        timestamp=datetime.utcnow(),
    )
    session.add(alert)
    # Note: caller commits the transaction or session handles it.
    logger.info("Task activity alert logged for user_id=%d: %s", user_id, task_desc[:60])
