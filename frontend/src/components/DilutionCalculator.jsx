import { useState } from "react";
import { dilutionPlan, fmt } from "../calc.js";
import { Button, Card, CardHeader, Field, inputClass } from "./ui.jsx";

// Seed/dilute to a target density using M1V1 = M2V2.
export default function DilutionCalculator({ currentDensity, onPlan }) {
  const [target, setTarget] = useState("");
  const [volume, setVolume] = useState("");
  const [plan, setPlan] = useState(null);

  function calculate() {
    const p = dilutionPlan(Number(currentDensity), Number(target), Number(volume));
    setPlan(p);
    onPlan?.(p.error ? null : p);
  }

  return (
    <Card>
      <CardHeader title="Seed or dilute" />
      <div className="p-4 sm:p-5">
        <p className="num mb-4 text-xs text-muted-fg">
          Current: {fmt(currentDensity, 2)} million cells/mL
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Target density (M cells/mL)">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0.5"
              className={inputClass}
            />
          </Field>
          <Field label="Final volume (mL)">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="10"
              className={inputClass}
            />
          </Field>
        </div>

        <Button onClick={calculate} className="mt-4 w-full">
          Calculate
        </Button>

        {plan && (
          <div className="mt-4 text-sm">
            {plan.error ? (
              <p className="text-danger">{plan.error}</p>
            ) : (
              <>
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-foreground">
                  Take <span className="num font-semibold">{fmt(plan.v1, 3)} mL</span>{" "}
                  of your sample and bring to{" "}
                  <span className="num font-semibold">{fmt(plan.v2, 2)} mL</span>{" "}
                  total with media.
                </div>
                {plan.concentrate && (
                  <p className="mt-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-warning">
                    Target is higher than your current density — you would need to
                    concentrate the sample, not dilute it.
                  </p>
                )}
                {plan.tiny && !plan.concentrate && (
                  <p className="mt-2 text-xs text-muted-fg">
                    Tip: consider an intermediate dilution for accuracy.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
