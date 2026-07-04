from sqlmodel import create_engine, Session
from .config import settings

_db_url = str(settings.DATABASE_URL)
_is_sqlite = _db_url.startswith("sqlite")

# SQLite needs check_same_thread=False; PostgreSQL needs timezone options
_connect_args = {"check_same_thread": False} if _is_sqlite else {"options": "-c timezone=utc"}

engine = create_engine(
    _db_url,
    echo=False,
    connect_args=_connect_args,
)


def get_session():
    with Session(engine) as session:
        yield session