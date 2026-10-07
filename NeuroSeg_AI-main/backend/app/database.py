"""
NeuroSeg AI — Database engine and session factory.
"""
from __future__ import annotations
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
from app.models import Base

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 30},
)

# Enable WAL mode for better SQLite concurrency between API and worker
@event.listens_for(engine, "connect")
def _set_wal(dbapi_conn, _record):
    dbapi_conn.execute("PRAGMA journal_mode=WAL")
    dbapi_conn.execute("PRAGMA synchronous=NORMAL")
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    """FastAPI dependency — yields a database session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (idempotent)."""
    Base.metadata.create_all(bind=engine)
