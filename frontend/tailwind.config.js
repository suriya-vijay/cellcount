/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Semantic tokens -> Tailwind names. Components use `bg-primary`,
      // `text-muted-fg`, `border-border` etc. instead of raw hex values.
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          fg: "var(--color-on-primary)",
        },
        accent: "var(--color-accent)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        surface: "var(--color-surface)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        "muted-fg": "var(--color-muted-fg)",
        border: "var(--color-border)",
      },
      fontFamily: {
        sans: ['"Fira Sans"', "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"Fira Code"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Single, consistent elevation step (Swiss style: no random shadows).
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04)",
      },
      // Micro-interaction budget: 150-250ms only.
      transitionDuration: {
        DEFAULT: "180ms",
      },
    },
  },
  plugins: [],
};
