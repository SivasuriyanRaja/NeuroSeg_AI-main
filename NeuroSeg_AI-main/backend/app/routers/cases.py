"""
NeuroSeg AI — API Routers
cases.py  — Case CRUD + upload
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Case, Asset, AnalysisJob, User
from app.schemas import CaseCreate, CaseOut, CaseUpdate, AssetOut, CaseListItem
from app.file_utils import validate_image_file, save_upload, make_thumbnail
from app.config import settings
from app.auth import get_current_user

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.post("/", response_model=CaseOut, status_code=201)
async def create_case_with_upload(
    file: UploadFile = File(...),
    label: str = Form(default=""),
    notes: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new case and store the uploaded MRI image."""
    raw = await file.read()
    try:
        w, h, mime = validate_image_file(raw, file.filename or "upload.png")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    path, fname = save_upload(raw, file.filename or "upload.png")
    thumb_path = make_thumbnail(path)

    case = Case(label=label, notes=notes, user_id=current_user.id)
    db.add(case)
    db.flush()

    orig_asset = Asset(
        case_id=case.id,
        asset_type="original",
        filename=fname,
        original_filename=file.filename or "",
        mime_type=mime,
        file_size_bytes=len(raw),
        width=w,
        height=h,
    )
    thumb_asset = Asset(
        case_id=case.id,
        asset_type="thumbnail",
        filename=thumb_path.name,
        original_filename="",
        mime_type="image/png",
        file_size_bytes=thumb_path.stat().st_size,
        width=256,
        height=256,
    )
    db.add_all([orig_asset, thumb_asset])
    db.commit()
    db.refresh(case)
    return case


@router.get("/", response_model=List[CaseListItem])
def list_cases(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Case).filter(
        (Case.user_id == current_user.id) | (Case.user_id.is_(None))
    )
    if search:
        q = q.filter(Case.label.ilike(f"%{search}%"))
    cases = q.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for c in cases:
        latest_job = (
            db.query(AnalysisJob)
            .filter(AnalysisJob.case_id == c.id)
            .order_by(AnalysisJob.queued_at.desc())
            .first()
        )
        thumb = next((a for a in c.assets if a.asset_type == "thumbnail"), None)
        thumb_url = f"/api/assets/{thumb.filename}?type=upload" if thumb else None
        items.append(
            CaseListItem(
                id=c.id,
                label=c.label,
                created_at=c.created_at,
                updated_at=c.updated_at,
                job_status=latest_job.status.value if latest_job else None,
                thumbnail_url=thumb_url,
            )
        )
    return items


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(case_id: str, payload: CaseUpdate, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    if payload.label is not None:
        case.label = payload.label
    if payload.notes is not None:
        case.notes = payload.notes
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # If a job is still running, mark it failed before deleting
    running = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.case_id == case_id, AnalysisJob.status == "running")
        .all()
    )
    for job in running:
        job.status = "failed"
        job.error_message = "Case deleted while job was running."
    db.flush()

    # Remove associated files
    for asset in case.assets:
        _try_delete(settings.upload_dir / asset.filename)

    db.delete(case)
    db.commit()


def _try_delete(path):
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass
