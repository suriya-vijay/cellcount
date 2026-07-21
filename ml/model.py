"""Tiny U-Net that regresses a cell-density map.

Deliberately small (~100-200K params): the dataset is small, it must train on CPU
in minutes, and it needs to export to a few-MB file for eventual browser inference.
Input  (B,1,H,W) grayscale in [0,1]
Output (B,1,H,W) non-negative density; summing it gives the cell count.
"""

from __future__ import annotations

import torch
import torch.nn as nn


def block(cin: int, cout: int) -> nn.Sequential:
    return nn.Sequential(
        nn.Conv2d(cin, cout, 3, padding=1),
        nn.BatchNorm2d(cout),
        nn.ReLU(inplace=True),
        nn.Conv2d(cout, cout, 3, padding=1),
        nn.BatchNorm2d(cout),
        nn.ReLU(inplace=True),
    )


class TinyUNet(nn.Module):
    def __init__(self, base: int = 16):
        super().__init__()
        self.e1 = block(1, base)             # H
        self.e2 = block(base, base * 2)      # H/2
        self.e3 = block(base * 2, base * 4)  # H/4
        self.pool = nn.MaxPool2d(2)
        self.up2 = nn.ConvTranspose2d(base * 4, base * 2, 2, stride=2)
        self.d2 = block(base * 4, base * 2)
        self.up1 = nn.ConvTranspose2d(base * 2, base, 2, stride=2)
        self.d1 = block(base * 2, base)
        self.out = nn.Conv2d(base, 1, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        e1 = self.e1(x)
        e2 = self.e2(self.pool(e1))
        e3 = self.e3(self.pool(e2))
        d2 = self.d2(torch.cat([self.up2(e3), e2], dim=1))
        d1 = self.d1(torch.cat([self.up1(d2), e1], dim=1))
        # ReLU (not softplus): background must be EXACTLY zero. softplus has a
        # floor of ln(2)≈0.69 per pixel, which over a 256x256 map adds ~45,000
        # of phantom density and makes the count meaningless.
        return nn.functional.relu(self.out(d1))


def param_count(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())
