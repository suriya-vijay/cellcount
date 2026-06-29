// Thin client for the FastAPI detection backend.

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// Slider definitions: must stay consistent with backend app/params.py.
// Each: key, label, min, max, step, default. Booleans use type:"toggle".
// group: "sensitivity" (common, shown first) | "advanced" (collapsed sub-section)
export const SLIDERS = [
  { key: "bright_thresh", label: "Brightness sensitivity", min: 1, max: 120, step: 1, default: 18,
    hint: "Lower = detect dimmer cells (and more noise).",
    hideWhen: "auto_bright", group: "sensitivity" },  // hidden while Auto brightness is on
  { key: "min_circularity", label: "Roundness filter", min: 0, max: 1, step: 0.05, default: 0.35,
    hint: "Lower = catch more cells (incl. touching ones); higher = stricter.",
    group: "sensitivity" },
  { key: "min_radius", label: "Min cell radius (px)", min: 1, max: 100, step: 1, default: 2,
    group: "sensitivity" },
  { key: "max_radius", label: "Max cell radius (px)", min: 2, max: 200, step: 1, default: 14,
    group: "sensitivity" },
  { key: "tophat_size", label: "Cell isolation size", min: 5, max: 61, step: 2, default: 15,
    hint: "Slightly larger than a cell. Increase for bigger cells.", group: "advanced" },
  { key: "max_aspect", label: "Max elongation", min: 1, max: 6, step: 0.1, default: 3.0,
    hint: "Lower = reject more line-like shapes (grid lines).", group: "advanced" },
  { key: "min_extent", label: "Min fill", min: 0, max: 1, step: 0.02, default: 0.32,
    hint: "Higher = reject sparse shapes that aren't solid round cells.", group: "advanced" },
  { key: "line_kernel", label: "Grid-line suppression", min: 1, max: 9, step: 2, default: 3,
    group: "advanced" },
  { key: "v_dead_max", label: "Dead darkness max", min: 0, max: 255, step: 5, default: 170,
    hint: "Dead (blue) cells darker than this.", group: "advanced" },
  { key: "blue_excess", label: "Dead blue sensitivity", min: 0, max: 150, step: 1, default: 18,
    group: "advanced" },
];

export const TOGGLES = [
  { key: "auto_bright", label: "Auto brightness", default: true,
    hint: "Let the tool pick the brightness level for each image." },
  { key: "detect_dead", label: "Detect dead (blue) cells", default: true },
];

export function defaultParams() {
  const p = {};
  SLIDERS.forEach((s) => (p[s.key] = s.default));
  TOGGLES.forEach((t) => (p[t.key] = t.default));
  return p;
}

// Run detection on one square. image is a File/Blob, box normalized, params object.
export async function detect(image, box, params) {
  const form = new FormData();
  form.append("image", image);
  form.append("box", JSON.stringify(box));
  form.append("params", JSON.stringify(params));

  const res = await fetch(`${BASE}/detect`, { method: "POST", body: form });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}
