from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from contextlib import asynccontextmanager
import logging

from utils.logging import setup_logging, CorrelationIdMiddleware
from core.config import settings

# Initialize structured or dev logging based on environment mode
setup_logging(dev_mode=settings.DEV_MODE)
logger = logging.getLogger(__name__)

from core.database import engine
from api.routes import router
from api.hr import router as hr_router
from api.time import router as time_router
from api.tasks import router as tasks_router
from api.files import router as files_router
from api.requests import router as requests_router
from api.chat import router as chat_router
from api.meet import router as meet_router
from models.user import User, AccessWhitelist
from models.timelog import TimeLog
from models.tasklog import TaskLog
from models.filelog import FileLog
from models.leavewfhrequest import LeaveWFHRequest
from models.chatmessage import ChatMessage
from models.meetlog import MeetLog
from models.alertlog import AlertLog


from alembic.config import Config
from alembic import command
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run database migrations on startup; warn if DEV_MODE is active in production, or if DB is unreachable."""
    # ── Security Audit Warning for Production Deployments ────────────────────
    env = os.getenv("ENVIRONMENT", "production").strip().lower()
    if settings.DEV_MODE and env not in ("development", "dev", "local"):
        logger.warning(
            "⚠️ CRITICAL SECURITY WARNING: DEV_MODE=True is detected in a non-development/production environment (%s)! "
            "Google OAuth signature checks are bypassed. Please set DEV_MODE=False in your production .env file.",
            env
        )
    if settings.ENABLE_MOCK_LOGIN and env not in ("development", "dev", "local"):
        logger.warning(
            "⚠️ CRITICAL SECURITY WARNING: ENABLE_MOCK_LOGIN=True is detected in a non-development/production environment (%s)! "
            "Anyone can log in as HR or an employee bypassing whitelist checks. Disable this by setting ENABLE_MOCK_LOGIN=False.",
            env
        )

    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        ini_path = os.path.join(base_dir, "alembic.ini")
        alembic_cfg = Config(ini_path)
        # Ensure alembic config uses the absolute path for the migration script folder
        alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations successfully applied to head.")
    except Exception as exc:
        logger.warning(
            "Could not connect to the database or apply migrations on startup: %s. "
            "Endpoints requiring DB access will fail until a connection is available.",
            exc,
        )
    yield  # Application runs here.


app = FastAPI(
    title="HR-Productivity Hub",
    description="A secure HR-Productivity Hub API",
    version="1.0.0",
    lifespan=lifespan,
)

# Register Correlation ID Middleware
app.add_middleware(CorrelationIdMiddleware)

# Set up CORS with production lockdown
if settings.BACKEND_CORS_ORIGINS:
    origins = settings.BACKEND_CORS_ORIGINS
    if not settings.DEV_MODE:
        # Production mode: remove wildcard from allowed origins
        if "*" in origins:
            logger.warning("CORS wildcard '*' detected in production mode. Restricting and removing wildcard.")
            origins = [o for o in origins if o != "*"]
            
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )


from fastapi.responses import JSONResponse
from fastapi import Request


# Include routes
app.include_router(router)
app.include_router(hr_router)
app.include_router(time_router)
app.include_router(tasks_router)
app.include_router(files_router)
app.include_router(requests_router)
app.include_router(chat_router)
app.include_router(meet_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler to log traceback locally and return a sanitized
    error message to prevent detailed stack traces from leaking to clients.
    """
    logger.error("Unhandled exception occurred during request execution: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Underlaying system traces have been secured."},
    )


@app.get("/")
async def root():
    return {"message": "Welcome to HR-Productivity Hub API"}