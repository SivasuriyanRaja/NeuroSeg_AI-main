"""
NeuroSeg AI — Training CLI.
Usage: python train.py --config configs/unet_baseline.yaml
"""
from __future__ import annotations
import argparse
import json
import logging
import random
import time
import os
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
from torch.utils.data import DataLoader, random_split

from ml.model import build_model, count_parameters
from ml.losses import BCEDiceLoss, dice_score, iou_score, precision_recall
from ml.dataset import PairedSegmentationDataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("neuroseg.train")


def load_config(path: Path) -> dict:
    import yaml
    with open(path) as f:
        return yaml.safe_load(f)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def train_epoch(model, loader, optimizer, loss_fn, device, scaler=None):
    model.train()
    total_loss = 0.0
    for imgs, masks in loader:
        imgs, masks = imgs.to(device), masks.to(device)
        optimizer.zero_grad()
        if scaler is not None:
            with torch.autocast("cuda"):
                logits = model(imgs)
                loss = loss_fn(logits, masks)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            logits = model(imgs)
            loss = loss_fn(logits, masks)
            loss.backward()
            optimizer.step()
        total_loss += loss.item()
    return total_loss / max(len(loader), 1)


@torch.inference_mode()
def eval_epoch(model, loader, loss_fn, device, threshold: float):
    model.eval()
    total_loss = 0.0
    dices, ious = [], []
    for imgs, masks in loader:
        imgs, masks = imgs.to(device), masks.to(device)
        logits = model(imgs)
        loss = loss_fn(logits, masks)
        total_loss += loss.item()
        probs = torch.sigmoid(logits)
        pred = (probs >= threshold).long()
        for p, g in zip(pred, masks.long()):
            dices.append(dice_score(p, g))
            ious.append(iou_score(p, g))
    return (
        total_loss / max(len(loader), 1),
        float(np.mean(dices)),
        float(np.mean(ious)),
    )


