"""
NeuroSeg AI — Dataset classes.
Supports paired image/mask directories and optional COCO JSON adapter.
"""
from __future__ import annotations
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset
import torchvision.transforms.functional as TF
import random

log = logging.getLogger("neuroseg.dataset")


# ─── Preprocessing (shared with inference) ───────────────────────────────────

def preprocess_pair(
    image: Image.Image,
    mask: Image.Image,
    input_size: int,
    mean: Union[float, List[float]],
    std: Union[float, List[float]],
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Aspect-preserving resize + pad to square, then normalize image.
    Mask resized with NEAREST to preserve category values.
    """
    w, h = image.size
    scale = min(input_size / w, input_size / h)
    nw, nh = int(w * scale), int(h * scale)
    image = image.resize((nw, nh), Image.LANCZOS)
    mask = mask.resize((nw, nh), Image.NEAREST)

    pad_l = (input_size - nw) // 2
    pad_t = (input_size - nh) // 2
    is_rgb = image.mode == "RGB"
    img_pad = Image.new("RGB" if is_rgb else "L", (input_size, input_size), 0)
    msk_pad = Image.new("L", (input_size, input_size), 0)
    img_pad.paste(image, (pad_l, pad_t))
    msk_pad.paste(mask, (pad_l, pad_t))

    img_arr = np.array(img_pad, dtype=np.float32) / 255.0
    if is_rgb:
        img_arr = np.transpose(img_arr, (2, 0, 1))
    else:
        img_arr = np.expand_dims(img_arr, axis=0)

    if isinstance(mean, (list, tuple)):
        mean_arr = np.array(mean, dtype=np.float32).reshape(-1, 1, 1)
        std_arr = np.array(std, dtype=np.float32).reshape(-1, 1, 1)
        img_arr = (img_arr - mean_arr) / (std_arr + 1e-8)
    else:
        img_arr = (img_arr - mean) / (std + 1e-8)

    msk_arr = (np.array(msk_pad) > 0).astype(np.float32)
    msk_arr = np.expand_dims(msk_arr, axis=0)

    return torch.from_numpy(img_arr), torch.from_numpy(msk_arr)


def augment_pair(
    image: Image.Image,
    mask: Image.Image,
) -> Tuple[Image.Image, Image.Image]:
    """
    Synchronized spatial augmentation (applied to both image and mask).
    Training-only intensity augmentation on image only.
    """
    # Horizontal flip
    if random.random() < 0.5:
        image = TF.hflip(image)
        mask = TF.hflip(mask)
    # Vertical flip
    if random.random() < 0.3:
        image = TF.vflip(image)
        mask = TF.vflip(mask)
    # Random rotation ±15°
    angle = random.uniform(-15, 15)
    image = TF.rotate(image, angle)
    mask = TF.rotate(mask, angle)
    # Intensity augmentation (image only)
    if random.random() < 0.5:
        image = TF.adjust_brightness(image, brightness_factor=random.uniform(0.7, 1.3))
    if random.random() < 0.3:
        image = TF.adjust_contrast(image, contrast_factor=random.uniform(0.8, 1.2))
    return image, mask


# ─── Paired directory dataset ─────────────────────────────────────────────────

class PairedSegmentationDataset(Dataset):
    """
    Loads (image, mask) pairs from two aligned directories.
    image_dir/*.{png,jpg}  ↔  mask_dir/*.{png,jpg}  (matched by stem)
    """
    def __init__(
        self,
        image_dir: Path,
        mask_dir: Path,
        input_size: int = 256,
        mean: Union[float, List[float]] = 0.5,
        std: Union[float, List[float]] = 0.5,
        augment: bool = False,
    ):
        self.image_dir = Path(image_dir)
        self.mask_dir = Path(mask_dir)
        self.input_size = input_size
        self.mean = mean
        self.std = std
        self.augment = augment
        self.pairs = self._find_pairs()
        log.info("Dataset: %d pairs found.", len(self.pairs))

    def _find_pairs(self) -> List[Tuple[Path, Path]]:
        EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
        same_dir = (self.image_dir.resolve() == self.mask_dir.resolve()) if self.mask_dir.exists() and self.image_dir.exists() else False

        img_paths = []
        if self.image_dir.exists():
            for ext in EXTS:
                img_paths.extend(self.image_dir.rglob(f"*{ext}"))
                img_paths.extend(self.image_dir.rglob(f"*{ext.upper()}"))

        # Filter out masks if they are in the same dir
        if same_dir:
            img_paths = [p for p in img_paths if "_mask" not in p.stem.lower()]

        img_map: Dict[str, Path] = {p.stem: p for p in img_paths}
        pairs = []
        for stem, img_path in sorted(img_map.items()):
            found = False
            for ext in [".png", ".jpg", ".jpeg", ".tif", ".tiff"]:
                if same_dir:
                    msk_path = img_path.parent / f"{stem}_mask{ext}"
                else:
                    msk_path = self.mask_dir / (stem + ext)

                if msk_path.exists():
                    pairs.append((img_path, msk_path))
                    found = True
                    break
            
            if not found:
                log.warning("No mask found for image: %s", img_path.name)
        return pairs

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path, msk_path = self.pairs[idx]
        image = Image.open(img_path).convert("RGB")
        mask = Image.open(msk_path).convert("L")
        if self.augment:
            image, mask = augment_pair(image, mask)
        img_t, msk_t = preprocess_pair(image, mask, self.input_size, self.mean, self.std)
        return img_t, msk_t

    def manifest_hash(self) -> str:
        """Deterministic hash of the file list for split identity tracking."""
        content = "\n".join(str(p) for p, _ in sorted(self.pairs))
        return hashlib.sha256(content.encode()).hexdigest()[:16]


# ─── COCO JSON adapter ────────────────────────────────────────────────────────

class COCOSegmentationDataset(Dataset):
    """
    Loads images referenced by a COCO-format annotation JSON.
    Unions all target-category annotations into a single binary mask.
    Supports polygon and RLE encodings. Invalid annotations are skipped with a warning.
    """
    def __init__(
        self,
        annotation_path: Path,
        image_dir: Path,
        target_category_ids: Optional[List[int]] = None,
        input_size: int = 256,
        mean: Union[float, List[float]] = 0.5,
        std: Union[float, List[float]] = 0.5,
        augment: bool = False,
    ):
        self.image_dir = Path(image_dir)
        self.input_size = input_size
        self.mean = mean
        self.std = std
        self.augment = augment

        with open(annotation_path) as f:
            coco = json.load(f)

        categories = {c["id"]: c["name"] for c in coco.get("categories", [])}
        if target_category_ids is None:
            target_category_ids = list(categories.keys())
            log.info("COCO adapter: targeting all %d categories.", len(target_category_ids))
        else:
            for cid in target_category_ids:
                if cid not in categories:
                    raise ValueError(f"Category ID {cid} not found in annotation file.")

        # Build image_id → annotations mapping
        ann_by_image: Dict[int, List] = {}
        for ann in coco.get("annotations", []):
            if ann.get("category_id") in target_category_ids:
                ann_by_image.setdefault(ann["image_id"], []).append(ann)

        self.samples = []
        for img_info in coco.get("images", []):
            iid = img_info["id"]
            img_path = self.image_dir / img_info["file_name"]
            if not img_path.exists():
                log.warning("Image missing: %s", img_path)
                continue
            anns = ann_by_image.get(iid, [])
            self.samples.append({
                "path": img_path,
                "width": img_info["width"],
                "height": img_info["height"],
                "annotations": anns,
            })

        log.info("COCO dataset: %d images loaded.", len(self.samples))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        sample = self.samples[idx]
        image = Image.open(sample["path"]).convert("RGB")
        mask = self._build_mask(sample)
        if self.augment:
            image, mask = augment_pair(image, mask)
        return preprocess_pair(image, mask, self.input_size, self.mean, self.std)

    def _build_mask(self, sample) -> Image.Image:
        """Union all target-category annotations into a binary PIL mask."""
        w, h = sample["width"], sample["height"]
        combined = np.zeros((h, w), dtype=np.uint8)
        for ann in sample["annotations"]:
            try:
                seg = ann.get("segmentation", [])
                if isinstance(seg, dict):
                    # RLE encoding
                    combined |= self._decode_rle(seg, h, w)
                elif isinstance(seg, list):
                    for poly in seg:
                        combined |= self._decode_polygon(poly, h, w)
            except Exception as exc:
                log.warning("Skipping invalid annotation %s: %s", ann.get("id"), exc)
        return Image.fromarray(combined * 255, mode="L")

    @staticmethod
    def _decode_polygon(polygon: list, h: int, w: int) -> np.ndarray:
        from PIL import ImageDraw
        mask = Image.new("L", (w, h), 0)
        if len(polygon) < 6:
            return np.array(mask)
        coords = [(polygon[i], polygon[i + 1]) for i in range(0, len(polygon) - 1, 2)]
        ImageDraw.Draw(mask).polygon(coords, fill=1)
        return np.array(mask)

    @staticmethod
    def _decode_rle(rle: dict, h: int, w: int) -> np.ndarray:
        """Decode uncompressed COCO RLE."""
        counts = rle["counts"]
        mask = np.zeros(h * w, dtype=np.uint8)
        pos = 0
        val = 0
        for c in counts:
            mask[pos:pos + c] = val
            pos += c
            val = 1 - val
        return mask.reshape(h, w, order="F")
