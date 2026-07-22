// Shared primitives so every screen stays visually consistent and every
// interactive element meets the 44x44px touch-target minimum.

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "min-h-[44px] px-4 text-sm transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
  "focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed";

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-primary text-primary-fg hover:bg-primary-hover",
    secondary: "border border-border bg-surface text-foreground hover:bg-background",
    ghost: "text-muted-fg hover:text-foreground hover:bg-background",
  }[variant];
  return (
    <button
      {...props}
      className={`${BASE} ${styles} cursor-pointer ${className}`}
    />
  );
}

export function Card({ className = "", children }) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

// Small filled dot used in the legend — replaces emoji (🟢/🔴) with a real
// shape so it renders identically on every platform.
export function Dot({ tone = "accent", label }) {
  const color = tone === "danger" ? "var(--color-danger)" : "var(--color-accent)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="4" fill={color} />
      </svg>
      <span>{label}</span>
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-fg">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full min-h-[44px] rounded-lg border border-border bg-surface px-3 " +
  "text-foreground placeholder:text-muted-fg transition-colors duration-150 " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
