import { useState } from "react";
import { dilutionPlan, fmt } from "../calc.js";

// Seed/dilute to a target density using M1V1 = M2V2.
export default function DilutionCalculator({ currentDensity }) {
  const [target, setTarget] = useState("");
  const [volume, setVolume] = useState("");
  const [plan, setPlan] = useState(null);

  function calculate() {
    setPlan(dilutionPlan(Number(currentDensity), Number(target), Number(volume)));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold mb-1">Seed or Dilute to Target Density</h3>
      <p className="text-xs text-slate-500 mb-4">
        Current density: {fmt(currentDensity, 2)} million cells/mL
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Target Density (M cells/mL)"
          value={target}
          onChange={setTarget}
          placeholder="e.g. 0.5"
        />
        <Field
          label="Final Volume Needed (mL)"
          value={volume}
          onChange={setVolume}
          placeholder="e.g. 10"
        />
      </div>

      <button
        onClick={calculate}
        className="mt-4 w-full rounded-lg bg-teal-600 text-white font-medium py-2 hover:bg-teal-700 transition"
      >
        Calculate
      </button>

      {plan && (
        <div className="mt-4 text-sm">
          {plan.error ? (
            <div className="text-red-500">{plan.error}</div>
          ) : (
            <>
              <div className="rounded-lg bg-teal-50 border border-teal-100 p-3 text-teal-900">
                Take <strong>{fmt(plan.v1, 3)} mL</strong> of your current sample and
                bring to <strong>{fmt(plan.v2, 2)} mL</strong> total volume with media.
              </div>
              {plan.concentrate && (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
                  ⚠️ Your target density is higher than your current density. You would
                  need to concentrate your sample, not dilute it.
                </div>
              )}
              {plan.tiny && !plan.concentrate && (
                <div className="mt-2 text-slate-500">
                  Tip: Consider making an intermediate dilution for accuracy.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
      />
    </label>
  );
}
