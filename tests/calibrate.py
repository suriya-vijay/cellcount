"""Run detection on real sample images and write overlay PNGs for visual tuning.

Usage:
  python tests/calibrate.py [box_x0 box_y0 box_x1 box_y1]

If a box is given (normalized), detection runs only inside it; otherwise the whole
image is used as the counting region. Writes <name>.overlay.png next to each sample
and prints the counts so we can tune params.py defaults against real cells.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.detection import detect_cells  # noqa: E402

SAMPLES = ROOT / "samples"


def overlay(img, result, box):
    h, w = img.shape[:2]
    out = img.copy()
    # draw the box
    x0, y0, x1, y1 = box["x0"], box["y0"], box["x1"], box["y1"]
    cv2.rectangle(out, (int(x0 * w), int(y0 * h)), (int(x1 * w), int(y1 * h)),
                  (255, 0, 0), 2)
    for c in result["cells"]:
        cx, cy = int(c["x"] * w), int(c["y"] * h)
        r = max(4, int(c["radius"] * w))
        color = (0, 200, 0) if c["type"] == "live" else (0, 0, 255)
        cv2.circle(out, (cx, cy), r, color, 2)
    return out


def main():
    if len(sys.argv) == 5:
        box = {"x0": float(sys.argv[1]), "y0": float(sys.argv[2]),
               "x1": float(sys.argv[3]), "y1": float(sys.argv[4])}
    else:
        box = {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0}

    # optional params override via env-like trailing key=value args could go here
    params = None

    for path in sorted(SAMPLES.glob("*.jpg")):
        data = path.read_bytes()
        result = detect_cells(data, box, params)
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        out = overlay(img, result, box)
        dst = path.with_suffix(".overlay.png")
        cv2.imwrite(str(dst), out)
        print(f"{path.name}: total={result['total_count']} "
              f"live={result['live_count']} dead={result['dead_count']} "
              f"-> {dst.name}")


if __name__ == "__main__":
    main()
