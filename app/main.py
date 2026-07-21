"""FastAPI app exposing the OpenCV cell-detection pipeline.

Endpoints:
  GET  /health  -> {"status": "ok"}
  POST /detect  -> run detection on one image+box and return the cell list

/detect is multipart/form-data:
  image:  the uploaded file (jpg/jpeg/png/tiff)
  box:    JSON string {"x0","y0","x1","y1"} (normalized 0-1)
  params: JSON string of slider values (optional; defaults applied server-side)
"""

from __future__ import annotations

import io
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from secrets import token_hex

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .detection import DetectionError, detect_box, detect_cells
from .schemas import (
    Box,
    BoxDetectResponse,
    DetectResponse,
    LabelRecord,
    LabelSaveResponse,
)

app = FastAPI(title="CellCount", version="1.0.0")

# Directory where annotation labels (image + JSON sidecar) accumulate for ML
# training. Ephemeral on free hosting (see /labels docs) → a local activity.
LABELS_DIR = Path(__file__).resolve().parent.parent / "labels"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/detect", response_model=DetectResponse)
async def detect(
    image: UploadFile = File(...),
    box: str = Form(...),
    params: str = Form("{}"),
) -> DetectResponse:
    # --- parse + validate the box ---
    try:
        box_obj = Box(**json.loads(box))
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid box JSON: {exc}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"invalid box: {exc}")

    # --- parse params (lenient: detection clamps/fills defaults) ---
    try:
        params_obj = json.loads(params) if params else {}
        if not isinstance(params_obj, dict):
            params_obj = {}
    except json.JSONDecodeError:
        params_obj = {}

    # --- read image bytes ---
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="empty image upload")

    # --- run detection ---
    try:
        result = detect_cells(image_bytes, box_obj.model_dump(), params_obj)
    except DetectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"detection failed: {exc}")

    return DetectResponse(**result)


@app.post("/detect-box", response_model=BoxDetectResponse)
async def detect_box_endpoint(image: UploadFile = File(...)) -> BoxDetectResponse:
    """Auto-suggest the counting square for one uploaded image.

    Returns a box + confidence when it finds a plausible square; otherwise
    box=None so the UI falls back to manual drawing. One-time, upload-time call.
    """
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="empty image upload")
    try:
        result = detect_box(image_bytes, None)
    except DetectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"box detection failed: {exc}")
    return BoxDetectResponse(**result)


# --- Annotation labels (training data collection) --------------------------- #
def _labels_enabled() -> bool:
    """Labeling writes to local disk; on ephemeral free hosting it's pointless.
    Disable when running on Render (or when explicitly turned off)."""
    if os.environ.get("ENABLE_LABELING", "").lower() in ("0", "false", "no"):
        return False
    return os.environ.get("RENDER") is None


def _label_count() -> int:
    if not LABELS_DIR.exists():
        return 0
    return sum(1 for _ in LABELS_DIR.glob("*.json"))


@app.get("/labels/status")
def labels_status() -> dict:
    """Whether labeling is available here + how many labels collected."""
    return {"enabled": _labels_enabled(), "count": _label_count()}


@app.post("/labels", response_model=LabelSaveResponse)
async def save_label(
    image: UploadFile = File(...),
    record: str = Form(...),
) -> LabelSaveResponse:
    """Persist one annotated image (original bytes) + its corrected point set."""
    if not _labels_enabled():
        raise HTTPException(
            status_code=403,
            detail="Labeling saves to local disk only — run CellCount locally.",
        )
    try:
        rec = LabelRecord(**json.loads(record))
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid record JSON: {exc}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"invalid record: {exc}")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="empty image upload")

    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc)
    label_id = f"{stamp:%Y%m%d-%H%M%S}-{token_hex(3)}"
    ext = Path(image.filename or "").suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".tiff", ".tif"):
        ext = ".jpg"

    (LABELS_DIR / f"{label_id}{ext}").write_bytes(image_bytes)
    sidecar = {
        "id": label_id,
        "schema_version": 1,
        "image_file": f"{label_id}{ext}",
        "image_width": rec.image_width,
        "image_height": rec.image_height,
        "box": rec.box.model_dump(),
        "points": [p.model_dump() for p in rec.points],
        "point_count": len(rec.points),
        "source_detector_count": rec.source_detector_count,
        "created_at": stamp.isoformat(),
        "app_version": app.version,
    }
    (LABELS_DIR / f"{label_id}.json").write_text(json.dumps(sidecar, indent=2))

    return LabelSaveResponse(id=label_id, saved=True, total_labels=_label_count())


@app.get("/labels/export.zip")
def export_labels():
    """Zip all labels + a manifest.json with points converted to pixel coords."""
    if not LABELS_DIR.exists() or _label_count() == 0:
        raise HTTPException(status_code=404, detail="no labels collected yet")

    manifest = {"schema_version": 1, "count": 0, "images": []}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for jpath in sorted(LABELS_DIR.glob("*.json")):
            rec = json.loads(jpath.read_text())
            img_name = rec["image_file"]
            ipath = LABELS_DIR / img_name
            if not ipath.exists():
                continue
            zf.write(ipath, img_name)
            zf.write(jpath, jpath.name)
            w, h = rec["image_width"], rec["image_height"]
            b = rec["box"]
            manifest["images"].append({
                "image": img_name,
                "width": w,
                "height": h,
                "box_px": [round(b["x0"] * w), round(b["y0"] * h),
                           round(b["x1"] * w), round(b["y1"] * h)],
                "points_px": [[round(p["x"] * w), round(p["y"] * h), p["type"]]
                              for p in rec["points"]],
            })
        manifest["count"] = len(manifest["images"])
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        zf.writestr("README.md", _EXPORT_README)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=cellcount-labels.zip"},
    )


_EXPORT_README = (
    "# CellCount training labels\n\n"
    "`manifest.json` lists every image with `points_px` = [[x,y,type],...] in PIXEL\n"
    "coordinates and `box_px` = [x0,y0,x1,y1]. Each image also has a matching\n"
    "`<id>.json` sidecar with normalized points. To train a density-map counter:\n\n"
    "```python\nimport json, cv2\nm = json.load(open('manifest.json'))\n"
    "for im in m['images']:\n    img = cv2.imread(im['image'])\n"
    "    pts = im['points_px']   # build a Gaussian density map from these\n```\n"
)


# --- Serve the built React app (single-command / single-server mode) --------- #
# Mounted LAST so /health and /detect above take precedence. Everything else is
# served from frontend/dist (build it with `cd frontend && npm run build`). The
# existence guard keeps the API runnable before the UI has been built.
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="app")
