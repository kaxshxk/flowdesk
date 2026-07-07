import os
import sys
from datetime import datetime, timedelta, date

# Add the project root to python path to import properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine
from sqlmodel import Session, select, SQLModel
from models.user import User, UserRole, AccessWhitelist
from models.timelog import TimeLog
from models.tasklog import TaskLog
from models.filelog import FileLog
from models.leavewfhrequest import LeaveWFHRequest, RequestType, RequestStatus
from models.chatmessage import ChatMessage, MessageDirection
from models.meetlog import MeetLog
from models.alertlog import AlertLog, AlertType, AlertSeverity
from utils.security import generate_task_hmac

def clear_db(session: Session):
    print("Clearing existing tables...")
    session.query(AlertLog).delete()
    session.query(MeetLog).delete()
    session.query(ChatMessage).delete()
    session.query(LeaveWFHRequest).delete()
    session.query(FileLog).delete()
    session.query(TaskLog).delete()
    session.query(TimeLog).delete()
    session.query(AccessWhitelist).delete()
    session.query(User).delete()
    session.commit()

def seed_db():
    with Session(engine) as session:
        clear_db(session)
        
        print("Creating mock users...")
        # 1. Users
        hr_user = User(id=1, company_email="hr@company.com", role=UserRole.HR, is_active=True)
        alice = User(id=2, company_email="alice@company.com", role=UserRole.EMPLOYEE, is_active=True)
        bob = User(id=3, company_email="bob@company.com", role=UserRole.EMPLOYEE, is_active=True)
        charlie = User(id=4, company_email="charlie@company.com", role=UserRole.EMPLOYEE, is_active=True)
        
        session.add_all([hr_user, alice, bob, charlie])
        session.commit()
        
        # Refresh to get IDs
        session.refresh(hr_user)
        session.refresh(alice)
        session.refresh(bob)
        session.refresh(charlie)
        
        print("Creating access whitelist entries...")
        # 2. Whitelist
        wl_hr = AccessWhitelist(allowed_email="hr@company.com", assigned_role=UserRole.HR, created_by_hr_id=hr_user.id)
        wl_alice = AccessWhitelist(allowed_email="alice@company.com", assigned_role=UserRole.EMPLOYEE, created_by_hr_id=hr_user.id)
        wl_bob = AccessWhitelist(allowed_email="bob@company.com", assigned_role=UserRole.EMPLOYEE, created_by_hr_id=hr_user.id)
        wl_charlie = AccessWhitelist(allowed_email="charlie@company.com", assigned_role=UserRole.EMPLOYEE, created_by_hr_id=hr_user.id)
        
        session.add_all([wl_hr, wl_alice, wl_bob, wl_charlie])
        session.commit()
        
        print("Creating time logs...")
        # 3. Time Logs
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        
        time_logs = [
            # Alice Yesterday (Full Day)
            TimeLog(user_id=alice.id, clock_in=yesterday.replace(hour=9, minute=0, second=0), clock_out=yesterday.replace(hour=17, minute=0, second=0)),
            # Alice Today (Active clock-in)
            TimeLog(user_id=alice.id, clock_in=now.replace(hour=8, minute=45, second=0), clock_out=None),
            
            # Bob Yesterday (Full Day)
            TimeLog(user_id=bob.id, clock_in=yesterday.replace(hour=9, minute=30, second=0), clock_out=yesterday.replace(hour=18, minute=15, second=0)),
            # Bob Today (Full Day)
            TimeLog(user_id=bob.id, clock_in=now.replace(hour=9, minute=15, second=0), clock_out=now.replace(hour=17, minute=30, second=0)),
            
            # Charlie Today (Active clock-in)
            TimeLog(user_id=charlie.id, clock_in=now.replace(hour=10, minute=0, second=0), clock_out=None)
        ]
        session.add_all(time_logs)
        session.commit()
        
        print("Creating task logs...")
        # 4. Tasks (with HMAC)
        # We need to construct ISO strings for timestamp, matches frontend ISO string format
        def log_task(user_id, description, time_val):
            iso_str = time_val.isoformat(timespec='seconds') + 'Z'
            hmac_hash = generate_task_hmac(user_id, description, iso_str)
            return TaskLog(
                user_id=user_id,
                description=description,
                timestamp=time_val,
                hmac_hash=hmac_hash
            )
            
        t1 = log_task(alice.id, "Setup local development environment and ran setup script", yesterday.replace(hour=10, minute=30, second=0))
        t2 = log_task(alice.id, "Refactored login flow components and improved OAuth redirection", now.replace(hour=11, minute=15, second=0))
        t3 = log_task(alice.id, "Fixed react hydration warnings in main layout container", now.replace(hour=14, minute=0, second=0))
        
        t4 = log_task(bob.id, "Drafted Q3 product specifications document & roadmap proposal", yesterday.replace(hour=11, minute=0, second=0))
        t5 = log_task(bob.id, "Aligned with engineering and design team on CSS theme tokens", now.replace(hour=10, minute=30, second=0))
        
        t6 = log_task(charlie.id, "Investigated cloud API gateway latency spikes and timeouts", now.replace(hour=11, minute=45, second=0))
        t7 = log_task(charlie.id, "Optimized relational database query execution paths and indexes", now.replace(hour=15, minute=30, second=0))
        
        session.add_all([t1, t2, t3, t4, t5, t6, t7])
        session.commit()
        
        print("Creating file logs...")
        # 5. File logs
        files = [
            FileLog(user_id=alice.id, file_name="login_flow_overhaul.pdf", google_drive_file_id="MOCK_DRIVE_ALICE_001", drive_folder_path="2026/07/2026-07-07"),
            FileLog(user_id=bob.id, file_name="q3_product_specs.docx", google_drive_file_id="MOCK_DRIVE_BOB_001", drive_folder_path="2026/07/2026-07-06"),
            FileLog(user_id=charlie.id, file_name="latency_report.xlsx", google_drive_file_id="MOCK_DRIVE_CHARLIE_001", drive_folder_path="2026/07/2026-07-07")
        ]
        session.add_all(files)
        session.commit()
        
        print("Creating leave/WFH requests...")
        # 6. Leave / WFH Requests
        requests = [
            # Alice WFH Pending
            LeaveWFHRequest(
                user_id=alice.id,
                request_type=RequestType.WFH,
                start_date=date.today() + timedelta(days=1),
                end_date=date.today() + timedelta(days=1),
                employee_note="Need to wait for urgent fiber-optic installation package delivery.",
                status=RequestStatus.PENDING,
                created_at=now - timedelta(hours=2)
            ),
            # Bob Leave Approved
            LeaveWFHRequest(
                user_id=bob.id,
                request_type=RequestType.LEAVE,
                start_date=date.today() + timedelta(days=5),
                end_date=date.today() + timedelta(days=9),
                employee_note="Annual family summer vacation. Setting up cover with Charlie.",
                status=RequestStatus.APPROVED,
                hr_note="Approved. Backup resource coverage confirmed with Charlie.",
                reviewed_by_hr_id=hr_user.id,
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=1)
            ),
            # Charlie WFH Approved
            LeaveWFHRequest(
                user_id=charlie.id,
                request_type=RequestType.WFH,
                start_date=date.today(),
                end_date=date.today(),
                employee_note="Slight dry cough, working from home to be safe and avoid spread.",
                status=RequestStatus.APPROVED,
                hr_note="Approved. Rest up and feel better!",
                reviewed_by_hr_id=hr_user.id,
                created_at=now - timedelta(hours=5),
                updated_at=now - timedelta(hours=4.5)
            ),
            # Alice Leave Declined
            LeaveWFHRequest(
                user_id=alice.id,
                request_type=RequestType.LEAVE,
                start_date=date.today() - timedelta(days=3),
                end_date=date.today() - timedelta(days=3),
                employee_note="Personal errands on Friday afternoon.",
                status=RequestStatus.DECLINED,
                hr_note="Declined due to the scheduled client presentation. Please reschedule.",
                reviewed_by_hr_id=hr_user.id,
                created_at=now - timedelta(days=4),
                updated_at=now - timedelta(days=3)
            )
        ]
        session.add_all(requests)
        session.commit()
        
        print("Creating chat messages...")
        # 7. Chat messages
        chats = [
            # General Sync space
            ChatMessage(user_id=alice.id, space_id="spaces/general_sync", message_text="Hey team, just logging in to the portal!", direction=MessageDirection.OUTBOUND, timestamp=now - timedelta(hours=3)),
            ChatMessage(user_id=bob.id, space_id="spaces/general_sync", message_text="Awesome. I'll join you in a bit to run some tests.", direction=MessageDirection.OUTBOUND, timestamp=now - timedelta(hours=2.5)),
            # HR Room
            ChatMessage(user_id=hr_user.id, space_id="spaces/hr_room", message_text="Important reminder: please submit leave requests 3 days in advance.", direction=MessageDirection.OUTBOUND, timestamp=now - timedelta(hours=5)),
            # Engineering Sync
            ChatMessage(user_id=charlie.id, space_id="spaces/engineering_sync", message_text="Is anyone else seeing latency spikes on the dev gateway?", direction=MessageDirection.OUTBOUND, timestamp=now - timedelta(minutes=45)),
            ChatMessage(user_id=alice.id, space_id="spaces/engineering_sync", message_text="Yes, I noticed it earlier while pushing the login files.", direction=MessageDirection.OUTBOUND, timestamp=now - timedelta(minutes=40)),
            ChatMessage(user_id=charlie.id, space_id="spaces/engineering_sync", message_text="Got it, investigating database indexes now.", direction=MessageDirection.OUTBOUND, timestamp=now - timedelta(minutes=30))
        ]
        session.add_all(chats)
        session.commit()
        
        print("Creating meet logs...")
        # 8. Meet logs
        meets = [
            MeetLog(creator_id=alice.id, meet_url="https://meet.google.com/abc-defg-hij", topic="Login Flow Sync", target_space_id="spaces/engineering_sync", timestamp=now - timedelta(hours=1)),
            MeetLog(creator_id=charlie.id, meet_url="https://meet.google.com/xyz-pdq-rst", topic="API Gateway Latency Debug", target_space_id="spaces/engineering_sync", timestamp=now - timedelta(minutes=35))
        ]
        session.add_all(meets)
        session.commit()
        
        print("Creating alert logs...")
        # 9. Alert logs
        alerts = [
            # Info Alert
            AlertLog(
                user_id=alice.id,
                alert_type=AlertType.FILE_UPLOADED,
                severity=AlertSeverity.INFO,
                description="User alice@company.com uploaded 'login_flow_overhaul.pdf' to Drive folder '2026/07/2026-07-07'.",
                resolved=True,
                timestamp=now - timedelta(hours=1.5)
            ),
            # Warning Alert
            AlertLog(
                user_id=charlie.id,
                alert_type=AlertType.TASK_LOGGED,
                severity=AlertSeverity.WARNING,
                description="Long task description length (1024 chars) logged by charlie@company.com.",
                resolved=False,
                timestamp=now - timedelta(minutes=15)
            ),
            # Critical Security Alert
            AlertLog(
                user_id=bob.id,
                alert_type=AlertType.TAMPER_DETECTED,
                severity=AlertSeverity.CRITICAL,
                description="HMAC verification failure: cryptographically-signed signature validation failed for task ID #5.",
                resolved=False,
                timestamp=now - timedelta(minutes=5)
            )
        ]
        session.add_all(alerts)
        session.commit()
        
        print("DB seeding completed successfully!")

if __name__ == "__main__":
    seed_db()
