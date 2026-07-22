// Client-side PDF report. Runs entirely in the browser (works on phones, no
// server compute, no uploads). Reuses calc.js so the PDF and the on-screen
// numbers can never disagree.
import { summarize, fmt } from "./calc.js";

const NAVY = [30, 58, 95];
const SLATE = [100, 116, 139];
const INK = [15, 23, 42];

export async function downloadReport({ results, dilution, target }) {
  // Loaded on demand so the ~150KB PDF library never delays first paint.
  const { jsPDF } = await import("jspdf");
  const s = summarize(results, dilution || 0);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48; // margin
  let y = M;

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text("CellCount", M, 34);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Hemocytometer cell count report", M, 50);
  doc.text(new Date().toLocaleString(), W - M, 50, { align: "right" });
  y = 96;

  // Headline result
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold").setFontSize(24);
  doc.text(`${fmt(s.densityMillions, 2)} million cells/mL`, M, y);
  y += 18;
  doc.setFont("courier", "normal").setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(`${fmt(s.densityPerMl, 0)} cells/mL`, M, y);
  y += 28;

  // Per-square table
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Counts per square", M, y);
  y += 6;
  doc.setDrawColor(228, 231, 235);
  doc.line(M, y, W - M, y);
  y += 16;

  doc.setFont("helvetica", "normal").setFontSize(10);
  results.forEach((r, i) => {
    const label = `Square ${i + 1}`;
    const value = r
      ? `${r.total_count} total   (${r.live_count} live, ${r.dead_count} dead)`
      : "not analyzed";
    doc.setTextColor(...SLATE);
    doc.text(label, M, y);
    doc.setTextColor(...INK);
    doc.setFont("courier", "normal");
    doc.text(value, M + 120, y);
    doc.setFont("helvetica", "normal");
    y += 16;
  });

  y += 6;
  doc.line(M, y, W - M, y);
  y += 18;

  // Calculation
  const rows = [
    ["Total cells counted", `${fmt(s.totalCells, 0)}`],
    ["Average per square", `${fmt(s.average, 1)}`],
    ["Dilution factor", `${fmt(dilution, 2)}`],
    [
      "Calculation",
      `${fmt(s.average, 1)} x ${fmt(dilution, 2)} x 10^4 = ${fmt(s.densityPerMl, 0)} cells/mL`,
    ],
    [
      "Viability",
      s.viability === null
        ? "-"
        : s.totalDead === 0
        ? "100% (no dead cells detected)"
        : `${fmt(s.viability, 1)}%`,
    ],
  ];
  rows.forEach(([k, v]) => {
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "normal");
    doc.text(k, M, y);
    doc.setTextColor(...INK);
    doc.setFont("courier", "normal");
    doc.text(String(v), M + 120, y);
    y += 16;
  });

  // Optional dilution plan
  if (target && target.v1 != null) {
    y += 10;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
    doc.text("Dilution plan", M, y);
    y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10);
    const txt = `Take ${fmt(target.v1, 3)} mL of sample and bring to ${fmt(
      target.v2,
      2
    )} mL total with media.`;
    doc.text(doc.splitTextToSize(txt, W - M * 2), M, y);
    y += 24;
  }

  // Footnote — honest about accuracy
  y = Math.max(y + 16, doc.internal.pageSize.getHeight() - 72);
  doc.setDrawColor(228, 231, 235);
  doc.line(M, y - 14, W - M, y - 14);
  doc.setFontSize(8).setTextColor(...SLATE);
  doc.text(
    doc.splitTextToSize(
      "Counts are produced by automated image analysis (measured ~89% count accuracy on " +
        "held-out test images). Verify manually when precision is critical.",
      W - M * 2
    ),
    M,
    y
  );

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  doc.save(`cellcount-${stamp}.pdf`);
}
