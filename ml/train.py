"""Train the density-map counter on CPU.

Usage:  .venv\\Scripts\\python.exe -m ml.train [epochs]

Trains only on the TRAIN split; the test images are never seen (evaluate.py
scores them). Saves the best checkpoint by validation loss to ml/runs/.
"""

from __future__ import annotations

import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from .dataset import CROP, augment, load_samples, split_samples, to_tensor_pair
from .model import TinyUNet, param_count

RUNS = Path(__file__).resolve().parent / "runs"
CKPT = RUNS / "density.pt"
SEED = 7


def make_batch(samples, rng, batch: int):
    xs, ys = [], []
    for _ in range(batch):
        s = rng.choice(samples)
        img, pts = augment(s.image, s.points, rng, size=CROP)
        x, y = to_tensor_pair(img, pts)
        xs.append(x)
        ys.append(y)
    return (
        torch.from_numpy(np.stack(xs)).float(),
        torch.from_numpy(np.stack(ys)).float(),
    )


def fixed_val_batch(samples, n: int = 8):
    """Deterministic validation crops from the TRAIN images (not the test set)."""
    rng = random.Random(1234)
    return make_batch(samples, rng, n)


def main(epochs: int = 400, batch: int = 8, lr: float = 1e-3):
    torch.manual_seed(SEED)
    rng = random.Random(SEED)

    samples = load_samples()
    train, test = split_samples(samples)
    print(f"train images: {len(train)}  test images: {len(test)} (held out)")
    print(f"train cells: {sum(s.count for s in train)}  test cells: {sum(s.count for s in test)}")

    model = TinyUNet()
    print(f"model params: {param_count(model):,}")
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    # MSE on the density map; scaled up because density values are small.
    lossf = nn.MSELoss()

    vx, vy = fixed_val_batch(train)
    best = float("inf")
    RUNS.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    for ep in range(1, epochs + 1):
        model.train()
        x, y = make_batch(train, rng, batch)
        pred = model(x)
        # density loss (scaled: density values are small) + a count-consistency
        # term so the map's integral matches the true cell count.
        loss = lossf(pred, y) * 1000.0
        count_err = (pred.sum(dim=(1, 2, 3)) - y.sum(dim=(1, 2, 3))).abs().mean()
        loss = loss + 0.1 * count_err
        opt.zero_grad()
        loss.backward()
        opt.step()
        sched.step()

        if ep % 20 == 0 or ep == 1:
            model.eval()
            with torch.no_grad():
                vp = model(vx)
                vloss = (lossf(vp, vy) * 1000.0).item()
                vcount = (vp.sum(dim=(1, 2, 3)) - vy.sum(dim=(1, 2, 3))).abs().mean().item()
            flag = ""
            if vloss < best:
                best = vloss
                torch.save({"state_dict": model.state_dict()}, CKPT)
                flag = "  <- saved"
            print(f"ep {ep:4d}  train {loss.item():8.4f}  val {vloss:8.4f}  "
                  f"val_count_err {vcount:6.2f}{flag}")

    print(f"\ndone in {time.time() - t0:.0f}s — best val {best:.4f} -> {CKPT}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 400)
