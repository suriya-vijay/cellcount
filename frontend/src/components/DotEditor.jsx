import { useRef, useEffect, useState } from "react";

// Interactive dot-annotation overlay (patterned on ImageViewer). Dots are
// normalized {x, y, type, origin}. Gestures — one tap = one action, fast:
//   tap empty     -> add a dot (current `addType`)
//   tap a dot      -> remove it, OR flip its type when tapAction === "flip"
//   drag a dot     -> reposition
// Works with mouse and touch (pointer events). The parent owns the dots array
// and undo history; this component just reports mutations via callbacks.
const DRAG_PX = 4; // movement beyond this = drag, not tap
const HIT_PX = 14; // finger-friendly hit radius

export default function DotEditor({
  url,
  box,
  dots,
  addType,
  tapAction, // "remove" | "flip"
  onAdd,
  onRemove,
  onMove,
  onFlip,
}) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef(null); // {index, startX, startY, moved}

  function syncSize() {
    const img = imgRef.current;
    if (img) setSize({ w: img.clientWidth, h: img.clientHeight });
  }

  useEffect(() => {
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, [url]);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size.w, size.h);

    if (box) {
      ctx.strokeStyle = "#0d9488";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        box.x0 * size.w,
        box.y0 * size.h,
        (box.x1 - box.x0) * size.w,
        (box.y1 - box.y0) * size.h
      );
    }

    dots.forEach((d) => {
      const px = d.x * size.w;
      const py = d.y * size.h;
      const color = d.type === "dead" ? "#ef4444" : "#22c55e";
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      if (d.origin === "seed") {
        // muted hollow = detector guess (not yet confirmed)
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // solid = user-confirmed / added
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }, [size, dots, box]);

  function toNorm(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }

  function hitIndex(nx, ny) {
    const hx = HIT_PX / size.w;
    const hy = HIT_PX / size.h;
    let best = -1;
    let bestD = Infinity;
    dots.forEach((d, i) => {
      const dx = (d.x - nx) / hx;
      const dy = (d.y - ny) / hy;
      const dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bestD) {
        best = i;
        bestD = dd;
      }
    });
    return best;
  }

  function onDown(e) {
    e.preventDefault();
    const p = toNorm(e);
    const idx = hitIndex(p.x, p.y);
    drag.current = {
      index: idx,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    wrapRef.current.setPointerCapture?.(e.pointerId);
  }

  function onMovePtr(e) {
    const d = drag.current;
    if (!d || d.index < 0) return;
    if (
      Math.abs(e.clientX - d.startX) > DRAG_PX ||
      Math.abs(e.clientY - d.startY) > DRAG_PX
    ) {
      d.moved = true;
      const p = toNorm(e);
      onMove(d.index, p.x, p.y);
    }
  }

  function onUp(e) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) return; // was a drag; already applied via onMove
    // a tap
    const p = toNorm(e);
    if (d.index >= 0) {
      if (tapAction === "flip") onFlip(d.index);
      else onRemove(d.index);
    } else {
      onAdd(p.x, p.y, addType);
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative inline-block w-full select-none touch-none cursor-crosshair"
      onPointerDown={onDown}
      onPointerMove={onMovePtr}
      onPointerUp={onUp}
    >
      <img
        ref={imgRef}
        src={url}
        alt="annotate"
        className="block w-full rounded-lg"
        draggable={false}
        onLoad={syncSize}
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" />
    </div>
  );
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
