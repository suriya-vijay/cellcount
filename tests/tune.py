"""Interactive-ish tuning: try a parameter set, write overlay, print count.

Edit PARAMS below and rerun to converge on good defaults for the real samples.
Pass an image index (0-4) to focus on one image; default does all.
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

# A box that roughly covers the central counting region, avoiding the black rim.
BOX = {"x0": 0.10, "y0": 0.18, "x1": 0.92, "y1": 0.82}

PARAMS = None  # use tuned defaults from app/params.py


def draw(img, result):
    h, w = img.shape[:2]
    out = img.copy()
    bx = BOX
    cv2.rectangle(out, (int(bx["x0"] * w), int(bx["y0"] * h)),
                  (int(bx["x1"] * w), int(bx["y1"] * h)), (255, 0, 0), 1)
    for c in result["cells"]:
        cx, cy = int(c["x"] * w), int(c["y"] * h)
        color = (0, 200, 0) if c["type"] == "live" else (0, 0, 255)
        cv2.circle(out, (cx, cy), max(3, int(c["radius"] * w)), color, 1)
    return out


def main():
    paths = sorted(SAMPLES.glob("*.jpg"))
    if len(sys.argv) == 2:
        paths = [paths[int(sys.argv[1])]]
    for path in paths:
        data = path.read_bytes()
        result = detect_cells(data, BOX, PARAMS)
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        cv2.imwrite(str(path.with_suffix(".tune.png")), draw(img, result))
        print(f"{path.name}: total={result['total_count']} "
              f"live={result['live_count']} dead={result['dead_count']}")


if __name__ == "__main__":
    main()
