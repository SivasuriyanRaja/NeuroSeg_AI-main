"""
NeuroSeg AI — Report generator (PDF, JSON, CSV, PNG).
"""
from __future__ import annotations
import csv
import io
import json
from datetime import datetime
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AnalysisJob, ReportFormat


def _results_path(filename: str) -> Path:
    return settings.results_dir / filename


def generate_report(
    job: AnalysisJob, fmt: ReportFormat, db: Session
) -> Tuple[Path, int]:
    """Generate a deterministic report file. Returns (path, size_bytes)."""
    r = job.result
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    stem = f"report_{job.id[:8]}_{ts}"

    if fmt == ReportFormat.json:
        return _generate_json(job, r, stem)
    elif fmt == ReportFormat.csv:
        return _generate_csv(job, r, stem)
    elif fmt == ReportFormat.png_overlay:
        return _serve_existing_png(r.overlay_path, stem + "_overlay.png")
    elif fmt == ReportFormat.png_mask:
        return _serve_existing_png(r.mask_path, stem + "_mask.png")
    elif fmt == ReportFormat.pdf:
        return _generate_pdf(job, r, stem)
    elif fmt == ReportFormat.zip:
        return _generate_zip(job, r, stem)
    raise ValueError(f"Unsupported format: {fmt}")


def _generate_json(job, r, stem) -> Tuple[Path, int]:
    payload = {
        "report_generated_at": datetime.utcnow().isoformat(),
        "disclaimer": "For research and education only; not for diagnosis or treatment.",
        "case_id": job.case_id,
        "job_id": job.id,
        "model": {
            "id": job.model_version_id,
            "architecture": job.model_version.architecture,
            "version": job.model_version.version_tag,
            "threshold": job.threshold,
        },
        "processing_ms": job.processing_ms,
        "measurements": {
            "foreground_pixels": r.foreground_pixels,
            "total_pixels": r.total_pixels,
            "foreground_fraction": r.foreground_fraction,
            "connected_component_count": r.connected_component_count,
            "bounding_box": {
                "x": r.bounding_box_x, "y": r.bounding_box_y,
                "w": r.bounding_box_w, "h": r.bounding_box_h,
            } if r.bounding_box_x is not None else None,
        },
        "preprocessing": r.preprocessing_meta,
        "limitations": [
            "2D single-slice analysis only; no 3D volume inferred.",
            "No physical pixel spacing available; pixel counts only.",
            "No anatomical orientation from an un-oriented screenshot.",
            "Foreground region is a mask component, not a confirmed tumor.",
        ],
    }
    path = _results_path(stem + ".json")
    path.write_text(json.dumps(payload, indent=2))
    return path, path.stat().st_size


def _generate_csv(job, r, stem) -> Tuple[Path, int]:
    path = _results_path(stem + ".csv")
    rows = [
        ["field", "value"],
        ["case_id", job.case_id],
        ["job_id", job.id],
        ["model_architecture", job.model_version.architecture],
        ["model_version", job.model_version.version_tag],
        ["threshold", job.threshold],
        ["foreground_pixels", r.foreground_pixels],
        ["total_pixels", r.total_pixels],
        ["foreground_fraction", r.foreground_fraction],
        ["connected_components", r.connected_component_count],
        ["processing_ms", job.processing_ms],
        ["generated_at", datetime.utcnow().isoformat()],
    ]
    with open(path, "w", newline="") as f:
        csv.writer(f).writerows(rows)
    return path, path.stat().st_size


def _serve_existing_png(rel_path, fallback_name) -> Tuple[Path, int]:
    if rel_path:
        p = _results_path(rel_path)
        if p.exists():
            return p, p.stat().st_size
    # Return placeholder PNG
    img = Image.new("RGB", (256, 256), (15, 22, 36))
    d = ImageDraw.Draw(img)
    d.text((10, 120), "Image not available", fill=(100, 200, 200))
    path = _results_path(fallback_name)
    img.save(str(path), "PNG")
    return path, path.stat().st_size


def _generate_pdf(job, r, stem) -> Tuple[Path, int]:
    """Generate a simple research-style PDF using reportlab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib import colors
    except ImportError:
        # Fallback: just return JSON if reportlab not available
        return _generate_json(job, r, stem)

    path = _results_path(stem + ".pdf")
    doc = SimpleDocTemplate(str(path), pagesize=A4,
                            topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    NAVY = colors.HexColor("#0F1629")
    TEAL = colors.HexColor("#14B8A6")

    story.append(Paragraph("NeuroSeg AI — Segmentation Report", styles["Title"]))
    story.append(Paragraph(
        "<i>For research and education only; not for diagnosis or treatment.</i>",
        styles["Italic"]
    ))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", color=TEAL))
    story.append(Spacer(1, 0.4*cm))

    # Case info
    info_data = [
        ["Case ID", job.case_id[:16] + "…"],
        ["Job ID", job.id[:16] + "…"],
        ["Report Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
        ["Processing Time", f"{job.processing_ms} ms" if job.processing_ms else "—"],
    ]
    info_table = Table(info_data, colWidths=[5*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.6*cm))

    # Model
    story.append(Paragraph("Model", styles["Heading2"]))
    model_data = [
        ["Architecture", job.model_version.architecture],
        ["Version", job.model_version.version_tag],
        ["Threshold", str(job.threshold)],
    ]
    model_table = Table(model_data, colWidths=[5*cm, 12*cm])
    model_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(model_table)
    story.append(Spacer(1, 0.6*cm))

    # Measurements
    story.append(Paragraph("Measurements", styles["Heading2"]))
    meas_data = [
        ["Foreground Pixels", str(r.foreground_pixels)],
        ["Total Pixels", str(r.total_pixels)],
        ["Foreground Fraction", f"{r.foreground_fraction:.4f}"],
        ["Connected Components", str(r.connected_component_count)],
    ]
    if r.bounding_box_x is not None:
        meas_data.append([
            "Bounding Box",
            f"x={r.bounding_box_x}, y={r.bounding_box_y}, "
            f"w={r.bounding_box_w}, h={r.bounding_box_h}"
        ])
    meas_table = Table(meas_data, colWidths=[5*cm, 12*cm])
    meas_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(meas_table)
    story.append(Spacer(1, 0.6*cm))

    # Limitations
    story.append(Paragraph("Limitations", styles["Heading2"]))
    limitations = [
        "2D single-slice analysis only. Volume cannot be inferred from one 2D image.",
        "No calibrated pixel spacing; measurements are in pixels only.",
        "No anatomical orientation from an un-oriented image screenshot.",
        "Foreground region is a model mask component, not a confirmed tumor.",
        "Model confidence is not calibrated clinical probability.",
        "Results must not be used for diagnosis or treatment decisions.",
    ]
    for lim in limitations:
        story.append(Paragraph(f"• {lim}", styles["Normal"]))

    doc.build(story)
    return path, path.stat().st_size


def _generate_zip(job, r, stem) -> Tuple[Path, int]:
    path = _results_path(stem + ".zip")
    json_path, _ = _generate_json(job, r, stem + "_inner")
    with zipfile.ZipFile(str(path), "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(str(json_path), "report.json")
        for rel, name in [
            (r.overlay_path, "overlay.png"),
            (r.mask_path, "mask.png"),
            (r.prob_map_path, "prob_map.png"),
        ]:
            if rel:
                p = _results_path(rel)
                if p.exists():
                    zf.write(str(p), name)
    return path, path.stat().st_size