def train(config: dict, run_dir: Path) -> None:
    set_seed(config.get("seed", 42))

    device_str = "cuda" if torch.cuda.is_available() and config.get("use_cuda", True) else "cpu"
    device = torch.device(device_str)
    log.info("Training on %s", device)

    # Dataset
    ds = PairedSegmentationDataset(
        image_dir=Path(config["image_dir"]),
        mask_dir=Path(config["mask_dir"]),
        input_size=config.get("input_size", 256),
        mean=config.get("mean", 0.5),
        std=config.get("std", 0.5),
        augment=False,
    )
    n = len(ds)
    if n < 4:
        raise RuntimeError(f"Dataset too small: {n} samples.")

    val_frac = config.get("val_fraction", 0.15)
    test_frac = config.get("test_fraction", 0.15)
    n_test = max(1, int(n * test_frac))
    n_val = max(1, int(n * val_frac))
    n_train = n - n_val - n_test
    if n_train < 1:
        raise RuntimeError("Not enough samples for train/val/test split.")

    generator = torch.Generator().manual_seed(config.get("seed", 42))
    train_ds, val_ds, test_ds = random_split(ds, [n_train, n_val, n_test], generator=generator)

    # Enable augmentation for training split only
    train_ds.dataset.augment = True

    log.info("Split: train=%d  val=%d  test=%d", n_train, n_val, n_test)
    log.info("Manifest hash: %s", ds.manifest_hash())

    # Freeze split manifest
    manifest = {
        "train_indices": train_ds.indices,
        "val_indices": val_ds.indices,
        "test_indices": test_ds.indices,
        "manifest_hash": ds.manifest_hash(),
        "n_total": n,
    }
    (run_dir / "split_manifest.json").write_text(json.dumps(manifest, indent=2))

    bs = config.get("batch_size", 8)
    train_loader = DataLoader(train_ds, batch_size=bs, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=bs, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=bs, shuffle=False, num_workers=0)

    # Model
    arch = config.get("architecture", "unet_baseline")
    model = build_model(arch).to(device)
    n_params = count_parameters(model)
    log.info("Architecture: %s  Parameters: %s", arch, f"{n_params:,}")

    # Training setup
    loss_fn = BCEDiceLoss()
    lr = config.get("learning_rate", 1e-3)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    epochs = config.get("epochs", 50)
    patience = config.get("patience", 10)
    threshold = config.get("threshold", 0.5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    scaler = None
    if device_str == "cuda":
        try:
            scaler = torch.amp.GradScaler("cuda")
        except Exception:
            pass

    best_val_dice = -1.0
    epochs_no_improve = 0
    curves = {}

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        train_loss = train_epoch(model, train_loader, optimizer, loss_fn, device, scaler)
        val_loss, val_dice, val_iou = eval_epoch(model, val_loader, loss_fn, device, threshold)
        scheduler.step()
        elapsed = time.time() - t0

        curves[epoch] = {
            "train_loss": round(train_loss, 6),
            "val_loss": round(val_loss, 6),
            "val_dice": round(val_dice, 6),
            "val_iou": round(val_iou, 6),
        }

        log.info(
            "Epoch %3d/%d  train_loss=%.4f  val_loss=%.4f  val_dice=%.4f  val_iou=%.4f  %.1fs",
            epoch, epochs, train_loss, val_loss, val_dice, val_iou, elapsed,
        )

        # Save latest
        torch.save({
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "val_dice": val_dice,
            "config": config,
        }, run_dir / "checkpoint_latest.pt")

        # Save best by validation Dice
        if val_dice > best_val_dice:
            best_val_dice = val_dice
            epochs_no_improve = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_dice": val_dice,
                "config": config,
                "threshold": threshold,
                "architecture": arch,
                "input_size": config.get("input_size", 256),
                "mean": config.get("mean", 0.5),
                "std": config.get("std", 0.5),
                "parameter_count": n_params,
            }, run_dir / "checkpoint_best.pt")
            log.info("  ↑ New best val Dice: %.4f", val_dice)
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                log.info("Early stopping at epoch %d (no improvement for %d epochs).", epoch, patience)
                break

    # Test evaluation on best checkpoint
    best_ckpt = run_dir / "checkpoint_best.pt"
    log.info("Loading best checkpoint for test evaluation…")
    best_state = torch.load(best_ckpt, map_location=device, weights_only=False)
    model.load_state_dict(best_state["model_state_dict"])

    test_loss, test_dice, test_iou = eval_epoch(model, test_loader, loss_fn, device, threshold)
    # Compute precision / recall on test set
    all_prec, all_rec = [], []
    model.eval()
    with torch.inference_mode():
        for imgs, masks in test_loader:
            imgs, masks = imgs.to(device), masks.to(device)
            probs = torch.sigmoid(model(imgs))
            pred = (probs >= threshold).long()
            for p, g in zip(pred, masks.long()):
                pr, rc = precision_recall(p, g)
                all_prec.append(pr)
                all_rec.append(rc)

    test_precision = float(np.mean(all_prec))
    test_recall = float(np.mean(all_rec))

    log.info(
        "Test results — Dice=%.4f  IoU=%.4f  Precision=%.4f  Recall=%.4f",
        test_dice, test_iou, test_precision, test_recall,
    )

    # Save run summary
    summary = {
        "architecture": arch,
        "parameter_count": n_params,
        "best_val_dice": best_val_dice,
        "test_dice": test_dice,
        "test_iou": test_iou,
        "test_precision": test_precision,
        "test_recall": test_recall,
        "epochs_trained": epoch,
        "best_epoch": best_state["epoch"],
        "threshold": threshold,
        "hardware": device_str,
        "training_curves": curves,
        "config": config,
        "completed_at": datetime.utcnow().isoformat(),
    }
    (run_dir / "run_summary.json").write_text(json.dumps(summary, indent=2))
    log.info("Training complete. Summary saved to %s", run_dir / "run_summary.json")


def main():
    parser = argparse.ArgumentParser(description="NeuroSeg AI — Training CLI")
    parser.add_argument("--config", required=True, help="Path to YAML config file")
    parser.add_argument("--run-dir", default=None, help="Output directory for this run")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    arch = config.get("architecture", "model")
    run_dir = Path(args.run_dir) if args.run_dir else Path("runs") / f"{arch}_{ts}"
    os.makedirs(str(run_dir), exist_ok=True)
    log.info("Run directory: %s", run_dir)

    train(config, run_dir)


if __name__ == "__main__":
    main()
