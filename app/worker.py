"""
NeuroSeg AI — Analysis worker process.
Polls the job table, claims queued jobs, runs inference, writes results.
Designed to run as a separate process: `python -m app.worker`
"""
from __future__ import annotations
import logging
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional, Any

from app.config import settings
from app.database import init_db
from app.models import AnalysisJob, AnalysisResult, JobStatus, Asset, Case
from app.inference import run_inference

log = logging.getLogger("neuroseg.worker")
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

MAX_RETRIES = settings.worker_max_retries
POLL_INTERVAL = settings.worker_poll_interval


def claim_next_job() -> Optional[AnalysisJob]:
    """Claim a queued job."""
    job = AnalysisJob.objects(status=JobStatus.queued).order_by("queued_at").first()
    if job:
        job.status = JobStatus.running
        job.started_at = datetime.utcnow()
        job.save()
    return job


def recover_interrupted_jobs() -> None:
    """On worker start, re-queue running jobs that weren't completed."""
    stale = list(AnalysisJob.objects(status=JobStatus.running))
    for job in stale:
        if job.retry_count < MAX_RETRIES:
            log.warning("Recovering interrupted job %s (retry %d)", job.id, job.retry_count)
            job.status = JobStatus.queued
            job.retry_count += 1
            job.error_message = "Recovered after worker restart."
        else:
            log.error("Job %s exceeded max retries, marking failed.", job.id)
            job.status = JobStatus.failed
            job.error_message = f"Failed after {MAX_RETRIES} retries."
        job.save()


def process_job(job: AnalysisJob) -> None:
    """Run inference for a single job."""
    t_start = time.perf_counter()

    # Resolve original image path
    case = job.case
    orig_asset = next(
        (a for a in case.assets if a.asset_type == "original"), None
    )
    if not orig_asset:
        raise RuntimeError("No original image asset found for case.")

    image_path = settings.upload_dir / orig_asset.filename

    result_data = run_inference(
        image_path=image_path,
        model_version=job.model_version,
        threshold=job.threshold,
        orig_filename=orig_asset.original_filename,
    )

    elapsed_ms = int((time.perf_counter() - t_start) * 1000)

    result = AnalysisResult(
        job_id=job.id,
        foreground_pixels=result_data["foreground_pixels"],
        total_pixels=result_data["total_pixels"],
        foreground_fraction=result_data["foreground_fraction"],
        bounding_box_x=result_data.get("bbox_x"),
        bounding_box_y=result_data.get("bbox_y"),
        bounding_box_w=result_data.get("bbox_w"),
        bounding_box_h=result_data.get("bbox_h"),
        connected_component_count=result_data["connected_components"],
        prob_map_path=result_data.get("prob_map_filename"),
        mask_path=result_data.get("mask_filename"),
        overlay_path=result_data.get("overlay_filename"),
        thumbnail_path=result_data.get("thumbnail_filename"),
        preprocessing_meta=result_data.get("preprocessing_meta", {}),
        predicted_class=result_data.get("predicted_class"),
        predicted_confidence=result_data.get("predicted_confidence"),
        openai_analysis=result_data.get("openai_analysis"),
    )
    result.save()

    job.status = JobStatus.completed
    job.completed_at = datetime.utcnow()
    job.processing_ms = elapsed_ms
    job.save()
    log.info("Job %s completed in %d ms.", job.id, elapsed_ms)


def run_worker() -> None:
    """Main worker loop."""
    init_db()
    log.info("NeuroSeg AI worker starting.")

    recover_interrupted_jobs()

    while True:
        job = claim_next_job()
        if job:
            log.info("Processing job %s (case=%s, model=%s).",
                     job.id, job.case_id, job.model_version_id)
            try:
                process_job(job)
            except Exception:
                err = traceback.format_exc()
                log.error("Job %s failed:\n%s", job.id, err)
                j = AnalysisJob.objects(id=job.id).first()
                if j:
                    j.retry_count += 1
                    if j.retry_count >= MAX_RETRIES:
                        j.status = JobStatus.failed
                        j.error_message = err[-2000:]
                    else:
                        j.status = JobStatus.queued
                        j.error_message = f"Retrying ({j.retry_count}/{MAX_RETRIES})."
                    j.completed_at = datetime.utcnow()
                    j.save()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_worker()
