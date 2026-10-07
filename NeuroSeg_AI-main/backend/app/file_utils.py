"""
NeuroSeg AI — File-handling utilities.
Server-generated filenames, safe path access, thumbnail generation.
"""
from __future__ import annotations
import hashlib
import io
import os
import uuid
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageFilter

from app.config import settings


ALLOWED_MIME = {"image/png", "image/jpeg"}
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def safe_filename(original: str, suffix: str = "") -> str:
    """Return a UUID-based server-safe filename preserving extension."""
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".png"
    uid = uuid.uuid4().hex
    return f"{uid}{suffix}{ext}"


def validate_image_file(data: bytes, original_name: str) -> Tuple[int, int, str]:
    """
    Decode and validate image bytes.
    Returns (width, height, mime_type) or raises ValueError.
    """
    if len(data) > settings.max_upload_bytes:
        raise ValueError(f"File exceeds {settings.max_upload_bytes // (1024*1024)} MB limit.")
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()   # detects truncation / corruption
        img = Image.open(io.BytesIO(data))  # reopen after verify
        w, h = img.size
    except Exception as exc:
        raise ValueError(f"Cannot decode image: {exc}") from exc
    if max(w, h) > settings.max_image_dimension:
        raise ValueError(
            f"Image dimension {w}×{h} exceeds limit {settings.max_image_dimension}."
        )
    fmt = (img.format or "JPEG").upper()
    mime = "image/png" if fmt == "PNG" else "image/jpeg"
    return w, h, mime


def save_upload(data: bytes, original_name: str) -> Tuple[Path, str]:
    """Save upload to upload_dir. Returns (path, server_filename)."""
    fname = safe_filename(original_name)
    dest = settings.upload_dir / fname
    dest.write_bytes(data)
    return dest, fname


def make_thumbnail(source_path: Path, size: Tuple[int, int] = (256, 256)) -> Path:
    """Generate a thumbnail PNG alongside the upload."""
    img = Image.open(source_path).convert("RGB")
    img.thumbnail(size, Image.LANCZOS)
    # Pad to square
    result = Image.new("RGB", size, (15, 22, 36))  # dark navy
    offset = ((size[0] - img.width) // 2, (size[1] - img.height) // 2)
    result.paste(img, offset)
    thumb_name = source_path.stem + "_thumb.png"
    thumb_path = settings.upload_dir / thumb_name
    result.save(thumb_path, "PNG")
    return thumb_path


def dir_size_mb(path: Path) -> float:
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    return round(total / (1024 * 1024), 2)


def file_hash(path: Path) -> str:
    """SHA-256 of file contents — used for dedup / cache keys."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()
