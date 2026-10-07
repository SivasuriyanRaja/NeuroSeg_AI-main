"""
NeuroSeg AI — SQLAlchemy ORM Models
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


def _now() -> datetime:
    return datetime.utcnow()


def _uid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ─── Enumerations ────────────────────────────────────────────────────────────

class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class ReportFormat(str, enum.Enum):
    pdf = "pdf"
    json = "json"
    csv = "csv"
    png_overlay = "png_overlay"
    png_mask = "png_mask"
    zip = "zip"


# ─── Tables ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    
    id: str = Column(String, primary_key=True, default=_uid)
    email: str = Column(String, unique=True, index=True, nullable=False)
    hashed_password: str = Column(String, nullable=False)
    created_at: datetime = Column(DateTime, default=_now)

    cases = relationship("Case", back_populates="user")


class ModelVersion(Base):
    """Registered segmentation model (checkpoint)."""
    __tablename__ = "model_versions"

    id: str = Column(String, primary_key=True, default=_uid)
    name: str = Column(String, nullable=False)
    architecture: str = Column(String, nullable=False)  # e.g. "unet_baseline"
    version_tag: str = Column(String, nullable=False)
    checkpoint_path: str = Column(String)
    input_size: int = Column(Integer, default=256)
    normalization_mean: float = Column(Float, default=0.5)
    normalization_std: float = Column(Float, default=0.5)
    threshold: float = Column(Float, default=0.5)
    parameter_count: Optional[int] = Column(Integer)
    weight_file_size_bytes: Optional[int] = Column(Integer)
    description: str = Column(Text, default="")
    dataset_provenance: str = Column(Text, default="")
    is_active: bool = Column(Boolean, default=True)
    created_at: datetime = Column(DateTime, default=_now)

    jobs = relationship("AnalysisJob", back_populates="model_version")
    experiment_runs = relationship("ExperimentRun", back_populates="model_version")


class Case(Base):
    """One uploaded patient MRI session."""
    __tablename__ = "cases"

    id: str = Column(String, primary_key=True, default=_uid)
    label: str = Column(String, default="")
    notes: str = Column(Text, default="")
    created_at: datetime = Column(DateTime, default=_now)
    updated_at: datetime = Column(DateTime, default=_now, onupdate=_now)
    user_id: Optional[str] = Column(String, ForeignKey("users.id"))

    user = relationship("User", back_populates="cases")
    assets = relationship("Asset", back_populates="case", cascade="all, delete-orphan")
    jobs = relationship("AnalysisJob", back_populates="case", cascade="all, delete-orphan")


class Asset(Base):
    """File stored on disk linked to a Case."""
    __tablename__ = "assets"

    id: str = Column(String, primary_key=True, default=_uid)
    case_id: str = Column(String, ForeignKey("cases.id"), nullable=False)
    asset_type: str = Column(String, nullable=False)  # original / thumbnail / overlay / mask / prob_map / report
    filename: str = Column(String, nullable=False)    # server-generated safe name
    original_filename: str = Column(String, default="")
    mime_type: str = Column(String, default="image/png")
    file_size_bytes: int = Column(Integer, default=0)
    width: Optional[int] = Column(Integer)
    height: Optional[int] = Column(Integer)
    created_at: datetime = Column(DateTime, default=_now)

    case = relationship("Case", back_populates="assets")


class AnalysisJob(Base):
    """Inference job record."""
    __tablename__ = "analysis_jobs"

    id: str = Column(String, primary_key=True, default=_uid)
    case_id: str = Column(String, ForeignKey("cases.id"), nullable=False)
    model_version_id: str = Column(String, ForeignKey("model_versions.id"), nullable=False)
    status: JobStatus = Column(SAEnum(JobStatus), default=JobStatus.queued, nullable=False)
    threshold: float = Column(Float, default=0.5)
    retry_count: int = Column(Integer, default=0)
    error_message: Optional[str] = Column(Text)
    queued_at: datetime = Column(DateTime, default=_now)
    started_at: Optional[datetime] = Column(DateTime)
    completed_at: Optional[datetime] = Column(DateTime)
    processing_ms: Optional[int] = Column(Integer)

    case = relationship("Case", back_populates="jobs")
    model_version = relationship("ModelVersion", back_populates="jobs")
    result = relationship("AnalysisResult", back_populates="job", uselist=False, cascade="all, delete-orphan")


class AnalysisResult(Base):
    """Metrics and artifact paths for a completed job."""
    __tablename__ = "analysis_results"

    id: str = Column(String, primary_key=True, default=_uid)
    job_id: str = Column(String, ForeignKey("analysis_jobs.id"), nullable=False, unique=True)

    # Mask measurements
    foreground_pixels: int = Column(Integer, default=0)
    total_pixels: int = Column(Integer, default=0)
    foreground_fraction: float = Column(Float, default=0.0)
    bounding_box_x: Optional[int] = Column(Integer)
    bounding_box_y: Optional[int] = Column(Integer)
    bounding_box_w: Optional[int] = Column(Integer)
    bounding_box_h: Optional[int] = Column(Integer)
    connected_component_count: int = Column(Integer, default=0)

    # Classification results
    predicted_class: Optional[str] = Column(String)
    predicted_confidence: Optional[float] = Column(Float)

    # File paths (relative to results_dir)
    prob_map_path: Optional[str] = Column(String)
    mask_path: Optional[str] = Column(String)
    overlay_path: Optional[str] = Column(String)
    thumbnail_path: Optional[str] = Column(String)

    # Preprocessing provenance
    preprocessing_meta: dict = Column(JSON, default=dict)

    created_at: datetime = Column(DateTime, default=_now)

    job = relationship("AnalysisJob", back_populates="result")
    revisions = relationship("MaskRevision", back_populates="result", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="result", cascade="all, delete-orphan")


class MaskRevision(Base):
    """User-edited mask saved as a separate revision."""
    __tablename__ = "mask_revisions"

    id: str = Column(String, primary_key=True, default=_uid)
    result_id: str = Column(String, ForeignKey("analysis_results.id"), nullable=False)
    revision_number: int = Column(Integer, nullable=False)
    mask_path: str = Column(String, nullable=False)
    notes: str = Column(Text, default="")
    is_selected: bool = Column(Boolean, default=False)
    created_at: datetime = Column(DateTime, default=_now)

    result = relationship("AnalysisResult", back_populates="revisions")


class Report(Base):
    """Generated downloadable report."""
    __tablename__ = "reports"

    id: str = Column(String, primary_key=True, default=_uid)
    result_id: str = Column(String, ForeignKey("analysis_results.id"), nullable=False)
    format: ReportFormat = Column(SAEnum(ReportFormat), nullable=False)
    file_path: str = Column(String, nullable=False)
    file_size_bytes: int = Column(Integer, default=0)
    created_at: datetime = Column(DateTime, default=_now)

    result = relationship("AnalysisResult", back_populates="reports")


class ExperimentRun(Base):
    """ML training experiment record."""
    __tablename__ = "experiment_runs"

    id: str = Column(String, primary_key=True, default=_uid)
    model_version_id: str = Column(String, ForeignKey("model_versions.id"), nullable=False)
    run_name: str = Column(String, nullable=False)
    dataset_name: str = Column(String, default="")
    split_identity: str = Column(String, default="")   # hash or manifest path
    epochs_trained: int = Column(Integer, default=0)
    best_epoch: int = Column(Integer, default=0)
    best_val_dice: float = Column(Float, default=0.0)
    test_dice: Optional[float] = Column(Float)
    test_iou: Optional[float] = Column(Float)
    test_precision: Optional[float] = Column(Float)
    test_recall: Optional[float] = Column(Float)
    parameter_count: Optional[int] = Column(Integer)
    peak_memory_mb: Optional[float] = Column(Float)
    median_latency_ms: Optional[float] = Column(Float)
    p95_latency_ms: Optional[float] = Column(Float)
    hardware_info: str = Column(Text, default="")
    training_curves: dict = Column(JSON, default=dict)   # {epoch: {train_loss, val_loss, val_dice}}
    config_snapshot: dict = Column(JSON, default=dict)
    created_at: datetime = Column(DateTime, default=_now)

    model_version = relationship("ModelVersion", back_populates="experiment_runs")
