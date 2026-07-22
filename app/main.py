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

import json
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .detection import DetectionError, detect_box, detect_cells
from .schemas import Box, BoxDetectResponse, DetectResponse

app = FastAPI(title="CellCount", version="1.0.0")

# Reject absurdly large uploads before they can exhaust memory on a small
# instance. Normal phone photos are ~2-12MB, so 25MB is generous.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _read_image(image_bytes: bytes) -> bytes:
    """Shared upload validation for the detection endpoints."""
    if not image_bytes:
        raise HTTPException(status_code=422, detail="empty image upload")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"image is too large "
                f"({len(image_bytes) / 1048576:.1f}MB, limit "
                f"{MAX_UPLOAD_BYTES // 1048576}MB)"
            ),
        )
    return image_bytes

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

    # --- read + validate image bytes ---
    image_bytes = _read_image(await image.read())

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
    image_bytes = _read_image(await image.read())
    try:
        result = detect_box(image_bytes, None)
    except DetectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"box detection failed: {exc}")
    return BoxDetectResponse(**result)


# --- Serve the built React app (single-command / single-server mode) --------- #
# Mounted LAST so /health and /detect above take precedence. Everything else is
# served from frontend/dist (build it with `cd frontend && npm run build`). The
# existence guard keeps the API runnable before the UI has been built.
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="app")
