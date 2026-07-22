"""Score detection against hand-labeled ground truth, at several resolutions.

This is the regression guard that catches scale-dependent bugs: detection
parameters are expressed in PIXELS, so if the working resolution drifts away
from what they were tuned on, counts silently explode. (That exact bug shipped
once — `detect_width` was set to 900px when the tuning assumes ~316px, which
scored 1.5% on phone-resolution photos.)

Needs labeled data in labels/ (produced by the annotation tool; gitignored).
Run:  .venv\\Scripts\\python.exe tests\\accuracy_check.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.detection import detect_cells  # noqa: E402

LABELS = ROOT / "labels"
# Accuracy must hold at phone resolutions too, not just the small reference images.
SCALES = (1, 3, 5)
MIN_ACCURACY = 80.0  # fail below this — a real regression, not noise


def load_records():
    out = []
    for p in sorted(LABELS.glob("*.json")):
        rec = json.loads(p.read_text())
        img_path = LABELS / rec["image_file"]
        if img_path.exists():
            out.append((p.stem, rec, cv2.imread(str(img_path))))
    return out


def accuracy_at(records, scale: int) -> float:
    """Mean count accuracy with every image resampled by `scale`."""
    err = total = 0
    for _, rec, img in records:
        if scale == 1:
            data = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])[1].tobytes()
        else:
            big = cv2.resize(
                img,
                (img.shape[1] * scale, img.shape[0] * scale),
                interpolation=cv2.INTER_CUBIC,
            )
            data = cv2.imencode(".jpg", big, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tobytes()
        got = detect_cells(data, rec["box"], None)["total_count"]
        err += abs(got - len(rec["points"]))
        total += len(rec["points"])
    return 100 - (err / total * 100) if total else 0.0


def main() -> int:
    records = load_records()
    if not records:
        print("no labeled data in labels/ — skipping (nothing to score against)")
        return 0

    cells = sum(len(r["points"]) for _, r, _ in records)
    print(f"{len(records)} labeled images, {cells} cells\n")

    failed = False
    for scale in SCALES:
        acc = accuracy_at(records, scale)
        label = "native" if scale == 1 else f"{scale}x (phone-size)"
        flag = ""
        if acc < MIN_ACCURACY:
            flag = f"  <-- FAIL (below {MIN_ACCURACY}%)"
            failed = True
        print(f"  {label:18s} count accuracy: {acc:5.1f}%{flag}")

    if failed:
        print("\nAccuracy regression. If detect_width changed, that's the likely cause.")
        return 1
    print("\nOK — accuracy holds across resolutions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
