/**
 * Comparison Engine — Pure computation module for baseline vs midline analysis.
 *
 * All functions are stateless and take farmer arrays as input.
 * Control group is used for DID reference only — never in recommendations.
 */

import type { Farmer, ProjectGroup } from "@/lib/data/types";
import { isAboveLIB, median } from "./statistics";

/* ═══════════════════════════════════
   Types
   ═══════════════════════════════════ */

export interface ComparisonKPI {
  metric: string;
  label: string;
  baselineValue: number;
  midlineValue: number;
  absoluteChange: number;
  percentChange: number;
  direction: "up" | "down" | "flat";
  format: "percent" | "currency" | "number" | "index";
  higherIsBetter: boolean;
}

export interface GroupComparison {
  group: ProjectGroup;
  kpis: ComparisonKPI[];
}

export interface DIDResult {
  metric: string;
  label: string;
  treatmentGroup: ProjectGroup;
  treatmentBaseline: number;
  treatmentMidline: number;
  treatmentChange: number;
  controlBaseline: number;
  controlMidline: number;
  controlChange: number;
  /** Net treatment effect = treatmentChange - controlChange */
  treatmentEffect: number;
  /** Statistical significance (placeholder for when we add t-tests) */
  pValue: number | null;
  /** Effect size (Cohen's d) */
  cohensD: number | null;
}

export interface DriverFactor {
  factor: string;
  baselineValue: number;
  midlineValue: number;
  change: number;
  /** Correlation with income change (-1 to 1) */
  correlation: number;
}

export interface DriverAnalysis {
  metric: string;
  drivers: DriverFactor[];
}

export interface SignificanceResult {
  tStat: number;
  pValue: number;
  cohensD: number;
  ci95Lower: number;
  ci95Upper: number;
  n1: number;
  n2: number;
  significant: boolean; // p < 0.05
}

/* ═══════════════════════════════════
   Helpers
   ═══════════════════════════════════ */

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  const squaredDiffs = arr.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

function direction(diff: number, threshold = 0.5): "up" | "down" | "flat" {
  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "flat";
}

/* ═══════════════════════════════════
   Metric Extractors
   ═══════════════════════════════════ */

type MetricExtractor = (farmers: Farmer[]) => number;

interface MetricDef {
  id: string;
  label: string;
  extract: MetricExtractor;
  format: ComparisonKPI["format"];
  higherIsBetter: boolean;
}

