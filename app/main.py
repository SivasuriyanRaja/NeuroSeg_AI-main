"""
NeuroSeg AI — FastAPI application entry point.
"""
from __future__ import annotations
import logging

import uuid
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.models import ModelVersion
from app.routers.cases import router as cases_router
from app.routers.jobs import router as jobs_router
from app.routers.assets import router as assets_router
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router
from app.routers.misc import (
    models_router, experiments_router, dashboard_router, settings_router
)
from fastapi import Depends
from app.auth import get_current_user

log = logging.getLogger("neuroseg.api")

app = FastAPI(
    title="NeuroSeg AI",
    description="MRI Segmentation and Research Workspace — For research and education only.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — allow frontend dev server and production deployments (e.g. Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router, prefix="/api")
app.include_router(assets_router, prefix="/api") # Assets not protected to allow <img src>

# Protected routes
protected_depends = []
app.include_router(cases_router, prefix="/api", dependencies=protected_depends)
app.include_router(jobs_router, prefix="/api", dependencies=protected_depends)
app.include_router(models_router, prefix="/api", dependencies=protected_depends)
app.include_router(experiments_router, prefix="/api", dependencies=protected_depends)
app.include_router(dashboard_router, prefix="/api", dependencies=protected_depends)
app.include_router(settings_router, prefix="/api", dependencies=protected_depends)
app.include_router(admin_router, prefix="/api", dependencies=protected_depends)


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_models_if_empty()
    _seed_admin_if_empty()
    log.info("NeuroSeg AI API started. Docs at /api/docs")
    
    import threading
    from app.worker import run_worker
    t = threading.Thread(target=run_worker, daemon=True)
    t.start()
    log.info("Worker thread started in-process.")


def _seed_models_if_empty():
    """Ensure only the unified NeuroSeg Fusion Engine is registered (idempotent)."""
    # Remove any legacy multi-model records
    legacy_names = ["U-Net Baseline", "Compact Encoder-Decoder", "DenseNet121 Classifier"]
    for name in legacy_names:
        existing = ModelVersion.objects(name=name).first()
        if existing:
            existing.delete()
            log.info("Removed legacy model: %s", name)

    # Seed the single Fusion Engine if not already present
    if not ModelVersion.objects(name="NeuroSeg Fusion Engine").first():
        fusion = ModelVersion(
            id=str(uuid.uuid4()),
            name="NeuroSeg Fusion Engine",
            architecture="fusion_engine",
            version_tag="v3.0",
            checkpoint_path=None,
            input_size=256,
            normalization_mean=0.5,
            normalization_std=0.5,
            threshold=0.5,
            description=(
                "Unified AI engine combining GPT-4o Vision (classification + bbox) "
                "with OpenCV GrabCut segmentation for pixel-perfect masks. "
                "Handles all tumor types: glioblastoma, glioma, meningioma, "
                "metastasis, pituitary, low-grade glioma."
            ),
            dataset_provenance="GPT-4o Vision API + OpenCV GrabCut. No local checkpoint required.",
            is_active=True,
        )
        fusion.save()
        log.info("Seeded NeuroSeg Fusion Engine.")
        log.info("NeuroSeg Fusion Engine already in DB.")


def _seed_admin_if_empty():
    """Ensure a dedicated administrator account exists."""
    from app.models import User
    from app.auth import get_password_hash
    admin_email = "admin@neuroseg.ai"
    admin_user = User.objects(email=admin_email).first()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            username="admin",
            prefix="Dr.",
            first_name="System",
            last_name="Administrator",
            profession="doctor",
            role="admin",
            hashed_password=get_password_hash("admin123"),
        )
        admin_user.save()
        log.info("Seeded default Administrator account: %s", admin_email)
    else:
        if getattr(admin_user, 'role', '') != 'admin':
            admin_user.role = 'admin'
            admin_user.save()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "disclaimer": "For research and education only; not for diagnosis or treatment.",
    }
