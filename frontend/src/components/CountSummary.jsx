import { summarize, fmt } from "../calc.js";

export default function CountSummary({ results, errors, dilution }) {
  const s = summarize(results, dilution || 0);
  const exp = s.densityPerMl > 0 ? s.densityPerMl / 1e5 : 0; // coefficient for x10^5

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold mb-3">Count Summary</h3>

      <div className="space-y-1 text-sm">
        {results.map((r, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-slate-600">Square {i + 1}</span>
            {r ? (
              r.total_count === 0 ? (
                <span className="text-amber-600 text-right max-w-[60%]">
                  0 — check the box covers cells, or lower Brightness sensitivity.
                </span>
              ) : (
                <span className="tabular-nums">
                  {r.total_count} total{" "}
                  <span className="text-slate-400">
                    ({r.live_count} live, {r.dead_count} dead)
                  </span>
                </span>
              )
            ) : (
              <span className="text-red-500">{errors[i] || "no result"}</span>
            )}
          </div>
        ))}
      </div>

      <hr className="my-4 border-slate-100" />

      <dl className="space-y-1 text-sm">
        <Row label="Total Cells Counted" value={fmt(s.totalCells, 0)} />
        <Row label="Average per Square" value={fmt(s.average, 1)} />
        <Row label="Dilution Factor" value={dilution ? fmt(dilution, 2) : "—"} />
      </dl>

      <div className="my-4 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="text-slate-500 mb-1">── Calculation ──</div>
        <div className="font-mono text-xs leading-relaxed">
          {fmt(s.average, 1)} × {fmt(dilution, 2)} × 10⁴ ={" "}
          {fmt(s.densityPerMl, 0)} cells/mL
        </div>
        <div className="mt-2 text-base font-semibold text-teal-700">
          {fmt(exp, 2)} × 10⁵ cells/mL
        </div>
        <div className="text-sm text-slate-600">
          = {fmt(s.densityMillions, 2)} million cells/mL
        </div>
      </div>

      <div className="text-sm">
        <span className="text-slate-600">Cell Viability: </span>
        {s.viability === null ? (
          <span className="text-slate-400">—</span>
        ) : s.totalDead === 0 ? (
          <span className="text-teal-700 font-medium">
            100% — No dead cells detected
          </span>
        ) : (
          <span className="font-medium">{fmt(s.viability, 1)}%</span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