const METRICS: MetricDef[] = [
  {
    id: "libPct",
    label: "% Above Living Income",
    extract: (f) => pct(f.filter((x) => isAboveLIB(x.aboveLIB)).length, f.length),
    format: "percent",
    higherIsBetter: true,
  },
  {
    id: "medianIncome",
    label: "Median Net Income",
    extract: (f) => {
      const incomes = f.map((x) => x.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
      return incomes.length ? median(incomes) : 0;
    },
    format: "currency",
    higherIsBetter: true,
  },
  {
    id: "avgIncome",
    label: "Avg Net Income",
    extract: (f) => {
      const incomes = f.map((x) => x.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
      return avg(incomes);
    },
    format: "currency",
    higherIsBetter: true,
  },
  {
    id: "femaleLIBPct",
    label: "Female LIB Attainment",
    extract: (f) => {
      const females = f.filter((x) => x.gender === "Female");
      return pct(females.filter((x) => isAboveLIB(x.aboveLIB)).length, females.length);
    },
    format: "percent",
    higherIsBetter: true,
  },
  {
    id: "gapAdoptionPct",
    label: "GAP Adoption Rate",
    extract: (f) =>
      pct(f.filter((x) => x.practiceAdoption === "Yes" || x.practiceAdoption === "yes").length, f.length),
    format: "percent",
    higherIsBetter: true,
  },
  {
    id: "fpcMembershipPct",
    label: "FPC Membership",
    extract: (f) =>
      pct(f.filter((x) => x.fpcMember === "Yes" || x.fpcMember === "yes").length, f.length),
    format: "percent",
    higherIsBetter: true,
  },
  {
    id: "trainingPct",
    label: "Training Participation",
    extract: (f) =>
      pct(f.filter((x) => x.trainingParticipation === "Yes" || x.trainingParticipation === "yes").length, f.length),
    format: "percent",
    higherIsBetter: true,
  },
  {
    id: "avgWEI",
    label: "Women Empowerment Index",
    extract: (f) => {
      const scores = f.map((x) => x.womenEmpowerment).filter((v): v is number => v != null && isFinite(v));
      return avg(scores);
    },
    format: "index",
    higherIsBetter: true,
  },
  {
    id: "avgResources",
    label: "Resources Index",
    extract: (f) => avg(f.map((x) => x.resourcesIndex).filter((v) => isFinite(v))),
    format: "index",
    higherIsBetter: true,
  },
  {
    id: "avgProductivity",
    label: "Productivity Index",
    extract: (f) => avg(f.map((x) => x.productivityIndex).filter((v) => isFinite(v))),
    format: "index",
    higherIsBetter: true,
  },
  {
    id: "offFarmDep",
    label: "Off-Farm Dependency",
    extract: (f) => {
      const vals = f.map((x) => x.offFarmDependency).filter((v): v is number => v != null && isFinite(v));
      return avg(vals);
    },
    format: "percent",
    higherIsBetter: false, // lower dependency is better
  },
];

/* ═══════════════════════════════════
   Core Functions
   ═══════════════════════════════════ */

/**
 * Compute KPI comparisons for a single group of farmers across two rounds.
 */
export function computeGroupKPIs(
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[],
  metricIds?: string[]
): ComparisonKPI[] {
  const defs = metricIds
    ? METRICS.filter((m) => metricIds.includes(m.id))
    : METRICS;

  return defs.map((m) => {
    const bVal = baselineFarmers.length ? m.extract(baselineFarmers) : 0;
    const mVal = midlineFarmers.length ? m.extract(midlineFarmers) : 0;
    const diff = mVal - bVal;
    const pctChg = bVal !== 0 ? (diff / Math.abs(bVal)) * 100 : 0;

    return {
      metric: m.id,
      label: m.label,
      baselineValue: bVal,
      midlineValue: mVal,
      absoluteChange: diff,
      percentChange: pctChg,
      direction: direction(diff),
      format: m.format,
      higherIsBetter: m.higherIsBetter,
    };
  });
}

/**
 * Compute group-level comparisons for all project groups.
 */
export function computeAllGroupComparisons(
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[],
  metricIds?: string[]
): GroupComparison[] {
  const groups: ProjectGroup[] = ["T-1", "T-2", "Control"];

  return groups.map((g) => ({
    group: g,
    kpis: computeGroupKPIs(
      baselineFarmers.filter((f) => f.project === g),
      midlineFarmers.filter((f) => f.project === g),
      metricIds
    ),
  }));
}

/**
 * Difference-in-Differences (DID) for a treatment group vs control.
 *
 * treatmentEffect = (T_midline - T_baseline) - (C_midline - C_baseline)
 * This isolates the program's causal effect from secular trends.
 */
export function computeDID(
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[],
  treatmentGroup: ProjectGroup,
  metricId: string
): DIDResult | null {
  const def = METRICS.find((m) => m.id === metricId);
  if (!def) return null;

  const tBase = baselineFarmers.filter((f) => f.project === treatmentGroup);
  const tMid = midlineFarmers.filter((f) => f.project === treatmentGroup);
  const cBase = baselineFarmers.filter((f) => f.project === "Control");
  const cMid = midlineFarmers.filter((f) => f.project === "Control");

  if (!tBase.length || !cBase.length) return null;

  const tBaseVal = def.extract(tBase);
  const tMidVal = tMid.length ? def.extract(tMid) : tBaseVal;
  const cBaseVal = def.extract(cBase);
  const cMidVal = cMid.length ? def.extract(cMid) : cBaseVal;

  const tChange = tMidVal - tBaseVal;
  const cChange = cMidVal - cBaseVal;
  const effect = tChange - cChange;

  return {
    metric: metricId,
    label: def.label,
    treatmentGroup,
    treatmentBaseline: tBaseVal,
    treatmentMidline: tMidVal,
    treatmentChange: tChange,
    controlBaseline: cBaseVal,
    controlMidline: cMidVal,
    controlChange: cChange,
    treatmentEffect: effect,
    pValue: null, // will compute when we have enough data
    cohensD: null,
  };
}

/**
 * Compute DID for all treatment groups across key metrics.
 */
export function computeAllDID(
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[],
  metricIds?: string[]
): DIDResult[] {
  const groups: ProjectGroup[] = ["T-1", "T-2"];
  const ids = metricIds || ["libPct", "medianIncome", "avgIncome", "gapAdoptionPct", "fpcMembershipPct", "avgWEI"];
  const results: DIDResult[] = [];

  for (const g of groups) {
    for (const id of ids) {
      const r = computeDID(baselineFarmers, midlineFarmers, g, id);
      if (r) results.push(r);
    }
  }

  return results;
}

/**
 * Basic two-sample t-test (Welch's).
 * Returns significance metrics for comparing two distributions.
 */
export function computeSignificance(
  values1: number[],
  values2: number[]
): SignificanceResult | null {
  const n1 = values1.length;
  const n2 = values2.length;
  if (n1 < 2 || n2 < 2) return null;

  const mean1 = avg(values1);
  const mean2 = avg(values2);
  const sd1 = stdDev(values1);
  const sd2 = stdDev(values2);

  const se = Math.sqrt((sd1 ** 2) / n1 + (sd2 ** 2) / n2);
  if (se === 0) return null;

  const tStat = (mean2 - mean1) / se;

  // Welch's degrees of freedom
  const num = ((sd1 ** 2) / n1 + (sd2 ** 2) / n2) ** 2;
  const den =
    ((sd1 ** 2) / n1) ** 2 / (n1 - 1) + ((sd2 ** 2) / n2) ** 2 / (n2 - 1);
  const df = den > 0 ? num / den : n1 + n2 - 2;

  // Approximate p-value using normal distribution (good for large df)
  const absT = Math.abs(tStat);
  const pValue = 2 * (1 - normalCDF(absT));

  // Cohen's d
  const pooledSD = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
  const cohensD = pooledSD > 0 ? (mean2 - mean1) / pooledSD : 0;

  // 95% CI
  const criticalValue = 1.96; // approximate for large df
  const ci95Lower = (mean2 - mean1) - criticalValue * se;
  const ci95Upper = (mean2 - mean1) + criticalValue * se;

  return {
    tStat,
    pValue,
    cohensD,
    ci95Lower,
    ci95Upper,
    n1,
    n2,
    significant: pValue < 0.05,
  };
}

/**
 * Identify which factors (practices, indices) most drove income changes.
 * Simple approach: rank factors by their change magnitude × baseline correlation.
 */
export function computeDrivers(
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[]
): DriverAnalysis {
  const factors: { name: string; extract: (f: Farmer) => number | null }[] = [
    { name: "GAP Adoption", extract: (f) => f.practiceAdoption === "Yes" || f.practiceAdoption === "yes" ? 1 : 0 },
    { name: "FPC Membership", extract: (f) => f.fpcMember === "Yes" || f.fpcMember === "yes" ? 1 : 0 },
    { name: "Training", extract: (f) => f.trainingParticipation === "Yes" || f.trainingParticipation === "yes" ? 1 : 0 },
    { name: "Resources Index", extract: (f) => f.resourcesIndex },
    { name: "Productivity Index", extract: (f) => f.productivityIndex },
    { name: "Women Empowerment", extract: (f) => f.womenEmpowerment },
    { name: "Farm Size (acres)", extract: (f) => f.totalAcre },
    { name: "Off-Farm Dependency", extract: (f) => f.offFarmDependency },
  ];

  const drivers: DriverFactor[] = factors.map((fac) => {
    const bVals = baselineFarmers.map((f) => fac.extract(f)).filter((v): v is number => v != null && isFinite(v));
    const mVals = midlineFarmers.length
      ? midlineFarmers.map((f) => fac.extract(f)).filter((v): v is number => v != null && isFinite(v))
      : bVals;

    const bAvg = avg(bVals);
    const mAvg = avg(mVals);

    return {
      factor: fac.name,
      baselineValue: bAvg,
      midlineValue: mAvg,
      change: mAvg - bAvg,
      correlation: 0, // placeholder — will compute with midline income
    };
  });

  // Sort by absolute change magnitude
  drivers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return { metric: "income", drivers };
}

/**
 * Get all available metric definitions (for UI to enumerate).
 */
export function getMetricDefs(): MetricDef[] {
  return METRICS;
}

/* ═══════════════════════════════════
   Statistical Helpers
   ═══════════════════════════════════ */

/** Standard normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Significance stars for display:
 * *** p < 0.001, ** p < 0.01, * p < 0.05, ns otherwise
 */
export function significanceStars(pValue: number | null): string {
  if (pValue == null) return "";
  if (pValue < 0.001) return "***";
  if (pValue < 0.01) return "**";
  if (pValue < 0.05) return "*";
  return "ns";
}
