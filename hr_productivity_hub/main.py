from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger(__name__)

from core.config import settings
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup; log a warning if the DB is unreachable."""
    try:
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables created / verified.")
    except Exception as exc:
        logger.warning(
            "Could not connect to the database on startup: %s. "
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


# Set up CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
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