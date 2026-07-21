"""Training data pipeline: annotated labels -> (image crop, density map) pairs.

Why a density map? The model learns to place a small Gaussian bump on each cell.
Summing the map gives the count, so two TOUCHING cells produce two bumps and are
counted separately — the exact failure mode classical blob detection can't fix.
Grid lines get ~zero density because the model learns they aren't cells.

Labels come from the in-app annotation tool (labels/<id>.json + <id>.jpg).
"""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
LABELS_DIR = ROOT / "labels"

SIGMA = 2.5          # Gaussian radius (px) per cell in the density map
CROP = 256           # training crop size
SPLIT_SEED = 7       # fixed so the train/test split is reproducible


@dataclass
class Sample:
    """One annotated image, cropped to its counting box."""

    label_id: str
    image: np.ndarray        # BGR crop of the counting box
    points: np.ndarray       # (N,2) float32 cell centers, in CROP-LOCAL pixels
    image_hash: str

    @property
    def count(self) -> int:
        return len(self.points)


def load_samples(labels_dir: Path = LABELS_DIR) -> list[Sample]:
    """Load every label, de-duplicating images labeled more than once.

    When the same image was annotated twice, keep the pass with MORE points
    (assumed to be the more complete correction).
    """
    by_hash: dict[str, Sample] = {}
    for jpath in sorted(labels_dir.glob("*.json")):
        rec = json.loads(jpath.read_text())
        ipath = labels_dir / rec["image_file"]
        if not ipath.exists():
            continue
        raw = ipath.read_bytes()
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            continue
        ih, iw = img.shape[:2]

        b = rec["box"]
        x0, y0 = int(b["x0"] * iw), int(b["y0"] * ih)
        x1, y1 = int(b["x1"] * iw), int(b["y1"] * ih)
        x0, x1 = max(0, min(x0, x1)), min(iw, max(x0, x1))
        y0, y1 = max(0, min(y0, y1)), min(ih, max(y0, y1))
        if x1 - x0 < 32 or y1 - y0 < 32:
            continue

        crop = img[y0:y1, x0:x1].copy()
        pts = []
        for p in rec["points"]:
            px, py = p["x"] * iw - x0, p["y"] * ih - y0
            if 0 <= px < crop.shape[1] and 0 <= py < crop.shape[0]:
                pts.append((px, py))
        pts = np.array(pts, dtype=np.float32).reshape(-1, 2)

        h = hashlib.md5(raw).hexdigest()[:10]
        cand = Sample(jpath.stem, crop, pts, h)
        prev = by_hash.get(h)
        if prev is None or cand.count > prev.count:
            by_hash[h] = cand

    return sorted(by_hash.values(), key=lambda s: s.label_id)


def density_map(shape: tuple[int, int], points: np.ndarray, sigma: float = SIGMA) -> np.ndarray:
    """Render points as summed Gaussians. Integral of the map == len(points)."""
    h, w = shape
    dm = np.zeros((h, w), dtype=np.float32)
    for x, y in points:
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < w and 0 <= yi < h:
            dm[yi, xi] += 1.0
    if dm.max() > 0:
        # Normalizing the kernel keeps the sum equal to the cell count.
        k = int(sigma * 6) | 1
        dm = cv2.GaussianBlur(dm, (k, k), sigma)
    return dm


def split_samples(samples: list[Sample], n_test: int = 2):
    """Deterministic by-image split. Test images are NEVER trained on."""
    idx = list(range(len(samples)))
    random.Random(SPLIT_SEED).shuffle(idx)
    test_idx = set(idx[:n_test])
    train = [s for i, s in enumerate(samples) if i not in test_idx]
    test = [s for i, s in enumerate(samples) if i in test_idx]
    return train, test


# --------------------------------------------------------------------------- #
# Augmentation — critical with few images. Brightness/contrast/gamma jitter
# directly simulates the uneven "warped" microscope lighting that breaks the
# classical detector.
# --------------------------------------------------------------------------- #
def augment(crop: np.ndarray, points: np.ndarray, rng: random.Random, size: int = CROP):
    h, w = crop.shape[:2]
    # random crop window (pad if the source is smaller than the crop size)
    if h < size or w < size:
        ph, pw = max(0, size - h), max(0, size - w)
        crop = cv2.copyMakeBorder(crop, 0, ph, 0, pw, cv2.BORDER_REFLECT_101)
        h, w = crop.shape[:2]
    ox = rng.randint(0, w - size)
    oy = rng.randint(0, h - size)
    img = crop[oy:oy + size, ox:ox + size].copy()
    pts = points - np.array([ox, oy], dtype=np.float32)
    keep = (pts[:, 0] >= 0) & (pts[:, 0] < size) & (pts[:, 1] >= 0) & (pts[:, 1] < size)
    pts = pts[keep]

    # flips
    if rng.random() < 0.5:
        img = img[:, ::-1].copy()
        if len(pts):
            pts[:, 0] = size - 1 - pts[:, 0]
    if rng.random() < 0.5:
        img = img[::-1].copy()
        if len(pts):
            pts[:, 1] = size - 1 - pts[:, 1]
    # 90-degree rotations
    for _ in range(rng.randint(0, 3)):
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        if len(pts):
            pts = np.stack([size - 1 - pts[:, 1], pts[:, 0]], axis=1)

    # photometric jitter (simulates the lighting warp)
    img = img.astype(np.float32)
    img *= rng.uniform(0.7, 1.3)                      # brightness
    img = (img - 128) * rng.uniform(0.75, 1.3) + 128  # contrast
    if rng.random() < 0.5:                            # smooth illumination gradient
        gy, gx = np.mgrid[0:size, 0:size].astype(np.float32) / size
        ramp = 1.0 + rng.uniform(-0.35, 0.35) * (gx if rng.random() < 0.5 else gy)
        img *= ramp[..., None]
    img = np.clip(img, 0, 255).astype(np.uint8)
    return img, pts.astype(np.float32)


def to_tensor_pair(img: np.ndarray, pts: np.ndarray):
    """(H,W,3) uint8 + points -> (1,H,W) float image, (1,H,W) float density."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    dm = density_map(gray.shape, pts)
    return gray[None, ...], dm[None, ...]


if __name__ == "__main__":
    samples = load_samples()
    total = sum(s.count for s in samples)
    print(f"unique images: {len(samples)}   total labeled cells: {total}")
    for s in samples:
        print(f"  {s.label_id:24s} crop={s.image.shape[1]}x{s.image.shape[0]:<4d} cells={s.count}")
    train, test = split_samples(samples)
    print(f"\ntrain: {[s.label_id for s in train]}")
    print(f"test : {[s.label_id for s in test]}")
    # density map integral should equal the cell count
    s = samples[0]
    dm = density_map(s.image.shape[:2], s.points)
    print(f"\ndensity-map check on {s.label_id}: sum={dm.sum():.2f} vs cells={s.count}")
