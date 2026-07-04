import pytest
from unittest.mock import patch
from sqlmodel import Session, select
from models.user import User, UserRole
from models.tasklog import TaskLog
from models.alertlog import AlertLog, AlertType
from services.integrity_worker import verify_sheet_integrity
from utils.security import generate_task_hmac

def test_task_creation_integrity_roundtrip(client, session: Session, employee_headers, hr_headers):
    # Fetch current user to get their user ID
    res = client.get("/api/v1/me", headers=employee_headers)
    user_id = res.json()["id"]

    # 1. Create a task via API
    task_desc = "Testing task integrity ledger: item 1"
    res = client.post(
        "/api/v1/tasks",
        json={"description": task_desc},
        headers=employee_headers
    )
    assert res.status_code == 201
    task_data = res.json()
    hmac_hash = task_data["hmac_hash"]
    timestamp_str = task_data["timestamp"] # ISO string with 'Z'

    # Verify task exists in local DB
    db_task = session.get(TaskLog, task_data["id"])
    assert db_task is not None
    assert db_task.hmac_hash == hmac_hash

    # 2. Mock Google Sheets client to return the row we just created
    # Google Sheet row format: [Date, Task Description, HMAC Signature]
    mock_rows = [
        ["Date", "Description", "Signature"], # Header
        [timestamp_str, task_desc, hmac_hash] # Row 1
    ]

    with patch("services.integrity_worker.sheets_client.read_sheet_rows", return_value=mock_rows):
        is_authentic = verify_sheet_integrity(user_id=user_id, sheet_id="test-sheet-id")
        assert is_authentic is True

    # 3. Verify tampering is detected
    # Scenario A: description changed
    mock_tampered_desc = [
        ["Date", "Description", "Signature"],
        [timestamp_str, "Tampered task description here", hmac_hash]
    ]
    with patch("services.integrity_worker.sheets_client.read_sheet_rows", return_value=mock_tampered_desc):
        with patch("services.integrity_worker.chat_client.send_message_to_google_chat") as mock_chat:
            is_authentic = verify_sheet_integrity(user_id=user_id, sheet_id="test-sheet-id")
            assert is_authentic is False
            assert mock_chat.called

            # Check that an unresolved critical alert was logged in DB
            stmt = select(AlertLog).where(AlertLog.user_id == user_id).where(AlertLog.alert_type == AlertType.TAMPER_DETECTED)
            alerts = session.exec(stmt).all()
            assert len(alerts) > 0
            assert alerts[0].resolved is False
            assert "TAMPER DETECTED" in alerts[0].description
