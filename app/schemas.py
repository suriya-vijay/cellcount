"""Pydantic request/response models for the detection API."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class Box(BaseModel):
    """Normalized (0-1) bounding box of one counting square the user drew."""

    x0: float = Field(ge=0.0, le=1.0)
    y0: float = Field(ge=0.0, le=1.0)
    x1: float = Field(ge=0.0, le=1.0)
    y1: float = Field(ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _ordered_and_nonzero(self) -> "Box":
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("box must have x1 > x0 and y1 > y0 (non-zero area)")
        return self


class Cell(BaseModel):
    """A single detected cell, in normalized full-image coordinates."""

    x: float       # center X, normalized to image width
    y: float       # center Y, normalized to image height
    radius: float  # radius, normalized to image width
    type: str      # "live" | "dead"


class DetectResponse(BaseModel):
    cells: list[Cell]
    live_count: int
    dead_count: int
    total_count: int
    bright_used: int  # the brightness threshold actually applied (auto or manual)
    viability: float  # live / total, 0.0 when no cells


class BoxDetectResponse(BaseModel):
    box: Box | None          # normalized counting square, or None if not confident
    confidence: float        # 0-1
    source: str              # "auto" | "failed"
