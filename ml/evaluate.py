"""Honest evaluation on the HELD-OUT test images, head-to-head vs the classical
detector.

Reports, for each test image and overall:
  * count accuracy  — predicted count vs the user's labeled count (% error)
  * detection F1    — precision/recall by matching predicted peaks to labels
and the same numbers for the existing OpenCV detector, so we can tell whether the
model is actually better than what we already ship.

Usage:  .venv\\Scripts\\python.exe -m ml.evaluate
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
import torch

from app.detection import detect_cells
from .dataset import LABELS_DIR, load_samples, split_samples
from .model import TinyUNet

RUNS = Path(__file__).resolve().parent / "runs"
CKPT = RUNS / "density.pt"
MATCH_PX = 12          # a prediction within this distance of a label = a hit
PEAK_THRESH = 0.15     # fraction of max density to consider a peak


def predict_density(model: TinyUNet, crop_bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    # pad to a multiple of 4 (two 2x downsamples in the U-Net)
    h, w = gray.shape
    ph, pw = (-h) % 4, (-w) % 4
    if ph or pw:
        gray = cv2.copyMakeBorder(gray, 0, ph, 0, pw, cv2.BORDER_REFLECT_101)
    with torch.no_grad():
        out = model(torch.from_numpy(gray[None, None]).float())[0, 0].numpy()
    return out[:h, :w]


def peaks_from_density(dm: np.ndarray, thresh_frac: float = PEAK_THRESH) -> np.ndarray:
    """Local maxima above a threshold -> predicted cell centers."""
    if dm.max() <= 0:
        return np.zeros((0, 2), np.float32)
    thr = dm.max() * thresh_frac
    dil = cv2.dilate(dm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    mask = ((dm >= dil) & (dm >= thr)).astype(np.uint8)
    n, _, _, cent = cv2.connectedComponentsWithStats(mask)
    return cent[1:].astype(np.float32) if n > 1 else np.zeros((0, 2), np.float32)


def match_f1(pred: np.ndarray, true: np.ndarray, tol: float = MATCH_PX):
    """Greedy nearest matching within `tol` px -> precision, recall, F1."""
    if len(true) == 0:
        return (0.0, 0.0, 0.0, 0, len(pred), 0)
    if len(pred) == 0:
        return (0.0, 0.0, 0.0, 0, 0, len(true))
    used = set()
    tp = 0
    for p in pred:
        d = np.hypot(true[:, 0] - p[0], true[:, 1] - p[1])
        order = np.argsort(d)
        for i in order:
            if d[i] > tol:
                break
            if i not in used:
                used.add(int(i))
                tp += 1
                break
    fp = len(pred) - tp
    fn = len(true) - tp
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return prec, rec, f1, tp, fp, fn


def classical_points(sample) -> np.ndarray:
    """Run the existing OpenCV detector on the SAME crop, in crop-local px."""
    ok, buf = cv2.imencode(".png", sample.image)
    if not ok:
        return np.zeros((0, 2), np.float32)
    res = detect_cells(buf.tobytes(), {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0}, None)
    h, w = sample.image.shape[:2]
    return np.array([[c["x"] * w, c["y"] * h] for c in res["cells"]], np.float32).reshape(-1, 2)


def main():
    if not CKPT.exists():
        raise SystemExit(f"no checkpoint at {CKPT} — run `python -m ml.train` first")
    model = TinyUNet()
    model.load_state_dict(torch.load(CKPT, map_location="cpu")["state_dict"])
    model.eval()

    samples = load_samples()
    _, test = split_samples(samples)
    RUNS.mkdir(parents=True, exist_ok=True)

    print(f"Evaluating on {len(test)} HELD-OUT images (never trained on)\n")
    header = f"{'image':24s} {'true':>5s} | {'ML':>5s} {'err%':>6s} {'F1':>5s} | {'CV':>5s} {'err%':>6s} {'F1':>5s}"
    print(header)
    print("-" * len(header))

    agg = {"ml_abs": 0, "cv_abs": 0, "true": 0, "ml_f1": [], "cv_f1": []}
    for s in test:
        dm = predict_density(model, s.image)
        ml_pts = peaks_from_density(dm)
        cv_pts = classical_points(s)
        true = s.points

        ml_n, cv_n, t_n = len(ml_pts), len(cv_pts), len(true)
        ml_err = abs(ml_n - t_n) / t_n * 100 if t_n else 0
        cv_err = abs(cv_n - t_n) / t_n * 100 if t_n else 0
        _, _, ml_f1, *_ = match_f1(ml_pts, true)
        _, _, cv_f1, *_ = match_f1(cv_pts, true)

        print(f"{s.label_id[:24]:24s} {t_n:5d} | {ml_n:5d} {ml_err:5.1f}% {ml_f1:5.2f} | "
              f"{cv_n:5d} {cv_err:5.1f}% {cv_f1:5.2f}")

        agg["ml_abs"] += abs(ml_n - t_n)
        agg["cv_abs"] += abs(cv_n - t_n)
        agg["true"] += t_n
        agg["ml_f1"].append(ml_f1)
        agg["cv_f1"].append(cv_f1)

        # overlay: true (green) vs ML (magenta) vs classical (yellow)
        vis = s.image.copy()
        for x, y in true:
            cv2.circle(vis, (int(x), int(y)), 9, (0, 220, 0), 2)
        for x, y in ml_pts:
            cv2.drawMarker(vis, (int(x), int(y)), (255, 0, 255), cv2.MARKER_CROSS, 10, 2)
        for x, y in cv_pts:
            cv2.drawMarker(vis, (int(x), int(y)), (0, 200, 255), cv2.MARKER_TILTED_CROSS, 8, 1)
        cv2.imwrite(str(RUNS / f"eval_{s.label_id}.png"), vis)

    t = agg["true"]
    ml_acc = 100 - (agg["ml_abs"] / t * 100) if t else 0
    cv_acc = 100 - (agg["cv_abs"] / t * 100) if t else 0
    print("\n=== OVERALL (held-out) ===")
    print(f"true cells: {t}")
    print(f"ML  count accuracy: {ml_acc:5.1f}%   mean F1: {np.mean(agg['ml_f1']):.2f}")
    print(f"CV  count accuracy: {cv_acc:5.1f}%   mean F1: {np.mean(agg['cv_f1']):.2f}")
    print(f"\noverlays -> {RUNS}  (green=truth, magenta=ML, yellow=classical)")

    (RUNS / "results.json").write_text(json.dumps({
        "test_images": [s.label_id for s in test],
        "true_cells": t,
        "ml_count_accuracy_pct": round(ml_acc, 1),
        "cv_count_accuracy_pct": round(cv_acc, 1),
        "ml_mean_f1": round(float(np.mean(agg["ml_f1"])), 3),
        "cv_mean_f1": round(float(np.mean(agg["cv_f1"])), 3),
    }, indent=2))


if __name__ == "__main__":
    main()
