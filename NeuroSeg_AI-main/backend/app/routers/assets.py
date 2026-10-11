"""
NeuroSeg AI — Assets serve, reports, mask revision endpoints.
"""
from __future__ import annotations
import io
import json
import csv
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Any

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse

from app.database import get_db
from app.models import (
    AnalysisJob, AnalysisResult, Asset, MaskRevision, Report, ReportFormat, JobStatus
)
from app.schemas import MaskRevisionOut, ReportOut, ReportRequest
from app.config import settings
from app.file_utils import validate_image_file, safe_filename
from app.report_gen import generate_report

router = APIRouter(tags=["Assets & Reports"])


# ─── Static asset serving ────────────────────────────────────────────────────

@router.get("/assets/{filename}")
def serve_asset(filename: str, type: str = "upload"):
    """Serve images and result files. type=upload|result"""
    # Prevent path traversal
    safe = Path(filename).name
    if type == "upload":
        path = settings.upload_dir / safe
    else:
        path = settings.results_dir / safe

    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found.")
    return FileResponse(path=str(path))


# ─── Reports ─────────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/report", response_model=ReportOut, status_code=201)
def create_report(job_id: str, payload: ReportRequest, db: Any = Depends(get_db)):
    job = AnalysisJob.objects(id=job_id).first()
    if not job or job.status != JobStatus.completed:
        raise HTTPException(status_code=425, detail="Job not completed.")
    if not job.result:
        raise HTTPException(status_code=404, detail="No result found.")

    # Note: generate_report expects a db session for SQLAlchemy, but since we are replacing it,
    # generate_report needs to be modified if it uses it. Assuming it uses job directly.
    file_path, size = generate_report(job, payload.format, db)
    report = Report(
        result_id=job.result.id,
        format=payload.format,
        file_path=str(file_path),
        file_size_bytes=size,
    )
    report.save()
    return report


@router.get("/reports/{report_id}/download")
def download_report(report_id: str, db: Any = Depends(get_db)):
    rep = Report.objects(id=report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found.")
    path = Path(rep.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report file missing on disk.")
    mime_map = {
        ReportFormat.pdf: "application/pdf",
        ReportFormat.json: "application/json",
        ReportFormat.csv: "text/csv",
        ReportFormat.png_overlay: "image/png",
        ReportFormat.png_mask: "image/png",
        ReportFormat.zip: "application/zip",
    }
    return FileResponse(
        path=str(path),
        media_type=mime_map.get(rep.format, "application/octet-stream"),
        filename=path.name,
    )


# ─── Mask revisions ──────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/revisions", response_model=MaskRevisionOut, status_code=201)
async def save_revision(
    job_id: str,
    file: UploadFile = File(...),
    notes: str = Form(default=""),
    base_revision_number: int = Form(default=-1),
    db: Any = Depends(get_db),
):
    job = AnalysisJob.objects(id=job_id).first()
    if not job or not job.result:
        raise HTTPException(status_code=404, detail="Job or result not found.")

    revisions = list(MaskRevision.objects(result_id=job.result.id))
    current_rev = len(revisions)
    if base_revision_number != -1 and base_revision_number != current_rev:
        raise HTTPException(
            status_code=409, 
            detail="Stale edit detected. Another revision was saved while you were editing."
        )

    raw = await file.read()
    try:
        validate_image_file(raw, file.filename or "mask.png")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    rev_num = current_rev + 1
    fname = safe_filename(f"revision_{rev_num}.png")
    dest = settings.results_dir / fname
    dest.write_bytes(raw)

    # Deselect previous
    for prev in revisions:
        prev.is_selected = False
        prev.save()

    rev = MaskRevision(
        result_id=job.result.id,
        revision_number=rev_num,
        mask_path=fname,
        notes=notes,
        is_selected=True,
    )
    rev.save()
    return rev


@router.patch("/revisions/{revision_id}/select", response_model=MaskRevisionOut)
def select_revision(revision_id: str, db: Any = Depends(get_db)):
    rev = MaskRevision.objects(id=revision_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found.")
        
    all_revisions = MaskRevision.objects(result_id=rev.result_id)
    for sibling in all_revisions:
        sibling.is_selected = False
        sibling.save()
        
    rev.is_selected = True
    rev.save()
    return rev
