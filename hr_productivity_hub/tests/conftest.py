import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session

# Make sure imports resolved correctly from app root
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import settings

# Force settings for tests BEFORE importing main or core/database
settings.SECRET_KEY = "test-secret-key-change-in-production-abc123xyz"
settings.HMAC_SECRET_KEY = "test-hmac-secret-key-change-in-production-abc123xyz"
settings.DATABASE_URL = "sqlite:///./test_temp.db"  # File-based SQLite for test stability
settings.DEV_MODE = True
settings.ENABLE_MOCK_LOGIN = True

from main import app
from core.database import get_session

# Explicitly import all models so SQLModel.metadata knows about them
from models.user import User, AccessWhitelist
from models.timelog import TimeLog
from models.tasklog import TaskLog
from models.filelog import FileLog
from models.leavewfhrequest import LeaveWFHRequest
from models.chatmessage import ChatMessage
from models.meetlog import MeetLog
from models.alertlog import AlertLog

@pytest.fixture(autouse=True)
def reset_settings():
    settings.DEV_MODE = True
    settings.ENABLE_MOCK_LOGIN = True

@pytest.fixture(name="session")
def session_fixture():
    db_file = "./test_temp.db"
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass

    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    
    # Clean up
    engine.dispose()
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

@pytest.fixture(name="hr_headers")
def hr_headers_fixture(client):
    response = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "hr@company.com", "role": "hr"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(name="employee_headers")
def employee_headers_fixture(client):
    response = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "employee@company.com", "role": "employee"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
