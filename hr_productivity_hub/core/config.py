from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    # Database settings — accepts both sqlite:/// and postgresql:// URLs
    DATABASE_URL: str
    
    # Security settings (No defaults, strictly required)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    HMAC_SECRET_KEY: str
    
    # Google OAuth settings
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    
    # Google Sheets settings
    GOOGLE_SHEETS_CREDENTIALS: Optional[str] = None
    FALLBACK_SHEET_ID: Optional[str] = None

    # Google Drive settings
    GOOGLE_DRIVE_CREDENTIALS: Optional[str] = None
    GOOGLE_DRIVE_ROOT_FOLDER_ID: Optional[str] = None

    # Google Chat settings
    # Option A — Incoming webhook URL (simpler, no service account needed)
    GOOGLE_CHAT_WEBHOOK_URL: Optional[str] = None
    # Option B — Service account JSON key path (full Chat API access)
    GOOGLE_CHAT_CREDENTIALS: Optional[str] = None
    # Optional webhook secret for HMAC-SHA256 signature verification
    GOOGLE_CHAT_WEBHOOK_SECRET: Optional[str] = None
    # Google Chat Space ID used for emergency HR broadcasts
    GOOGLE_CHAT_HR_ROOM_ID: Optional[str] = None

    # Security settings (No defaults, strictly required)
    ENABLE_MOCK_LOGIN: bool
    DEV_MODE: bool

    # Google Calendar / Meet settings
    GOOGLE_CALENDAR_CREDENTIALS: Optional[str] = None
    
    # CORS settings
    BACKEND_CORS_ORIGINS: list[str] = []
    
    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v:
            raise ValueError("SECRET_KEY must be set in the environment or .env file.")
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long to ensure cryptographic safety.")
        return v

    @field_validator("HMAC_SECRET_KEY")
    @classmethod
    def validate_hmac_secret_key(cls, v: str) -> str:
        if not v:
            raise ValueError("HMAC_SECRET_KEY must be set in the environment or .env file.")
        if len(v) < 32:
            raise ValueError("HMAC_SECRET_KEY must be at least 32 characters long to ensure cryptographic safety.")
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()