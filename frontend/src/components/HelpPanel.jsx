import { Button } from "./ui.jsx";

// First-time guidance. The workflow is obvious once you've done it, but a new
// user needs to know what to photograph, where to drag the box, and what the
// dilution factor means. Shown as an overlay so it never blocks repeat users.
export default function HelpPanel({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="How to use CellCount"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">How to use CellCount</h2>
          <Button variant="ghost" onClick={onClose} className="px-3">
            Close
          </Button>
        </div>

        <ol className="space-y-4 text-sm leading-relaxed">
          <Step n="1" title="Photograph 4 counting squares">
            Load your stained sample on the hemocytometer and take one photo per
            counting square through the eyepiece — 4 photos total. Any photo size
            works.
          </Step>
          <Step n="2" title="Drag a box over the square">
            On each photo, drag a box around the counting square you want counted.
            <strong> Only cells inside the box are counted.</strong> Cells touching
            the top and left edges are included; bottom and right edges are excluded,
            so cells aren’t counted twice between squares.
          </Step>
          <Step n="3" title="Enter the dilution factor">
            The numeric factor only. For a 1:2 dilution — equal parts sample and
            trypan blue — enter <span className="num">2</span>.
          </Step>
          <Step n="4" title="Analyze and read the result">
            You get live/dead counts per square and the cell density:
            <span className="num"> average × dilution × 10⁴</span> cells/mL. Use
            “Seed or dilute” to work out volumes for a target density, and download a
            PDF for your records.
          </Step>
        </ol>

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-fg">
          <p>
            <strong className="text-foreground">Accuracy:</strong> counts are
            automated estimates, measured at ~89% against hand-labeled images. Check
            the markers and verify manually when precision matters.
          </p>
          <p>
            <strong className="text-foreground">First load is slow:</strong> the free
            server sleeps when idle and can take up to a minute to wake.
          </p>
          <p>
            <strong className="text-foreground">Privacy:</strong> photos are analyzed
            per request and never stored on the server.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-fg">
        {n}
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-fg">{children}</p>
      </div>
    </li>
  );
}
