"""Smoke tests for the detection pipeline.

Synthetic image: bright cells (top-hat target) + dark-blue dead cells on a bright-ish
background, matching the real brightfield case. Verifies counts, classification, the
border rule, and coordinate normalization.

Run: C:\\cellcountingv2\\.venv\\Scripts\\python.exe -m pytest tests -q
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.detection import detect_cells  # noqa: E402

FULL_BOX = {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0}


def _img(live_centers, dead_centers, size=600, bg=180):
    img = np.full((size, size, 3), bg, dtype=np.uint8)
    for (x, y) in live_centers:
        cv2.circle(img, (x, y), 5, (245, 245, 245), -1)  # bright live cell
    for (x, y) in dead_centers:
        cv2.circle(img, (x, y), 5, (130, 50, 40), -1)    # dark blue dead cell (BGR)
    return cv2.imencode(".png", img)[1].tobytes()


def _grid(n, start, step):
    pts = []
    side = int(np.ceil(np.sqrt(n)))
    for i in range(n):
        r, c = divmod(i, side)
        pts.append((start + c * step, start + r * step))
    return pts


def test_smoke_counts_and_classifies():
    live = _grid(16, 80, 110)
    dead = [(500, 80), (500, 200), (380, 500)]
    result = detect_cells(_img(live, dead), FULL_BOX, None)
    print(f"live={result['live_count']} dead={result['dead_count']} "
          f"total={result['total_count']}")
    assert 15 <= result["total_count"] <= 25
    assert result["dead_count"] >= 1
    assert result["live_count"] >= 10
    for c in result["cells"]:
        assert 0.0 <= c["x"] <= 1.0 and 0.0 <= c["y"] <= 1.0
        assert c["type"] in ("live", "dead")


def test_border_rule_excludes_right_bottom():
    size = 400
    edge = _img([(size - 1, 200)], [], size=size)   # hard against right edge
    assert detect_cells(edge, FULL_BOX, None)["total_count"] == 0
    inner = _img([(200, 200)], [], size=size)
    assert detect_cells(inner, FULL_BOX, None)["total_count"] == 1


if __name__ == "__main__":
    test_smoke_counts_and_classifies()
    test_border_rule_excludes_right_bottom()
    print("ALL CHECKS PASSED")
