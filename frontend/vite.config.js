import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      // jsPDF lazily references html2canvas/canvg/dompurify for features we don't
      // use (HTML-to-PDF rasterizing). Without this they get bundled and add
      // ~400KB for nothing. We only draw text/vectors, so stub them out.
      external: ["html2canvas", "canvg", "dompurify"],
    },
  },
});
