"""
NeuroSeg AI — FastAPI application entry point.
"""
from __future__ import annotations
import logging

import uuid
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, SessionLocal
from app.models import ModelVersion
from app.routers.cases import router as cases_router
from app.routers.jobs import router as jobs_router
from app.routers.assets import router as assets_router
from app.routers.auth import router as auth_router
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

# CORS — allow local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router, prefix="/api")
app.include_router(assets_router, prefix="/api") # Assets not protected to allow <img src>

# Protected routes
protected_depends = [Depends(get_current_user)]
app.include_router(cases_router, prefix="/api", dependencies=protected_depends)
app.include_router(jobs_router, prefix="/api", dependencies=protected_depends)
app.include_router(models_router, prefix="/api", dependencies=protected_depends)
app.include_router(experiments_router, prefix="/api", dependencies=protected_depends)
app.include_router(dashboard_router, prefix="/api", dependencies=protected_depends)
app.include_router(settings_router, prefix="/api", dependencies=protected_depends)


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_models_if_empty()
    log.info("NeuroSeg AI API started. Docs at /api/docs")


def _seed_models_if_empty():
    """Auto-register model configurations on first start (idempotent)."""
    db = SessionLocal()
    try:
        if db.query(ModelVersion).count() == 0:
            models = [
                ModelVersion(
                    id=str(uuid.uuid4()),
                    name="U-Net Baseline",
                    architecture="unet_baseline",
                    version_tag="v1.0",
                    checkpoint_path=None,
                    input_size=256,
                    normalization_mean=0.5,
                    normalization_std=0.5,
                    threshold=0.5,
                    description=(
                        "Standard 4-level U-Net for binary tumour segmentation. "
                        "BCE + soft Dice loss, AdamW optimiser."
                    ),
                    dataset_provenance="TCGA LGG MRI dataset. Train with ml/train.py.",
                    is_active=True,
                ),
                ModelVersion(
                    id=str(uuid.uuid4()),
                    name="Compact Encoder-Decoder",
                    architecture="compact_encoder_decoder",
                    version_tag="v1.0",
                    checkpoint_path=None,
                    input_size=256,
                    normalization_mean=0.5,
                    normalization_std=0.5,
                    threshold=0.5,
                    description=(
                        "Lightweight encoder-decoder with depthwise-separable convolutions. "
                        "Faster inference, lower parameter count."
                    ),
                    dataset_provenance="TCGA LGG MRI dataset. Train with ml/train.py.",
                    is_active=True,
                ),
            ]
            db.add_all(models)
            db.commit()
            log.info("Auto-seeded %d model versions into DB.", len(models))
        else:
            log.info("Model versions already in DB.")
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "disclaimer": "For research and education only; not for diagnosis or treatment.",
    }
