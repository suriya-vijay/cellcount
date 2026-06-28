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

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .detection import DetectionError, detect_cells
from .schemas import Box, DetectResponse

app = FastAPI(title="CellCount", version="1.0.0")

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
