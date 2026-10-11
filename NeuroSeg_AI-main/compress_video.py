# -*- coding: utf-8 -*-
"""compress_video.py — Compress brainvd.mp4 using OpenCV (available on Python 3.6+)"""
import sys, io, os, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import cv2
from pathlib import Path

BASE   = Path(r"c:\Users\sivas\Documents\NeuroSeg_AI-main\NeuroSeg_AI-main\frontend")
PUBLIC = BASE / "public"

def human(size):
    return f"{size/1024/1024:.2f} MB" if size > 1024*1024 else f"{size/1024:.1f} KB"

def compress_video_cv2(src: Path, scale=0.6, fps_out=24):
    """Re-encode video with OpenCV at lower resolution and FPS."""
    orig_size = src.stat().st_size
    tmp = src.with_suffix(".tmp.mp4")

    cap = cv2.VideoCapture(str(src))
    orig_fps  = cap.get(cv2.CAP_PROP_FPS) or 30
    width     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height    = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    new_w     = int(width  * scale) & ~1   # must be even
    new_h     = int(height * scale) & ~1

    out_fps   = min(fps_out, orig_fps)
    fourcc    = cv2.VideoWriter_fourcc(*'mp4v')
    out       = cv2.VideoWriter(str(tmp), fourcc, out_fps, (new_w, new_h))

    frame_idx = 0
    skip      = max(1, int(orig_fps / out_fps))   # frame skip ratio

    print(f"  Original: {width}x{height} @ {orig_fps:.0f}fps")
    print(f"  Output:   {new_w}x{new_h} @ {out_fps:.0f}fps  (every {skip} frames kept)")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % skip == 0:
            resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
            out.write(resized)
        frame_idx += 1

    cap.release()
    out.release()

    if tmp.exists() and tmp.stat().st_size > 0:
        shutil.move(str(tmp), str(src))
        new_size = src.stat().st_size
        saved = 100*(orig_size - new_size)//orig_size
        print(f"  MP4 {src.name}: {human(orig_size)} -> {human(new_size)}  ({saved}% saved)")
    else:
        print(f"  MP4 compression failed - keeping original")
        if tmp.exists():
            tmp.unlink()

print("=" * 50)
print("Compressing brainvd.mp4 (this may take ~1-2 min)...")
print("=" * 50)

for vid_path in [PUBLIC / "brainvd.mp4", BASE / "brainvd.mp4"]:
    if vid_path.exists():
        print(f"\n[{vid_path.parent.name}/brainvd.mp4]")
        compress_video_cv2(vid_path, scale=0.65, fps_out=24)

print("\nDone!")
