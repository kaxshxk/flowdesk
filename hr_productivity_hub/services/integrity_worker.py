import logging
import hmac
from datetime import datetime
from typing import Optional
from sqlmodel import Session, select

from core.config import settings
from core.database import engine
from models.alertlog import AlertLog, AlertSeverity, AlertType
from models.user import User
from services.google_sheets import sheets_client
from services.google_chat import chat_client
from utils.security import generate_task_hmac

logger = logging.getLogger(__name__)


def verify_sheet_integrity(user_id: int, sheet_id: str) -> bool:
    """
    Scans a user's Google Sheet, extracts task entries and HMAC signatures,
    and validates them against locally computed signatures.

    If a signature mismatch is detected, it logs a critical AlertLog entry
    and dispatches a warning message to the designated HR Google Chat room.

    Args:
        user_id: The ID of the employee owning the ledger.
        sheet_id: The Google Sheet ID containing the ledger.

    Returns:
        bool: True if the sheet is fully authentic, False if tampering is found.
    """
    logger.info("Starting sheet integrity scan for user_id=%d, sheet_id=%s", user_id, sheet_id)

    # Fetch rows from Google Sheets client
    rows = sheets_client.read_sheet_rows(sheet_id)

    if not rows:
        logger.info("No rows or empty data returned for sheet '%s'. Scan complete.", sheet_id)
        return True

    # If the sheet contains header row, skip it (first row matches "Date" or similar headers)
    first_row = rows[0]
    start_index = 0
    if len(first_row) >= 3 and first_row[0].strip().lower() in ("date", "timestamp"):
        start_index = 1

    tamper_detected = False
    issues_count = 0

    # Get user email/info for alert detail
    with Session(engine) as db_session:
        user = db_session.get(User, user_id)
        user_email = user.company_email if user else f"User #{user_id}"

        for index in range(start_index, len(rows)):
            row = rows[index]
            # Ensure the row has enough columns [Date, Task Description, HMAC Signature]
            if len(row) < 3:
                logger.warning("Row %d in sheet %s is malformed: %s. Skipping.", index, sheet_id, row)
                continue

            date_str = row[0].strip()
            description = row[1].strip()
            provided_sig = row[2].strip()

            # Parse date string back to ISO format for signature verification.
            timestamp_iso = date_str
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S UTC")
                timestamp_iso = dt.isoformat(timespec='seconds') + 'Z'
            except ValueError:
                # If date format is custom or direct ISO, try to parse
                try:
                    clean_date = date_str.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(clean_date)
                    timestamp_iso = dt.isoformat(timespec='seconds') + 'Z'
                except ValueError:
                    pass

            # Recalculate signature
            expected_sig = generate_task_hmac(
                user_id=user_id,
                description=description,
                timestamp=timestamp_iso,
            )

            # Compare signatures using timing-attack resistant comparison
            if not hmac.compare_digest(expected_sig, provided_sig):
                tamper_detected = True
                issues_count += 1
                logger.error(
                    "Integrity check FAILED at row %d. Expected: %s, Provided: %s",
                    index,
                    expected_sig,
                    provided_sig,
                )

                # Log critical AlertLog entry
                alert_desc = (
                    f"TAMPER DETECTED: Google Sheet row {index + 1} has an invalid cryptographic signature. "
                    f"Entry: [{date_str}] '{description}'. Expected HMAC: '{expected_sig}', got '{provided_sig}'."
                )
                alert = AlertLog(
                    user_id=user_id,
                    alert_type=AlertType.TAMPER_DETECTED,
                    severity=AlertSeverity.CRITICAL,
                    description=alert_desc,
                    resolved=False,
                    timestamp=datetime.utcnow(),
                )
                db_session.add(alert)
                db_session.commit()

        if tamper_detected:
            # Send emergency broadcast to HR chat room
            hr_space_id = settings.GOOGLE_CHAT_HR_ROOM_ID or "spaces/hr_notification_room"
            alert_message = (
                f"🚨 *CRITICAL:* Cryptographic integrity check failed for employee *{user_email}* (ID: {user_id}). "
                f"Tamper evidence detected on Google Sheet: {issues_count} signature mismatch(es) found."
            )
            chat_client.send_message_to_google_chat(space_id=hr_space_id, text=alert_message)

    return not tamper_detected
