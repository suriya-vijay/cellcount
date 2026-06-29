import { useState } from "react";
import { SLIDERS, TOGGLES, defaultParams } from "../api.js";

// Live detection-tuning controls, in a collapsible panel so the image + count stay
// in view. Sliders are grouped: "sensitivity" (common) shown first, "advanced"
// behind a nested toggle. `brightUsed` is the threshold the backend applied.
export default function SliderPanel({ params, onChange, brightUsed }) {
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function set(key, value) {
    onChange({ ...params, [key]: value });
  }

  // Respect `hideWhen` (e.g. brightness slider hidden while Auto brightness is on).
  const visible = SLIDERS.filter((s) => !(s.hideWhen && params[s.hideWhen]));
  const sensitivity = visible.filter((s) => s.group !== "advanced");
  const advanced = visible.filter((s) => s.group === "advanced");

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header / collapse toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold">⚙ Adjust detection</span>
        <span className="text-slate-400 text-sm">{open ? "▲ hide" : "▼ show"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500">
              Changes re-count the active square live.
            </p>
            <button
              onClick={() => onChange(defaultParams())}
              className="text-xs rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50"
            >
              Reset to defaults
            </button>
          </div>

          {/* Auto-brightness status note */}
          {params.auto_bright && (
            <div className="mb-4 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-800">
              Brightness is set automatically for each image
              {Number.isFinite(brightUsed) ? ` (level ${brightUsed})` : ""}. Turn off
              “Auto brightness” below to adjust it yourself.
            </div>
          )}

          {/* Sensitivity (common) sliders */}
          <div className="space-y-4">
            {sensitivity.map((s) => (
              <Slider key={s.key} s={s} value={params[s.key]} onSet={set} />
            ))}
          </div>

          {/* Advanced sub-section */}
          {advanced.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                {showAdvanced ? "▲ Hide advanced" : "▼ Advanced settings"}
              </button>
              {showAdvanced && (
                <div className="space-y-4 mt-3">
                  {advanced.map((s) => (
                    <Slider key={s.key} s={s} value={params[s.key]} onSet={set} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toggles */}
          <div className="mt-4 pt-3 space-y-2 border-t border-slate-100">
            {TOGGLES.map((t) => (
              <div key={t.key}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!params[t.key]}
                    onChange={(e) => set(t.key, e.target.checked)}
                    className="accent-teal-600"
                  />
                  {t.label}
                </label>
                {t.hint && (
                  <p className="text-[11px] text-slate-400 ml-6">{t.hint}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ s, value, onSet }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <label className="text-slate-700">{s.label}</label>
        <span className="text-slate-500 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={value}
        // onInput fires continuously while dragging (smooth live updates).
        onInput={(e) => onSet(s.key, Number(e.target.value))}
        onChange={(e) => onSet(s.key, Number(e.target.value))}
        className="w-full accent-teal-600"
      />
      {s.hint && <p className="text-[11px] text-slate-400">{s.hint}</p>}
    </div>
  );
}
