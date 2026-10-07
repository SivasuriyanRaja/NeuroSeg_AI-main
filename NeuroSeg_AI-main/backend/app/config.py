"""
NeuroSeg AI — Application Settings
Reads from environment variables / .env file.
"""
from __future__ import annotations
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Paths
    data_dir: Path = Path("../data")
    upload_dir: Path = Path("../data/uploads")
    results_dir: Path = Path("../data/results")
    model_dir: Path = Path("../data/models")

    # Database
    database_url: str = "sqlite:///./neuroseg.db"

    # Worker
    max_concurrent_jobs: int = 2
    worker_poll_interval: float = 2.0   # seconds
    worker_max_retries: int = 3

    # Upload limits
    max_upload_bytes: int = 50 * 1024 * 1024  # 50 MB
    max_image_dimension: int = 4096

    # Logging
    log_level: str = "INFO"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.upload_dir, self.results_dir, self.model_dir):
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
