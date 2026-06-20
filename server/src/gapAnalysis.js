/**
 * Compares two coverage runs (existing tests alone vs existing+generated tests)
 * to surface exactly which lines/branches the user's original suite was NOT
 * exercising, and which new tests closed those gaps.
 */
export function computeGapAnalysis({ baselineCoverage, combinedCoverage, generatedTestNames }) {
  if (!baselineCoverage && !combinedCoverage) {
    return {
      hasBaseline: false,
      newlyCoveredLines: [],
      stillUncoveredLines: combinedCoverage?.missingLines || [],
      percentImprovement: null,
    };
  }

  if (!baselineCoverage) {
    return {
      hasBaseline: false,
      newlyCoveredLines: [],
      stillUncoveredLines: combinedCoverage?.missingLines || [],
      percentImprovement: null,
    };
  }

  const baselineMissing = new Set(baselineCoverage.missingLines || []);
  const combinedMissing = new Set(combinedCoverage?.missingLines || []);

  const newlyCoveredLines = [...baselineMissing].filter((line) => !combinedMissing.has(line));
  const stillUncoveredLines = [...combinedMissing];

  const percentImprovement =
    combinedCoverage && baselineCoverage
      ? round1(combinedCoverage.percentCovered - baselineCoverage.percentCovered)
      : null;

  return {
    hasBaseline: true,
    baselinePercent: round1(baselineCoverage.percentCovered),
    combinedPercent: round1(combinedCoverage?.percentCovered),
    newlyCoveredLines: newlyCoveredLines.sort((a, b) => a - b),
    stillUncoveredLines: stillUncoveredLines.sort((a, b) => a - b),
    percentImprovement,
    generatedTestCount: generatedTestNames?.length || 0,
  };
}

function round1(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

/** Groups a flat list of line numbers into contiguous ranges for cleaner display. */
export function groupConsecutiveLines(lines) {
  if (!lines || lines.length === 0) return [];
  const sorted = [...lines].sort((a, b) => a - b);
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = sorted[i];
    prev = sorted[i];
  }
  groups.push(start === prev ? `${start}` : `${start}-${prev}`);
  return groups;
}
