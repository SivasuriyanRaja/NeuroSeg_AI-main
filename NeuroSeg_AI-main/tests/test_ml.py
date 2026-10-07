"""
NeuroSeg AI — ML unit tests.
Uses synthetic (programmatically generated) image/mask pairs — not real MRI data.
"""
import io
import numpy as np
import pytest
import torch
from PIL import Image

from ml.model import UNetBaseline, CompactEncoderDecoder, build_model, count_parameters
from ml.losses import BCEDiceLoss, SoftDiceLoss, dice_score, iou_score, precision_recall
from ml.dataset import PairedSegmentationDataset, preprocess_pair


# ─── Model tests ─────────────────────────────────────────────────────────────

def test_unet_output_shape():
    model = UNetBaseline(in_channels=1, base_features=16)
    x = torch.zeros(2, 1, 64, 64)
    with torch.inference_mode():
        out = model(x)
    assert out.shape == (2, 1, 64, 64), f"Got {out.shape}"


def test_compact_output_shape():
    model = CompactEncoderDecoder(in_channels=1, base_features=8)
    x = torch.zeros(2, 1, 64, 64)
    with torch.inference_mode():
        out = model(x)
    assert out.shape == (2, 1, 64, 64)


def test_unet_param_count():
    model = UNetBaseline(in_channels=1, base_features=64)
    n = count_parameters(model)
    assert n > 0
    print(f"U-Net parameters: {n:,}")


def test_compact_fewer_params_than_unet():
    unet = UNetBaseline(in_channels=1, base_features=64)
    compact = CompactEncoderDecoder(in_channels=1, base_features=32)
    n_unet = count_parameters(unet)
    n_compact = count_parameters(compact)
    assert n_compact < n_unet, \
        f"Compact ({n_compact}) should have fewer params than U-Net ({n_unet})"


def test_build_model_registry():
    for arch in ["unet_baseline", "compact_encoder_decoder"]:
        m = build_model(arch)
        assert m is not None


def test_build_model_unknown_raises():
    with pytest.raises(ValueError):
        build_model("nonexistent_arch")


# ─── Loss tests ──────────────────────────────────────────────────────────────

def test_dice_loss_perfect_prediction():
    loss = SoftDiceLoss()
    pred = torch.ones(1, 1, 4, 4)
    targ = torch.ones(1, 1, 4, 4)
    val = loss(pred * 10, targ)  # high logit → sigmoid ≈ 1
    assert val.item() < 0.05, f"Expected near-zero dice loss, got {val.item()}"


def test_dice_loss_empty_mask():
    """Dice loss on all-zero target should not produce NaN."""
    loss = SoftDiceLoss()
    pred = torch.zeros(1, 1, 4, 4)
    targ = torch.zeros(1, 1, 4, 4)
    val = loss(pred, targ)
    assert not torch.isnan(val)


def test_bce_dice_loss_shape():
    loss = BCEDiceLoss()
    logits = torch.randn(2, 1, 64, 64)
    targets = (torch.rand(2, 1, 64, 64) > 0.5).float()
    val = loss(logits, targets)
    assert val.ndim == 0  # scalar


def test_dice_score_range():
    pred = torch.randint(0, 2, (1, 64, 64))
    gt   = torch.randint(0, 2, (1, 64, 64))
    s = dice_score(pred, gt)
    assert 0.0 <= s <= 1.0


def test_iou_range():
    pred = torch.randint(0, 2, (1, 32, 32))
    gt   = torch.randint(0, 2, (1, 32, 32))
    s = iou_score(pred, gt)
    assert 0.0 <= s <= 1.0


def test_precision_recall_range():
    pred = torch.randint(0, 2, (1, 32, 32))
    gt   = torch.randint(0, 2, (1, 32, 32))
    p, r = precision_recall(pred, gt)
    assert 0.0 <= p <= 1.0
    assert 0.0 <= r <= 1.0


# ─── Preprocessing tests ─────────────────────────────────────────────────────

def test_preprocess_output_shape():
    """Synthetic image — software test only."""
    img = Image.new("RGB", (128, 96), (100, 100, 100))
    mask = Image.new("L", (128, 96), 255)
    img_t, msk_t = preprocess_pair(img, mask, input_size=64, mean=0.5, std=0.5)
    assert img_t.shape == (3, 64, 64)
    assert msk_t.shape == (1, 64, 64)


def test_preprocess_mask_binary():
    """Output mask should be binary (0 or 1)."""
    img  = Image.new("L", (64, 64), 128)
    mask = Image.new("L", (64, 64), 200)
    _, msk_t = preprocess_pair(img, mask, 64, 0.5, 0.5)
    unique = torch.unique(msk_t)
    for v in unique:
        assert v.item() in (0.0, 1.0), f"Non-binary value {v.item()} in mask"


def test_preprocess_normalisation():
    """Uniform image normalised with correct mean/std."""
    img  = Image.new("L", (64, 64), 128)  # pixel value = 0.502 after /255
    mask = Image.new("L", (64, 64), 0)
    img_t, _ = preprocess_pair(img, mask, 64, 0.5, 0.5)
    # (0.502 - 0.5) / 0.5 ≈ 0.004
    assert abs(img_t.mean().item()) < 0.1
