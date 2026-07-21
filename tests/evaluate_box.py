"""Box-detection evaluation harness: score detect_box against a ground-truth box.

Ground truth comes from an ANNOTATED image where the counting square is drawn as a
big YELLOW rectangle (the largest yellow component). This tool:
  1. extracts the GT box from the annotation's yellow rectangle,
  2. runs detect_box on the image,
  3. reports IoU (intersection-over-union) and pass/fail at an IoU threshold,
  4. writes an overlay (green=GT, red=detected).

This is the objective metric that lets us tune box-detection params and decide when
auto-box is reliable enough to become the default (fully automatic) instead of a
manual-confirmed suggestion.

Usage:
  python tests/evaluate_box.py <annotated_image>
Self-test (no args): verifies the IoU math.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.detection import detect_box  # noqa: E402


def gt_box_from_yellow(annotated_bgr: np.ndarray):
    """Largest yellow component's bounding box = the drawn counting square."""
    b, g, r = cv2.split(annotated_bgr.astype(np.int16))
    yellow = ((r > 150) & (g > 150) & (b < 120)).astype(np.uint8) * 255
    n, _, stats, _ = cv2.connectedComponentsWithStats(yellow)
    if n <= 1:
        return None
    best = max(range(1, n), key=lambda i: stats[i, cv2.CC_STAT_AREA])
    x, y, w, h = (stats[best, cv2.CC_STAT_LEFT], stats[best, cv2.CC_STAT_TOP],
                  stats[best, cv2.CC_STAT_WIDTH], stats[best, cv2.CC_STAT_HEIGHT])
    return (x, y, x + w, y + h)


def iou(a, b) -> float:
    ix0, iy0 = max(a[0], b[0]), max(a[1], b[1])
    ix1, iy1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua else 0.0


def evaluate_box(annotated_path: Path, iou_bar: float = 0.7):
    img = cv2.imread(str(annotated_path))
    if img is None:
        raise SystemExit(f"could not read {annotated_path}")
    ih, iw = img.shape[:2]

    gt = gt_box_from_yellow(img)
    if gt is None:
        raise SystemExit("no yellow ground-truth box found in annotation")

    result = detect_box(annotated_path.read_bytes(), None)
    if not result["box"]:
        print(f"{annotated_path.name}: detect_box returned NO box "
              f"(confidence={result['confidence']}, source={result['source']}) "
              f"-> falls back to manual. IoU=0.")
        return 0.0

    b = result["box"]
    det = (b["x0"] * iw, b["y0"] * ih, b["x1"] * iw, b["y1"] * ih)
    score = iou(gt, det)

    vis = img.copy()
    cv2.rectangle(vis, (gt[0], gt[1]), (gt[2], gt[3]), (0, 255, 0), 2)
    cv2.rectangle(vis, (int(det[0]), int(det[1])), (int(det[2]), int(det[3])),
                  (0, 0, 255), 2)
    out = annotated_path.with_suffix(".boxeval.png")
    cv2.imwrite(str(out), vis)

    print(f"{annotated_path.name}: IoU={score:.3f} "
          f"({'PASS' if score >= iou_bar else 'FAIL'} @ {iou_bar}), "
          f"confidence={result['confidence']}")
    print(f"overlay -> {out.name} (green=ground truth, red=detected)")
    return score


def _self_test():
    a = (0, 0, 10, 10)
    b = (5, 5, 15, 15)  # inter=25, union=175 -> IoU=25/175
    assert abs(iou(a, b) - 25 / 175) < 1e-9, iou(a, b)
    assert iou(a, a) == 1.0
    assert iou((0, 0, 1, 1), (5, 5, 6, 6)) == 0.0
    print("SELF-TEST OK: IoU math correct")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        _self_test()
    else:
        evaluate_box(Path(sys.argv[1]))
