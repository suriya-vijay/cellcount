import { summarize, fmt } from "../calc.js";
import { Card, CardHeader } from "./ui.jsx";

export default function CountSummary({ results, errors, dilution }) {
  const s = summarize(results, dilution || 0);

  return (
    <Card>
      <CardHeader title="Results" />
      <div className="p-4 sm:p-5">
        {/* Headline density — the number the user actually came for */}
        <div className="mb-5">
          <div className="num text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {fmt(s.densityMillions, 2)}
            <span className="ml-1.5 text-sm font-medium text-muted-fg">
              million cells/mL
            </span>
          </div>
          <div className="num mt-1 text-xs text-muted-fg">
            {fmt(s.densityPerMl, 0)} cells/mL
          </div>
        </div>

        {/* Per-square breakdown */}
        <dl className="space-y-1.5 text-sm">
          {results.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-fg">Square {i + 1}</dt>
              <dd className="text-right">
                {!r ? (
                  <span className="text-danger">{errors[i] || "no result"}</span>
                ) : r.total_count === 0 ? (
                  <span className="text-warning">
                    0 — check the box covers cells
                  </span>
                ) : (
                  <>
                    <span className="num font-medium">{r.total_count}</span>
                    <span className="num ml-2 text-xs text-muted-fg">
                      {r.live_count} live · {r.dead_count} dead
                    </span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <hr className="my-4 border-border" />

        <dl className="space-y-1.5 text-sm">
          <Row label="Total counted" value={fmt(s.totalCells, 0)} />
          <Row label="Average per square" value={fmt(s.average, 1)} />
          <Row label="Dilution factor" value={dilution ? fmt(dilution, 2) : "—"} />
        </dl>

        {/* The calculation, shown explicitly so it's auditable */}
        <div className="mt-4 rounded-lg bg-background p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-fg">
            Calculation
          </div>
          <div className="num text-xs leading-relaxed text-foreground">
            {fmt(s.average, 1)} × {fmt(dilution, 2)} × 10⁴ ={" "}
            {fmt(s.densityPerMl, 0)} cells/mL
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between text-sm">
          <span className="text-muted-fg">Viability</span>
          {s.viability === null ? (
            <span className="text-muted-fg">—</span>
          ) : s.totalDead === 0 ? (
            <span className="font-medium text-accent">
              100% — no dead cells detected
            </span>
          ) : (
            <span className="num font-medium">{fmt(s.viability, 1)}%</span>
          )}
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-fg">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}
