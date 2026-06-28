// Density and dilution math (authoritative; mirrors the plan).

// results: array of 4 detection results (or null). dilution: number.
export function summarize(results, dilution) {
  const valid = results.filter(Boolean);
  const totalLive = valid.reduce((s, r) => s + r.live_count, 0);
  const totalDead = valid.reduce((s, r) => s + r.dead_count, 0);
  const totalCells = totalLive + totalDead;

  // Average is over 4 squares (the hemocytometer convention), even if a square failed.
  const average = totalCells / 4;
  const densityPerMl = average * dilution * 10000;
  const densityMillions = densityPerMl / 1_000_000;
  const viability = totalCells > 0 ? (totalLive / totalCells) * 100 : null;

  return {
    totalLive,
    totalDead,
    totalCells,
    average,
    densityPerMl,
    densityMillions,
    viability,
  };
}

// M1V1 = M2V2  ->  V1 = (M2 * V2) / M1
// currentDensity and targetDensity in million cells/mL; finalVolume in mL.
export function dilutionPlan(currentDensity, targetDensity, finalVolume) {
  if (!(currentDensity > 0) || !(targetDensity > 0) || !(finalVolume > 0)) {
    return { error: "Enter positive numbers for density and volume." };
  }
  const v1 = (targetDensity * finalVolume) / currentDensity;
  const concentrate = v1 > finalVolume;
  const tiny = v1 < 0.01;
  return { v1, v2: finalVolume, concentrate, tiny };
}

export function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
