"""
NeuroSeg AI — Analysis jobs router.
Submits inference jobs (returns 202 with job ID), polls status, retrieves results.
"""
from __future__ import annotations
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AnalysisJob, AnalysisResult, Case, ModelVersion, MaskRevision, JobStatus
)
from app.schemas import (
    AnalysisSubmit, JobStatusOut, AnalysisResultOut, MaskRevisionOut
)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("/{case_id}/submit", status_code=202, response_model=JobStatusOut)
def submit_analysis(
    case_id: str,
    payload: AnalysisSubmit,
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    model = db.query(ModelVersion).filter(
        ModelVersion.id == payload.model_version_id,
        ModelVersion.is_active == True,
    ).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model version not found or inactive.")

    # Prevent duplicate active submissions
    existing = (
        db.query(AnalysisJob)
        .filter(
            AnalysisJob.case_id == case_id,
            AnalysisJob.model_version_id == payload.model_version_id,
            AnalysisJob.status.in_([JobStatus.queued, JobStatus.running]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A job is already {existing.status.value} for this case+model.",
        )

    job = AnalysisJob(
        case_id=case_id,
        model_version_id=payload.model_version_id,
        threshold=payload.threshold,
        status=JobStatus.queued,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobStatusOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/case/{case_id}", response_model=List[JobStatusOut])
def list_case_jobs(case_id: str, db: Session = Depends(get_db)):
    return (
        db.query(AnalysisJob)
        .filter(AnalysisJob.case_id == case_id)
        .order_by(AnalysisJob.queued_at.desc())
        .all()
    )


@router.get("/{job_id}/result", response_model=AnalysisResultOut)
def get_result(job_id: str, db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.completed:
        raise HTTPException(status_code=425, detail=f"Job status is '{job.status.value}', not completed.")
    if not job.result:
        raise HTTPException(status_code=404, detail="Result not yet available.")
    return AnalysisResultOut.from_orm_with_bbox(job.result)


@router.get("/{job_id}/revisions", response_model=List[MaskRevisionOut])
def list_revisions(job_id: str, db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job or not job.result:
        raise HTTPException(status_code=404, detail="Job or result not found.")
    return job.result.revisions
