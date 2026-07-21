import { useState, useRef, useEffect } from "react";
import BoxDrawer from "./BoxDrawer.jsx";
import DotEditor from "./DotEditor.jsx";
import {
  detect,
  saveLabels,
  labelsStatus,
  LABELS_EXPORT_URL,
} from "../api.js";

// Annotation screen: draw/confirm the counting box, pre-seed dots from the
// detector, correct them (add/remove/move/flip), and save as training labels.
export default function LabelingScreen({ square, params, seedCells, onClose }) {
  const [box, setBox] = useState(square.box || null);
  const [redrawing, setRedrawing] = useState(!square.box);
  const [dots, setDots] = useState([]);
  const [history, setHistory] = useState([]); // undo stack of dot arrays
  const [addType, setAddType] = useState("live");
  const [tapAction, setTapAction] = useState("remove");
  const [seeding, setSeeding] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [status, setStatus] = useState({ enabled: true, count: 0 });
  const seedCountRef = useRef(0);

  useEffect(() => {
    labelsStatus().then(setStatus);
  }, []);

  // Seed dots from provided detection results, or fetch fresh when a box exists.
  useEffect(() => {
    if (redrawing || !box) return;
    if (dots.length) return; // already seeded/edited
    const toDots = (cells) =>
      (cells || []).map((c) => ({ x: c.x, y: c.y, type: c.type, origin: "seed" }));
    if (seedCells && seedCells.length) {
      const d = toDots(seedCells);
      seedCountRef.current = d.length;
      setDots(d);
    } else {
      setSeeding(true);
      detect(square.file, box, params)
        .then((r) => {
          const d = toDots(r.cells);
          seedCountRef.current = d.length;
          setDots(d);
        })
        .catch(() => setDots([]))
        .finally(() => setSeeding(false));
    }
  }, [redrawing, box]); // eslint-disable-line react-hooks/exhaustive-deps

  // undo support
  function commit(next) {
    setHistory((h) => [...h, dots]);
    setDots(next);
  }
  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setDots(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind each render so `undo` closes over latest state

  // dot mutations
  const addDot = (x, y, type) =>
    commit([...dots, { x, y, type, origin: "user" }]);
  const removeDot = (i) => commit(dots.filter((_, k) => k !== i));
  const moveDot = (i, x, y) =>
    setDots(dots.map((d, k) => (k === i ? { ...d, x, y, origin: "user" } : d)));
  const flipDot = (i) =>
    commit(
      dots.map((d, k) =>
        k === i
          ? { ...d, type: d.type === "live" ? "dead" : "live", origin: "user" }
          : d
      )
    );

  async function reseed() {
    setSeeding(true);
    try {
      const r = await detect(square.file, box, params);
      seedCountRef.current = r.cells.length;
      commit(r.cells.map((c) => ({ x: c.x, y: c.y, type: c.type, origin: "seed" })));
    } catch {
      /* ignore */
    } finally {
      setSeeding(false);
    }
  }

  async function save() {
    setSaveMsg(null);
    const img = new Image();
    img.src = square.url;
    await img.decode().catch(() => {});
    const record = {
      box,
      points: dots.map((d) => ({ x: d.x, y: d.y, type: d.type })),
      image_width: img.naturalWidth || 0,
      image_height: img.naturalHeight || 0,
      source_detector_count: seedCountRef.current,
    };
    try {
      const res = await saveLabels(square.file, record);
      setSaveMsg(`Saved ✓ — ${res.total_labels} labels collected`);
      setStatus((s) => ({ ...s, count: res.total_labels }));
    } catch (e) {
      setSaveMsg(`Error: ${e.message}`);
    }
  }

  const liveCount = dots.filter((d) => d.type === "live").length;
  const deadCount = dots.length - liveCount;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Label cells (training data)</h1>
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Back
        </button>
      </div>

      {!status.enabled && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
          ⚠️ Labeling saves to local disk only. Run CellCount locally (not on the
          hosted site) to collect a persistent training set.
        </div>
      )}

      <p className="text-sm text-slate-500 mb-4">
        Tap an empty spot to add a cell, tap a dot to{" "}
        {tapAction === "flip" ? "flip its type" : "remove it"}, drag to move. Muted
        circles are the detector's guesses — correct them, then Save.
      </p>

      {redrawing ? (
        <div>
          <p className="text-sm text-slate-600 mb-2">
            Draw the counting box (drag over one square).
          </p>
          <BoxDrawer
            url={square.url}
            box={box}
            onChange={(b) => {
              setBox(b);
              setRedrawing(false);
              setDots([]);
            }}
          />
        </div>
      ) : (
        <>
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
            <Seg
              label="Add"
              options={[
                ["live", "🟢 Live"],
                ["dead", "🔴 Dead"],
              ]}
              value={addType}
              onChange={setAddType}
            />
            <Seg
              label="Tap"
              options={[
                ["remove", "Remove"],
                ["flip", "Flip type"],
              ]}
              value={tapAction}
              onChange={setTapAction}
            />
            <Btn onClick={undo} disabled={!history.length}>
              Undo
            </Btn>
            <Btn onClick={() => commit([])} disabled={!dots.length}>
              Clear
            </Btn>
            <Btn onClick={reseed}>Re-seed</Btn>
            <Btn onClick={() => setRedrawing(true)}>Redraw box</Btn>
            <span className="ml-auto tabular-nums text-slate-600">
              {dots.length} cells ({liveCount} live, {deadCount} dead)
              {seeding && " · seeding…"}
            </span>
          </div>

          <DotEditor
            url={square.url}
            box={box}
            dots={dots}
            addType={addType}
            tapAction={tapAction}
            onAdd={addDot}
            onRemove={removeDot}
            onMove={moveDot}
            onFlip={flipDot}
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={!status.enabled}
              className="rounded-lg bg-teal-600 text-white font-medium px-5 py-2 hover:bg-teal-700 disabled:opacity-40"
            >
              Save labels
            </button>
            <a
              href={LABELS_EXPORT_URL}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Download training set (.zip)
            </a>
            {saveMsg && (
              <span className="text-sm text-slate-600">{saveMsg}</span>
            )}
            <span className="ml-auto text-xs text-slate-400">
              {status.count} labels collected
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-500">{label}:</span>
      <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
        {options.map(([v, txt]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-2 py-1 ${
              value === v ? "bg-teal-600 text-white" : "hover:bg-slate-50"
            }`}
          >
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Btn({ children, ...props }) {
  return (
    <button
      {...props}
      className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
