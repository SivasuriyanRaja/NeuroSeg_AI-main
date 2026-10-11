"""
NeuroSeg AI — MongoEngine Models
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
import enum
from mongoengine import (
    Document, StringField, IntField, FloatField, BooleanField, DateTimeField,
    ReferenceField, DictField, EnumField, ListField
)

def _now() -> datetime:
    return datetime.utcnow()

def _uid() -> str:
    return str(uuid.uuid4())

class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"

class ReportFormat(str, enum.Enum):
    pdf = "pdf"
    json = "json"
    csv = "csv"
    png_overlay = "png_overlay"
    png_mask = "png_mask"
    zip = "zip"

class User(Document):
    meta = {'strict': False}
    id = StringField(primary_key=True, default=_uid)
    email = StringField(required=True, unique=True)
    hashed_password = StringField(required=True)
    role = StringField(default="user")  # 'user' or 'admin'
    username = StringField(default="")
    prefix = StringField(default="")
    first_name = StringField(default="")
    last_name = StringField(default="")
    profession = StringField(default="researcher")  # 'doctor', 'researcher', 'student'
    created_at = DateTimeField(default=_now)

class ModelVersion(Document):
    id = StringField(primary_key=True, default=_uid)
    name = StringField(required=True)
    architecture = StringField(required=True)
    version_tag = StringField(required=True)
    checkpoint_path = StringField()
    input_size = IntField(default=256)
    normalization_mean = FloatField(default=0.5)
    normalization_std = FloatField(default=0.5)
    threshold = FloatField(default=0.5)
    parameter_count = IntField(null=True)
    weight_file_size_bytes = IntField(null=True)
    description = StringField(default="")
    dataset_provenance = StringField(default="")
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=_now)

class Case(Document):
    id = StringField(primary_key=True, default=_uid)
    label = StringField(default="")
    notes = StringField(default="")
    created_at = DateTimeField(default=_now)
    updated_at = DateTimeField(default=_now)
    user_id = StringField()

    @property
    def user(self):
        return User.objects(id=self.user_id).first()
        
    @property
    def assets(self):
        return Asset.objects(case_id=self.id)
        
    @property
    def jobs(self):
        return AnalysisJob.objects(case_id=self.id)

class Asset(Document):
    id = StringField(primary_key=True, default=_uid)
    case_id = StringField(required=True)
    asset_type = StringField(required=True)
    filename = StringField(required=True)
    original_filename = StringField(default="")
    mime_type = StringField(default="image/png")
    file_size_bytes = IntField(default=0)
    width = IntField(null=True)
    height = IntField(null=True)
    created_at = DateTimeField(default=_now)

    @property
    def case(self):
        return Case.objects(id=self.case_id).first()

class AnalysisResult(Document):
    id = StringField(primary_key=True, default=_uid)
    job_id = StringField(required=True, unique=True)
    foreground_pixels = IntField(default=0)
    total_pixels = IntField(default=0)
    foreground_fraction = FloatField(default=0.0)
    bounding_box_x = IntField(null=True)
    bounding_box_y = IntField(null=True)
    bounding_box_w = IntField(null=True)
    bounding_box_h = IntField(null=True)
    connected_component_count = IntField(default=0)
    predicted_class = StringField(null=True)
    predicted_confidence = FloatField(null=True)
    prob_map_path = StringField(null=True)
    mask_path = StringField(null=True)
    overlay_path = StringField(null=True)
    thumbnail_path = StringField(null=True)
    preprocessing_meta = DictField(default=dict)
    openai_analysis = StringField(null=True)
    created_at = DateTimeField(default=_now)

class AnalysisJob(Document):
    id = StringField(primary_key=True, default=_uid)
    case_id = StringField(required=True)
    model_version_id = StringField(required=True)
    status = EnumField(JobStatus, default=JobStatus.queued)
    threshold = FloatField(default=0.5)
    retry_count = IntField(default=0)
    error_message = StringField(null=True)
    queued_at = DateTimeField(default=_now)
    started_at = DateTimeField(null=True)
    completed_at = DateTimeField(null=True)
    processing_ms = IntField(null=True)

    @property
    def case(self):
        return Case.objects(id=self.case_id).first()
        
    @property
    def model_version(self):
        return ModelVersion.objects(id=self.model_version_id).first()
        
    @property
    def result(self):
        return AnalysisResult.objects(job_id=self.id).first()

class MaskRevision(Document):
    id = StringField(primary_key=True, default=_uid)
    result_id = StringField(required=True)
    revision_number = IntField(required=True)
    mask_path = StringField(required=True)
    notes = StringField(default="")
    is_selected = BooleanField(default=False)
    created_at = DateTimeField(default=_now)

class Report(Document):
    id = StringField(primary_key=True, default=_uid)
    result_id = StringField(required=True)
    format = EnumField(ReportFormat, required=True)
    file_path = StringField(required=True)
    file_size_bytes = IntField(default=0)
    created_at = DateTimeField(default=_now)

class ExperimentRun(Document):
    id = StringField(primary_key=True, default=_uid)
    model_version_id = StringField(required=True)
    run_name = StringField(required=True)
    dataset_name = StringField(default="")
    split_identity = StringField(default="")
    epochs_trained = IntField(default=0)
    best_epoch = IntField(default=0)
    best_val_dice = FloatField(default=0.0)
    test_dice = FloatField(null=True)
    test_iou = FloatField(null=True)
    test_precision = FloatField(null=True)
    test_recall = FloatField(null=True)
    parameter_count = IntField(null=True)
    peak_memory_mb = FloatField(null=True)
    median_latency_ms = FloatField(null=True)
    p95_latency_ms = FloatField(null=True)
    hardware_info = StringField(default="")
    training_curves = DictField(default=dict)
    config_snapshot = DictField(default=dict)
    created_at = DateTimeField(default=_now)

class BaseDummy:
    metadata = type("Metadata", (), {"create_all": lambda bind: None})()
Base = BaseDummy()
