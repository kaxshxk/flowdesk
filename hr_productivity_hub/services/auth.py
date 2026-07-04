from datetime import datetime, timedelta
from typing import Optional
import jwt
from jwt import PyJWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from core.config import settings
from models.user import User, AccessWhitelist, UserRole
from core.database import get_session

security_scheme = HTTPBearer()


# Verify Google token or return dev mock
def verify_google_token(token: str) -> Optional[dict]:
    """
    Verify Google ID token.
    If settings.DEV_MODE is True, returns a mock user fallback.
    Otherwise, verifies using the google-auth library.
    """
    if settings.DEV_MODE:
        return {
            "email": "user@example.com",
            "name": "Test User"
        }
    
    from google.auth.transport import requests
    from google.oauth2 import id_token
    
    try:
        id_info = id_token.verify_oauth2_token(token, requests.Request(), settings.GOOGLE_CLIENT_ID)
        return id_info
    except ValueError:
        return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    session: Session = Depends(get_session)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception
    
    user = session.get(User, user_id)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    return user


def require_role(allowed_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return role_checker


async def authenticate_user_via_google(
    token: str,
    session: Session = Depends(get_session)
) -> dict:
    """
    Authenticate user via Google OIDC and return JWT token.
    
    Args:
        token (str): Google ID token
        session (Session): Database session
        
    Returns:
        dict: JWT token and user info
    """
    # Verify Google token
    user_info = verify_google_token(token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    
    email = user_info["email"]
    
    # Check if email is in whitelist
    statement = select(AccessWhitelist).where(AccessWhitelist.allowed_email == email)
    whitelist_entry = session.exec(statement).first()
    
    if not whitelist_entry:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not in access whitelist"
        )
    
    # Fetch or create user
    statement = select(User).where(User.company_email == email)
    user = session.exec(statement).first()
    
    if not user:
        # Create new user with role from whitelist
        user = User(
            company_email=email,
            role=whitelist_entry.assigned_role,
            is_active=True
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.company_email,
            "role": user.role
        },
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.company_email,
        "role": user.role
    }