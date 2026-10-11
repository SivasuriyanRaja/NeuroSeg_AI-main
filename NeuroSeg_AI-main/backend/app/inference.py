"""
NeuroSeg AI — Unified Fusion Inference Engine
==============================================
One single call to GPT-4o Vision does ALL of:
  1. Tumor classification  (type + confidence)
  2. Bounding box detection (precise JSON coordinates)
  3. Severity / grade estimation
  4. Brief clinical note

The bounding box is then refined pixel-perfect by our robust
OpenCV segmentation pipeline (Otsu + GrabCut + morphology) to
produce the binary mask, overlay, and probability map.

Fallback chain (safest first):
  GPT-4o Vision  →  Mistral-Large Vision  →  local CV engine
"""
from __future__ import annotations
import base64
import io
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image

from app.config import settings

log = logging.getLogger("neuroseg.inference")


# ── helpers ─────────────────────────────────────────────────────────────────

def _encode_image_b64(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _compute_measurements(mask: np.ndarray) -> Dict[str, Any]:
    """Foreground metrics from a binary mask."""
    from scipy import ndimage

    fg = int(np.sum(mask > 0))
    total = int(mask.size)
    fraction = fg / total if total > 0 else 0.0
    labeled, n_components = ndimage.label(mask > 0)

    bbox = None
    if fg > 0:
        rows = np.any(mask > 0, axis=1)
        cols = np.any(mask > 0, axis=0)
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        bbox = (int(cmin), int(rmin), int(cmax - cmin), int(rmax - rmin))

    return {
        "foreground_pixels": fg,
        "total_pixels": total,
        "foreground_fraction": fraction,
        "connected_components": n_components,
        "bbox": bbox,
    }


def _save_outputs(prob_map: np.ndarray, mask: np.ndarray, orig_img_path: Path) -> Dict[str, str]:
    """Save prob map, binary mask, and overlay PNGs. Returns relative filenames."""
    uid = uuid.uuid4().hex[:12]
    out: Dict[str, str] = {}
    h, w = prob_map.shape[:2]

    # Probability map — red heat-map with alpha = probability
    prob_uint8 = (np.clip(prob_map, 0, 1) * 255).astype(np.uint8)
    prob_img = Image.new("RGBA", (w, h), (220, 50, 50, 0))
    prob_img.putalpha(Image.fromarray(prob_uint8, mode="L"))
    prob_fname = f"prob_{uid}.png"
    prob_img.save(str(settings.results_dir / prob_fname))
    out["prob_map_filename"] = prob_fname

    # Binary mask — teal on transparent
    mask_uint8 = (np.clip(mask, 0, 1) * 255).astype(np.uint8)
    teal_mask = Image.new("RGBA", (w, h), (20, 184, 166, 0))
    teal_mask.putalpha(Image.fromarray(mask_uint8, mode="L"))
    mask_fname = f"mask_{uid}.png"
    teal_mask.save(str(settings.results_dir / mask_fname))
    out["mask_filename"] = mask_fname

    # Overlay — 60% opacity teal
    overlay_alpha = (np.clip(mask, 0, 1) * 153).astype(np.uint8)
    teal_overlay = Image.new("RGBA", (w, h), (20, 184, 166, 0))
    teal_overlay.putalpha(Image.fromarray(overlay_alpha, mode="L"))
    overlay_fname = f"overlay_{uid}.png"
    teal_overlay.save(str(settings.results_dir / overlay_fname))
    out["overlay_filename"] = overlay_fname

    return out


# ── Local OpenCV segmentation engine ────────────────────────────────────────

def _cv_segment(image_path: Path, hint_bbox=None) -> tuple:
    """
    Robust local OpenCV segmentation.
    If hint_bbox (x1,y1,x2,y2) is provided from the AI, we refine it with GrabCut.
    Otherwise we use multi-scale Otsu + morphology to find the brightest lesion.
    Returns: (mask uint8 H×W, prob float32 H×W, measurements dict)
    """
    import cv2

    img_pil = Image.open(image_path).convert("RGB")
    img_arr = np.array(img_pil)
    gray = cv2.cvtColor(img_arr, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape

    # ── Step 1: Brain-region mask ──────────────────────────────────────────
    _, brain_thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    k7 = np.ones((7, 7), np.uint8)
    brain_thresh = cv2.morphologyEx(brain_thresh, cv2.MORPH_CLOSE, k7, iterations=3)
    cnts, _ = cv2.findContours(brain_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    brain_mask = np.zeros_like(gray)
    if cnts:
        cv2.drawContours(brain_mask, [max(cnts, key=cv2.contourArea)], -1, 255, cv2.FILLED)

    brain_gray = cv2.bitwise_and(gray, gray, mask=brain_mask)
    brain_px = brain_gray[brain_mask > 0]

    if brain_px.size == 0:
        empty = np.zeros((h, w), dtype=np.uint8)
        return empty, empty.astype(np.float32), _compute_measurements(empty)

    # ── Step 2: If we have a bbox hint from AI, use GrabCut ───────────────
    if hint_bbox is not None:
        x1, y1, x2, y2 = hint_bbox
        # Clamp
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w - 1, x2), min(h - 1, y2)
        bw, bh = x2 - x1, y2 - y1

        if bw > 4 and bh > 4:
            try:
                gc_mask = np.zeros((h, w), dtype=np.uint8)
                bgd_model = np.zeros((1, 65), np.float64)
                fgd_model = np.zeros((1, 65), np.float64)
                rect = (x1, y1, bw, bh)
                cv2.grabCut(img_arr, gc_mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
                gc_fg = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
                # Keep only inside brain
                gc_fg = cv2.bitwise_and(gc_fg, gc_fg, mask=brain_mask // 255)

                # Morphological cleanup
                k3 = np.ones((3, 3), np.uint8)
                gc_fg = cv2.morphologyEx(gc_fg, cv2.MORPH_OPEN, k3, iterations=1)
                gc_fg = cv2.dilate(gc_fg, k3, iterations=2)

                if gc_fg.sum() > 50:
                    prob_map = gc_fg.astype(np.float32)
                    # Smooth prob map with distance transform for nicer visuals
                    dist = cv2.distanceTransform(gc_fg, cv2.DIST_L2, 5)
                    if dist.max() > 0:
                        prob_map = (dist / dist.max()).astype(np.float32)
                    m = _compute_measurements(gc_fg)
                    return gc_fg, prob_map, m
            except Exception as e:
                log.warning(f"GrabCut failed: {e}. Using Otsu fallback.")

    # ── Step 3: Pure Otsu bright-region detection inside brain ────────────
    p75 = float(np.percentile(brain_px, 75))
    p95 = float(np.percentile(brain_px, 95))

    thresholds = [p95, p95 * 0.90, p95 * 0.82, p75 * 1.10]
    tumor_mask = np.zeros((h, w), dtype=np.uint8)

    for thresh_val in thresholds:
        thresh_val = min(thresh_val, 254)
        candidate = (brain_gray > thresh_val).astype(np.uint8)

        # Keep only bright regions well above mean background
        mean_bg = float(np.mean(brain_px))
        if thresh_val < mean_bg * 1.2:
            continue

        # Morphological cleanup
        k5 = np.ones((5, 5), np.uint8)
        candidate = cv2.morphologyEx(candidate, cv2.MORPH_OPEN, k5, iterations=1)
        candidate = cv2.dilate(candidate, k5, iterations=2)

        if candidate.sum() > 100:
            tumor_mask = candidate
            break

    if tumor_mask.sum() == 0:
        # Last resort: top 3% brightest pixels inside brain
        thr = float(np.percentile(brain_px, 97))
        tumor_mask = ((brain_gray > thr) & (brain_mask > 0)).astype(np.uint8)

    # Distance-based probability map
    dist = cv2.distanceTransform(tumor_mask, cv2.DIST_L2, 5)
    prob_map = (dist / dist.max()).astype(np.float32) if dist.max() > 0 else tumor_mask.astype(np.float32)

    m = _compute_measurements(tumor_mask)
    return tumor_mask, prob_map, m


# ── Unified AI call (GPT-4o Vision) ─────────────────────────────────────────

_SYSTEM_PROMPT = """You are a neuroradiology AI assistant. Analyze the brain MRI image provided.
Return a single JSON object with exactly these fields:
{
  "classification": "<tumor_type>",
  "confidence": <float 0-1>,
  "grade": "<WHO grade or N/A>",
  "bbox": [ymin, xmin, ymax, xmax],
  "note": "<one sentence clinical impression>"
}

Rules:
- classification must be one of: glioblastoma, glioma, low-grade glioma, meningioma, metastasis, pituitary, notumor
- bbox coordinates are integers normalized 0–1000 (1000 = full image width/height)
- If no tumor is visible, set classification to "notumor" and bbox to []
- Respond ONLY with valid JSON, no markdown, no extra text."""

def _call_gpt4o_vision(image_path: Path) -> dict | None:
    """Call GPT-4o Vision for full classification + bbox in one shot."""
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key="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"
        )
        img_b64 = _encode_image_b64(image_path)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}", "detail": "high"}},
                        {"type": "text", "text": "Analyze this brain MRI scan. Return JSON only."}
                    ]
                }
            ],
            max_tokens=512,
            temperature=0.1,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        log.warning(f"GPT-4o Vision failed: {e}")
        return None


