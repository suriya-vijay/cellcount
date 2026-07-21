"""Default detection parameters and clamping.

Every value here corresponds to a UI slider/toggle. The frontend sends a partial
``params`` dict; :func:`resolve_params` fills in defaults and clamps each value to a
safe range so a bad slider value can never crash the OpenCV pipeline.

Defaults are tuned against real phone-through-eyepiece hemocytometer photos (bright
brightfield cells with a faint dark halo on a bright background, faint grid lines).
They are a strong starting point but a given microscope/camera may need a one-time
tune via the UI sliders.
"""

from __future__ import annotations

# name -> (default, min, max). Values are clamped to [min, max].
_SPEC: dict[str, tuple[float, float, float]] = {
    # --- bright (live) cell detection via top-hat ---
    # Top-hat structuring-element diameter: must be a bit larger than a cell so the
    # cell survives the transform but the slowly-varying background is removed.
    "tophat_size": (15, 5, 61),
    # Brightness sensitivity: cells must be at least this much brighter than their
    # local background (top-hat response). Lower = more cells (and more noise).
    # Used only when auto_bright is off (manual override).
    "bright_thresh": (18, 1, 120),
    # When auto_bright is on, Otsu picks the threshold per image; this is the floor
    # it is clamped to so a near-empty crop can't go wildly permissive.
    "auto_bright_floor": (12, 0, 60),
    # --- size + shape filtering (applies to both live and dead) ---
    # Defaults are deliberately loose ("overdetect"): catch touching/merged and
    # slightly-irregular cells, accepting a few grid/debris false marks that the
    # user can tighten via the sliders. Tighten min_circularity / lower max_radius
    # to reduce false positives.
    "min_radius": (2, 1, 100),
    "max_radius": (14, 2, 200),
    "min_circularity": (0.35, 0.0, 1.0),
    # Shape gates that reject grid-line fragments circularity misses.
    "max_aspect": (3.0, 1.0, 6.0),    # reject blobs longer/thinner than this
    "min_extent": (0.32, 0.0, 1.0),   # reject blobs filling < this fraction of their box
    # Reject dim/empty live detections: a blob's mean top-hat core must be at least
    # this multiple of the detection threshold. 1.0 = off; higher = stricter.
    "min_core_factor": (1.3, 1.0, 4.0),
    # --- preprocessing ---
    # Flat-field sigma: Gaussian blur radius for the background estimate. Must be
    # much larger than a cell (so cells are erased) but small enough to track the
    # light gradient. Only used when flatfield is on.
    "flatfield_sigma": (31, 5, 101),
    "blur_kernel": (3, 1, 15),        # odd; 1 disables blur
    "clahe_clip": (2.0, 0.0, 10.0),
    "line_kernel": (3, 1, 9),         # opening size to suppress thin grid lines
    # --- dead (trypan-blue) cell detection ---
    # Dead cells are dark + blue. Detected on the blue-vs-overall channel signal.
    "blue_excess": (18, 0, 150),      # how much B must exceed R/G mean to be "blue"
    "v_dead_max": (170, 0, 255),      # dead cells are darker than this
    "sat_min": (40, 0, 255),          # min saturation to count as stained
    # --- automatic counting-box detection ---
    # Below this confidence, detect_box returns no box (UI falls back to manual draw).
    "box_min_confidence": (0.35, 0.0, 1.0),
}

_BOOL_DEFAULTS: dict[str, bool] = {
    "flatfield": True,               # flatten uneven ("warped") illumination first
    "auto_bright": True,             # auto-pick brightness threshold (Otsu) per image
    "detect_dead": True,             # run the blue dead-cell pass
}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def resolve_params(raw: dict | None) -> dict:
    """Merge user params over defaults, clamping everything to safe ranges."""
    raw = raw or {}
    out: dict = {}

    for name, (default, lo, hi) in _SPEC.items():
        val = raw.get(name, default)
        try:
            val = float(val)
        except (TypeError, ValueError):
            val = default
        out[name] = _clamp(val, lo, hi)

    for name, default in _BOOL_DEFAULTS.items():
        out[name] = bool(raw.get(name, default))

    # kernels must be odd integers
    out["tophat_size"] = _force_odd(int(out["tophat_size"]), floor=5)
    out["blur_kernel"] = _force_odd(int(out["blur_kernel"]), floor=1)
    out["line_kernel"] = _force_odd(int(out["line_kernel"]), floor=1)

    if out["max_radius"] <= out["min_radius"]:
        out["max_radius"] = out["min_radius"] + 1

    return out


def _force_odd(value: int, floor: int) -> int:
    value = max(floor, value)
    if value % 2 == 0:
        value += 1
    return value
