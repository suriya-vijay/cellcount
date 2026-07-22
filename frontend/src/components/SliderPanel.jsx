import { useState } from "react";
import { SLIDERS, TOGGLES, defaultParams } from "../api.js";
import { Button, Card } from "./ui.jsx";

// Detection tuning, collapsed by default so the image + counts stay in view.
// Most users never open this — brightness is automatic.
export default function SliderPanel({ params, onChange, brightUsed }) {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const set = (key, value) => onChange({ ...params, [key]: value });

  const visible = SLIDERS.filter((s) => !(s.hideWhen && params[s.hideWhen]));
  const basic = visible.filter((s) => s.group !== "advanced");
  const adv = visible.filter((s) => s.group === "advanced");

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between px-4 text-left text-sm font-medium transition-colors duration-150 hover:bg-background"
        aria-expanded={open}
      >
        Detection settings
        <span className="text-xs font-normal text-muted-fg">
          {open ? "Hide" : "Adjust"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-fg">Changes re-count this square.</p>
            <Button
              variant="ghost"
              onClick={() => onChange(defaultParams())}
              className="px-3 text-xs"
            >
              Reset
            </Button>
          </div>

          {params.auto_bright && (
            <p className="mb-4 rounded-lg bg-background p-3 text-xs text-muted-fg">
              Brightness is set automatically for each image
              {Number.isFinite(brightUsed) ? ` (level ${brightUsed})` : ""}.
            </p>
          )}

          <div className="space-y-4">
            {basic.map((s) => (
              <Slider key={s.key} s={s} value={params[s.key]} onSet={set} />
            ))}
          </div>

          {adv.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                onClick={() => setAdvanced((v) => !v)}
                className="min-h-[44px] text-xs font-medium text-muted-fg hover:text-foreground"
              >
                {advanced ? "Hide advanced" : "Advanced settings"}
              </button>
              {advanced && (
                <div className="mt-3 space-y-4">
                  {adv.map((s) => (
                    <Slider key={s.key} s={s} value={params[s.key]} onSet={set} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-2 border-t border-border pt-3">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={!!params[t.key]}
                  onChange={(e) => set(t.key, e.target.checked)}
                  className="h-4 w-4 accent-[color:var(--color-primary)]"
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Slider({ s, value, onSet }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <label className="text-foreground">{s.label}</label>
        <span className="num text-muted-fg">{value}</span>
      </div>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={value}
        onInput={(e) => onSet(s.key, Number(e.target.value))}
        onChange={(e) => onSet(s.key, Number(e.target.value))}
        className="mt-1 w-full accent-[color:var(--color-primary)]"
      />
      {s.hint && <p className="mt-0.5 text-[11px] text-muted-fg">{s.hint}</p>}
    </div>
  );
}
