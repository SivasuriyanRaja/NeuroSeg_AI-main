"""
NeuroSeg AI — U-Net baseline and Compact Encoder-Decoder architectures.
Both use standard PyTorch modules. No proprietary implementation copied.
Architecture choices documented in docs/methodology.md.
"""
from __future__ import annotations
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F


# ─── Shared building blocks ───────────────────────────────────────────────────

class DoubleConv(nn.Module):
    """Two sequential 3×3 convolutions with BN + ReLU (standard U-Net block)."""
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class DepthwiseSeparableConv(nn.Module):
    """Depthwise-separable 3×3 conv + BN + ReLU for compact model."""
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.dw = nn.Conv2d(in_ch, in_ch, 3, padding=1, groups=in_ch, bias=False)
        self.pw = nn.Conv2d(in_ch, out_ch, 1, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.relu(self.bn(self.pw(self.dw(x))), inplace=True)


class CompactBlock(nn.Module):
    """Two depthwise-separable convolutions."""
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            DepthwiseSeparableConv(in_ch, out_ch),
            DepthwiseSeparableConv(out_ch, out_ch),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


# ─── U-Net Baseline ───────────────────────────────────────────────────────────

class UNetBaseline(nn.Module):
    """
    4-level U-Net for binary segmentation.
    Input:  [B, 1, H, W]  (grayscale, power-of-2 recommended)
    Output: [B, 1, H, W]  (logits; apply sigmoid for probabilities)

    Architecture reference: Ronneberger et al. (2015), "U-Net: Convolutional
    Networks for Biomedical Image Segmentation." arXiv:1505.04597.
    This is an independent re-implementation using standard PyTorch modules.
    """
    def __init__(self, in_channels: int = 3, base_features: int = 64):
        super().__init__()
        f = base_features

        # Encoder
        self.enc1 = DoubleConv(in_channels, f)
        self.enc2 = DoubleConv(f, f * 2)
        self.enc3 = DoubleConv(f * 2, f * 4)
        self.enc4 = DoubleConv(f * 4, f * 8)
        self.bottleneck = DoubleConv(f * 8, f * 16)
        self.pool = nn.MaxPool2d(2)

        # Decoder
        self.up4 = nn.ConvTranspose2d(f * 16, f * 8, 2, stride=2)
        self.dec4 = DoubleConv(f * 16, f * 8)
        self.up3 = nn.ConvTranspose2d(f * 8, f * 4, 2, stride=2)
        self.dec3 = DoubleConv(f * 8, f * 4)
        self.up2 = nn.ConvTranspose2d(f * 4, f * 2, 2, stride=2)
        self.dec2 = DoubleConv(f * 4, f * 2)
        self.up1 = nn.ConvTranspose2d(f * 2, f, 2, stride=2)
        self.dec1 = DoubleConv(f * 2, f)

        self.head = nn.Conv2d(f, 1, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        b = self.bottleneck(self.pool(e4))

        d4 = self.dec4(torch.cat([self.up4(b), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.head(d1)


# ─── Compact Encoder-Decoder ─────────────────────────────────────────────────

class CompactEncoderDecoder(nn.Module):
    """
    Narrower encoder-decoder using depthwise-separable convolutions.
    Designed as a lower-parameter alternative to UNetBaseline.
    Trade-off (speed vs quality) is measured and documented, not assumed.
    Input:  [B, 1, H, W]
    Output: [B, 1, H, W]  (logits)
    """
    def __init__(self, in_channels: int = 3, base_features: int = 32):
        super().__init__()
        f = base_features

        self.enc1 = CompactBlock(in_channels, f)
        self.enc2 = CompactBlock(f, f * 2)
        self.enc3 = CompactBlock(f * 2, f * 4)
        self.bottleneck = CompactBlock(f * 4, f * 8)
        self.pool = nn.MaxPool2d(2)

        self.up3 = nn.ConvTranspose2d(f * 8, f * 4, 2, stride=2)
        self.dec3 = CompactBlock(f * 8, f * 4)
        self.up2 = nn.ConvTranspose2d(f * 4, f * 2, 2, stride=2)
        self.dec2 = CompactBlock(f * 4, f * 2)
        self.up1 = nn.ConvTranspose2d(f * 2, f, 2, stride=2)
        self.dec1 = CompactBlock(f * 2, f)

        self.head = nn.Conv2d(f, 1, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))

        d3 = self.dec3(torch.cat([self.up3(b), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.head(d1)


# ─── Factory ──────────────────────────────────────────────────────────────────

def build_model(architecture: str, pretrained: bool = False) -> nn.Module:
    """
    Build a model by name. pretrained=True is unsupported (no hosted weights);
    passing it will raise an informative error.
    """
    if pretrained:
        raise ValueError(
            "No pretrained weights are bundled. Train a model first with ml/train.py."
        )
    registry = {
        "unet_baseline": lambda: UNetBaseline(in_channels=3, base_features=64),
        "compact_encoder_decoder": lambda: CompactEncoderDecoder(in_channels=3, base_features=32),
    }
    
    if architecture == "densenet121_classifier":
        from torchvision import models
        model = models.densenet121(weights=None)
        num_ftrs = model.classifier.in_features
        # 4 classes for brain tumor classifier
        model.classifier = nn.Linear(num_ftrs, 4)
        return model
        
    if architecture not in registry:
        raise ValueError(
            f"Unknown architecture '{architecture}'. "
            f"Available: {list(registry.keys())}"
        )
    return registry[architecture]()


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
