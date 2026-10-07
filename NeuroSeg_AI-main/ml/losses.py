"""
NeuroSeg AI — Loss functions and metrics.
BCE + soft Dice loss for training; Dice, IoU, precision, recall for evaluation.
"""
from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F


class SoftDiceLoss(nn.Module):
    """
    Soft Dice loss for binary segmentation.
    Smooth factor prevents division by zero on empty masks.
    """
    def __init__(self, smooth: float = 1.0):
        super().__init__()
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        probs_flat = probs.view(-1)
        targets_flat = targets.view(-1).float()
        intersection = (probs_flat * targets_flat).sum()
        dice = (2.0 * intersection + self.smooth) / (
            probs_flat.sum() + targets_flat.sum() + self.smooth
        )
        return 1.0 - dice


class BCEDiceLoss(nn.Module):
    """Combined BCE + soft Dice loss."""
    def __init__(self, bce_weight: float = 0.5, dice_weight: float = 0.5):
        super().__init__()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        self.bce = nn.BCEWithLogitsLoss()
        self.dice = SoftDiceLoss()

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        return (
            self.bce_weight * self.bce(logits, targets.float())
            + self.dice_weight * self.dice(logits, targets)
        )


# ─── Metrics ─────────────────────────────────────────────────────────────────

def dice_score(pred_mask: torch.Tensor, gt_mask: torch.Tensor, smooth: float = 1.0) -> float:
    pred_flat = pred_mask.view(-1).float()
    gt_flat = gt_mask.view(-1).float()
    intersection = (pred_flat * gt_flat).sum().item()
    return (2.0 * intersection + smooth) / (pred_flat.sum().item() + gt_flat.sum().item() + smooth)


def iou_score(pred_mask: torch.Tensor, gt_mask: torch.Tensor, smooth: float = 1.0) -> float:
    pred_flat = pred_mask.view(-1).float()
    gt_flat = gt_mask.view(-1).float()
    intersection = (pred_flat * gt_flat).sum().item()
    union = pred_flat.sum().item() + gt_flat.sum().item() - intersection
    return (intersection + smooth) / (union + smooth)


def precision_recall(pred_mask: torch.Tensor, gt_mask: torch.Tensor):
    tp = ((pred_mask == 1) & (gt_mask == 1)).sum().item()
    fp = ((pred_mask == 1) & (gt_mask == 0)).sum().item()
    fn = ((pred_mask == 0) & (gt_mask == 1)).sum().item()
    precision = tp / (tp + fp + 1e-8)
    recall = tp / (tp + fn + 1e-8)
    return precision, recall
