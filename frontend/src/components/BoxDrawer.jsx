import { useRef, useState } from "react";

// Lets the user drag a rectangle over the displayed image to mark one counting
// square. Reports the box in normalized (0-1) image coordinates via onChange.
export default function BoxDrawer({ url, box, onChange }) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null); // {x0,y0,x1,y1} in pixels while dragging

  // Convert a pointer event to normalized coords within the image element.
  function toNorm(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function onDown(e) {
    e.preventDefault();
    const p = toNorm(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  function onMove(e) {
    if (!drag) return;
    const p = toNorm(e);
    setDrag((d) => ({ ...d, x1: p.x, y1: p.y }));
  }
  function onUp() {
    if (!drag) return;
    const norm = normalize(drag);
    setDrag(null);
    if (norm.x1 - norm.x0 > 0.02 && norm.y1 - norm.y0 > 0.02) {
      onChange(norm);
    }
  }

  // Box to render (committed box, or live drag).
  const shown = drag ? normalize(drag) : box;

  return (
    <div
      ref={wrapRef}
      className="relative select-none cursor-crosshair touch-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <img src={url} alt="square" className="block w-full rounded-lg" draggable={false} />
      {shown && (
        <div
          className="absolute border-2 border-primary bg-primary/10 pointer-events-none rounded-sm"
          style={{
            left: `${shown.x0 * 100}%`,
            top: `${shown.y0 * 100}%`,
            width: `${(shown.x1 - shown.x0) * 100}%`,
            height: `${(shown.y1 - shown.y0) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function normalize(b) {
  return {
    x0: Math.min(b.x0, b.x1),
    y0: Math.min(b.y0, b.y1),
    x1: Math.max(b.x0, b.x1),
    y1: Math.max(b.y0, b.y1),
  };
}
