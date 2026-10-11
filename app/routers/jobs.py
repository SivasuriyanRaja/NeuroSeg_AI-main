"""
NeuroSeg AI — Analysis jobs router.
Submits inference jobs (returns 202 with job ID), polls status, retrieves results.
"""
from __future__ import annotations
from typing import List, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

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
    db: Any = Depends(get_db),
):
    case = Case.objects(id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    model = ModelVersion.objects(
        id=payload.model_version_id,
        is_active=True,
    ).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model version not found or inactive.")

    # Prevent duplicate active submissions
    existing = AnalysisJob.objects(
        case_id=case_id,
        model_version_id=payload.model_version_id,
        status__in=[JobStatus.queued, JobStatus.running],
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A job is already {existing.status} for this case+model.",
        )

    job = AnalysisJob(
        case_id=case_id,
        model_version_id=payload.model_version_id,
        threshold=payload.threshold,
        status=JobStatus.queued,
    )
    job.save()
    return job


@router.get("/{job_id}", response_model=JobStatusOut)
def get_job(job_id: str, db: Any = Depends(get_db)):
    job = AnalysisJob.objects(id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/case/{case_id}", response_model=List[JobStatusOut])
def list_case_jobs(case_id: str, db: Any = Depends(get_db)):
    return list(AnalysisJob.objects(case_id=case_id).order_by("-queued_at"))


@router.get("/{job_id}/result", response_model=AnalysisResultOut)
def get_result(job_id: str, db: Any = Depends(get_db)):
    job = AnalysisJob.objects(id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.completed:
        raise HTTPException(status_code=425, detail=f"Job status is '{job.status}', not completed.")
    
    result = job.result
    if not result:
        raise HTTPException(status_code=404, detail="Result not yet available.")
    
    return AnalysisResultOut(
        id=result.id,
        job_id=result.job_id,
        foreground_pixels=result.foreground_pixels,
        total_pixels=result.total_pixels,
        foreground_fraction=result.foreground_fraction,
        bbox=[result.bounding_box_x, result.bounding_box_y, result.bounding_box_w, result.bounding_box_h] if result.bounding_box_x is not None else None,
        connected_component_count=result.connected_component_count,
        predicted_class=result.predicted_class,
        predicted_confidence=result.predicted_confidence,
        prob_map_url=f"/api/assets/{result.prob_map_path}?type=result" if result.prob_map_path else None,
        mask_url=f"/api/assets/{result.mask_path}?type=result" if result.mask_path else None,
        overlay_url=f"/api/assets/{result.overlay_path}?type=result" if result.overlay_path else None,
        thumbnail_url=f"/api/assets/{result.thumbnail_path}?type=result" if result.thumbnail_path else None,
        preprocessing_meta=result.preprocessing_meta,
        created_at=result.created_at
    )


@router.get("/{job_id}/revisions", response_model=List[MaskRevisionOut])
def list_revisions(job_id: str, db: Any = Depends(get_db)):
    job = AnalysisJob.objects(id=job_id).first()
    if not job or not job.result:
        raise HTTPException(status_code=404, detail="Job or result not found.")
    return list(MaskRevision.objects(result_id=job.result.id))
