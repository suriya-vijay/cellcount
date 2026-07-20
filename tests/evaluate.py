"""Evaluation harness: score the detector against a human-annotated ground truth.

The user marks every real cell with a colored DOT (default red/magenta) on a copy of
a sample image. This tool:
  1. extracts the dot centroids by color (the ground-truth cell locations),
  2. runs detect_cells on the ORIGINAL image with a given box + params,
  3. greedily matches predictions to ground-truth within a distance tolerance,
  4. reports precision / recall / F1 + false negatives (misses) and false positives,
  5. writes an overlay PNG: green=hit, red=missed cell, yellow=false detection.

This replaces "looks better" with an objective number, so pipeline changes can be
tuned to maximize F1 on the user's own judgment.

Usage:
  python tests/evaluate.py <annotated_image> <original_image> [x0 y0 x1 y1]
  # box defaults to the whole image if not given
  # If <original_image> is omitted, the annotated image is used as the source too
  # (fine if the dots are small and don't cover the cells).

Self-test (no args): runs a synthetic check that the metrics are computed correctly.
  python tests/evaluate.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.detection import detect_cells  # noqa: E402


# --------------------------------------------------------------------------- #
# Ground-truth extraction: find the colored annotation dots.
# --------------------------------------------------------------------------- #
def extract_dots(annotated_bgr: np.ndarray) -> list[tuple[float, float]]:
    """Return centroids of the annotation marks (red/magenta dots).

    Matches strongly red pixels: R high, G and B low (covers pure red and magenta-ish
    marks). Robust to anti-aliasing via a small close + connected components.
    """
    b, g, r = cv2.split(annotated_bgr.astype(np.int16))
    red_mask = ((r > 150) & (g < 100) & (b < 100)).astype(np.uint8) * 255
    # also catch magenta (r high, b high, g low)
    magenta = ((r > 150) & (b > 120) & (g < 110)).astype(np.uint8) * 255
    mask = cv2.bitwise_or(red_mask, magenta)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    n, _, stats, centroids = cv2.connectedComponentsWithStats(mask)
    pts = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 2:  # ignore single-pixel noise
            cx, cy = centroids[i]
            pts.append((float(cx), float(cy)))
    return pts


# --------------------------------------------------------------------------- #
# Matching + metrics.
# --------------------------------------------------------------------------- #
def match(pred: list[tuple], truth: list[tuple], tol: float):
    """Greedy nearest-neighbor match within tol pixels. Returns (hits, missed, false)."""
    used = [False] * len(pred)
    hits, missed = [], []
    for t in truth:
        best, best_d = -1, tol
        for j, p in enumerate(pred):
            if used[j]:
                continue
            d = ((p[0] - t[0]) ** 2 + (p[1] - t[1]) ** 2) ** 0.5
            if d <= best_d:
                best, best_d = j, d
        if best >= 0:
            used[best] = True
            hits.append((t, pred[best]))
        else:
            missed.append(t)
    false = [pred[j] for j in range(len(pred)) if not used[j]]
    return hits, missed, false


def metrics(n_hits: int, n_missed: int, n_false: int) -> dict:
    tp, fn, fp = n_hits, n_missed, n_false
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"precision": round(precision, 3), "recall": round(recall, 3),
            "f1": round(f1, 3), "tp": tp, "fn": fn, "fp": fp}


def evaluate(annotated_path: Path, original_path: Path, box: dict,
             params: dict | None = None, tol_frac: float = 0.02):
    annotated = cv2.imread(str(annotated_path))
    if annotated is None:
        raise SystemExit(f"could not read {annotated_path}")
    truth = extract_dots(annotated)

    original_bytes = original_path.read_bytes()
    result = detect_cells(original_bytes, box, params)
    ih, iw = annotated.shape[:2]
    pred = [(c["x"] * iw, c["y"] * ih) for c in result["cells"]]

    tol = tol_frac * iw  # ~1 cell radius in px
    hits, missed, false = match(pred, truth, tol)
    m = metrics(len(hits), len(missed), len(false))

    # overlay
    vis = cv2.imread(str(original_path))
    for _, p in hits:
        cv2.circle(vis, (int(p[0]), int(p[1])), 8, (0, 200, 0), 2)   # green hit
    for t in missed:
        cv2.circle(vis, (int(t[0]), int(t[1])), 9, (0, 0, 255), 2)   # red miss
    for p in false:
        cv2.circle(vis, (int(p[0]), int(p[1])), 8, (0, 220, 220), 2)  # yellow false
    out = original_path.with_suffix(".eval.png")
    cv2.imwrite(str(out), vis)

    print(f"ground-truth cells: {len(truth)}   detected: {len(pred)}")
    print(f"precision={m['precision']}  recall={m['recall']}  F1={m['f1']}  "
          f"(hits={m['tp']} misses={m['fn']} false={m['fp']})")
    print(f"overlay -> {out.name}  (green=hit, red=missed, yellow=false)")
    return m


# --------------------------------------------------------------------------- #
# Self-test: verify the metric math on a synthetic case.
# --------------------------------------------------------------------------- #
def _self_test():
    truth = [(10, 10), (20, 20), (30, 30), (40, 40)]
    pred = [(10, 11), (21, 20), (99, 99)]  # 2 hits, 2 misses, 1 false
    hits, missed, false = match(pred, truth, tol=5)
    m = metrics(len(hits), len(missed), len(false))
    assert m["tp"] == 2 and m["fn"] == 2 and m["fp"] == 1, m
    assert m["precision"] == round(2 / 3, 3)
    assert m["recall"] == 0.5
    assert m["f1"] == round(2 * (2/3) * 0.5 / ((2/3) + 0.5), 3)
    print("SELF-TEST OK:", m)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        _self_test()
    else:
        annotated = Path(sys.argv[1])
        original = Path(sys.argv[2]) if len(sys.argv) > 2 else annotated
        if len(sys.argv) >= 7:
            box = {"x0": float(sys.argv[3]), "y0": float(sys.argv[4]),
                   "x1": float(sys.argv[5]), "y1": float(sys.argv[6])}
        else:
            box = {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0}
        evaluate(annotated, original, box)
