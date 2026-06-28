import { SLIDERS, TOGGLES } from "../api.js";

// Live detection-tuning controls. Changes update params and trigger a re-run of
// the active square (debounced by the parent). `brightUsed` is the threshold the
// backend actually applied (shown when Auto brightness is on).
export default function SliderPanel({ params, onChange, brightUsed }) {
  function set(key, value) {
    onChange({ ...params, [key]: value });
  }

  // Hide a slider when its `hideWhen` toggle is currently on (e.g. brightness
  // slider hidden while Auto brightness is enabled).
  const visibleSliders = SLIDERS.filter((s) => !(s.hideWhen && params[s.hideWhen]));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold mb-1">Detection settings</h3>
      <p className="text-xs text-slate-500 mb-4">
        Tune these to your microscope. Changes re-count the active square live.
      </p>

      {/* Auto-brightness status note */}
      {params.auto_bright && (
        <div className="mb-4 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-800">
          Brightness is set automatically for each image
          {Number.isFinite(brightUsed) ? ` (level ${brightUsed})` : ""}. Turn off
          “Auto brightness” below to adjust it yourself.
        </div>
      )}

      <div className="space-y-4">
        {visibleSliders.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-sm">
              <label className="text-slate-700">{s.label}</label>
              <span className="text-slate-500 tabular-nums">{params[s.key]}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              // onInput fires continuously while dragging (smooth live updates).
              onInput={(e) => set(s.key, Number(e.target.value))}
              onChange={(e) => set(s.key, Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            {s.hint && <p className="text-[11px] text-slate-400">{s.hint}</p>}
          </div>
        ))}

        <div className="pt-2 space-y-2 border-t border-slate-100">
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
    </div>
  );
}
