import { useEffect, useState } from "react";
import AppHeader from "./AppHeader.jsx";

// Single lightweight spinner (transform-only animation — no layout work).
export default function ProcessingScreen() {
  const [slow, setSlow] = useState(false);

  // If it's taking a while, say why. A silent long wait reads as "broken".
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-full bg-background">
      <AppHeader />
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-primary"
          role="status"
          aria-label="Analyzing"
        />
        <p className="font-medium">Analyzing squares…</p>
        <p className="text-sm text-muted-fg">Detecting cells inside each box</p>
        {slow && (
          <p className="max-w-sm text-sm text-muted-fg" aria-live="polite">
            Still working — the server may be waking up after being idle. This can
            take up to a minute on the first run.
          </p>
        )}
      </div>
    </div>
  );
}
