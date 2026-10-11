"""
NeuroSeg AI — API Routers
cases.py  — Case CRUD + upload
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
import os
import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from typing import Any

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
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw = await file.read()
    try:
        w, h, mime = validate_image_file(raw, file.filename or "upload.png")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    path, fname = save_upload(raw, file.filename or "upload.png")
    thumb_path = make_thumbnail(path)

    case = Case(label=label, notes=notes, user_id=current_user.id)
    case.save()

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
    orig_asset.save()
    thumb_asset.save()
    return case


@router.get("/", response_model=List[CaseListItem])
def list_cases(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = {}
    if search:
        query["label__icontains"] = search
        
    if getattr(current_user, 'role', 'user') != 'admin':
        query["user_id__in"] = [current_user.id, None]

    cases_qs = Case.objects(**query).order_by("-created_at").skip(skip).limit(limit)
    cases = list(cases_qs)

    items = []
    for c in cases:
        latest_job = AnalysisJob.objects(case_id=c.id).order_by("-queued_at").first()
        thumb = next((a for a in c.assets if a.asset_type == "thumbnail"), None)
        thumb_url = f"/api/assets/{thumb.filename}?type=upload" if thumb else None
        items.append(
            CaseListItem(
                id=c.id,
                label=c.label,
                created_at=c.created_at,
                updated_at=c.updated_at,
                job_status=latest_job.status if latest_job else None,
                thumbnail_url=thumb_url,
            )
        )
    return items


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Any = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = Case.objects(id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    if getattr(current_user, 'role', 'user') != 'admin' and case.user_id and case.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this case.")
    return case


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(case_id: str, payload: CaseUpdate, db: Any = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = Case.objects(id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    if getattr(current_user, 'role', 'user') != 'admin' and case.user_id and case.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this case.")
    if payload.label is not None:
        case.label = payload.label
    if payload.notes is not None:
        case.notes = payload.notes
    case.updated_at = datetime.utcnow()
    case.save()
    return case


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: str, db: Any = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = Case.objects(id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    if getattr(current_user, 'role', 'user') != 'admin' and case.user_id and case.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this case.")

    # If a job is still running, mark it failed before deleting
    running = AnalysisJob.objects(case_id=case_id, status="running")
    for job in running:
        job.status = "failed"
        job.error_message = "Case deleted while job was running."
        job.save()

    # Remove associated files
    for asset in case.assets:
        _try_delete(settings.upload_dir / asset.filename)
        asset.delete()

    case.delete()


def _try_delete(path):
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass
