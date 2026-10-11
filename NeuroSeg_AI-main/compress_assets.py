# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
compress_assets.py
Compresses the large binary assets before git push:
  - neulogo.png  (1.6 MB → target <300 KB)
  - brainbg.jpg  (720 KB → target <250 KB)
  - brainvd.mp4  (11 MB  → target <4 MB via imageio-ffmpeg)
Saves compressed files back in-place (public/ and frontend root).
"""
import os
import shutil
from pathlib import Path
from PIL import Image

BASE = Path(r"c:\Users\sivas\Documents\NeuroSeg_AI-main\NeuroSeg_AI-main\frontend")
PUBLIC = BASE / "public"

def human(size):
    return f"{size/1024/1024:.2f} MB" if size > 1024*1024 else f"{size/1024:.1f} KB"

def compress_png(src: Path, max_dim=512, quality=85):
    """Resize + convert to optimized PNG."""
    orig = src.stat().st_size
    img = Image.open(src).convert("RGBA")
    # Resize if larger than max_dim on any side
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    # Save optimized
    img.save(src, format="PNG", optimize=True)
    new = src.stat().st_size
    print(f"  PNG {src.name}: {human(orig)} -> {human(new)}  ({100*(orig-new)//orig}% saved)")

def compress_jpg(src: Path, max_dim=1920, quality=72):
    """Resize + compress JPEG."""
    orig = src.stat().st_size
    img = Image.open(src).convert("RGB")
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    img.save(src, format="JPEG", quality=quality, optimize=True, progressive=True)
    new = src.stat().st_size
    print(f"  JPG {src.name}: {human(orig)} -> {human(new)}  ({100*(orig-new)//orig}% saved)")

def compress_video(src: Path):
    """Compress MP4 using imageio-ffmpeg (re-encode with lower bitrate)."""
    orig = src.stat().st_size
    tmp = src.with_suffix(".tmp.mp4")
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        import subprocess
        result = subprocess.run([
            ffmpeg_exe,
            "-y",                    # overwrite
            "-i", str(src),
            "-vcodec", "libx264",
            "-crf", "28",            # quality (lower=better, 18-28 typical)
            "-preset", "fast",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",  # ensure even dimensions
            "-acodec", "aac",
            "-b:a", "96k",
            "-movflags", "+faststart",  # good for web streaming
            str(tmp)
        ], capture_output=True, text=True, timeout=300)
        if result.returncode == 0 and tmp.exists():
            shutil.move(str(tmp), str(src))
            new = src.stat().st_size
            print(f"  MP4 {src.name}: {human(orig)} -> {human(new)}  ({100*(orig-new)//orig}% saved)")
        else:
            print(f"  MP4 compression failed:\n{result.stderr[-500:]}")
            if tmp.exists():
                tmp.unlink()
    except Exception as e:
        print(f"  MP4 compression error: {e}")
        if tmp.exists():
            tmp.unlink()

print("=" * 55)
print("NeuroSeg AI — Asset Compression")
print("=" * 55)

# --- Images in public/ ---
logo_public = PUBLIC / "neulogo.png"
bg_public   = PUBLIC / "brainbg.jpg"
vid_public  = PUBLIC / "brainvd.mp4"

# Also compress copies in frontend root (used during dev)
logo_root = BASE / "neulogo.png"
bg_root   = BASE / "brainbg.jpg"
vid_root  = BASE / "brainvd.mp4"

print("\n[Images]")
if logo_public.exists():
    compress_png(logo_public, max_dim=512)
if logo_root.exists():
    compress_png(logo_root, max_dim=512)

if bg_public.exists():
    compress_jpg(bg_public, max_dim=1920, quality=72)
if bg_root.exists():
    compress_jpg(bg_root, max_dim=1920, quality=72)

print("\n[Video]")
if vid_public.exists():
    compress_video(vid_public)
if vid_root.exists():
    compress_video(vid_root)

print("\nDone! Ready to git add & push.")
