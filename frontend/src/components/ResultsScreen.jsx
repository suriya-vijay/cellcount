import { useState, useRef, useEffect } from "react";
import AppHeader from "./AppHeader.jsx";
import ImageViewer from "./ImageViewer.jsx";
import SliderPanel from "./SliderPanel.jsx";
import CountSummary from "./CountSummary.jsx";
import DilutionCalculator from "./DilutionCalculator.jsx";
import { Button, Card, Dot } from "./ui.jsx";
import { DownloadIcon, RefreshIcon } from "./icons.jsx";
import { summarize } from "../calc.js";
import { downloadReport } from "../report.js";

export default function ResultsScreen({
  squares,
  results,
  errors,
  dilution,
  params,
  setParams,
  onReRun,
  onReset,
}) {
  const [active, setActive] = useState(0);
  const [showMarkers, setShowMarkers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const debounceRef = useRef(null);
  const seqRef = useRef(0);

  const summary = summarize(results, dilution);

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
    <div className="min-h-full bg-background">
      <AppHeader
        right={
          <Button variant="secondary" onClick={onReset} className="px-3">
            <RefreshIcon className="h-4 w-4" />
            <span className="hidden sm:inline">New count</span>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Square tabs — horizontally scrollable so they never overflow on mobile */}
        <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div
            className="flex gap-2 border-b border-border"
            role="tablist"
            aria-label="Counting squares"
          >
            {squares.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={`-mb-px min-h-[44px] shrink-0 border-b-2 px-4 text-sm font-medium transition-colors duration-150 ${
                  active === i
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-fg hover:text-foreground"
                }`}
              >
                Square {i + 1}
                {errors[i] && <span className="ml-1 text-danger">!</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* LEFT — image + detection controls */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3 text-muted-fg">
                  <Dot tone="accent" label="Live" />
                  <Dot tone="danger" label="Dead" />
                  {res && (
                    <span className="num font-medium text-foreground">
                      {res.total_count} cells
                    </span>
                  )}
                  {busy && (
                    <span className="text-primary" aria-live="polite">
                      updating…
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowMarkers((v) => !v)}
                  className="px-3"
                >
                  {showMarkers ? "Hide markers" : "Show markers"}
                </Button>
              </div>

              <div className="p-3">
                {sq?.url ? (
                  <ImageViewer
                    url={sq.url}
                    box={sq.box}
                    cells={res?.cells || []}
                    showMarkers={showMarkers}
                    busy={busy}
                  />
                ) : sq?.photoMissing ? (
                  <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Photo not kept after reload
                    </p>
                    <p className="mt-1 text-xs text-muted-fg">
                      Your counts and calculations are preserved — the image itself
                      isn’t stored. Start a new count to re-analyze photos.
                    </p>
                  </div>
                ) : (
                  <p className="p-6 text-center text-sm text-muted-fg">
                    No image for this square.
                  </p>
                )}
                {errors[active] && (
                  <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                    {errors[active]}
                  </p>
                )}
              </div>
            </Card>

            <SliderPanel
              params={params}
              onChange={changeParams}
              brightUsed={res?.bright_used}
            />

            <p className="text-xs leading-relaxed text-muted-fg">
              Automated counts are estimates (~89% measured accuracy). Verify manually
              when precision is critical.
            </p>
          </div>

          {/* RIGHT — numbers */}
          <div className="space-y-5">
            <CountSummary results={results} errors={errors} dilution={dilution} />

            <Button
              variant="secondary"
              onClick={() => downloadReport({ results, dilution, target: plan })}
              className="w-full"
            >
              <DownloadIcon className="h-4 w-4" /> Download PDF report
            </Button>

            <DilutionCalculator
              currentDensity={summary.densityMillions}
              onPlan={setPlan}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
