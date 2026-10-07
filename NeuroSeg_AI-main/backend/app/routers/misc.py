"""
NeuroSeg AI — Models, experiments, dashboard and settings routers.
"""
from __future__ import annotations
from typing import List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ModelVersion, ExperimentRun, Case, AnalysisJob, JobStatus
)
from app.schemas import (
    ModelVersionOut, ExperimentRunOut, DashboardStats, StorageStats
)
from app.file_utils import dir_size_mb
from app.config import settings

# ─── Models ──────────────────────────────────────────────────────────────────

models_router = APIRouter(prefix="/models", tags=["Models"])


@models_router.get("/", response_model=List[ModelVersionOut])
def list_models(db: Session = Depends(get_db)):
    return db.query(ModelVersion).filter(ModelVersion.is_active == True).all()


@models_router.get("/{model_id}", response_model=ModelVersionOut)
def get_model(model_id: str, db: Session = Depends(get_db)):
    m = db.query(ModelVersion).filter(ModelVersion.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found.")
    return m


# ─── Experiments ─────────────────────────────────────────────────────────────

experiments_router = APIRouter(prefix="/experiments", tags=["Experiments"])


@experiments_router.get("/", response_model=List[ExperimentRunOut])
def list_experiments(db: Session = Depends(get_db)):
    return db.query(ExperimentRun).order_by(ExperimentRun.created_at.desc()).all()


@experiments_router.get("/{run_id}", response_model=ExperimentRunOut)
def get_experiment(run_id: str, db: Session = Depends(get_db)):
    run = db.query(ExperimentRun).filter(ExperimentRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Experiment run not found.")
    return run


# ─── Dashboard ───────────────────────────────────────────────────────────────

dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db)):
    total_cases = db.query(func.count(Case.id)).scalar()
    completed = db.query(func.count(AnalysisJob.id)).filter(
        AnalysisJob.status == JobStatus.completed
    ).scalar()
    running = db.query(func.count(AnalysisJob.id)).filter(
        AnalysisJob.status == JobStatus.running
    ).scalar()
    queued = db.query(func.count(AnalysisJob.id)).filter(
        AnalysisJob.status == JobStatus.queued
    ).scalar()
    failed = db.query(func.count(AnalysisJob.id)).filter(
        AnalysisJob.status == JobStatus.failed
    ).scalar()

    active_model = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active == True)
        .order_by(ModelVersion.created_at.desc())
        .first()
    )
    recent_jobs = (
        db.query(AnalysisJob)
        .order_by(AnalysisJob.queued_at.desc())
        .limit(10)
        .all()
    )
    return DashboardStats(
        total_cases=total_cases or 0,
        completed_analyses=completed or 0,
        running_jobs=running or 0,
        queued_jobs=queued or 0,
        failed_jobs=failed or 0,
        active_model=active_model,
        recent_jobs=recent_jobs,
    )


# ─── Settings ────────────────────────────────────────────────────────────────

settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.get("/storage", response_model=StorageStats)
def get_storage():
    return StorageStats(
        upload_dir=str(settings.upload_dir),
        results_dir=str(settings.results_dir),
        model_dir=str(settings.model_dir),
        upload_size_mb=dir_size_mb(settings.upload_dir),
        results_size_mb=dir_size_mb(settings.results_dir),
        model_size_mb=dir_size_mb(settings.model_dir),
    )
