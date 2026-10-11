"""
NeuroSeg AI — Admin Router.
Provides administrative user management, system metrics, and full control.
"""
from __future__ import annotations
from typing import List, Any, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models import User, Case, AnalysisJob, ModelVersion
from app.auth import get_current_user, get_password_hash
from app.config import settings
from app.file_utils import dir_size_mb

router = APIRouter(prefix="/admin", tags=["Admin"])


class RoleUpdatePayload(BaseModel):
    role: str  # 'admin' or 'user'


class AdminUserCreatePayload(BaseModel):
    email: str
    password: str
    username: Optional[str] = ""
    prefix: Optional[str] = ""
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    profession: Optional[str] = "researcher"
    role: Optional[str] = "user"


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, 'role', 'user') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource.",
        )
    return current_user


def _make_display_name(user: User) -> str:
    pref = (getattr(user, 'prefix', '') or '').strip()
    first = (getattr(user, 'first_name', '') or '').strip()
    last = (getattr(user, 'last_name', '') or '').strip()
    uname = (getattr(user, 'username', '') or '').strip()
    
    if first or last:
        base = f"{first} {last}".strip()
    elif uname:
        base = uname
    else:
        base = user.email.split('@')[0]
        
    if pref and pref.lower() != 'none' and not base.lower().startswith(pref.lower()):
        return f"{pref} {base}"
    return base


@router.get("/overview")
def get_admin_overview(
    db: Any = Depends(get_db),
    admin_user: User = Depends(_require_admin),
):
    total_users = User.objects.count()
    admin_count = User.objects(role="admin").count()
    total_cases = Case.objects.count()
    total_jobs = AnalysisJob.objects.count()
    active_model = ModelVersion.objects(is_active=True).first()
    
    total_storage = (
        dir_size_mb(settings.upload_dir)
        + dir_size_mb(settings.results_dir)
        + dir_size_mb(settings.model_dir)
    )

    return {
        "total_users": total_users,
        "total_admins": admin_count,
        "total_cases": total_cases,
        "total_jobs": total_jobs,
        "active_engine": active_model.name if active_model else "NeuroSeg Fusion Engine v3.0",
        "storage_mb": round(total_storage, 2),
        "status": "operational",
    }


@router.get("/users")
def list_all_users(
    db: Any = Depends(get_db),
    admin_user: User = Depends(_require_admin),
):
    users = list(User.objects().order_by("-created_at"))
    out = []
    for u in users:
        case_cnt = Case.objects(user_id=u.id).count()
        created_str = u.created_at.isoformat() if hasattr(u, 'created_at') and u.created_at else ""
        out.append({
            "id": u.id,
            "email": u.email,
            "username": getattr(u, 'username', '') or u.email.split('@')[0],
            "prefix": getattr(u, 'prefix', '') or '',
            "first_name": getattr(u, 'first_name', '') or '',
            "last_name": getattr(u, 'last_name', '') or '',
            "display_name": _make_display_name(u),
            "profession": getattr(u, 'profession', 'researcher') or 'researcher',
            "role": getattr(u, 'role', 'user') or 'user',
            "created_at": created_str,
            "case_count": case_cnt,
        })
    return out


@router.post("/users", status_code=201)
def create_user_by_admin(
    payload: AdminUserCreatePayload,
    db: Any = Depends(get_db),
    admin_user: User = Depends(_require_admin),
):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
        
    existing = User.objects(email=email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
        
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        
    new_user = User(
        email=email,
        username=payload.username or email.split('@')[0],
        prefix=payload.prefix or "",
        first_name=payload.first_name or "",
        last_name=payload.last_name or "",
        profession=payload.profession or "researcher",
        role="admin" if payload.role == "admin" else "user",
        hashed_password=get_password_hash(payload.password),
    )
    new_user.save()
    return {
        "id": new_user.id,
        "email": new_user.email,
        "username": new_user.username,
        "role": new_user.role,
        "message": "User created successfully",
    }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: RoleUpdatePayload,
    db: Any = Depends(get_db),
    admin_user: User = Depends(_require_admin),
):
    target = User.objects(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    new_role = "admin" if payload.role.lower() == "admin" else "user"
    
    # Prevent the only admin from demoting themselves
    if target.id == admin_user.id and new_role != "admin":
        admin_count = User.objects(role="admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote yourself when you are the sole administrator."
            )

    target.role = new_role
    target.save()
    return {"id": target.id, "email": target.email, "role": target.role}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Any = Depends(get_db),
    admin_user: User = Depends(_require_admin),
):
    target = User.objects(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    if target.id == admin_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own active administrator account."
        )

    target.delete()
    return {"message": f"User {target.email} was successfully deleted."}