def _call_mistral_vision(image_path: Path) -> dict | None:
    """Fallback: call Mistral-Large Vision for classification + bbox."""
    try:
        import io as _io
        from openai import OpenAI
        client = OpenAI(
            base_url="https://api.xkiro.com/v1",
            api_key="sk-xt-9929f47bdd2e178b30c2f7f1cdc86c3a36cb3bd79eee89c3"
        )
        img_pil = Image.open(image_path).convert("RGB")
        buf = _io.BytesIO()
        img_pil.save(buf, format="JPEG")
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        resp = client.chat.completions.create(
            model="mistralai/mistral-large-4-0",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                        {"type": "text", "text": "Analyze this brain MRI scan. Return JSON only."}
                    ]
                }
            ],
            temperature=0.2,
            max_tokens=512,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        log.warning(f"Mistral Vision fallback failed: {e}")
        return None


def _local_cv_classify(measurements: dict, image_path: Path) -> tuple[str, float]:
    """Pure-CV classification from mask shape/intensity statistics when all APIs fail."""
    import cv2

    fg_fraction = measurements.get("foreground_fraction", 0)
    n_components = measurements.get("connected_components", 0)

    if fg_fraction == 0:
        return "notumor", 0.65

    img = np.array(Image.open(image_path).convert("RGB"))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    cy, cx = gray.shape[0] // 2, gray.shape[1] // 2

    bbox = measurements.get("bbox")
    avg_intensity = 128.0
    is_central = True
    if bbox:
        x, y, bw, bh = bbox
        roi = gray[y:y + bh, x:x + bw]
        if roi.size > 0:
            avg_intensity = float(np.mean(roi))
        tumor_cx = x + bw / 2
        tumor_cy = y + bh / 2
        is_central = (abs(tumor_cx - cx) < cx * 0.35 and abs(tumor_cy - cy) < cy * 0.35)

    if fg_fraction > 0.18:
        return "glioblastoma", min(0.92, 0.75 + fg_fraction * 0.8)
    if n_components >= 3:
        return "metastasis", min(0.88, 0.68 + n_components * 0.04)
    if is_central and avg_intensity > 160:
        return "pituitary", 0.80
    if not is_central and fg_fraction < 0.06:
        return "meningioma", 0.78
    if fg_fraction < 0.025:
        return "low-grade glioma", 0.72
    return "glioma", min(0.86, 0.68 + fg_fraction * 1.0)


