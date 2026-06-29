"""Classical OpenCV cell-detection pipeline for hemocytometer images.

Single public entry point: :func:`detect_cells`. Stateless, CPU-only, deterministic.

Designed for real phone-through-eyepiece brightfield photos: live cells are small
BRIGHT dots (often with a faint dark halo) on a bright background, with faint grid
lines crossing the field. Dead cells (trypan blue) are small DARK BLUE dots.

Because live cells are brighter than background (not darker), we isolate them with a
white top-hat transform rather than a plain dark threshold. Dead cells are found in a
separate blue+dark pass. Thin grid lines are suppressed by morphological opening and
by the area/circularity filters.

Pipeline (crop -> list of cells):
  1. decode + crop to the user-drawn box (one counting square)
  2. preprocess: grayscale -> CLAHE -> blur
  3a. LIVE pass: white top-hat -> threshold -> open (kill grid lines) -> contours
  3b. DEAD pass: blue-excess & dark mask -> open -> contours
  4. filter each contour by area + circularity + shape; classify by pass
  5. de-duplicate (a blob found by both passes counts once, preferring dead)
  6. border rule: exclude cells touching the BOTTOM or RIGHT crop edge
  7. map centers back to normalized full-image coordinates
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from .params import resolve_params


class DetectionError(ValueError):
    """Raised when the input image or box is unusable."""


def detect_cells(image_bytes: bytes, box: dict, raw_params: dict | None) -> dict:
    """Detect and classify cells inside ``box`` of the given image."""
    params = resolve_params(raw_params)

    img = _decode(image_bytes)
    ih, iw = img.shape[:2]
    crop, (x0px, y0px) = _crop(img, box, iw, ih)
    ch, cw = crop.shape[:2]

    gray = _preprocess(crop, params)

    live_contours, bright_used, tophat = _detect_live(gray, params)
    dead_contours = (
        _detect_dead(crop, params)
        if params["detect_dead"] and _has_blue_signal(crop, params)
        else []
    )

    # Reject dim/empty live detections: a real cell has a bright core, so its mean
    # top-hat response must clear a multiple of the detection threshold. Relative to
    # bright_used so it adapts per image under auto-brightness. Dead cells are dark by
    # nature, so this filter is applied to the live pass only.
    min_core = params["min_core_factor"] * bright_used

    # Build candidate cells (crop-local), tagged by pass.
    candidates: list[dict] = []
    for c in dead_contours:
        cell = _measure(c, cw, ch, params)
        if cell:
            cell["type"] = "dead"
            candidates.append(cell)
    for c in live_contours:
        cell = _measure(c, cw, ch, params)
        if cell and _core_brightness(c, tophat) >= min_core:
            cell["type"] = "live"
            candidates.append(cell)

    # De-duplicate overlapping detections (dead has priority since it's listed first).
    kept = _dedupe(candidates)

    cells = [
        {
            "x": (x0px + k["cx"]) / iw,
            "y": (y0px + k["cy"]) / ih,
            "radius": k["radius_px"] / iw,
            "type": k["type"],
        }
        for k in kept
    ]

    live = sum(1 for c in cells if c["type"] == "live")
    dead = len(cells) - live
    total = len(cells)
    viability = (live / total) if total else 0.0

    return {
        "cells": cells,
        "live_count": live,
        "dead_count": dead,
        "total_count": total,
        "bright_used": bright_used,
        "viability": round(viability, 4),
    }


# --------------------------------------------------------------------------- #
# Step 1: decode + crop
# --------------------------------------------------------------------------- #
def _decode(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise DetectionError("could not decode image (unsupported or corrupt file)")
    return img


def _crop(img: np.ndarray, box: dict, iw: int, ih: int):
    x0 = int(round(box["x0"] * iw))
    y0 = int(round(box["y0"] * ih))
    x1 = int(round(box["x1"] * iw))
    y1 = int(round(box["y1"] * ih))
    x0, x1 = sorted((max(0, min(iw, x0)), max(0, min(iw, x1))))
    y0, y1 = sorted((max(0, min(ih, y0)), max(0, min(ih, y1))))
    if x1 - x0 < 2 or y1 - y0 < 2:
        raise DetectionError("box is too small after clamping to the image")
    return img[y0:y1, x0:x1].copy(), (x0, y0)


# --------------------------------------------------------------------------- #
# Step 2: preprocess
# --------------------------------------------------------------------------- #
def _preprocess(crop: np.ndarray, params: dict) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    if params["clahe_clip"] > 0:
        clahe = cv2.createCLAHE(clipLimit=params["clahe_clip"], tileGridSize=(8, 8))
        gray = clahe.apply(gray)
    k = params["blur_kernel"]
    if k >= 3:
        gray = cv2.medianBlur(gray, k)
    return gray


# --------------------------------------------------------------------------- #
# Step 3a: LIVE pass (bright top-hat)
# --------------------------------------------------------------------------- #
def _detect_live(gray: np.ndarray, params: dict) -> tuple[list[np.ndarray], int, np.ndarray]:
    """Return (contours, brightness_threshold_used, tophat)."""
    size = params["tophat_size"]
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)

    if params["auto_bright"]:
        thresh = _auto_bright_threshold(tophat, int(params["auto_bright_floor"]),
                                        fallback=int(params["bright_thresh"]))
    else:
        thresh = int(params["bright_thresh"])

    _, binary = cv2.threshold(tophat, thresh, 255, cv2.THRESH_BINARY)
    binary = _suppress_lines(binary, params)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return list(contours), thresh, tophat


def _core_brightness(contour: np.ndarray, tophat: np.ndarray) -> float:
    """Mean top-hat response inside a blob — a real cell's bright core scores high,
    a dim/empty false detection scores low (just above the detection threshold)."""
    mask = np.zeros(tophat.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, thickness=-1)
    return cv2.mean(tophat, mask=mask)[0]


def _auto_bright_threshold(tophat: np.ndarray, floor: int, fallback: int) -> int:
    """Otsu threshold on the meaningful top-hat response.

    Computing Otsu over the whole image is skewed by the large flat near-zero
    background; restricting to the response (pixels > 2) finds the bright-cell vs
    halo split far more reliably. Clamped to `floor` so it can never go wildly
    permissive on a near-empty crop.
    """
    resp = tophat[tophat > 2]
    if resp.size < 10:
        return fallback
    t, _ = cv2.threshold(resp.reshape(-1, 1), 0, 255,
                         cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return max(int(t), floor)


# --------------------------------------------------------------------------- #
# Step 3b: DEAD pass (blue + dark)
# --------------------------------------------------------------------------- #
def _has_blue_signal(crop: np.ndarray, params: dict) -> bool:
    """Cheap early-out: skip the dead pass entirely when the crop has no blue.

    Trypan-blue dead cells make the blue channel exceed the red/green average. If
    the strongest blue-excess in the whole crop is below the detection threshold,
    there are no dead cells to find — avoid the full mask pipeline.
    """
    b, g, r = cv2.split(crop.astype(np.int16))
    blue_excess = b - (r + g) // 2
    return bool(blue_excess.max() >= params["blue_excess"])


def _detect_dead(crop: np.ndarray, params: dict) -> list[np.ndarray]:
    b, g, r = cv2.split(crop.astype(np.int16))
    # "blueness": blue channel exceeds the average of red and green
    blue_excess = b - (r + g) // 2
    blue_mask = (blue_excess >= params["blue_excess"]).astype(np.uint8) * 255

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    dark_mask = (val <= params["v_dead_max"]).astype(np.uint8) * 255
    sat_mask = (sat >= params["sat_min"]).astype(np.uint8) * 255

    mask = cv2.bitwise_and(blue_mask, dark_mask)
    mask = cv2.bitwise_and(mask, sat_mask)
    mask = _suppress_lines(mask, params)
    # close small gaps inside a stained cell
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return list(contours)


def _suppress_lines(binary: np.ndarray, params: dict) -> np.ndarray:
    """Open with a small ellipse to erase thin grid lines while keeping round cells."""
    k = params["line_kernel"]
    if k < 3:
        return binary
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)


# --------------------------------------------------------------------------- #
# Step 4 + 7: measure / filter / border rule (per contour)
# --------------------------------------------------------------------------- #
def _measure(contour: np.ndarray, cw: int, ch: int, params: dict) -> dict | None:
    area = cv2.contourArea(contour)
    min_area = math.pi * params["min_radius"] ** 2
    max_area = math.pi * params["max_radius"] ** 2
    if area < min_area or area > max_area:
        return None

    perimeter = cv2.arcLength(contour, True)
    if perimeter <= 0:
        return None
    circularity = 4 * math.pi * area / (perimeter * perimeter)
    if circularity < params["min_circularity"]:
        return None

    bx, by, bw, bh = cv2.boundingRect(contour)

    # Shape gates: reject grid-line fragments that slip past circularity. A line
    # segment is elongated (high aspect ratio) or sparsely fills its bounding box.
    aspect = max(bw, bh) / max(1, min(bw, bh))
    if aspect > params["max_aspect"]:
        return None
    extent = area / (bw * bh) if bw * bh else 0.0
    if extent < params["min_extent"]:
        return None

    # Border rule: exclude cells touching BOTTOM or RIGHT edge (checked first).
    tol = 2
    if (by + bh) >= (ch - tol) or (bx + bw) >= (cw - tol):
        return None

    (cx, cy), radius = cv2.minEnclosingCircle(contour)
    return {"cx": cx, "cy": cy, "radius_px": max(radius, params["min_radius"])}


# --------------------------------------------------------------------------- #
# Step 6: de-duplicate overlapping detections
# --------------------------------------------------------------------------- #
def _dedupe(candidates: list[dict]) -> list[dict]:
    """Drop a cell whose center lies within an already-kept cell's radius.

    Candidates are processed in order (dead first), so when a live and dead
    detection overlap, the dead one wins.
    """
    kept: list[dict] = []
    for cand in candidates:
        dup = False
        for k in kept:
            d2 = (cand["cx"] - k["cx"]) ** 2 + (cand["cy"] - k["cy"]) ** 2
            if d2 <= max(k["radius_px"], cand["radius_px"]) ** 2:
                dup = True
                break
        if not dup:
            kept.append(cand)
    return kept
