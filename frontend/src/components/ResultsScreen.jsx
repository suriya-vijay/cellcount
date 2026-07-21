import { useState, useRef, useEffect } from "react";
import ImageViewer from "./ImageViewer.jsx";
import SliderPanel from "./SliderPanel.jsx";
import CountSummary from "./CountSummary.jsx";
import DilutionCalculator from "./DilutionCalculator.jsx";
import { summarize } from "../calc.js";

export default function ResultsScreen({
  squares,
  results,
  errors,
  dilution,
  params,
  setParams,
  onReRun,
  onReset,
  onOpenLabeling,
}) {
  const [active, setActive] = useState(0);
  const [showMarkers, setShowMarkers] = useState(true);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);
  const seqRef = useRef(0); // request sequence; ignore stale completions

  const summary = summarize(results, dilution);

  // Debounced live re-run of the active square whenever params change. Tracks a
  // busy flag for the "updating…" indicator; only the latest request clears it,
  // so fast dragging doesn't flicker the indicator off prematurely.
  function changeParams(next) {
    setParams(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const myId = ++seqRef.current;
      setBusy(true);
      try {
        await onReRun(active, next);
      } finally {
        if (myId === seqRef.current) setBusy(false);
      }
    }, 150);
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const sq = squares[active];
  const res = results[active];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Results</h1>
        <button
          onClick={onReset}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Start New Count
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {squares.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition ${
              active === i
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Square {i + 1}
            {errors[i] && <span className="text-red-500"> ⚠</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: image + overlay + sliders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>🟢 Live&nbsp;&nbsp;🔴 Dead</span>
              {res && (
                <span className="font-medium text-slate-700 tabular-nums">
                  {res.total_count} cells
                </span>
              )}
              {busy && (
                <span className="flex items-center gap-1 text-teal-600">
                  <span className="w-3 h-3 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                  updating…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenLabeling?.(active)}
                className="text-sm rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                title="Correct the detected cells and save as training data"
              >
                Label this image →
              </button>
              <button
                onClick={() => setShowMarkers((v) => !v)}
                className="text-sm rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
              >
                {showMarkers ? "Hide Markers" : "Show Markers"}
              </button>
            </div>
          </div>

          {sq?.url ? (
            <ImageViewer
              url={sq.url}
              box={sq.box}
              cells={res?.cells || []}
              showMarkers={showMarkers}
              busy={busy}
            />
          ) : (
            <div className="text-slate-400">No image for this square.</div>
          )}

          {errors[active] && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              {errors[active]}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Auto markers are estimates. Verify manually if precision is critical.
            Artifacts, debris, and shadows may be miscounted — tune the settings below.
          </p>

          <SliderPanel
            params={params}
            onChange={changeParams}
            brightUsed={res?.bright_used}
          />
        </div>

        {/* RIGHT: counts + dilution calc */}
        <div className="space-y-6">
          <CountSummary results={results} errors={errors} dilution={dilution} />
          <DilutionCalculator currentDensity={summary.densityMillions} />
        </div>
      </div>
    </div>
  );
}
