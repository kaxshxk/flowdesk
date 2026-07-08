from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel

from core.database import get_session
from services.auth import authenticate_user_via_google, get_current_user, require_role, create_access_token
from models.user import User, AccessWhitelist, UserRole
from datetime import timedelta
from core.config import settings
from utils.rate_limit import rate_limit


router = APIRouter(prefix="/api/v1")


class GoogleAuthRequest(BaseModel):
    token: str


class MockLoginRequest(BaseModel):
    email: str
    role: str  # "hr" or "employee"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str
    role: str


class HealthCheck(BaseModel):
    status: str
    timestamp: str
    database: str
    google_sheets: str
    google_drive: str


@router.post("/auth/google", response_model=TokenResponse)
def google_auth(
    request: GoogleAuthRequest,
    session: Session = Depends(get_session),
    _rate_limit = Depends(rate_limit(5, 60)),
):
    """
    Authenticate user via Google OIDC.
    """
    return authenticate_user_via_google(request.token, session)


import logging
from fastapi import Request

logger = logging.getLogger(__name__)


@router.post("/auth/mock-login", response_model=TokenResponse)
def mock_login(
    request_data: MockLoginRequest,
    request: Request,
    session: Session = Depends(get_session),
    _rate_limit = Depends(rate_limit(10, 60)),
):
    """
    DEV ONLY: Bypass Google OAuth. Requires whitelisted and registered dev email.
    """
    if not settings.ENABLE_MOCK_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mock login is disabled in this environment."
        )

    email = request_data.email.strip().lower()

    # 1. Enforce specific dev email domains (@company.com, @yourcompany.com or @dev.local)
    if not (email.endswith("@company.com") or email.endswith("@yourcompany.com") or email.endswith("@dev.local")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mock login is restricted to dev domains (@company.com, @yourcompany.com or @dev.local)."
        )

    # 2. Require the user to exist in the AccessWhitelist
    whitelisted = session.exec(select(AccessWhitelist).where(AccessWhitelist.allowed_email == email)).first()
    if not whitelisted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not whitelisted for access."
        )

    # 3. Require the user to already exist in the User table (no auto-create)
    user = session.exec(select(User).where(User.company_email == email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found. Please contact an administrator to register."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    # 4. Log a warning every time mock login is successfully used with IP and email
    ip_address = request.client.host if request.client else "unknown"
    logger.warning(
        "⚠️ SECURITY WARNING: Mock login used successfully. Email: %s, User ID: %d, Role: %s, IP: %s",
        email, user.id, user.role, ip_address
    )

    # 5. Issue JWT using the user's database role directly (ignoring client role parameter)
    access_token = create_access_token(
        data={"user_id": user.id, "email": user.company_email, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.company_email,
        "role": user.role,
    }



@router.get("/health", response_model=HealthCheck)
def health_check(session: Session = Depends(get_session)):
    """
    Health check endpoint. Validates DB connection and pings Google APIs.
    """
    from datetime import datetime
    from sqlmodel import text
    from services.google_sheets import sheets_client
    from services.google_drive import drive_client

    # 1. Database Liveliness Check
    db_status = "healthy"
    try:
        session.exec(text("SELECT 1")).one()
    except Exception as exc:
        db_status = f"unhealthy: {exc}"

    # 2. Google Sheets Liveliness Check
    sheets_status = "healthy"
    if sheets_client._mock_mode:
        sheets_status = "mock_mode (disabled)"
    else:
        try:
            # Ping fallback sheet metadata
            sheet_id = settings.FALLBACK_SHEET_ID
            if sheet_id and sheet_id != "FALLBACK_NOT_CONFIGURED":
                sheets_client.service.spreadsheets().get(spreadsheetId=sheet_id).execute()
            else:
                sheets_status = "healthy (no fallback sheet configured)"
        except Exception as exc:
            sheets_status = f"unhealthy: {exc}"

    # 3. Google Drive Liveliness Check
    drive_status = "healthy"
    if drive_client._mock_mode:
        drive_status = "mock_mode (disabled)"
    else:
        try:
            # Minimal list call to test access
            drive_client.service.files().list(pageSize=1).execute()
        except Exception as exc:
            drive_status = f"unhealthy: {exc}"

    is_healthy = (
        db_status == "healthy"
        and "unhealthy" not in sheets_status
        and "unhealthy" not in drive_status
    )
    status_str = "healthy" if is_healthy else "unhealthy"

    return {
        "status": status_str,
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "google_sheets": sheets_status,
        "google_drive": drive_status,
    }


# Protected route
@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user info.
    """
    return current_user


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


@router.put("/me")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update current user profile.
    """
    # Enforce role restrictions: Employees cannot edit job title and department
    if current_user.role == UserRole.EMPLOYEE:
        if payload.job_title is not None or payload.department is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees are not permitted to modify their Job Title or Department. Please contact HR."
            )

    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.job_title is not None:
        current_user.job_title = payload.job_title
    if payload.department is not None:
        current_user.department = payload.department
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url if payload.avatar_url != "" else None
        
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(..., description="Binary avatar image."),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Upload and update user profile avatar.
    """
    import os
    import shutil
    
    # Resolve absolute path for static/uploads/avatars
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    avatar_dir = os.path.join(base_dir, "static", "uploads", "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    
    # Sanitize extension
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise HTTPException(status_code=400, detail="Unsupported image format. Please upload PNG, JPG, or WEBP.")
        
    filename = f"user_{current_user.id}{ext.lower()}"
    file_path = os.path.join(avatar_dir, filename)
    
    # Write to local disk
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Standard serving path
    avatar_url = f"http://localhost:8000/static/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    return current_user


@router.delete("/me/avatar")
def delete_avatar(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete user profile avatar.
    """
    current_user.avatar_url = None
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


# Role-protected route
@router.get("/hr/dashboard")
def hr_dashboard(current_user: User = Depends(require_role([UserRole.HR]))):
    """
    HR dashboard - only accessible by HR users.
    """
    return {"message": "Welcome to HR dashboard"}