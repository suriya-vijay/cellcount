import { useRef, useEffect, useState } from "react";

// Shows the square image with a canvas overlay of detected cells (green=live,
// red=dead). Also draws the counting box outline. Circles scale with the image.
export default function ImageViewer({ url, box, cells, showMarkers, busy }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  function syncSize() {
    const img = imgRef.current;
    if (img) setSize({ w: img.clientWidth, h: img.clientHeight });
  }

  useEffect(() => {
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size.w, size.h);

    // counting box outline
    if (box) {
      ctx.strokeStyle = "#1E3A5F"; // --color-primary (canvas can't read CSS vars)
      ctx.lineWidth = 2;
      ctx.strokeRect(
        box.x0 * size.w,
        box.y0 * size.h,
        (box.x1 - box.x0) * size.w,
        (box.y1 - box.y0) * size.h
      );
    }

    if (!showMarkers || !cells) return;
    // While a re-detect is in flight, dim the existing markers so the view never
    // flashes empty — they're swapped for fresh ones the moment the result lands.
    ctx.globalAlpha = busy ? 0.35 : 1;
    cells.forEach((c) => {
      ctx.beginPath();
      const r = Math.max(5, c.radius * size.w);
      ctx.arc(c.x * size.w, c.y * size.h, r, 0, Math.PI * 2);
      ctx.strokeStyle = c.type === "dead" ? "#ef4444" : "#22c55e";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }, [size, cells, showMarkers, box, busy]);

  return (
    <div className="relative inline-block w-full">
      <img
        ref={imgRef}
        src={url}
        alt="counting square"
        className="block w-full rounded-lg"
        onLoad={syncSize}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
      />
    </div>
  );
}
