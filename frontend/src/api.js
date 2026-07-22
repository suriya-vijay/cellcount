// Thin client for the FastAPI detection backend.

// Empty string = same origin as the page (works when FastAPI serves the built UI).
// For the two-server dev flow, set VITE_API_BASE=http://localhost:8000 in frontend/.env.
const BASE = import.meta.env.VITE_API_BASE ?? "";

// Free hosting sleeps when idle, so the first request after a quiet period has to
// wait for the server to boot (~50s). Allow for that instead of failing fast.
const TIMEOUT_MS = 90_000;

/** Nudge the server awake. Fire-and-forget: called on app load so the backend is
 *  warming up while the user is still adding photos. Failures are irrelevant. */
export function wake() {
  return fetch(`${BASE}/health`, { cache: "no-store" })
    .then((r) => r.ok)
    .catch(() => false);
}

/** POST with a timeout, one retry, and human-readable failures.
 *  Raw fetch rejections surface as "Failed to fetch", which reads as "the app is
 *  broken" to a user who has no idea the server was asleep. */
async function post(path, form, { retry = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `Server error (${res.status}).`;
      try {
        const body = await res.json();
        if (body.detail) detail = body.detail;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(detail);
    }
    return await res.json();
  } catch (err) {
    // A sleeping instance usually answers on the second attempt.
    if (retry && (err.name === "AbortError" || err instanceof TypeError)) {
      return post(path, form, { retry: false });
    }
    throw new Error(friendlyError(err));
  } finally {
    clearTimeout(timer);
  }
}

function friendlyError(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }
  if (err.name === "AbortError" || err instanceof TypeError) {
    return (
      "Couldn't reach the server. It may be waking up — free hosting sleeps when " +
      "idle and can take up to a minute. Please try again."
    );
  }
  return err.message || "Something went wrong. Please try again.";
}

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
  { key: "min_core_factor", label: "Minimum cell brightness", min: 1, max: 4, step: 0.1, default: 1.3,
    hint: "Higher = drop dim, empty-looking detections. Lower = keep more.",
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
  return post("/detect", form);
}

// Auto-suggest the counting box for one image. Returns {box, confidence, source}.
// box is null when detection isn't confident (caller falls back to manual draw).
export async function detectBox(image) {
  const form = new FormData();
  form.append("image", image);
  try {
    return await post("/detect-box", form);
  } catch {
    // Auto-box is a convenience; on failure the user just draws it manually.
    return { box: null, confidence: 0, source: "failed" };
  }
}
