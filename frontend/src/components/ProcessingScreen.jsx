import AppHeader from "./AppHeader.jsx";

// Single lightweight spinner (transform-only animation — no layout work).
export default function ProcessingScreen() {
  return (
    <div className="min-h-full bg-background">
      <AppHeader />
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-24">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-primary"
          role="status"
          aria-label="Analyzing"
        />
        <p className="font-medium">Analyzing squares…</p>
        <p className="text-sm text-muted-fg">Detecting cells inside each box</p>
      </div>
    </div>
  );
}