# ── Preprocessing (kept for any optional PyTorch path) ───────────────────────

def _preprocess(image_path: Path, input_size: int, mean, std):
    import torch

    img = Image.open(image_path).convert("RGB")
    orig_w, orig_h = img.size
    scale = min(input_size / orig_w, input_size / orig_h)
    new_w, new_h = int(orig_w * scale), int(orig_h * scale)
    img_resized = img.resize((new_w, new_h), Image.LANCZOS)

    padded = Image.new("RGB", (input_size, input_size), 0)
    pad_left = (input_size - new_w) // 2
    pad_top  = (input_size - new_h) // 2
    padded.paste(img_resized, (pad_left, pad_top))

    arr = np.array(padded, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))
    mean_arr = np.array(mean, dtype=np.float32).reshape(-1, 1, 1)
    std_arr  = np.array(std,  dtype=np.float32).reshape(-1, 1, 1)
    arr = (arr - mean_arr) / (std_arr + 1e-8)

    tensor = torch.from_numpy(arr).unsqueeze(0)
    meta = {
        "orig_w": orig_w, "orig_h": orig_h, "input_size": input_size,
        "new_w": new_w, "new_h": new_h, "pad_left": pad_left, "pad_top": pad_top,
        "mean": mean, "std": std,
    }
    return tensor, meta


# ── Main entry point ─────────────────────────────────────────────────────────

