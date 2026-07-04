import contextvars
import json
import logging
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable to hold correlation ID for the current request context
correlation_id_ctx = contextvars.ContextVar("correlation_id", default="")

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that reads/injects X-Correlation-ID header and stores it in contextvars.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        corr_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        token = correlation_id_ctx.set(corr_id)
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = corr_id
            return response
        finally:
            correlation_id_ctx.reset(token)


class StructuredJSONFormatter(logging.Formatter):
    """
    Formatter for outputting logs as JSON structure in production.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%SZ"),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx.get(),
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)


class DevFormatter(logging.Formatter):
    """
    Clean human-readable formatter for local development, containing correlation IDs.
    """
    def format(self, record: logging.LogRecord) -> str:
        corr_id = correlation_id_ctx.get()
        corr_str = f" [{corr_id}]" if corr_id else ""
        message = record.getMessage()
        log_str = f"{self.formatTime(record, '%Y-%m-%d %H:%M:%S')} [{record.levelname}]{corr_str} {record.name}: {message}"
        if record.exc_info:
            log_str += "\n" + self.formatException(record.exc_info)
        return log_str


def setup_logging(dev_mode: bool = True):
    """
    Configures root logging with the appropriate formatter.
    """
    root_logger = logging.getLogger()
    
    # Remove existing handlers to prevent duplicate logs
    for h in list(root_logger.handlers):
        root_logger.removeHandler(h)
        
    handler = logging.StreamHandler()
    if dev_mode:
        handler.setFormatter(DevFormatter())
    else:
        handler.setFormatter(StructuredJSONFormatter())
        
    root_logger.addHandler(handler)
    # Set logging level for app
    root_logger.setLevel(logging.INFO)
    
    # Silence third-party noise a bit unless error
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
