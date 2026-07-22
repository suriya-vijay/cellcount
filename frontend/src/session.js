// Keeps a small snapshot of the current count in sessionStorage so a page
// reload — or a phone browser reclaiming a backgrounded tab — doesn't throw the
// user back to the upload screen with their work lost.
//
// Deliberately does NOT store the photos: File objects aren't serializable and
// blob: URLs die on reload, and four phone photos would blow past the ~5MB
// storage quota. Counts, boxes and calculations are tiny and always fit, so the
// results screen (and the PDF) survive intact; the images are re-added if the
// user wants to re-run detection.

const KEY = "cellcount.session.v1";

export function saveSession(state) {
  try {
    const snapshot = {
      screen: state.screen,
      dilution: state.dilution,
      params: state.params,
      results: state.results,
      errors: state.errors,
      // only the box per square — never the File/blob URL
      boxes: state.squares.map((s) => s.box || null),
    };
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode / quota exceeded: persistence is a nicety, never fatal.
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Only restore a finished analysis — a half-filled upload screen has no
    // photos to show, so restoring it would be confusing rather than helpful.
    if (s?.screen !== "results" || !Array.isArray(s.results)) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