def run_inference(
    image_path: Path,
    model_version,
    threshold: float,
    orig_filename: str = "",
) -> Dict[str, Any]:
    """
    NeuroSeg Fusion Engine:
      1. Call GPT-4o Vision (classification + bbox)
      2. Fallback to Mistral Vision
      3. Fallback to pure-CV engine
      4. Pixel-perfect OpenCV segmentation refined by GrabCut
      5. Produce mask / overlay / prob-map PNGs
    """
    log.info("NeuroSeg Fusion: starting inference on %s", image_path.name)

    img_pil = Image.open(image_path).convert("RGB")
    orig_w, orig_h = img_pil.size

    ai_result: dict | None = None

    # ── Stage 1: GPT-4o Vision ─────────────────────────────────────────────
    ai_result = _call_gpt4o_vision(image_path)

    # ── Stage 2: Mistral Vision fallback ──────────────────────────────────
    if ai_result is None:
        log.info("Falling back to Mistral Vision...")
        ai_result = _call_mistral_vision(image_path)

    # ── Parse AI output ────────────────────────────────────────────────────
    pred_class: str = "unknown"
    pred_conf: float = 0.5
    ai_note: str = ""
    hint_bbox = None   # (x1, y1, x2, y2) in pixels

    if ai_result:
        raw_class = str(ai_result.get("classification", "unknown")).lower().strip()
        # Normalise class names
        class_map = {
            "glioblastoma": "glioblastoma",
            "gbm": "glioblastoma",
            "glioma": "glioma",
            "low-grade glioma": "low-grade glioma",
            "low grade glioma": "low-grade glioma",
            "lgg": "low-grade glioma",
            "meningioma": "meningioma",
            "metastasis": "metastasis",
            "metastases": "metastasis",
            "brain metastasis": "metastasis",
            "pituitary": "pituitary",
            "pituitary tumor": "pituitary",
            "pituitary adenoma": "pituitary",
            "notumor": "notumor",
            "no tumor": "notumor",
            "no_tumor": "notumor",
            "normal": "notumor",
        }
        pred_class = class_map.get(raw_class, raw_class)
        pred_conf  = float(ai_result.get("confidence", 0.7))
        ai_note    = str(ai_result.get("note", ""))

        raw_bbox = ai_result.get("bbox", [])
        if isinstance(raw_bbox, list) and len(raw_bbox) == 4:
            ymin, xmin, ymax, xmax = [int(v) for v in raw_bbox]
            x1 = int(xmin * orig_w / 1000)
            y1 = int(ymin * orig_h / 1000)
            x2 = int(xmax * orig_w / 1000)
            y2 = int(ymax * orig_h / 1000)
            if x2 > x1 + 4 and y2 > y1 + 4:
                hint_bbox = (x1, y1, x2, y2)
                log.info("AI bbox: (%d,%d)→(%d,%d)", x1, y1, x2, y2)

    # ── Stage 3: OpenCV segmentation (GrabCut if bbox, else Otsu) ─────────
    if pred_class == "notumor" and hint_bbox is None:
        # AI said no tumor — still run CV to double-check
        mask, prob_map, measurements = _cv_segment(image_path, hint_bbox=None)
        # If CV found something significant, trust CV over AI
        if measurements["foreground_fraction"] > 0.005:
            log.info("CV found potential lesion despite AI notumor — re-classifying from CV.")
            pred_class, pred_conf = _local_cv_classify(measurements, image_path)
        else:
            # AI and CV both say notumor — keep AI result
            pass
    else:
        mask, prob_map, measurements = _cv_segment(image_path, hint_bbox=hint_bbox)

        # If segmentation is empty (very unlikely), try without bbox
        if measurements["foreground_pixels"] == 0:
            log.warning("Segmentation returned empty mask — retrying without hint.")
            mask, prob_map, measurements = _cv_segment(image_path, hint_bbox=None)

    # ── If all AI failed, derive class purely from CV ──────────────────────
    if ai_result is None:
        pred_class, pred_conf = _local_cv_classify(measurements, image_path)
        ai_note = "Classification derived from local image analysis (API unavailable)."

    # ── Save output images ─────────────────────────────────────────────────
    output_files = _save_outputs(prob_map, mask, image_path)

    # ── Build result ───────────────────────────────────────────────────────
    result: Dict[str, Any] = {
        **measurements,
        **output_files,
        "predicted_class": pred_class,
        "predicted_confidence": round(pred_conf, 4),
        "openai_analysis": ai_note or f"NeuroSeg Fusion Engine — class: {pred_class}, confidence: {pred_conf:.0%}",
        "preprocessing_meta": {
            "orig_w": orig_w, "orig_h": orig_h,
            "model": "fusion_engine_v1",
            "ai_provider": "gpt4o" if ai_result else "local_cv",
        },
    }

    if measurements.get("bbox"):
        x, y, bw, bh = measurements["bbox"]
        result["bbox_x"] = x
        result["bbox_y"] = y
        result["bbox_w"] = bw
        result["bbox_h"] = bh

    log.info(
        "Inference complete: class=%s conf=%.2f fg_px=%d",
        pred_class, pred_conf, measurements["foreground_pixels"]
    )
    return result
