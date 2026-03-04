/**
 * Comparison Insights Engine
 *
 * Generates local, rule-based analysis of multi-scenario comparison results.
 * No API calls — all analysis is computed from the scenario engine output.
 */

import type {
  LIBScenarioParams,
  LIBScenarioResult,
  YearlyResult,
  ModeledCrop,
} from "./libScenarioEngine";
import { MODELED_CROPS } from "./libScenarioEngine";
import { formatPercent, formatUSD, formatNumber } from "./formatters";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComparisonInsight {
  id: string;
  title: string;
  description: string;
  category: "winner" | "delta" | "risk" | "recommendation";
  severity: "high" | "medium" | "low";
  scenarioName?: string;
  metric?: string;
  value?: number;
  delta?: number;
}

export interface ComparisonInsights {
  bestPerformer: ComparisonInsight;
  keyDeltas: ComparisonInsight[];
  riskFactors: ComparisonInsight[];
  recommendations: ComparisonInsight[];
  summary: string;
}

interface ScenarioWithResult {
  params: LIBScenarioParams;
  result: LIBScenarioResult;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findBAU(results: ScenarioWithResult[]): ScenarioWithResult | undefined {
  return results.find((r) => r.params.name === "Business as Usual");
}

function nonBAU(results: ScenarioWithResult[]): ScenarioWithResult[] {
  return results.filter((r) => r.params.name !== "Business as Usual");
}

/** Check if trajectory is improving, flat, or declining in the last 3 data points */
function trajectoryDirection(
  yearlyResults: YearlyResult[],
  metric: keyof YearlyResult
): "improving" | "flat" | "declining" {
  if (yearlyResults.length < 3) return "flat";
  const last3 = yearlyResults.slice(-3).map((yr) => Number(yr[metric]));
  const trend = last3[2] - last3[0];
  if (Math.abs(trend) < 0.5) return "flat";
  return trend > 0 ? "improving" : "declining";
}

/** Summarize which levers are active in a scenario */
function summarizeLevers(params: LIBScenarioParams): string {
  const parts: string[] = [];
  const crops = Object.entries(params.crops) as [ModeledCrop, { yieldChange: number; priceChange: number; costChange: number; acreageChange: number }][];
  const activeCrops = crops.filter(
    ([, c]) => c.yieldChange !== 0 || c.priceChange !== 0 || c.costChange !== 0 || c.acreageChange !== 0
  );
  if (activeCrops.length > 0) {
    const names = activeCrops.map(([name]) => name);
    parts.push(`crop adjustments (${names.join(", ")})`);
  }
  if (params.otherOnFarmChange !== 0) parts.push(`other on-farm income ${params.otherOnFarmChange > 0 ? "+" : ""}${params.otherOnFarmChange}%`);
  if (params.livestockChange !== 0) parts.push(`livestock ${params.livestockChange > 0 ? "+" : ""}${params.livestockChange}%`);
  if (params.includeT1Legacy) parts.push("T1 legacy included");
  const t2Total = Object.values(params.t2YearlyIntake).reduce((a, b) => a + b, 0);
  if (t2Total > 0) parts.push(`${formatNumber(t2Total)} T2 intake`);
  return parts.length > 0 ? parts.join(", ") : "no lever changes";
}

/** Find which crop has the biggest improvement in a scenario vs BAU */
function topCropDelta(
  scenario: LIBScenarioResult,
  bau: LIBScenarioResult
): { crop: string; delta: number } | null {
  let best: { crop: string; delta: number } | null = null;
  for (const sc of scenario.cropContributions) {
    const bc = bau.cropContributions.find((c) => c.crop === sc.crop);
    if (!bc || bc.growerCount === 0) continue;
    const delta = sc.projectedIncome - bc.projectedIncome;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { crop: sc.crop, delta };
    }
  }
  return best;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export function generateComparisonInsights(
  results: ScenarioWithResult[]
): ComparisonInsights {
  const bau = findBAU(results);
  const others = nonBAU(results);
  const bauSummary = bau?.result.summary;

  // ── 1. Best Performer ──
  let bestName = "Business as Usual";
  let bestPct = bauSummary?.totalPctAboveLIB ?? 0;
  let bestDelta = 0;

  for (const sr of others) {
    const pct = sr.result.summary.totalPctAboveLIB;
    if (pct > bestPct) {
      bestPct = pct;
      bestName = sr.params.name;
      bestDelta = pct - (bauSummary?.totalPctAboveLIB ?? 0);
    }
  }

  const bestSR = results.find((r) => r.params.name === bestName);
  const bestLevers = bestSR ? summarizeLevers(bestSR.params) : "";
  const bestMoved = bestSR ? bestSR.result.summary.totalMovedAboveLIB : 0;

  const bestPerformer: ComparisonInsight = {
    id: "best-performer",
    title: "Best Performing Scenario",
    description:
      bestName === "Business as Usual"
        ? "No scenario outperforms the Business as Usual baseline. Consider adjusting lever settings for more ambitious strategies."
        : `${bestName} achieves ${formatPercent(bestPct)} of households above LIB — a ${formatPercent(bestDelta, 1)} improvement over BAU. It moves ${formatNumber(bestMoved)} additional households above the benchmark through ${bestLevers}.`,
    category: "winner",
    severity: "high",
    scenarioName: bestName,
    metric: "totalPctAboveLIB",
    value: bestPct,
    delta: bestDelta,
  };

  // ── 2. Key Deltas ──
  const keyDeltas: ComparisonInsight[] = [];
  const metrics: { key: keyof YearlyResult; label: string; fmt: (v: number) => string }[] = [
    { key: "totalPctAboveLIB", label: "% Above LIB", fmt: (v) => formatPercent(v, 1) },
    { key: "totalAvgIncome", label: "Avg Income", fmt: (v) => formatUSD(v) },
    { key: "totalAvgLIBGap", label: "Avg LIB Gap", fmt: (v) => formatUSD(v) },
    { key: "totalMovedAboveLIB", label: "Moved Above LIB", fmt: (v) => formatNumber(v) },
    { key: "t1PctAboveLIB", label: "T1 % Above LIB", fmt: (v) => formatPercent(v, 1) },
    { key: "t2PctAboveLIB", label: "T2 % Above LIB", fmt: (v) => formatPercent(v, 1) },
  ];

  type Delta = { name: string; metric: string; metricKey: string; delta: number; value: number; absDelta: number; fmt: (v: number) => string };
  const allDeltas: Delta[] = [];

  for (const sr of others) {
    for (const m of metrics) {
      const val = Number(sr.result.summary[m.key]);
      const bauVal = bauSummary ? Number(bauSummary[m.key]) : 0;
      const delta = val - bauVal;
      allDeltas.push({
        name: sr.params.name,
        metric: m.label,
        metricKey: m.key,
        delta,
        value: val,
        absDelta: Math.abs(delta),
        fmt: m.fmt,
      });
    }
  }

  // Top 5 by absolute delta
  allDeltas.sort((a, b) => b.absDelta - a.absDelta);
  for (const d of allDeltas.slice(0, 5)) {
    if (d.absDelta < 0.01) continue;
    const direction = d.delta > 0 ? "+" : "";
    // For LIB Gap, lower is better
    const isPositive = d.metricKey === "totalAvgLIBGap" ? d.delta < 0 : d.delta > 0;
    keyDeltas.push({
      id: `delta-${d.name}-${d.metricKey}`,
      title: `${d.metric}: ${d.name}`,
      description: `${d.name} reaches ${d.fmt(d.value)} (${direction}${d.fmt(d.delta)} vs BAU) — ${isPositive ? "an improvement" : "a decline"} on this metric.`,
      category: "delta",
      severity: d.absDelta > 10 ? "high" : d.absDelta > 3 ? "medium" : "low",
      scenarioName: d.name,
      metric: d.metric,
      value: d.value,
      delta: d.delta,
    });
  }

  // ── 3. Risk Factors ──
  const riskFactors: ComparisonInsight[] = [];

  for (const sr of others) {
    const s = sr.result.summary;

    // Risk: T2 regression
    if (bauSummary && s.t2PctAboveLIB < bauSummary.t2PctAboveLIB) {
      riskFactors.push({
        id: `risk-t2-regression-${sr.params.name}`,
        title: "T2 Regression Risk",
        description: `${sr.params.name} shows T2 farmers at ${formatPercent(s.t2PctAboveLIB)} above LIB, which is ${formatPercent(bauSummary.t2PctAboveLIB - s.t2PctAboveLIB, 1)} below the BAU baseline. This strategy may negatively impact T2 outcomes.`,
        category: "risk",
        severity: "high",
        scenarioName: sr.params.name,
      });
    }

    // Risk: LIB gap widening
    if (bauSummary && s.totalAvgLIBGap > bauSummary.totalAvgLIBGap) {
      riskFactors.push({
        id: `risk-gap-widening-${sr.params.name}`,
        title: "LIB Gap Widening",
        description: `${sr.params.name} has an average LIB gap of ${formatUSD(s.totalAvgLIBGap)}, which is ${formatUSD(s.totalAvgLIBGap - bauSummary.totalAvgLIBGap)} wider than BAU. The poorest households may fall further behind.`,
        category: "risk",
        severity: "medium",
        scenarioName: sr.params.name,
      });
    }

    // Risk: declining trajectory
    const dir = trajectoryDirection(sr.result.yearlyResults, "totalPctAboveLIB");
    if (dir === "declining") {
      riskFactors.push({
        id: `risk-declining-${sr.params.name}`,
        title: "Declining Trajectory",
        description: `${sr.params.name} shows a declining trend in % households above LIB in later years. Gains may not be sustained over the full projection period.`,
        category: "risk",
        severity: "medium",
        scenarioName: sr.params.name,
      });
    }

    // Risk: extreme lever settings
    const extremeCrops = (Object.entries(sr.params.crops) as [ModeledCrop, { yieldChange: number; priceChange: number; costChange: number; acreageChange: number }][])
      .filter(([, c]) => Math.abs(c.yieldChange) > 40 || Math.abs(c.priceChange) > 40);
    if (extremeCrops.length > 0) {
      const names = extremeCrops.map(([n]) => n).join(", ");
      riskFactors.push({
        id: `risk-extreme-${sr.params.name}`,
        title: "Aggressive Lever Settings",
        description: `${sr.params.name} uses aggressive settings for ${names} (>40% yield or price change). These improvements may be difficult to achieve in practice.`,
        category: "risk",
        severity: "low",
        scenarioName: sr.params.name,
      });
    }
  }

  // ── 4. Recommendations ──
  const recommendations: ComparisonInsight[] = [];

  // Recommendation: best T1 vs best T2
  let bestT1Name = "";
  let bestT1Val = 0;
  let bestT2Name = "";
  let bestT2Val = 0;
  for (const sr of results) {
    if (sr.result.summary.t1PctAboveLIB > bestT1Val) {
      bestT1Val = sr.result.summary.t1PctAboveLIB;
      bestT1Name = sr.params.name;
    }
    if (sr.result.summary.t2PctAboveLIB > bestT2Val) {
      bestT2Val = sr.result.summary.t2PctAboveLIB;
      bestT2Name = sr.params.name;
    }
  }

  if (bestT1Name && bestT2Name && bestT1Name !== bestT2Name) {
    recommendations.push({
      id: "rec-hybrid",
      title: "Consider a Hybrid Strategy",
      description: `${bestT1Name} performs best for T1 farmers (${formatPercent(bestT1Val)}) while ${bestT2Name} leads on T2 (${formatPercent(bestT2Val)}). A hybrid approach combining ${bestT1Name}'s crop strategy with ${bestT2Name}'s T2 intake plan could optimize outcomes across both tiers.`,
      category: "recommendation",
      severity: "high",
    });
  }

  // Recommendation: top crop opportunity
  if (bau) {
    let topCrop: { name: string; crop: string; delta: number } | null = null;
    for (const sr of others) {
      const cd = topCropDelta(sr.result, bau.result);
      if (cd && (!topCrop || cd.delta > topCrop.delta)) {
        topCrop = { name: sr.params.name, ...cd };
      }
    }
    if (topCrop && topCrop.delta > 0) {
      recommendations.push({
        id: "rec-top-crop",
        title: `Prioritize ${topCrop.crop.charAt(0).toUpperCase() + topCrop.crop.slice(1)} Improvements`,
        description: `${topCrop.crop.charAt(0).toUpperCase() + topCrop.crop.slice(1)} shows the highest income improvement of ${formatUSD(topCrop.delta)}/farmer in the ${topCrop.name} scenario. Focusing extension efforts and input subsidies on this crop could maximize per-farmer income gains.`,
        category: "recommendation",
        severity: "medium",
      });
    }
  }

  // Recommendation: T2 intake level
  const t2Totals = others.map((sr) => ({
    name: sr.params.name,
    total: Object.values(sr.params.t2YearlyIntake).reduce((a, b) => a + b, 0),
    t2Pct: sr.result.summary.t2PctAboveLIB,
  }));
  const highT2 = t2Totals.filter((t) => t.total > 8000);
  const lowT2 = t2Totals.filter((t) => t.total < 5000);
  if (highT2.length > 0 && lowT2.length > 0) {
    const highBest = highT2.reduce((a, b) => (a.t2Pct > b.t2Pct ? a : b));
    const lowBest = lowT2.reduce((a, b) => (a.t2Pct > b.t2Pct ? a : b));
    if (lowBest.t2Pct > highBest.t2Pct) {
      recommendations.push({
        id: "rec-t2-quality",
        title: "Quality Over Quantity for T2",
        description: `${lowBest.name} (${formatNumber(lowBest.total)} T2 intake) achieves better T2 outcomes (${formatPercent(lowBest.t2Pct)}) than ${highBest.name} (${formatNumber(highBest.total)} intake, ${formatPercent(highBest.t2Pct)}). Smaller cohorts with deeper support may be more effective.`,
        category: "recommendation",
        severity: "medium",
      });
    }
  }

  // General recommendation if no risks
  if (riskFactors.length === 0 && recommendations.length < 2) {
    recommendations.push({
      id: "rec-general",
      title: "All Scenarios Show Positive Trends",
      description: "Every scenario improves on BAU without significant risk flags. Consider running the best-performing strategy as a pilot before full-scale implementation to validate assumptions.",
      category: "recommendation",
      severity: "low",
    });
  }

  // ── 5. Executive Summary ──
  const summary = buildSummary(bestPerformer, keyDeltas, riskFactors, recommendations, results.length);

  return { bestPerformer, keyDeltas, riskFactors, recommendations, summary };
}

function buildSummary(
  best: ComparisonInsight,
  deltas: ComparisonInsight[],
  risks: ComparisonInsight[],
  recs: ComparisonInsight[],
  count: number
): string {
  const parts: string[] = [];
  parts.push(`Across ${count} scenarios compared, ${best.scenarioName || "Business as Usual"} emerges as the strongest performer`);
  if (best.delta && best.delta > 0) {
    parts.push(` with a ${formatPercent(best.delta, 1)} improvement in households above the Living Income Benchmark.`);
  } else {
    parts.push(".");
  }

  if (deltas.length > 0) {
    const top = deltas[0];
    parts.push(` The most significant change is in ${top.metric} for ${top.scenarioName}.`);
  }

  if (risks.length > 0) {
    parts.push(` However, ${risks.length} risk factor${risks.length > 1 ? "s were" : " was"} identified that should be monitored.`);
  }

  if (recs.length > 0) {
    parts.push(` Key recommendation: ${recs[0].title.toLowerCase()}.`);
  }

  return parts.join("");
}
