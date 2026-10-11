"""
NeuroSeg AI — Pydantic schemas for API request / response validation.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.models import JobStatus, ReportFormat


# ─── Model Version ───────────────────────────────────────────────────────────

class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    architecture: str
    version_tag: str
    input_size: int
    threshold: float
    parameter_count: Optional[int]
    weight_file_size_bytes: Optional[int]
    description: str
    dataset_provenance: str
    is_active: bool
    created_at: datetime


# ─── Asset ───────────────────────────────────────────────────────────────────

class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    asset_type: str
    filename: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    width: Optional[int]
    height: Optional[int]
    created_at: datetime


# ─── Case ────────────────────────────────────────────────────────────────────

class CaseCreate(BaseModel):
    label: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=5000)


class CaseUpdate(BaseModel):
    label: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=5000)


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    notes: str
    created_at: datetime
    updated_at: datetime
    assets: List[AssetOut] = []


class CaseListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    created_at: datetime
    updated_at: datetime
    job_status: Optional[str] = None
    thumbnail_url: Optional[str] = None


# ─── Analysis Job ─────────────────────────────────────────────────────────────

class AnalysisSubmit(BaseModel):
    model_version_id: str
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class JobStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    case_id: str
    model_version_id: str
    status: JobStatus
    threshold: float
    retry_count: int
    error_message: Optional[str]
    queued_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    processing_ms: Optional[int]


# ─── Analysis Result ──────────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class AnalysisResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    foreground_pixels: int
    total_pixels: int
    foreground_fraction: float
    bounding_box: Optional[BoundingBox] = None
    connected_component_count: int
    predicted_class: Optional[str] = None
    predicted_confidence: Optional[float] = None
    prob_map_url: Optional[str] = None
    mask_url: Optional[str] = None
    overlay_url: Optional[str] = None
    preprocessing_meta: Dict[str, Any]
    openai_analysis: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_orm_with_bbox(cls, obj):
        data = {
            "id": obj.id,
            "job_id": obj.job_id,
            "foreground_pixels": obj.foreground_pixels,
            "total_pixels": obj.total_pixels,
            "foreground_fraction": obj.foreground_fraction,
            "connected_component_count": obj.connected_component_count,
            "predicted_class": obj.predicted_class,
            "predicted_confidence": obj.predicted_confidence,
            "prob_map_url": f"/api/assets/{obj.prob_map_path}?type=result" if obj.prob_map_path else None,
            "mask_url": f"/api/assets/{obj.mask_path}?type=result" if obj.mask_path else None,
            "overlay_url": f"/api/assets/{obj.overlay_path}?type=result" if obj.overlay_path else None,
            "preprocessing_meta": obj.preprocessing_meta or {},
            "openai_analysis": getattr(obj, "openai_analysis", None),
            "created_at": obj.created_at,
        }
        if obj.bounding_box_x is not None:
            data["bounding_box"] = BoundingBox(
                x=obj.bounding_box_x, y=obj.bounding_box_y,
                w=obj.bounding_box_w, h=obj.bounding_box_h,
            )
        return cls(**data)


# ─── Mask Revision ───────────────────────────────────────────────────────────

class MaskRevisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    result_id: str
    revision_number: int
    notes: str
    is_selected: bool
    created_at: datetime


# ─── Report ──────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    format: ReportFormat


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    result_id: str
    format: ReportFormat
    file_size_bytes: int
    created_at: datetime


# ─── Experiment Run ──────────────────────────────────────────────────────────

class ExperimentRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    model_version_id: str
    run_name: str
    dataset_name: str
    epochs_trained: int
    best_epoch: int
    best_val_dice: float
    test_dice: Optional[float]
    test_iou: Optional[float]
    test_precision: Optional[float]
    test_recall: Optional[float]
    parameter_count: Optional[int]
    peak_memory_mb: Optional[float]
    median_latency_ms: Optional[float]
    p95_latency_ms: Optional[float]
    hardware_info: str
    training_curves: Dict[str, Any]
    config_snapshot: Dict[str, Any]
    created_at: datetime


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_cases: int
    completed_analyses: int
    running_jobs: int
    queued_jobs: int
    failed_jobs: int
    active_model: Optional[ModelVersionOut]
    recent_jobs: List[JobStatusOut]


# ─── Settings ────────────────────────────────────────────────────────────────

class StorageStats(BaseModel):
    upload_dir: str
    results_dir: str
    model_dir: str
    upload_size_mb: float
    results_size_mb: float
    model_size_mb: float
