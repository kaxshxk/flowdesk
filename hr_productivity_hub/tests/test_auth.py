import pytest
from sqlmodel import Session, select
from models.user import User, AccessWhitelist, UserRole
from core.config import settings

def test_debug_tables(session: Session):
    # inspect tables using SQLAlchemy inspector
    from sqlalchemy import inspect
    inspector = inspect(session.bind)
    tables = inspector.get_table_names()
    print("\n--- DEBUG TABLES IN TEST SESSION ---")
    print("Tables in test session:", tables)
    print("------------------------------------")
    assert "user" in tables
    assert "accesswhitelist" in tables

def test_mock_login_creates_user(client, session: Session):
    # Enable mock login
    settings.ENABLE_MOCK_LOGIN = True
    
    # Request token for employee
    response = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "employee@example.com", "role": "employee"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["email"] == "employee@example.com"
    assert data["role"] == "employee"
    
    # Verify user exists in database
    user = session.exec(select(User).where(User.company_email == "employee@example.com")).first()
    assert user is not None
    assert user.role == UserRole.EMPLOYEE
    assert user.is_active is True

def test_mock_login_disabled(client):
    settings.ENABLE_MOCK_LOGIN = False
    
    response = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "employee@example.com", "role": "employee"}
    )
    assert response.status_code == 404

def test_google_auth_whitelist_flow(client, session: Session):
    # Create an HR user first to satisfy the created_by_hr_id FK constraint
    hr_user = User(
        company_email="hr_creator@example.com",
        role=UserRole.HR,
        is_active=True
    )
    session.add(hr_user)
    session.commit()
    session.refresh(hr_user)

    # Setup whitelist entry
    whitelist_entry = AccessWhitelist(
        allowed_email="whitelisted@example.com",
        assigned_role=UserRole.HR,
        created_by_hr_id=hr_user.id
    )
    session.add(whitelist_entry)
    session.commit()
    
    # Trigger google auth endpoint (which falls back to dev mode mockup of user@example.com if token is not matching)
    # Let's add user@example.com to whitelist so it passes.
    whitelist_entry_2 = AccessWhitelist(
        allowed_email="user@example.com",
        assigned_role=UserRole.EMPLOYEE,
        created_by_hr_id=hr_user.id
    )
    session.add(whitelist_entry_2)
    session.commit()
    
    response = client.post(
        "/api/v1/auth/google",
        json={"token": "mock-google-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "user@example.com"
    assert data["role"] == "employee"
