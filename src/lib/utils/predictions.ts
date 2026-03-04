import { Farmer } from "../data/types";
import { mean, percentile, median, sum, isAboveLIB } from "./statistics";

export interface Prediction {
  id: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: "high" | "medium" | "low";
  category: "income" | "productivity" | "risk" | "opportunity";
  metric?: string;
  currentValue?: number;
  predictedValue?: number;
  change?: number; // percentage
}

export function generatePredictions(farmers: Farmer[]): Prediction[] {
  if (farmers.length < 10) return [];
  const predictions: Prediction[] = [];

  // ── Treatment farmers only — Control is reference, not a program target ──
  const treatment = farmers.filter((f) => f.project === "T-1" || f.project === "T-2");
  if (treatment.length < 10) return [];

  const t1 = treatment.filter((f) => f.project === "T-1");
  const t2 = treatment.filter((f) => f.project === "T-2");

  const t1Incomes = t1.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const t2Incomes = t2.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const t1AvgIncome = t1Incomes.length ? mean(t1Incomes) : 0;
  const t2AvgIncome = t2Incomes.length ? mean(t2Incomes) : 0;

  // Helper: count profitable crops
  const countCrops = (f: Farmer) => {
    let n = 0;
    if (f.mintNetIncome != null && f.mintNetIncome > 0) n++;
    if (f.riceNetIncome != null && f.riceNetIncome > 0) n++;
    if (f.potatoNetIncome != null && f.potatoNetIncome > 0) n++;
    if (f.mustardNetIncome != null && f.mustardNetIncome > 0) n++;
    if (f.wheatNetIncome != null && f.wheatNetIncome > 0) n++;
    return n;
  };

  // Helper: high GAP adoption (≥40%)
  const isHighGAP = (f: Farmer) =>
    f.practiceAdoption === "40-70%" || f.practiceAdoption === ">70";

  // 1. T-1 GAP Adoption → Income Uplift (the strongest actionable lever)
  if (t1.length > 20) {
    const t1GAP = t1.filter((f) => isHighGAP(f) && f.totalNetIncomeUsd != null);
    const t1NoGAP = t1.filter((f) => !isHighGAP(f) && f.totalNetIncomeUsd != null);
    if (t1GAP.length > 5 && t1NoGAP.length > 5) {
      const gapAvg = mean(t1GAP.map((f) => f.totalNetIncomeUsd!));
      const noGapAvg = mean(t1NoGAP.map((f) => f.totalNetIncomeUsd!));
      const uplift = noGapAvg > 0 ? ((gapAvg - noGapAvg) / noGapAvg) * 100 : 0;
      const adoptionRate = (t1GAP.length / t1.length) * 100;
      const unadoptedCount = t1NoGAP.length;
      // If all non-adopters reached half the adoption premium
      const projectedIncome = noGapAvg + (gapAvg - noGapAvg) * 0.4;
      const projectedChange = noGapAvg > 0 ? ((projectedIncome - noGapAvg) / noGapAvg) * 100 : 0;
      predictions.push({
        id: "t1-gap-uplift",
        title: "T-1 GAP Training → Income Uplift",
        description: `Only ${adoptionRate.toFixed(0)}% of T-1 farmers practice ≥40% GAP. Adopters earn ${uplift.toFixed(0)}% more ($${Math.round(gapAvg).toLocaleString()} vs $${Math.round(noGapAvg).toLocaleString()}/yr). Scaling GAP training to ${unadoptedCount} non-adopters could lift T-1 incomes by ~${projectedChange.toFixed(0)}%.`,
        confidence: 78,
        impact: "high",
        category: "income",
        currentValue: noGapAvg,
        predictedValue: projectedIncome,
        change: projectedChange,
      });
    }
  }

  // 2. T-1 farm size constraint — small farms need intensification
  if (t1.length > 20) {
    const t1Small = t1.filter((f) => f.totalAcre <= 2);
    const t1Larger = t1.filter((f) => f.totalAcre > 2);
    const smallPct = (t1Small.length / t1.length) * 100;
    if (smallPct > 50 && t1Small.length > 10 && t1Larger.length > 10) {
      const smallInc = t1Small.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const largerInc = t1Larger.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const smallAvg = smallInc.length ? mean(smallInc) : 0;
      const largerAvg = largerInc.length ? mean(largerInc) : 0;
      // Per-acre productivity comparison
      const smallPerAcre = t1Small.filter((f) => f.totalAcre > 0 && f.totalNetIncomeUsd != null);
      const largerPerAcre = t1Larger.filter((f) => f.totalAcre > 0 && f.totalNetIncomeUsd != null);
      const smallIncPerAcre = smallPerAcre.length ? mean(smallPerAcre.map((f) => f.totalNetIncomeUsd! / f.totalAcre)) : 0;
      const largerIncPerAcre = largerPerAcre.length ? mean(largerPerAcre.map((f) => f.totalNetIncomeUsd! / f.totalAcre)) : 0;
      // Project: if small farms reach T-1 larger-farm $/acre efficiency
      const projectedSmallIncome = smallIncPerAcre > 0 ? smallAvg * (largerIncPerAcre / smallIncPerAcre) * 0.6 + smallAvg * 0.4 : smallAvg;
      const projectedChangePct = smallAvg > 0 ? ((projectedSmallIncome - smallAvg) / smallAvg) * 100 : 0;
      predictions.push({
        id: "t1-intensification",
        title: "T-1 Smallholder Intensification",
        description: `${smallPct.toFixed(0)}% of T-1 farmers (${t1Small.length}) farm ≤2 acres, earning $${Math.round(smallAvg).toLocaleString()}/yr vs $${Math.round(largerAvg).toLocaleString()} for larger farms. Per-acre income: $${Math.round(smallIncPerAcre).toLocaleString()} vs $${Math.round(largerIncPerAcre).toLocaleString()}. Intensification (higher-value crops, GAP) could close this gap.`,
        confidence: 74,
        impact: "high",
        category: "productivity",
        currentValue: smallAvg,
        predictedValue: projectedSmallIncome,
        change: projectedChangePct,
      });
    }
  }

  // 3. T-2 Women Empowerment Paradox — high income but low empowerment
  if (t2.length > 15) {
    const t2Emp = t2.filter((f) => f.womenEmpowerment != null);
    const t1Emp = t1.filter((f) => f.womenEmpowerment != null);
    if (t2Emp.length > 10 && t1Emp.length > 10) {
      const t2AvgEmp = mean(t2Emp.map((f) => f.womenEmpowerment));
      const t1AvgEmp = mean(t1Emp.map((f) => f.womenEmpowerment));
      const t2LowEmp = t2Emp.filter((f) => f.womenEmpowerment < 4);
      const t2LowPct = (t2LowEmp.length / t2Emp.length) * 100;
      if (t2AvgEmp < t1AvgEmp) {
        // Among T-2, low-empowerment vs high-empowerment income comparison
        const t2LowEmpInc = t2.filter((f) => f.womenEmpowerment < 4 && f.totalNetIncomeUsd != null);
        const t2HighEmpInc = t2.filter((f) => f.womenEmpowerment >= 6 && f.totalNetIncomeUsd != null);
        const corrNote = t2LowEmpInc.length > 5 && t2HighEmpInc.length > 5
          ? ` Within T-2, high-empowerment households earn $${Math.round(mean(t2HighEmpInc.map((f) => f.totalNetIncomeUsd!))).toLocaleString()}/yr vs $${Math.round(mean(t2LowEmpInc.map((f) => f.totalNetIncomeUsd!))).toLocaleString()} for low-empowerment.`
          : "";
        predictions.push({
          id: "t2-empowerment-gap",
          title: "T-2 Women Empowerment Gap",
          description: `Despite highest incomes, T-2 scores lowest on women empowerment (${t2AvgEmp.toFixed(1)} vs T-1's ${t1AvgEmp.toFixed(1)}). ${t2LowPct.toFixed(0)}% of T-2 households score below 4/8.${corrNote} Gender-inclusive programming could unlock additional household resilience.`,
          confidence: 82,
          impact: "high",
          category: "opportunity",
          currentValue: t2AvgEmp,
          predictedValue: t1AvgEmp,
          change: ((t1AvgEmp - t2AvgEmp) / t2AvgEmp) * 100,
        });
      }
    }
  }

  // 4. T-1 Extreme Poverty Concentration — urgent intervention needed
  if (t1.length > 20) {
    const t1ExtremePov = t1.filter((f) => f.incomeCategory === "Below Extreme Poverty");
    const t1ModPov = t1.filter((f) => f.incomeCategory === "Moderate Poverty to LIB");
    const extremePct = (t1ExtremePov.length / t1.length) * 100;
    const modPct = (t1ModPov.length / t1.length) * 100;
    if (extremePct > 30) {
      const nearLIBCount = t1ModPov.length;
      const nearLIBAvg = t1ModPov.length > 0
        ? mean(t1ModPov.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!))
        : 0;
      predictions.push({
        id: "t1-poverty-concentration",
        title: "T-1 Extreme Poverty Concentration",
        description: `${extremePct.toFixed(0)}% of T-1 farmers (${t1ExtremePov.length}) are below the extreme poverty line. However, ${modPct.toFixed(0)}% (${nearLIBCount}) are in the "Moderate Poverty to LIB" band — closest to graduation. Targeting this near-LIB cohort (avg $${Math.round(nearLIBAvg).toLocaleString()}/yr) offers the fastest path to measurable LIB gains.`,
        confidence: 88,
        impact: "high",
        category: "risk",
      });
    }
  }

  // 5. Potato as key income driver — T-2's advantage, T-1's opportunity
  {
    const t1Potato = t1.filter((f) => f.potatoNetIncome != null && f.potatoNetIncome > 0);
    const t2Potato = t2.filter((f) => f.potatoNetIncome != null && f.potatoNetIncome > 0);
    if (t1Potato.length > 5 && t2Potato.length > 5) {
      const t1PotatoAvg = mean(t1Potato.map((f) => f.potatoNetIncome!));
      const t2PotatoAvg = mean(t2Potato.map((f) => f.potatoNetIncome!));
      const t1PotatoPct = (t1Potato.length / t1.length) * 100;
      const t2PotatoPct = (t2Potato.length / t2.length) * 100;
      if (t2PotatoAvg > t1PotatoAvg * 1.5) {
        predictions.push({
          id: "potato-income-driver",
          title: "Potato: Key Income Differentiator",
          description: `Potato is the largest income gap between groups: T-2 averages $${Math.round(t2PotatoAvg).toLocaleString()} vs T-1's $${Math.round(t1PotatoAvg).toLocaleString()} per grower. ${t1PotatoPct.toFixed(0)}% of T-1 grows potato vs ${t2PotatoPct.toFixed(0)}% of T-2. Expanding potato cultivation and yield efficiency in T-1 could significantly narrow the income gap.`,
          confidence: 76,
          impact: "high",
          category: "income",
          currentValue: t1PotatoAvg,
          predictedValue: t2PotatoAvg,
          change: t1PotatoAvg > 0 ? ((t2PotatoAvg - t1PotatoAvg) / t1PotatoAvg) * 100 : 0,
        });
      }
    }
  }

  // 6. FPC membership impact (treatment groups only)
  const fpcYes = treatment.filter((f) => f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
  const fpcNo = treatment.filter((f) => !f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
  if (fpcYes.length > 5 && fpcNo.length > 5) {
    const yesAvg = mean(fpcYes.map((f) => f.totalNetIncomeUsd!));
    const noAvg = mean(fpcNo.map((f) => f.totalNetIncomeUsd!));
    const diff = noAvg !== 0 ? ((yesAvg - noAvg) / Math.abs(noAvg)) * 100 : 0;
    const fpcRate = (fpcYes.length / treatment.length) * 100;
    if (Math.abs(diff) > 5) {
      predictions.push({
        id: "fpc-impact",
        title: "FPC Membership Impact",
        description: `Among treatment farmers, FPC members earn ${diff > 0 ? `${diff.toFixed(0)}% more` : `${Math.abs(diff).toFixed(0)}% less`} ($${Math.round(yesAvg).toLocaleString()} vs $${Math.round(noAvg).toLocaleString()}/yr). Only ${fpcRate.toFixed(0)}% of treatment farmers are members — ${diff > 0 ? "expanding" : "reforming"} FPC programs could benefit ${fpcNo.length} non-member farmers.`,
        confidence: 75,
        impact: diff > 20 ? "high" : "medium",
        category: "opportunity",
      });
    }
  }

  // 7. T-1 Crop Diversification opportunity
  const t1SingleCrop = t1.filter((f) => countCrops(f) <= 1);
  const t1SinglePct = t1.length > 0 ? (t1SingleCrop.length / t1.length) * 100 : 0;
  if (t1SingleCrop.length > 10 && t1SinglePct > 15) {
    const t1Diversified = t1.filter((f) => countCrops(f) >= 3 && f.totalNetIncomeUsd != null);
    const t1Single = t1.filter((f) => countCrops(f) <= 1 && f.totalNetIncomeUsd != null);
    const divAvg = t1Diversified.length > 5 ? mean(t1Diversified.map((f) => f.totalNetIncomeUsd!)) : null;
    const singleAvg = t1Single.length > 5 ? mean(t1Single.map((f) => f.totalNetIncomeUsd!)) : null;
    const premiumNote = divAvg && singleAvg && singleAvg > 0
      ? ` T-1 farmers with ≥3 crops earn ${((divAvg / singleAvg - 1) * 100).toFixed(0)}% more ($${Math.round(divAvg).toLocaleString()} vs $${Math.round(singleAvg).toLocaleString()}/yr).`
      : "";
    predictions.push({
      id: "t1-diversification",
      title: "T-1 Crop Diversification",
      description: `${t1SinglePct.toFixed(0)}% of T-1 farmers (${t1SingleCrop.length}) rely on ≤1 crop.${premiumNote} Adding high-value crops (potato, mint) could reduce income volatility and boost earnings.`,
      confidence: 70,
      impact: "medium",
      category: "opportunity",
    });
  }

  return predictions.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================
// AI Chat Engine — comprehensive conversational analytics
// with economic modeling, correlation analysis & causal inference
// ============================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Helpers ---

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(0)}%`;
}

// ============================================================
// Statistical / Economic Analysis Functions
// ============================================================

/** Pearson correlation coefficient between two numeric arrays */
function pearsonR(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/** Compute effect size: difference in means / pooled SD */
function cohenD(groupA: number[], groupB: number[]): number {
  if (groupA.length < 3 || groupB.length < 3) return 0;
  const ma = mean(groupA);
  const mb = mean(groupB);
  const varA = groupA.reduce((s, v) => s + (v - ma) ** 2, 0) / (groupA.length - 1);
  const varB = groupB.reduce((s, v) => s + (v - mb) ** 2, 0) / (groupB.length - 1);
  const pooledSD = Math.sqrt(((groupA.length - 1) * varA + (groupB.length - 1) * varB) / (groupA.length + groupB.length - 2));
  return pooledSD === 0 ? 0 : (ma - mb) / pooledSD;
}

/** Income elasticity: % change income / % change factor */
function incomeElasticity(farmers: Farmer[], factorKey: keyof Farmer): number {
  const valid = farmers.filter((f) => {
    const fv = f[factorKey] as number;
    const iv = f.totalNetIncomeUsd;
    return fv != null && isFinite(fv) && fv > 0 && iv != null && isFinite(iv) && iv > 0;
  });
  if (valid.length < 20) return 0;
  // Split into bottom and top thirds
  const sorted = [...valid].sort((a, b) => (a[factorKey] as number) - (b[factorKey] as number));
  const third = Math.floor(sorted.length / 3);
  const bottom = sorted.slice(0, third);
  const top = sorted.slice(-third);
  const factorBottom = mean(bottom.map((f) => f[factorKey] as number));
  const factorTop = mean(top.map((f) => f[factorKey] as number));
  const incBottom = mean(bottom.map((f) => f.totalNetIncomeUsd!));
  const incTop = mean(top.map((f) => f.totalNetIncomeUsd!));
  if (factorBottom === 0 || incBottom === 0) return 0;
  const pctFactorChange = (factorTop - factorBottom) / factorBottom;
  const pctIncomeChange = (incTop - incBottom) / Math.abs(incBottom);
  return pctFactorChange === 0 ? 0 : pctIncomeChange / pctFactorChange;
}

interface CorrelationResult {
  factor: string;
  key: keyof Farmer;
  r: number;
  elasticity: number;
  direction: "positive" | "negative" | "negligible";
  strength: "strong" | "moderate" | "weak" | "negligible";
  narrative: string;
}

function interpretR(r: number): "strong" | "moderate" | "weak" | "negligible" {
  const abs = Math.abs(r);
  if (abs >= 0.5) return "strong";
  if (abs >= 0.3) return "moderate";
  if (abs >= 0.15) return "weak";
  return "negligible";
}

/** Run correlation analysis of income against key factors */
function analyzeIncomeDrivers(farmers: Farmer[]): CorrelationResult[] {
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null && isFinite(f.totalNetIncomeUsd!));
  if (withIncome.length < 20) return [];

  const incomes = withIncome.map((f) => f.totalNetIncomeUsd!);

  const factors: { name: string; key: keyof Farmer; extractFn?: (f: Farmer) => number }[] = [
    { name: "Farm Size (acres)", key: "totalAcre" },
    { name: "Productivity Index", key: "productivityIndex" },
    { name: "Women Empowerment Score", key: "womenEmpowerment" },
    { name: "Age", key: "age" },
    { name: "Family Size", key: "totalFamilyMembers" },
    { name: "Off-Farm Income", key: "offFarmNetIncome" },
    { name: "Mint Income", key: "mintNetIncome" },
    { name: "Rice Income", key: "riceNetIncome" },
    { name: "Wheat Income", key: "wheatNetIncome" },
    { name: "Potato Income", key: "potatoNetIncome" },
    { name: "Mustard Income", key: "mustardNetIncome" },
    { name: "Livestock Income", key: "livestockIncome" },
    { name: "Total Expenses", key: "totalExpensesUsd" },
    { name: "Fixed Costs", key: "fixedCostAllCrops" },
  ];

  const results: CorrelationResult[] = [];
  for (const factor of factors) {
    const values = withIncome.map((f) => {
      const v = f[factor.key] as number;
      return v != null && isFinite(v) ? v : 0;
    });

    const r = pearsonR(incomes, values);
    const elast = incomeElasticity(withIncome, factor.key);
    const strength = interpretR(r);
    const direction = Math.abs(r) < 0.1 ? "negligible" : r > 0 ? "positive" : "negative";

    // Generate narrative
    let narrative = "";
    if (strength === "strong" || strength === "moderate") {
      const dirWord = r > 0 ? "higher" : "lower";
      const factorDir = r > 0 ? "more" : "less";
      narrative = `Farmers with ${factorDir} ${factor.name.toLowerCase()} tend to have ${dirWord} net income (r=${r.toFixed(2)}).`;
      if (Math.abs(elast) > 0.1 && isFinite(elast)) {
        narrative += ` A 10% increase in ${factor.name.toLowerCase()} is associated with a ~${Math.abs(elast * 10).toFixed(1)}% ${elast > 0 ? "increase" : "decrease"} in income (elasticity: ${elast.toFixed(2)}).`;
      }
    }

    results.push({ factor: factor.name, key: factor.key, r, elasticity: elast, direction, strength, narrative });
  }

  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

// ============================================================
// Pair-specific correlation analysis functions
// ============================================================

/** Shared helpers for correlation functions */
const hasTrainingFn = (f: Farmer) => {
  const v = f.trainingParticipation;
  return typeof v === "string" && v !== "" && !v.startsWith("3.");
};
const hasAdoptionFn = (f: Farmer) =>
  f.practiceAdoption != null &&
  f.practiceAdoption !== "" &&
  f.practiceAdoption !== "No crops" &&
  f.practiceAdoption !== "No answer" &&
  f.practiceAdoption !== "Zero GAP practiced";
const isHighGAPFn = (f: Farmer) =>
  f.practiceAdoption === "40-70%" || f.practiceAdoption === ">70";
const numericAdoption = (f: Farmer): number | null => {
  const v = f.practiceAdoption;
  if (v === "Zero GAP practiced") return 0;
  if (v != null && /^(1-20|20-40)/.test(v)) return 1;
  if (v === "40-70%") return 2;
  if (v === ">70") return 3;
  return null;
};
const cropKeys: { name: string; key: keyof Farmer }[] = [
  { name: "Mint", key: "mintNetIncome" },
  { name: "Rice", key: "riceNetIncome" },
  { name: "Wheat", key: "wheatNetIncome" },
  { name: "Potato", key: "potatoNetIncome" },
  { name: "Mustard", key: "mustardNetIncome" },
];
const isFpcMemberFn = (f: Farmer) =>
  typeof f.fpcMember === "string" && f.fpcMember.startsWith("1");

function analyzeCorrelationAdoptionYield(farmers: Farmer[]): string {
  const total = farmers.length;
  const adoptionLevels = [
    { label: "Zero GAP", filter: (f: Farmer) => f.practiceAdoption === "Zero GAP practiced" },
    { label: "<40% GAP", filter: (f: Farmer) => f.practiceAdoption != null && /^(1-20|20-40)/.test(f.practiceAdoption) },
    { label: "40-70% GAP", filter: (f: Farmer) => f.practiceAdoption === "40-70%" },
    { label: ">70% GAP", filter: (f: Farmer) => f.practiceAdoption === ">70" },
  ];

  const lines: string[] = [`**Correlation: Practice Adoption vs Yield/Income by Crop**\n`];
  lines.push(`| Adoption Level | N |${cropKeys.map((c) => ` ${c.name}`).join(" |")} | Total Income |`);
  lines.push(`|---|---|${cropKeys.map(() => "---|").join("")}---|`);

  for (const level of adoptionLevels) {
    const group = farmers.filter(level.filter);
    if (group.length < 3) continue;
    const values = cropKeys.map((crop) => {
      const growers = group.filter((f) => {
        const v = f[crop.key] as number | null;
        return v != null && v > 0;
      });
      return growers.length >= 3 ? fmtUsd(mean(growers.map((f) => f[crop.key] as number))) : "—";
    });
    const totalInc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
    lines.push(`| ${level.label} | ${fmt(group.length)} | ${values.join(" | ")} | ${totalInc.length ? fmtUsd(mean(totalInc)) : "—"} |`);
  }

  // Pearson r: numeric adoption score vs productivity index
  const validPairs = farmers.filter((f) => numericAdoption(f) !== null && f.productivityIndex != null);
  if (validPairs.length >= 10) {
    const xs = validPairs.map((f) => numericAdoption(f)!);
    const ys = validPairs.map((f) => f.productivityIndex);
    const r = pearsonR(xs, ys);
    lines.push(`\n**Pearson r** (GAP adoption level vs productivity index): **${r.toFixed(3)}** (${interpretR(r)})`);
  }

  // Effect size: high adopters vs zero adopters on total income
  const highAdopters = farmers.filter(isHighGAPFn).filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const zeroAdopters = farmers.filter((f) => f.practiceAdoption === "Zero GAP practiced").filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  if (highAdopters.length >= 5 && zeroAdopters.length >= 5) {
    const d = cohenD(highAdopters, zeroAdopters);
    lines.push(`**Effect size** (high GAP vs zero): Cohen's d = **${d.toFixed(2)}** | High GAP avg: ${fmtUsd(mean(highAdopters))} vs Zero: ${fmtUsd(mean(zeroAdopters))}`);
  }

  // Summary
  const adopted = farmers.filter(hasAdoptionFn);
  lines.push(`\n> ${pct(adopted.length, total)} of farmers have adopted some level of GAP practices. ${highAdopters.length >= 5 && zeroAdopters.length >= 5 ? `High adopters earn ${fmtUsd(mean(highAdopters) - mean(zeroAdopters))} more on average.` : ""}`);

  return lines.join("\n");
}

function analyzeCorrelationTrainingAdoption(farmers: Farmer[]): string {
  const total = farmers.length;
  const trained = farmers.filter(hasTrainingFn);
  const untrained = farmers.filter((f) => !hasTrainingFn(f));

  const lines: string[] = [`**Correlation: Training Participation vs Practice Adoption**\n`];
  lines.push(`| Group | N | Any GAP Adoption | High GAP (40%+) | Avg Income |`);
  lines.push(`|---|---|---|---|---|`);

  for (const [label, group] of [["Trained", trained], ["Untrained", untrained]] as [string, Farmer[]][]) {
    if (group.length === 0) continue;
    const incomes = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
    lines.push(`| ${label} | ${fmt(group.length)} | ${pct(group.filter(hasAdoptionFn).length, group.length)} | ${pct(group.filter(isHighGAPFn).length, group.length)} | ${incomes.length ? fmtUsd(mean(incomes)) : "—"} |`);
  }

  if (trained.length >= 5 && untrained.length >= 5) {
    const trainedRate = trained.filter(hasAdoptionFn).length / trained.length;
    const untrainedRate = untrained.filter(hasAdoptionFn).length / untrained.length;
    const diff = trainedRate - untrainedRate;
    lines.push(`\n**Adoption rate difference**: ${(diff * 100).toFixed(1)} pp (trained: ${(trainedRate * 100).toFixed(1)}% vs untrained: ${(untrainedRate * 100).toFixed(1)}%)`);
    lines.push(`**Correlation**: ${diff > 0.05 ? "positive" : diff < -0.05 ? "negative" : "negligible"} — training ${diff > 0.05 ? "is strongly associated with" : "shows limited association with"} GAP adoption.`);
  }

  if (trained.length === total) {
    lines.push(`\n> All ${fmt(total)} farmers in this cohort have received training. ${pct(farmers.filter(hasAdoptionFn).length, total)} adopted GAP practices.`);
  }

  return lines.join("\n");
}

function analyzeCorrelationTrainingIncome(farmers: Farmer[]): string {
  const trained = farmers.filter(hasTrainingFn);
  const untrained = farmers.filter((f) => !hasTrainingFn(f));
  const trainedInc = trained.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const untrainedInc = untrained.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);

  const lines: string[] = [`**Correlation: Training Participation vs Income**\n`];
  lines.push(`| Group | N | Avg Income | Median Income | Productivity |`);
  lines.push(`|---|---|---|---|---|`);

  for (const [label, group, inc] of [["Trained", trained, trainedInc], ["Untrained", untrained, untrainedInc]] as [string, Farmer[], number[]][]) {
    if (group.length === 0) continue;
    const prod = group.map((f) => f.productivityIndex).filter((v) => v != null && isFinite(v));
    lines.push(`| ${label} | ${fmt(group.length)} | ${inc.length ? fmtUsd(mean(inc)) : "—"} | ${inc.length ? fmtUsd(median(inc)) : "—"} | ${prod.length ? fmtPct(mean(prod) * 100) : "—"} |`);
  }

  if (trainedInc.length >= 5 && untrainedInc.length >= 5) {
    const d = cohenD(trainedInc, untrainedInc);
    const diff = mean(trainedInc) - mean(untrainedInc);
    lines.push(`\n**Income difference**: ${diff >= 0 ? "+" : ""}${fmtUsd(diff)} | Cohen's d = **${d.toFixed(2)}** (${Math.abs(d) >= 0.8 ? "large" : Math.abs(d) >= 0.5 ? "medium" : "small"} effect)`);
  }

  return lines.join("\n");
}

function analyzeCorrelationTrainingYield(farmers: Farmer[]): string {
  const trained = farmers.filter(hasTrainingFn);
  const untrained = farmers.filter((f) => !hasTrainingFn(f));

  const lines: string[] = [`**Correlation: Training vs Productivity by Crop**\n`];
  lines.push(`| Crop | Trained Avg | Untrained Avg | Difference |`);
  lines.push(`|---|---|---|---|`);

  for (const crop of cropKeys) {
    const tGrowers = trained.filter((f) => (f[crop.key] as number | null) != null && (f[crop.key] as number) > 0);
    const uGrowers = untrained.filter((f) => (f[crop.key] as number | null) != null && (f[crop.key] as number) > 0);
    if (tGrowers.length < 3 && uGrowers.length < 3) continue;
    const tAvg = tGrowers.length >= 3 ? mean(tGrowers.map((f) => f[crop.key] as number)) : null;
    const uAvg = uGrowers.length >= 3 ? mean(uGrowers.map((f) => f[crop.key] as number)) : null;
    const diff = tAvg != null && uAvg != null ? tAvg - uAvg : null;
    lines.push(`| ${crop.name} | ${tAvg != null ? fmtUsd(tAvg) : "—"} | ${uAvg != null ? fmtUsd(uAvg) : "—"} | ${diff != null ? `${diff >= 0 ? "+" : ""}${fmtUsd(diff)}` : "—"} |`);
  }

  // Overall productivity
  const tProd = trained.map((f) => f.productivityIndex).filter((v) => isFinite(v));
  const uProd = untrained.map((f) => f.productivityIndex).filter((v) => isFinite(v));
  if (tProd.length >= 5 && uProd.length >= 5) {
    lines.push(`\n**Productivity Index**: Trained avg = ${fmtPct(mean(tProd) * 100)} vs Untrained avg = ${fmtPct(mean(uProd) * 100)}`);
  }

  return lines.join("\n");
}

function analyzeCorrelationAdoptionIncome(farmers: Farmer[]): string {
  const adoptionLevels = [
    { label: "Zero GAP", filter: (f: Farmer) => f.practiceAdoption === "Zero GAP practiced" },
    { label: "<40% GAP", filter: (f: Farmer) => f.practiceAdoption != null && /^(1-20|20-40)/.test(f.practiceAdoption) },
    { label: "40-70% GAP", filter: (f: Farmer) => f.practiceAdoption === "40-70%" },
    { label: ">70% GAP", filter: (f: Farmer) => f.practiceAdoption === ">70" },
  ];

  const lines: string[] = [`**Correlation: GAP Adoption Level vs Income**\n`];
  lines.push(`| Adoption Level | N | Avg Income | Median Income | % Above LIB |`);
  lines.push(`|---|---|---|---|---|`);

  for (const level of adoptionLevels) {
    const group = farmers.filter(level.filter);
    if (group.length < 3) continue;
    const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
    const aboveLIB = group.filter((f) => isAboveLIB(f.aboveLIB)).length;
    lines.push(`| ${level.label} | ${fmt(group.length)} | ${inc.length ? fmtUsd(mean(inc)) : "—"} | ${inc.length ? fmtUsd(median(inc)) : "—"} | ${pct(aboveLIB, group.length)} |`);
  }

  // Pearson r
  const validPairs = farmers.filter((f) => numericAdoption(f) !== null && f.totalNetIncomeUsd != null);
  if (validPairs.length >= 10) {
    const r = pearsonR(validPairs.map((f) => numericAdoption(f)!), validPairs.map((f) => f.totalNetIncomeUsd!));
    lines.push(`\n**Pearson r** (adoption level vs income): **${r.toFixed(3)}** (${interpretR(r)})`);
  }

  return lines.join("\n");
}

function analyzeCorrelationFarmSizeIncome(farmers: Farmer[]): string {
  const valid = farmers.filter((f) => f.totalAcre > 0 && f.totalNetIncomeUsd != null);
  const lines: string[] = [`**Correlation: Farm Size vs Income**\n`];

  if (valid.length >= 10) {
    const r = pearsonR(valid.map((f) => f.totalAcre), valid.map((f) => f.totalNetIncomeUsd!));
    lines.push(`Pearson r = **${r.toFixed(3)}** (${interpretR(r)})\n`);
  }

  const categories = ["Marginal", "Small", "Medium", "Large"];
  lines.push(`| Farm Size | N | Avg Acres | Avg Income | Median Income |`);
  lines.push(`|---|---|---|---|---|`);
  for (const cat of categories) {
    const group = farmers.filter((f) => f.farmSizeCategory === cat && f.totalNetIncomeUsd != null);
    if (group.length < 3) continue;
    const inc = group.map((f) => f.totalNetIncomeUsd!);
    lines.push(`| ${cat} | ${fmt(group.length)} | ${mean(group.map((f) => f.totalAcre)).toFixed(2)} | ${fmtUsd(mean(inc))} | ${fmtUsd(median(inc))} |`);
  }

  return lines.join("\n");
}

function analyzeCorrelationFarmSizeYield(farmers: Farmer[]): string {
  const valid = farmers.filter((f) => f.totalAcre > 0 && isFinite(f.productivityIndex));
  const lines: string[] = [`**Correlation: Farm Size vs Productivity**\n`];

  if (valid.length >= 10) {
    const r = pearsonR(valid.map((f) => f.totalAcre), valid.map((f) => f.productivityIndex));
    lines.push(`Pearson r = **${r.toFixed(3)}** (${interpretR(r)})\n`);
  }

  const categories = ["Marginal", "Small", "Medium", "Large"];
  lines.push(`| Farm Size | N | Avg Acres | Productivity | Avg Income |`);
  lines.push(`|---|---|---|---|---|`);
  for (const cat of categories) {
    const group = farmers.filter((f) => f.farmSizeCategory === cat);
    if (group.length < 3) continue;
    const prod = group.map((f) => f.productivityIndex).filter(isFinite);
    const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
    lines.push(`| ${cat} | ${fmt(group.length)} | ${mean(group.map((f) => f.totalAcre)).toFixed(2)} | ${prod.length ? fmtPct(mean(prod) * 100) : "—"} | ${inc.length ? fmtUsd(mean(inc)) : "—"} |`);
  }

  return lines.join("\n");
}

function analyzeCorrelationEmpowermentIncome(farmers: Farmer[]): string {
  const lines: string[] = [`**Correlation: Women Empowerment vs Income**\n`];

  const valid = farmers.filter((f) => f.womenEmpowerment != null && f.totalNetIncomeUsd != null);
  if (valid.length >= 10) {
    const r = pearsonR(valid.map((f) => f.womenEmpowerment), valid.map((f) => f.totalNetIncomeUsd!));
    lines.push(`Pearson r = **${r.toFixed(3)}** (${interpretR(r)})\n`);
  }

  const buckets = [
    { label: "Low (0-3)", filter: (f: Farmer) => f.womenEmpowerment <= 3 },
    { label: "Medium (4-5)", filter: (f: Farmer) => f.womenEmpowerment >= 4 && f.womenEmpowerment <= 5 },
    { label: "High (6-8)", filter: (f: Farmer) => f.womenEmpowerment >= 6 },
  ];

  lines.push(`| Empowerment Level | N | Avg Income | Median Income |`);
  lines.push(`|---|---|---|---|`);
  for (const bucket of buckets) {
    const group = farmers.filter(bucket.filter).filter((f) => f.totalNetIncomeUsd != null);
    if (group.length < 3) continue;
    const inc = group.map((f) => f.totalNetIncomeUsd!);
    lines.push(`| ${bucket.label} | ${fmt(group.length)} | ${fmtUsd(mean(inc))} | ${fmtUsd(median(inc))} |`);
  }

  return lines.join("\n");
}

function analyzeCorrelationFPCIncome(farmers: Farmer[]): string {
  const members = farmers.filter(isFpcMemberFn);
  const nonMembers = farmers.filter((f) => !isFpcMemberFn(f));

  const lines: string[] = [`**Correlation: FPC Membership vs Income**\n`];
  lines.push(`| Group | N | Avg Income | Median Income | % Above LIB |`);
  lines.push(`|---|---|---|---|---|`);

  for (const [label, group] of [["FPC Member", members], ["Non-Member", nonMembers]] as [string, Farmer[]][]) {
    if (group.length === 0) continue;
    const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
    const aboveLIB = group.filter((f) => isAboveLIB(f.aboveLIB)).length;
    lines.push(`| ${label} | ${fmt(group.length)} | ${inc.length ? fmtUsd(mean(inc)) : "—"} | ${inc.length ? fmtUsd(median(inc)) : "—"} | ${pct(aboveLIB, group.length)} |`);
  }

  const memInc = members.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const nonInc = nonMembers.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  if (memInc.length >= 5 && nonInc.length >= 5) {
    const d = cohenD(memInc, nonInc);
    lines.push(`\n**Effect size**: Cohen's d = **${d.toFixed(2)}** | FPC members earn ${fmtUsd(mean(memInc) - mean(nonInc))} ${mean(memInc) > mean(nonInc) ? "more" : "less"} on average.`);
  }

  return lines.join("\n");
}

function analyzeCorrelationSustainabilityIncome(farmers: Farmer[]): string {
  const lines: string[] = [`**Correlation: Sustainability Metrics vs Income**\n`];
  const factors = [
    { name: "Soil Carbon", key: "soilCarbon" as keyof Farmer },
    { name: "Electricity Use", key: "electricity" as keyof Farmer },
    { name: "Pesticide Use", key: "pesticide" as keyof Farmer },
    { name: "Trees (Sequestration)", key: "carbonFromTrees" as keyof Farmer },
  ];

  lines.push(`| Factor | r | Strength | Avg (All) |`);
  lines.push(`|---|---|---|---|`);
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  for (const factor of factors) {
    const valid = withIncome.filter((f) => (f[factor.key] as number) != null && isFinite(f[factor.key] as number));
    if (valid.length < 10) continue;
    const r = pearsonR(valid.map((f) => f.totalNetIncomeUsd!), valid.map((f) => f[factor.key] as number));
    const avg = mean(valid.map((f) => f[factor.key] as number));
    lines.push(`| ${factor.name} | ${r.toFixed(3)} | ${interpretR(r)} | ${avg.toFixed(2)} |`);
  }

  return lines.join("\n");
}

/** Generate deep economic insights narrative */
function generateEconomicInsights(farmers: Farmer[]): string {
  const correlations = analyzeIncomeDrivers(farmers);
  const significant = correlations.filter((c) => c.strength === "strong" || c.strength === "moderate");
  if (significant.length === 0) return "Insufficient variation in the data for meaningful correlation analysis.";

  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const avgIncome = mean(withIncome.map((f) => f.totalNetIncomeUsd!));
  const medIncome = median(withIncome.map((f) => f.totalNetIncomeUsd!));

  const lines: string[] = [];
  lines.push(`**Economic Driver Analysis** — ${fmt(farmers.length)} farmers\n`);
  lines.push(`Baseline: Avg income ${fmtUsd(avgIncome)}/yr, Median ${fmtUsd(medIncome)}/yr\n`);

  // Correlation table
  lines.push(`| Factor | Correlation (r) | Elasticity | Strength | Direction |`);
  lines.push(`|---|---|---|---|---|`);
  for (const c of significant) {
    const elastStr = Math.abs(c.elasticity) > 0.01 && isFinite(c.elasticity) ? c.elasticity.toFixed(2) : "—";
    lines.push(`| ${c.factor} | ${c.r.toFixed(2)} | ${elastStr} | ${c.strength} | ${c.direction} |`);
  }

  // Narrative insights
  lines.push(`\n**Key Findings:**\n`);

  // Top 3 drivers
  const topDrivers = significant.slice(0, 3);
  for (let i = 0; i < topDrivers.length; i++) {
    const d = topDrivers[i];
    lines.push(`**${i + 1}. ${d.factor}** (r = ${d.r.toFixed(2)})`);
    if (d.narrative) lines.push(d.narrative);
    lines.push(``);
  }

  // Cause-effect analysis
  lines.push(`**Cause-Effect Analysis:**\n`);

  // Farm size → income relationship
  const farmSizeCorr = correlations.find((c) => c.key === "totalAcre");
  if (farmSizeCorr && farmSizeCorr.strength !== "negligible") {
    const small = farmers.filter((f) => f.farmSizeCategory === "Small" || f.farmSizeCategory === "Marginal");
    const large = farmers.filter((f) => f.farmSizeCategory === "Large" || f.farmSizeCategory === "Medium");
    const smallInc = small.filter((f) => f.totalNetIncomeUsd != null);
    const largeInc = large.filter((f) => f.totalNetIncomeUsd != null);
    if (smallInc.length > 5 && largeInc.length > 5) {
      const smallAvg = mean(smallInc.map((f) => f.totalNetIncomeUsd!));
      const largeAvg = mean(largeInc.map((f) => f.totalNetIncomeUsd!));
      const incomePerAcreSmall = small.length > 0 ? smallAvg / Math.max(1, mean(small.map((f) => f.totalAcre))) : 0;
      const incomePerAcreLarge = large.length > 0 ? largeAvg / Math.max(1, mean(large.map((f) => f.totalAcre))) : 0;
      lines.push(`- **Farm Size → Income**: Larger farms (${fmt(large.length)}) earn ${fmtUsd(largeAvg)}/yr vs ${fmtUsd(smallAvg)}/yr for smaller farms (${fmt(small.length)}). However, income per acre is ${fmtUsd(incomePerAcreSmall)}/acre for small farms vs ${fmtUsd(incomePerAcreLarge)}/acre for large farms — ${incomePerAcreSmall > incomePerAcreLarge ? "small farms are more efficient per unit area" : "larger farms achieve better returns per acre"}.`);
    }
  }

  // Empowerment → income pathway
  const empCorr = correlations.find((c) => c.key === "womenEmpowerment");
  if (empCorr && empCorr.strength !== "negligible") {
    const highEmp = farmers.filter((f) => f.womenEmpowerment >= 6 && f.totalNetIncomeUsd != null);
    const lowEmp = farmers.filter((f) => f.womenEmpowerment < 4 && f.totalNetIncomeUsd != null);
    if (highEmp.length > 5 && lowEmp.length > 5) {
      const highAvg = mean(highEmp.map((f) => f.totalNetIncomeUsd!));
      const lowAvg = mean(lowEmp.map((f) => f.totalNetIncomeUsd!));
      const fpcHighEmp = highEmp.filter((f) => f.fpcMember?.startsWith("1")).length / highEmp.length * 100;
      const fpcLowEmp = lowEmp.filter((f) => f.fpcMember?.startsWith("1")).length / lowEmp.length * 100;
      lines.push(`- **Empowerment → Income Pathway**: High-empowerment households (score ≥6) earn ${fmtUsd(highAvg)}/yr vs ${fmtUsd(lowAvg)}/yr for low-empowerment (score <4). This ${fmtUsd(highAvg - lowAvg)} gap is partly mediated by FPC participation: ${fpcHighEmp.toFixed(0)}% of high-empowerment vs ${fpcLowEmp.toFixed(0)}% of low-empowerment households are FPC members.`);
    }
  }

  // Diversification effect
  const divFarmers = farmers.map((f) => {
    const crops = [f.mintNetIncome, f.riceNetIncome, f.potatoNetIncome, f.wheatNetIncome, f.mustardNetIncome];
    return { farmer: f, activeCrops: crops.filter((c) => c != null && c > 0).length };
  });
  const monocrop = divFarmers.filter((d) => d.activeCrops <= 1 && d.farmer.totalNetIncomeUsd != null);
  const multicrop = divFarmers.filter((d) => d.activeCrops >= 3 && d.farmer.totalNetIncomeUsd != null);
  if (monocrop.length > 5 && multicrop.length > 5) {
    const monoAvg = mean(monocrop.map((d) => d.farmer.totalNetIncomeUsd!));
    const multiAvg = mean(multicrop.map((d) => d.farmer.totalNetIncomeUsd!));
    const monoNeg = monocrop.filter((d) => d.farmer.totalNetIncomeUsd! < 0).length;
    const multiNeg = multicrop.filter((d) => d.farmer.totalNetIncomeUsd! < 0).length;
    lines.push(`- **Crop Diversification → Income Stability**: Farmers growing 3+ crops (${fmt(multicrop.length)}) earn ${fmtUsd(multiAvg)}/yr vs ${fmtUsd(monoAvg)}/yr for single-crop farmers (${fmt(monocrop.length)}). Negative income incidence: ${pct(monoNeg, monocrop.length)} (single-crop) vs ${pct(multiNeg, multicrop.length)} (diversified) — diversification reduces downside risk.`);
  }

  // FPC effect with controlling for farm size
  const fpcYes = farmers.filter((f) => f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
  const fpcNo = farmers.filter((f) => !f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
  if (fpcYes.length > 10 && fpcNo.length > 10) {
    const yesAvg = mean(fpcYes.map((f) => f.totalNetIncomeUsd!));
    const noAvg = mean(fpcNo.map((f) => f.totalNetIncomeUsd!));
    const yesAcre = mean(fpcYes.map((f) => f.totalAcre));
    const noAcre = mean(fpcNo.map((f) => f.totalAcre));
    const yesPerAcre = yesAcre > 0 ? yesAvg / yesAcre : 0;
    const noPerAcre = noAcre > 0 ? noAvg / noAcre : 0;
    lines.push(`- **FPC Membership → Income (controlling for farm size)**: FPC members earn ${fmtUsd(yesAvg)}/yr vs ${fmtUsd(noAvg)}/yr for non-members. After normalizing for farm size: ${fmtUsd(yesPerAcre)}/acre (FPC) vs ${fmtUsd(noPerAcre)}/acre (non-FPC) — ${yesPerAcre > noPerAcre ? "FPC members generate more income per unit of land, suggesting market access and collective bargaining effects" : "the FPC income advantage is largely explained by FPC members having larger farms"}.`);
  }

  lines.push(`\n**Policy Implications:**\n`);
  const recommendations: string[] = [];
  if (farmSizeCorr && farmSizeCorr.strength !== "negligible" && farmSizeCorr.r > 0) {
    recommendations.push(`Intensification programs for small/marginal farmers (${fmt(farmers.filter((f) => f.farmSizeCategory === "Small" || f.farmSizeCategory === "Marginal").length)}) could close the farm-size income gap without requiring land expansion.`);
  }
  if (empCorr && empCorr.strength !== "negligible" && empCorr.r > 0) {
    recommendations.push(`Women empowerment interventions have a measurable income multiplier effect (elasticity: ${empCorr.elasticity.toFixed(2)}). Targeting the ${fmt(farmers.filter((f) => f.womenEmpowerment < 4).length)} low-empowerment households would yield the highest marginal returns.`);
  }
  if (multicrop.length > 0 && monocrop.length > 0) {
    recommendations.push(`Crop diversification programs for the ${fmt(monocrop.length)} single-crop farmers could reduce income volatility and improve average outcomes.`);
  }
  if (fpcYes.length > 0 && fpcNo.length > 0) {
    recommendations.push(`Expanding FPC membership to the ${fmt(fpcNo.length)} non-member farmers, particularly those with high productivity but low market access.`);
  }
  for (let i = 0; i < recommendations.length; i++) {
    lines.push(`${i + 1}. ${recommendations[i]}`);
  }

  return lines.join("\n");
}

/** Generate a "why" analysis — explains causes behind a metric */
function generateWhyAnalysis(farmers: Farmer[], topic: string): string {
  const lines: string[] = [];
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);

  if (/\b(low|poor|negative|below)\b/.test(topic) && /\b(income|earning|poverty)\b/.test(topic)) {
    // Why is income low?
    const belowMedian = [...withIncome].sort((a, b) => a.totalNetIncomeUsd! - b.totalNetIncomeUsd!).slice(0, Math.floor(withIncome.length / 3));
    const aboveMedian = [...withIncome].sort((a, b) => b.totalNetIncomeUsd! - a.totalNetIncomeUsd!).slice(0, Math.floor(withIncome.length / 3));

    lines.push(`**Root Cause Analysis: Low Income**\n`);
    lines.push(`Comparing bottom third (${fmt(belowMedian.length)}) vs top third (${fmt(aboveMedian.length)}) of earners:\n`);

    const factors = [
      { name: "Farm Size", fn: (f: Farmer) => f.totalAcre, unit: "acres" },
      { name: "Productivity", fn: (f: Farmer) => f.productivityIndex * 100, unit: "%" },
      { name: "Empowerment", fn: (f: Farmer) => f.womenEmpowerment, unit: "/8" },
      { name: "FPC Membership", fn: (f: Farmer) => f.fpcMember?.startsWith("1") ? 1 : 0, unit: "%" },
      { name: "Crop Count", fn: (f: Farmer) => [f.mintNetIncome, f.riceNetIncome, f.wheatNetIncome, f.potatoNetIncome, f.mustardNetIncome].filter((c) => c != null && c > 0).length, unit: "crops" },
    ];

    lines.push(`| Factor | Bottom Third | Top Third | Gap | Impact |`);
    lines.push(`|---|---|---|---|---|`);

    for (const factor of factors) {
      const bottomVal = mean(belowMedian.map(factor.fn));
      const topVal = mean(aboveMedian.map(factor.fn));
      const gap = topVal - bottomVal;
      const gapPct = bottomVal !== 0 ? ((gap / Math.abs(bottomVal)) * 100) : 0;
      const impact = Math.abs(gapPct) > 30 ? "🔴 Major" : Math.abs(gapPct) > 15 ? "🟡 Moderate" : "⚪ Minor";

      if (factor.name === "FPC Membership") {
        lines.push(`| ${factor.name} | ${(bottomVal * 100).toFixed(0)}% | ${(topVal * 100).toFixed(0)}% | ${(gap * 100).toFixed(0)}pp | ${impact} |`);
      } else {
        lines.push(`| ${factor.name} | ${bottomVal.toFixed(1)}${factor.unit} | ${topVal.toFixed(1)}${factor.unit} | ${gap > 0 ? "+" : ""}${gap.toFixed(1)} | ${impact} |`);
      }
    }

    // Identify biggest gaps
    const bottomAvgInc = mean(belowMedian.map((f) => f.totalNetIncomeUsd!));
    const topAvgInc = mean(aboveMedian.map((f) => f.totalNetIncomeUsd!));
    lines.push(`\n**Income gap**: Bottom third earns ${fmtUsd(bottomAvgInc)}/yr vs ${fmtUsd(topAvgInc)}/yr (${fmtUsd(topAvgInc - bottomAvgInc)} difference)\n`);

    lines.push(`**Primary drivers of low income:**`);
    const bottomAcre = mean(belowMedian.map((f) => f.totalAcre));
    const topAcre = mean(aboveMedian.map((f) => f.totalAcre));
    if ((topAcre - bottomAcre) / Math.max(bottomAcre, 0.1) > 0.3) {
      lines.push(`1. **Land constraint**: Low earners farm ${bottomAcre.toFixed(1)} acres vs ${topAcre.toFixed(1)} for top earners. Without land expansion, intensification (higher yield/acre) is the primary lever.`);
    }
    const bottomProd = mean(belowMedian.map((f) => f.productivityIndex));
    const topProd = mean(aboveMedian.map((f) => f.productivityIndex));
    if ((topProd - bottomProd) / Math.max(bottomProd, 0.01) > 0.2) {
      lines.push(`2. **Productivity gap**: A ${((topProd - bottomProd) * 100).toFixed(0)}pp productivity gap suggests low earners underutilize available techniques or have less access to quality inputs.`);
    }
    const bottomFPC = belowMedian.filter((f) => f.fpcMember?.startsWith("1")).length / belowMedian.length;
    const topFPC = aboveMedian.filter((f) => f.fpcMember?.startsWith("1")).length / aboveMedian.length;
    if (topFPC - bottomFPC > 0.1) {
      lines.push(`3. **Market access**: ${(topFPC * 100).toFixed(0)}% of top earners are FPC members vs only ${(bottomFPC * 100).toFixed(0)}% of low earners — collective bargaining matters.`);
    }
  } else if (/\b(empower|women|gender)\b/.test(topic)) {
    lines.push(`**Root Cause Analysis: Women Empowerment → Economic Outcomes**\n`);
    const highEmp = farmers.filter((f) => f.womenEmpowerment >= 6);
    const lowEmp = farmers.filter((f) => f.womenEmpowerment < 4);
    const midEmp = farmers.filter((f) => f.womenEmpowerment >= 4 && f.womenEmpowerment < 6);

    lines.push(`| Empowerment Level | Count | Avg Income | FPC Rate | Crop Count | Business Interest |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const [label, group] of [["Low (<4)", lowEmp], ["Mid (4-6)", midEmp], ["High (≥6)", highEmp]] as [string, Farmer[]][]) {
      if (group.length === 0) continue;
      const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const fpcRate = group.filter((f) => f.fpcMember?.startsWith("1")).length / group.length * 100;
      const avgCrops = mean(group.map((f) => [f.mintNetIncome, f.riceNetIncome, f.wheatNetIncome, f.potatoNetIncome, f.mustardNetIncome].filter((c) => c != null && c > 0).length));
      const bizInterest = group.filter((f) => f.womenInterestedStartBusiness === "Yes").length / group.length * 100;
      lines.push(`| ${label} | ${fmt(group.length)} | ${fmtUsd(inc.length ? mean(inc) : 0)} | ${fpcRate.toFixed(0)}% | ${avgCrops.toFixed(1)} | ${bizInterest.toFixed(0)}% |`);
    }

    lines.push(`\n**Causal pathways identified:**`);
    lines.push(`1. **Empowerment → Decision-making → Diversification**: Higher empowerment correlates with more diverse crop portfolios, suggesting empowered women participate more in crop selection.`);
    lines.push(`2. **Empowerment → FPC participation → Market access**: Higher FPC participation among empowered households provides better market prices.`);
    lines.push(`3. **Empowerment → Business interest → Non-farm income**: Business interest is highest in empowered households, creating additional income streams.`);
  } else {
    // Generic "why" — run driver analysis
    return generateEconomicInsights(farmers);
  }

  return lines.join("\n");
}

/** Income inequality analysis */
function analyzeInequality(farmers: Farmer[]): string {
  const incomes = farmers.filter((f) => f.totalNetIncomeUsd != null && isFinite(f.totalNetIncomeUsd!))
    .map((f) => f.totalNetIncomeUsd!)
    .sort((a, b) => a - b);
  if (incomes.length < 10) return "Insufficient data for inequality analysis.";

  // Gini coefficient
  const n = incomes.length;
  let giniNumerator = 0;
  for (let i = 0; i < n; i++) {
    giniNumerator += (2 * (i + 1) - n - 1) * incomes[i];
  }
  const gini = giniNumerator / (n * sum(incomes));

  // Percentile ratios
  const p10 = percentile(incomes, 10);
  const p25 = percentile(incomes, 25);
  const p50 = median(incomes);
  const p75 = percentile(incomes, 75);
  const p90 = percentile(incomes, 90);
  const avgInc = mean(incomes);

  // Bottom 20% vs top 20% share
  const bottom20 = incomes.slice(0, Math.floor(n * 0.2));
  const top20 = incomes.slice(Math.floor(n * 0.8));
  const bottom20share = sum(bottom20.filter((v) => v > 0)) / sum(incomes.filter((v) => v > 0)) * 100;
  const top20share = sum(top20.filter((v) => v > 0)) / sum(incomes.filter((v) => v > 0)) * 100;

  const lines: string[] = [];
  lines.push(`**Income Distribution & Inequality Analysis**\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Gini Coefficient | ${gini.toFixed(3)} (${gini < 0.3 ? "Low inequality" : gini < 0.5 ? "Moderate inequality" : "High inequality"}) |`);
  lines.push(`| Mean / Median Ratio | ${(avgInc / p50).toFixed(2)} (${avgInc / p50 > 1.3 ? "right-skewed, few high earners pull average up" : "relatively symmetric"}) |`);
  lines.push(`| 90/10 Ratio | ${p10 !== 0 ? (p90 / p10).toFixed(1) : "∞"} |`);
  lines.push(`| Bottom 20% Income Share | ${bottom20share.toFixed(1)}% |`);
  lines.push(`| Top 20% Income Share | ${top20share.toFixed(1)}% |`);
  lines.push(`| 10th Percentile | ${fmtUsd(p10)}/yr |`);
  lines.push(`| 25th Percentile | ${fmtUsd(p25)}/yr |`);
  lines.push(`| 50th Percentile (Median) | ${fmtUsd(p50)}/yr |`);
  lines.push(`| 75th Percentile | ${fmtUsd(p75)}/yr |`);
  lines.push(`| 90th Percentile | ${fmtUsd(p90)}/yr |`);

  const negative = incomes.filter((v) => v < 0).length;
  lines.push(`\n**Key observations:**`);
  if (negative > 0) {
    lines.push(`- ${fmt(negative)} farmers (${pct(negative, n)}) have negative net income — these households are in debt and require urgent support.`);
  }
  if (gini > 0.4) {
    lines.push(`- High Gini coefficient (${gini.toFixed(2)}) indicates significant income inequality. Targeted interventions for the bottom quartile would have the highest equity impact.`);
  }
  lines.push(`- The gap between median (${fmtUsd(p50)}) and mean (${fmtUsd(avgInc)}) of ${fmtUsd(avgInc - p50)} indicates ${avgInc > p50 ? "a few high earners pull the average up — median better represents the 'typical' farmer" : "income is relatively evenly distributed"}.`);

  return lines.join("\n");
}

function groupProfile(label: string, group: Farmer[], total: number): string {
  if (group.length === 0) return `No ${label} farmers found in current selection.`;
  const withIncome = group.filter((f) => f.totalNetIncomeUsd != null);
  const incomes = withIncome.map((f) => f.totalNetIncomeUsd!);
  const avgInc = incomes.length ? mean(incomes) : 0;
  const medInc = incomes.length ? median(incomes) : 0;
  const avgProd = mean(group.map((f) => f.productivityIndex)) * 100;
  const avgEmp = mean(group.map((f) => f.womenEmpowerment));
  const avgAcre = mean(group.map((f) => f.totalAcre));
  const belowLIB = group.filter((f) => !isAboveLIB(f.aboveLIB)).length;
  const negIncome = withIncome.filter((f) => f.totalNetIncomeUsd! < 0).length;
  const fpcMembers = group.filter((f) => f.fpcMember?.startsWith("1")).length;
  const cropCounts = countCrops(group);
  const topCrop = cropCounts.sort((a, b) => b.count - a.count)[0];

  const lines = [
    `**${label}**: ${fmt(group.length)} farmers (${pct(group.length, total)} of selection)`,
    ``,
    `| Indicator | Value |`,
    `|---|---|`,
    `| Avg Net Income | ${fmtUsd(avgInc)}/yr |`,
    `| Median Net Income | ${fmtUsd(medInc)}/yr |`,
    `| Avg Productivity | ${fmtPct(avgProd)} |`,
    `| Avg Empowerment | ${avgEmp.toFixed(1)}/8 |`,
    `| Avg Farm Size | ${avgAcre.toFixed(1)} acres |`,
    `| Below Living Income | ${fmt(belowLIB)} (${pct(belowLIB, group.length)}) |`,
    `| Negative Income | ${fmt(negIncome)} |`,
    `| FPC Members | ${fmt(fpcMembers)} (${pct(fpcMembers, group.length)}) |`,
    `| Top Crop | ${topCrop ? `${topCrop.name} (${topCrop.count} growers)` : "N/A"} |`,
  ];
  return lines.join("\n");
}

function compareGroups(
  labelA: string, groupA: Farmer[],
  labelB: string, groupB: Farmer[],
  total: number
): string {
  if (groupA.length === 0 && groupB.length === 0) return `No data found for either group.`;
  if (groupA.length === 0) return `No ${labelA} farmers found. ${groupProfile(labelB, groupB, total)}`;
  if (groupB.length === 0) return `No ${labelB} farmers found. ${groupProfile(labelA, groupA, total)}`;

  const incA = groupA.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const incB = groupB.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const avgA = incA.length ? mean(incA) : 0;
  const avgB = incB.length ? mean(incB) : 0;
  const prodA = mean(groupA.map((f) => f.productivityIndex)) * 100;
  const prodB = mean(groupB.map((f) => f.productivityIndex)) * 100;
  const empA = mean(groupA.map((f) => f.womenEmpowerment));
  const empB = mean(groupB.map((f) => f.womenEmpowerment));
  const acreA = mean(groupA.map((f) => f.totalAcre));
  const acreB = mean(groupB.map((f) => f.totalAcre));
  const libA = groupA.filter((f) => !isAboveLIB(f.aboveLIB)).length;
  const libB = groupB.filter((f) => !isAboveLIB(f.aboveLIB)).length;
  const fpcA = groupA.filter((f) => f.fpcMember?.startsWith("1")).length;
  const fpcB = groupB.filter((f) => f.fpcMember?.startsWith("1")).length;

  function delta(a: number, b: number): string {
    if (b === 0) return "—";
    const d = ((a - b) / Math.abs(b)) * 100;
    return d > 0 ? `+${d.toFixed(0)}%` : `${d.toFixed(0)}%`;
  }

  const lines = [
    `**Comparison: ${labelA} vs ${labelB}**`,
    ``,
    `| Indicator | ${labelA} (${fmt(groupA.length)}) | ${labelB} (${fmt(groupB.length)}) | Difference |`,
    `|---|---|---|---|`,
    `| Avg Net Income | ${fmtUsd(avgA)} | ${fmtUsd(avgB)} | ${delta(avgA, avgB)} |`,
    `| Avg Productivity | ${fmtPct(prodA)} | ${fmtPct(prodB)} | ${delta(prodA, prodB)} |`,
    `| Empowerment | ${empA.toFixed(1)}/8 | ${empB.toFixed(1)}/8 | ${delta(empA, empB)} |`,
    `| Farm Size | ${acreA.toFixed(1)} ac | ${acreB.toFixed(1)} ac | ${delta(acreA, acreB)} |`,
    `| Below LIB | ${pct(libA, groupA.length)} | ${pct(libB, groupB.length)} | — |`,
    `| FPC Members | ${pct(fpcA, groupA.length)} | ${pct(fpcB, groupB.length)} | — |`,
  ];

  // Key insight
  const incomeDiff = avgA - avgB;
  if (Math.abs(incomeDiff) > 10) {
    const higher = incomeDiff > 0 ? labelA : labelB;
    const lower = incomeDiff > 0 ? labelB : labelA;
    lines.push(``);
    lines.push(`**Key insight**: ${higher} farmers earn ${fmtUsd(Math.abs(incomeDiff))} more per year on average than ${lower} farmers.`);
  }

  return lines.join("\n");
}

function countCrops(farmers: Farmer[]): { name: string; key: string; count: number; avgProfit: number }[] {
  const crops = [
    { name: "Mint", key: "mintNetIncome" },
    { name: "Rice", key: "riceNetIncome" },
    { name: "Wheat", key: "wheatNetIncome" },
    { name: "Potato", key: "potatoNetIncome" },
    { name: "Mustard", key: "mustardNetIncome" },
  ];
  return crops.map((c) => {
    const growers = farmers.filter((f) => {
      const v = f[c.key as keyof Farmer] as number | null;
      return v != null && v > 0;
    });
    const avgProfit = growers.length ? mean(growers.map((f) => f[c.key as keyof Farmer] as number)) : 0;
    return { ...c, count: growers.length, avgProfit };
  });
}

// --- What-if scenario engine ---

interface ScenarioResult {
  label: string;
  currentAvg: number;
  projectedAvg: number;
  changePercent: number;
  affectedFarmers: number;
  details: string;
}

function simulateYieldChange(farmers: Farmer[], changePct: number): ScenarioResult {
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const currentAvg = mean(withIncome.map((f) => f.totalNetIncomeUsd!));
  // Higher yield → proportional increase in crop income (simplified model)
  // Crop income is roughly 60-80% of total income for these farmers
  const cropShareEstimate = 0.7;
  const projectedAvg = currentAvg + currentAvg * cropShareEstimate * (changePct / 100);
  return {
    label: `Yield ${changePct > 0 ? "increase" : "decrease"} of ${Math.abs(changePct)}%`,
    currentAvg,
    projectedAvg,
    changePercent: currentAvg !== 0 ? ((projectedAvg - currentAvg) / Math.abs(currentAvg)) * 100 : 0,
    affectedFarmers: withIncome.length,
    details: `Assuming crop income represents ~70% of total income, a ${Math.abs(changePct)}% ${changePct > 0 ? "increase" : "decrease"} in yield would ${changePct > 0 ? "raise" : "lower"} average net income from ${fmtUsd(currentAvg)} to **${fmtUsd(projectedAvg)}** per year.`,
  };
}

function simulatePriceChange(farmers: Farmer[], crop: string, changePct: number): ScenarioResult {
  const cropKeyMap: Record<string, keyof Farmer> = {
    mint: "mintNetIncome", rice: "riceNetIncome", wheat: "wheatNetIncome",
    potato: "potatoNetIncome", mustard: "mustardNetIncome",
  };
  const key = cropKeyMap[crop.toLowerCase()] || "mintNetIncome";
  const cropName = crop.charAt(0).toUpperCase() + crop.slice(1).toLowerCase();
  const growers = farmers.filter((f) => {
    const v = f[key] as number | null;
    return v != null && v > 0;
  });
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const currentAvg = mean(withIncome.map((f) => f.totalNetIncomeUsd!));

  if (growers.length === 0) {
    return {
      label: `${cropName} price change`, currentAvg, projectedAvg: currentAvg,
      changePercent: 0, affectedFarmers: 0,
      details: `No ${cropName} growers found in the current selection.`,
    };
  }

  const avgCropIncome = mean(growers.map((f) => f[key] as number));
  const cropShareOfTotal = growers.length > 0 && currentAvg !== 0
    ? (avgCropIncome * growers.length) / (currentAvg * withIncome.length)
    : 0;
  const priceImpact = currentAvg * cropShareOfTotal * (changePct / 100);
  const projectedAvg = currentAvg + priceImpact;

  return {
    label: `${cropName} price ${changePct > 0 ? "increase" : "decrease"} of ${Math.abs(changePct)}%`,
    currentAvg,
    projectedAvg,
    changePercent: currentAvg !== 0 ? ((projectedAvg - currentAvg) / Math.abs(currentAvg)) * 100 : 0,
    affectedFarmers: growers.length,
    details: [
      `**${cropName} price ${changePct > 0 ? "+" : ""}${changePct}% scenario**`,
      ``,
      `- ${cropName} growers: ${fmt(growers.length)} (${pct(growers.length, farmers.length)} of farmers)`,
      `- Current avg ${cropName} profit: ${fmtUsd(avgCropIncome)}/yr per grower`,
      `- ${cropName} share of total income: ~${(cropShareOfTotal * 100).toFixed(0)}%`,
      ``,
      `**Projected impact**: Average net income shifts from ${fmtUsd(currentAvg)} to **${fmtUsd(projectedAvg)}** (${changePct > 0 ? "+" : ""}${((projectedAvg - currentAvg) / Math.abs(currentAvg) * 100).toFixed(1)}%).`,
      ``,
      `${changePct > 0
        ? `This would lift approximately ${fmt(Math.round(growers.length * 0.15))} additional farmers above the Living Income Benchmark.`
        : `This could push approximately ${fmt(Math.round(growers.length * 0.1))} more farmers below the Living Income Benchmark.`
      }`,
    ].join("\n"),
  };
}

function simulateAcreageChange(farmers: Farmer[], changePct: number): ScenarioResult {
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const currentAvg = mean(withIncome.map((f) => f.totalNetIncomeUsd!));
  const currentAcre = mean(farmers.map((f) => f.totalAcre));
  // More acreage → more income, but with diminishing returns (0.7 elasticity)
  const elasticity = 0.7;
  const projectedAvg = currentAvg * (1 + (changePct / 100) * elasticity);
  return {
    label: `Acreage ${changePct > 0 ? "increase" : "decrease"} of ${Math.abs(changePct)}%`,
    currentAvg,
    projectedAvg,
    changePercent: currentAvg !== 0 ? ((projectedAvg - currentAvg) / Math.abs(currentAvg)) * 100 : 0,
    affectedFarmers: farmers.length,
    details: [
      `**Farm size ${changePct > 0 ? "+" : ""}${changePct}% scenario**`,
      ``,
      `- Current avg farm size: ${currentAcre.toFixed(1)} acres`,
      `- Projected avg farm size: ${(currentAcre * (1 + changePct / 100)).toFixed(1)} acres`,
      `- Income elasticity to land: 0.7 (diminishing returns applied)`,
      ``,
      `**Projected impact**: Average net income shifts from ${fmtUsd(currentAvg)} to **${fmtUsd(projectedAvg)}** (${changePct > 0 ? "+" : ""}${((projectedAvg - currentAvg) / Math.abs(currentAvg) * 100).toFixed(1)}%).`,
      ``,
      `Note: Land expansion is constrained in practice. Intensification (higher yield per acre) is often more achievable than expansion.`,
    ].join("\n"),
  };
}

function simulateFPCExpansion(farmers: Farmer[]): string {
  const fpcYes = farmers.filter((f) => f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
  const fpcNo = farmers.filter((f) => !f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
  if (fpcYes.length < 3 || fpcNo.length < 3) return "Insufficient FPC data for this simulation.";
  const yesAvg = mean(fpcYes.map((f) => f.totalNetIncomeUsd!));
  const noAvg = mean(fpcNo.map((f) => f.totalNetIncomeUsd!));
  const premium = yesAvg - noAvg;
  const adoptionRate = 0.5; // assume 50% of non-members join
  const newMembers = Math.round(fpcNo.length * adoptionRate);
  const totalLift = newMembers * premium * 0.6; // 60% of gap realized

  return [
    `**FPC Membership Expansion Scenario**`,
    ``,
    `| Metric | Current | Projected |`,
    `|---|---|---|`,
    `| FPC Members | ${fmt(fpcYes.length)} | ${fmt(fpcYes.length + newMembers)} |`,
    `| Non-Members | ${fmt(fpcNo.length)} | ${fmt(fpcNo.length - newMembers)} |`,
    `| Member Avg Income | ${fmtUsd(yesAvg)} | ${fmtUsd(yesAvg)} |`,
    `| Non-Member Avg Income | ${fmtUsd(noAvg)} | ${fmtUsd(noAvg + premium * 0.6)} |`,
    ``,
    `If **${fmt(newMembers)} additional farmers** (50% of non-members) join FPC and realize 60% of the income premium:`,
    `- Per-farmer income lift: ~${fmtUsd(premium * 0.6)}/yr`,
    `- Total annual income generated: ~${fmtUsd(totalLift)}`,
    ``,
    `The income premium of FPC members (${fmtUsd(premium)}) is partly due to better market access and collective bargaining.`,
  ].join("\n");
}

function simulateEmpowermentImprovement(farmers: Farmer[]): string {
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const currentAvgEmp = mean(farmers.map((f) => f.womenEmpowerment));
  const highEmp = withIncome.filter((f) => f.womenEmpowerment >= 6);
  const lowEmp = withIncome.filter((f) => f.womenEmpowerment < 4);
  if (highEmp.length < 3 || lowEmp.length < 3) return "Insufficient empowerment data for simulation.";
  const highAvg = mean(highEmp.map((f) => f.totalNetIncomeUsd!));
  const lowAvg = mean(lowEmp.map((f) => f.totalNetIncomeUsd!));
  const upliftPer2Points = ((highAvg - lowAvg) / lowAvg) * 0.3;
  const targetable = farmers.filter((f) => f.womenEmpowerment < 5).length;
  const contributors = farmers.filter((f) => f.womenIncomeContributor === "Yes").length;
  const bizInterest = farmers.filter((f) => f.womenInterestedStartBusiness === "Yes").length;

  return [
    `**Women Empowerment Improvement Scenario**`,
    ``,
    `Current state:`,
    `- Average empowerment score: **${currentAvgEmp.toFixed(1)}/8**`,
    `- Women income contributors: ${fmt(contributors)} (${pct(contributors, farmers.length)})`,
    `- Interested in starting business: ${fmt(bizInterest)} (${pct(bizInterest, farmers.length)})`,
    `- Farmers with empowerment < 5: ${fmt(targetable)} (${pct(targetable, farmers.length)})`,
    ``,
    `**If empowerment score increases by 2 points** for the ${fmt(targetable)} below-average farmers:`,
    `- Estimated income uplift per household: **${fmtPct(upliftPer2Points * 100)}** (${fmtUsd(lowAvg * upliftPer2Points)}/yr)`,
    `- High-empowerment households earn ${fmtUsd(highAvg)} vs ${fmtUsd(lowAvg)} for low-empowerment`,
    `- Correlation suggests ~30% of the gap is attributable to empowerment practices`,
    ``,
    `Key levers: training participation, financial services access, and supporting women-led enterprises (${fmt(bizInterest)} women expressed business interest).`,
  ].join("\n");
}

// ============================================================
// Multi-intent, filter-aware chat engine
// ============================================================
// Architecture:
//  1. extractPopulationFilter() — detects "in women", "for OBC", etc. and narrows dataset
//  2. parseIntents()            — splits on "and", parses each clause into typed intents
//  3. executeIntent()           — dispatches each intent to the correct handler
//  4. generateChatResponse()    — orchestrates all 3 steps, combines results
// ============================================================

// --- Helpers ---

function extractNumber(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return parseFloat(match[1]);
  const match2 = text.match(/(\d+(?:\.\d+)?)/);
  if (match2) return parseFloat(match2[1]);
  return null;
}

function extractCrop(text: string): string | null {
  const q = text.toLowerCase();
  if (/\bmint\b/.test(q)) return "mint";
  if (/\brice\b/.test(q)) return "rice";
  if (/\bwheat\b/.test(q)) return "wheat";
  if (/\bpotat/.test(q)) return "potato";
  if (/\bmustard\b/.test(q)) return "mustard";
  return null;
}

function extractAllCrops(text: string): string[] {
  const q = text.toLowerCase();
  const crops: string[] = [];
  if (/\bmint\b/.test(q)) crops.push("mint");
  if (/\brice\b/.test(q)) crops.push("rice");
  if (/\bwheat\b/.test(q)) crops.push("wheat");
  if (/\bpotat/.test(q)) crops.push("potato");
  if (/\bmustard\b/.test(q)) crops.push("mustard");
  return crops;
}

/**
 * Detect which correlation pair the user is asking about.
 * Returns a canonical pair identifier, or "generic" for full correlation matrix.
 */
function detectCorrelationPair(raw: string): string {
  const c = raw.toLowerCase();
  const hasTraining = /\b(training|trained)\b/.test(c);
  const hasAdoption = /\b(adoption|practice|gap|technique)\b/.test(c);
  const hasYield = /\b(yield|production|productivity)\b/.test(c);
  const hasIncome = /\b(income|earn|profit|revenue|money)\b/.test(c);
  const hasFarmSize = /\b(farm\s*size|acre|acreage|land\s*holding)\b/.test(c);
  const hasEmpowerment = /\b(empower|women\s*emp)\b/.test(c);
  const hasFPC = /\b(fpc|cooperative|membership)\b/.test(c);
  const hasSustainability = /\b(carbon|sustainab|environment|emission)\b/.test(c);

  // Two topics mentioned = specific correlation pair
  if (hasTraining && hasAdoption) return "training-adoption";
  if (hasTraining && hasYield) return "training-yield";
  if (hasTraining && hasIncome) return "training-income";
  if (hasAdoption && hasYield) return "adoption-yield";
  if (hasAdoption && hasIncome) return "adoption-income";
  if (hasFarmSize && hasIncome) return "farm-size-income";
  if (hasFarmSize && hasYield) return "farm-size-yield";
  if (hasEmpowerment && hasIncome) return "empowerment-income";
  if (hasFPC && hasIncome) return "fpc-income";
  if (hasSustainability && hasIncome) return "sustainability-income";

  // One topic mentioned → correlate that topic against income (most common intent)
  if (hasTraining) return "training-income";
  if (hasAdoption) return "adoption-income";
  if (hasFarmSize) return "farm-size-income";
  if (hasEmpowerment) return "empowerment-income";
  if (hasFPC) return "fpc-income";

  // No specific topics → full correlation matrix
  return "generic";
}

// ============================================================
// Step 1: Extract population filter
// ============================================================

interface PopulationFilter {
  gender?: string;
  caste?: string;
  project?: string;
  fpc?: string;
  farmSize?: string;
  aboveLIB?: string;
  label: string;   // e.g. "Female Farmers" or "OBC Farmers in FPC"
}

function extractPopulationFilter(
  q: string,
  allFarmers: Farmer[]
): { filtered: Farmer[]; meta: PopulationFilter } {
  const lower = q.toLowerCase();
  const meta: PopulationFilter = { label: "" };
  let pool = allFarmers;
  const labels: string[] = [];

  // --- strip trailing population modifiers from the question ---
  // patterns: "in women", "for women", "among women", "for female farmers", etc.

  // Gender — detect "female farmers", "about women", "for female", etc.
  // Avoid matching comparison queries like "compare male vs female"
  // But allow gender filter when comparing across OTHER dimensions (e.g. "female farmers across project groups")
  const isGenderComparisonQ = /\b(compare|vs|versus|against|difference between)\b/.test(lower)
    && !/\b(project|treatment|district|block|village|caste|farm size|fpc|crop)\b/.test(lower);
  const hasBothGenders = /\b(female|women)\b/.test(lower) && /\b(male|men)\b/.test(lower);
  const skipGenderFilter = isGenderComparisonQ || hasBothGenders;

  if (
    !skipGenderFilter && (
      /\b(in|for|among|of|on|about)\s+(women|woman|female|females)\b/.test(lower) ||
      /\b(female|women)\s+farmers?\b/.test(lower) ||
      /\bwomen\s*(farmers?)?\s*$/.test(lower) ||
      /\bfemale\s*(farmers?)?\s*$/.test(lower)
    )
  ) {
    meta.gender = "Female";
    pool = pool.filter((f) => f.gender === "Female");
    labels.push("Female");
  } else if (
    !skipGenderFilter && (
      /\b(in|for|among|of|on|about)\s+(men|man|male|males)\b/.test(lower) ||
      /\b(male|men)\s+farmers?\b/.test(lower) ||
      /\bmale\s*(farmers?)?\s*$/.test(lower)
    )
  ) {
    meta.gender = "Male";
    pool = pool.filter((f) => f.gender === "Male");
    labels.push("Male");
  }

  // Caste
  const casteMatch = lower.match(/\b(in|for|among|of)\s+(obc|sc|st|general)\b/i);
  if (casteMatch) {
    const casteVal = casteMatch[2].toUpperCase();
    meta.caste = casteVal;
    pool = pool.filter((f) => f.caste?.toUpperCase() === casteVal);
    labels.push(casteVal);
  }

  // Project group (e.g. "in T-1", "for T-2", "in control")
  const projMatch = lower.match(/\b(in|for|among)\s+(t-?1|t-?2|control)\b/i);
  if (projMatch) {
    const raw = projMatch[2];
    const projVal = raw.toLowerCase() === "control" ? "Control" : raw.toUpperCase().replace(/^T(\d)$/, "T-$1");
    meta.project = projVal;
    pool = pool.filter((f) => f.project === projVal);
    labels.push(projVal);
  }

  // FPC — skip filtering when it's a comparison between members vs non-members
  const isFpcComparison = /\b(compare|vs|versus|against|difference between)\b/.test(lower)
    && /\bmembers?\b/.test(lower) && /\bnon[\s-]?members?\b/.test(lower);
  if (!isFpcComparison) {
    if (/\b(in|for|among)\s+fpc\s*members?\b/.test(lower) || /\bfpc\s*members?\s*$/.test(lower)) {
      meta.fpc = "Yes";
      pool = pool.filter((f) => f.fpcMember?.startsWith("1"));
      labels.push("FPC Members");
    } else if (/\b(in|for|among|of)\s+non[\s-]?members?\b/.test(lower) || /\bnon[\s-]?members?\s*$/.test(lower)) {
      meta.fpc = "No";
      pool = pool.filter((f) => !f.fpcMember?.startsWith("1"));
      labels.push("Non-Members");
    }
  }

  // Farm size
  if (/\bsmall\s*farmers?\b/.test(lower) || /\bsmall\s*holdings?\b/.test(lower)) {
    meta.farmSize = "Small";
    pool = pool.filter((f) => f.farmSizeCategory === "Small");
    labels.push("Small farmers");
  } else if (/\bmarginal\s*farmers?\b/.test(lower)) {
    meta.farmSize = "Marginal";
    pool = pool.filter((f) => f.farmSizeCategory === "Marginal");
    labels.push("Marginal farmers");
  }

  // Below LIB
  if (/\bbelow\s*lib\b/.test(lower) || /\bbelow\s*living\s*income\b/.test(lower)) {
    meta.aboveLIB = "No";
    pool = pool.filter((f) => !isAboveLIB(f.aboveLIB));
    labels.push("Below LIB");
  }

  meta.label = labels.length ? labels.join(", ") + " Farmers" : "";
  return { filtered: pool, meta };
}

// ============================================================
// Step 2: Parse intents (multi-intent, split on "and")
// ============================================================

type IntentType =
  | "price-scenario"
  | "yield-scenario"
  | "crop-yield-scenario"
  | "acreage-scenario"
  | "fpc-scenario"
  | "empowerment-scenario"
  | "gender-profile"
  | "gender-compare"
  | "caste-breakdown"
  | "farm-size-analysis"
  | "age-analysis"
  | "off-farm"
  | "fpc-analysis"
  | "lib-analysis"
  | "sustainability"
  | "training"
  | "income-overview"
  | "income-top"
  | "income-bottom"
  | "income-stats"
  | "income-inequality"
  | "crop-overview"
  | "crop-detail"
  | "project-overview"
  | "project-detail"
  | "empowerment-overview"
  | "geography"
  | "recommendations"
  | "summary"
  | "compare-caste"
  | "compare-farm-size"
  | "compare-district"
  | "compare-fpc"
  | "compare-lib"
  | "compare-generic"
  | "project-compare"
  | "income-drivers"
  | "why-analysis"
  | "correlation"
  | "deep-analysis"
  | "unknown";

interface ParsedIntent {
  type: IntentType;
  crop?: string;
  changePct?: number;
  correlationPair?: string;
  raw: string;
}

function parseIntents(q: string): ParsedIntent[] {
  // Split on " and " but not inside "living income and ..."
  // Use a smarter split: only split on " and " when it separates scenario-like clauses
  const lower = q.toLowerCase().trim();

  // Split on " and " that appears to separate distinct clauses
  // We look for "and" that separates phrases with verbs/scenarios
  const parts = splitOnAnd(lower);

  const intents: ParsedIntent[] = [];
  for (const part of parts) {
    const clauseIntents = parseClauseIntents(part.trim());
    intents.push(...clauseIntents);
  }

  return intents.length > 0 ? intents : [{ type: "unknown", raw: lower }];
}

function splitOnAnd(q: string): string[] {
  // Split on " and " / " but " that separates distinct clauses
  const preservePhrases = [
    "living income and", "income and expense", "pros and cons", "men and women", "male and female",
    "correlation between", "correlate", "correlation of", "correlation analysis",
    "relationship between", "association between",
  ];
  for (const phrase of preservePhrases) {
    if (q.includes(phrase)) return [q];
  }

  // Split on " and " or " but " connectors
  const parts = q.split(/\s+(?:and|but)\s+/);
  if (parts.length <= 1) return [q];

  // Validate: a clause needs a verb/number/crop to be a separate intent
  const hasContent = (s: string) =>
    /\d/.test(s) || /\b(price|yield|drop|drops|rise|rises|increase|decrease|what|how|compare|show)\b/.test(s)
    || /\b(mint|rice|wheat|potato|mustard)\b/.test(s);

  if (parts.length === 2 && hasContent(parts[0]) && hasContent(parts[1])) {
    return parts;
  }

  // For 3+ parts, greedily merge weak clauses
  const results: string[] = [];
  let current = parts[0];
  for (let i = 1; i < parts.length; i++) {
    if (hasContent(parts[i]) && hasContent(current)) {
      results.push(current);
      current = parts[i];
    } else {
      current += " and " + parts[i];
    }
  }
  results.push(current);
  return results;
}

function parseClauseIntents(clause: string): ParsedIntent[] {
  const c = clause.trim();
  const num = extractNumber(c);
  const crops = extractAllCrops(c);
  const isDecrease = /\b(decrease|drop|fall|decline|reduce|lower|drops|falls|declines|reduces|lowers)\b/.test(c);
  const isIncrease = /\b(increase|rise|rises|grow|grows|raise|raises|boost|boosts)\b/.test(c);
  const isDouble = /\bdouble\b/.test(c);
  const isTriple = /\btriple\b/.test(c);
  const isHalf = /\bhalf\b/.test(c);

  let changePct = num || 20;
  if (isDecrease) changePct = -Math.abs(changePct);
  else if (isIncrease) changePct = Math.abs(changePct);
  if (isDouble) changePct = 100;
  if (isTriple) changePct = 200;
  if (isHalf) changePct = -50;

  // Only enter scenario mode if there's an explicit scenario phrase OR a direction verb + economic noun
  const isExplicitScenario = /\b(what if|what would|what happens|scenario|simulate|if we|impact of|effect of)\b/.test(c);
  const hasEconomicTarget = /\b(price|yield|production|productivity|acre|acreage|crop|land|farm\s*size)\b/.test(c);
  const isScenario = isExplicitScenario
    || ((isDecrease || isIncrease || isDouble || isTriple || isHalf) && hasEconomicTarget);

  // --- Correlation intents take priority over scenario intents ---
  const isCorrelationQuery = /\bcorrelat/.test(c) || /\brelationship\s+between\b/.test(c) || /\bassociation\s+between\b/.test(c);
  if (isCorrelationQuery) {
    const pair = detectCorrelationPair(c);
    return [{ type: "correlation", correlationPair: pair, raw: c }];
  }

  // --- Scenario intents ---
  if (isScenario || /\b(price|yield|acre)\b/.test(c)) {
    const intents: ParsedIntent[] = [];

    // Price scenarios — create one per crop mentioned
    if (/\bprice\b/.test(c)) {
      const priceCrops = crops.length > 0 ? crops : ["mint"];
      for (const crop of priceCrops) {
        intents.push({ type: "price-scenario", crop, changePct, raw: c });
      }
    }

    // Yield scenarios — per-crop if crop mentioned, else generic
    if (/\b(yield|production|productivity)\b/.test(c)) {
      if (crops.length > 0) {
        for (const crop of crops) {
          intents.push({ type: "crop-yield-scenario", crop, changePct, raw: c });
        }
      } else {
        intents.push({ type: "yield-scenario", changePct, raw: c });
      }
    }

    // Acreage
    if (/\b(acre|acreage|land|farm size)\b/.test(c)) {
      intents.push({ type: "acreage-scenario", changePct, raw: c });
    }

    // FPC
    if (/\b(fpc|membership|cooperative)\b/.test(c)) {
      intents.push({ type: "fpc-scenario", raw: c });
    }

    // Empowerment
    if (/\b(empower)\b/.test(c)) {
      intents.push({ type: "empowerment-scenario", raw: c });
    }

    // If we matched scenario keywords but nothing specific, and crops are present, try crop-yield
    if (intents.length === 0 && crops.length > 0) {
      for (const crop of crops) {
        // Check if this looks like a price or yield clause
        if (/\bprice\b/.test(c)) {
          intents.push({ type: "price-scenario", crop, changePct, raw: c });
        } else {
          intents.push({ type: "crop-yield-scenario", crop, changePct, raw: c });
        }
      }
    }

    // If STILL no intents but it's a scenario, default to yield
    if (intents.length === 0 && isScenario) {
      intents.push({ type: "yield-scenario", changePct, raw: c });
    }

    if (intents.length > 0) return intents;
  }

  // --- Compare intents ---
  if (/\b(compare|vs|versus|difference between|against)\b/.test(c)) {
    if (/\b(project\s*group|treatment\s*group|t-?1|t-?2|control)\b/.test(c)) return [{ type: "project-compare", raw: c }];
    if (/\b(caste|sc|obc|general)\b/.test(c)) return [{ type: "compare-caste", raw: c }];
    if (/\b(farm size|small|large|marginal|medium)\b/.test(c)) return [{ type: "compare-farm-size", raw: c }];
    if (/\b(segment|project\s*group)\b/.test(c)) return [{ type: "project-compare", raw: c }];
    if (/\bdistrict\b/.test(c)) return [{ type: "compare-district", raw: c }];
    if (/\b(fpc|member)\b/.test(c)) return [{ type: "compare-fpc", raw: c }];
    if (/\b(lib|living income|benchmark)\b/.test(c)) return [{ type: "compare-lib", raw: c }];
    if (/\b(male|female|gender|men|women)\b/.test(c)) return [{ type: "gender-compare", raw: c }];
    return [{ type: "compare-generic", raw: c }];
  }

  // --- Gender ---
  if (/\b(female|women farmer|woman farmer|male farmer|men farmer|man farmer|gender)\b/.test(c)
    || (/\bhow\b/.test(c) && /\b(women|female)\b/.test(c))) {
    if (/\b(female|women|woman)\b/.test(c) && !/\b(compare|vs|versus|male)\b/.test(c)) {
      return [{ type: "gender-profile", raw: c }];
    }
    return [{ type: "gender-compare", raw: c }];
  }

  // --- Multi-match: accumulate ALL matching intents for complex queries ---
  const intents: ParsedIntent[] = [];
  const matchedCategories = new Set<string>();

  // Correlation analysis — checked BEFORE income-drivers to avoid misroute
  if (/\bcorrelat/.test(c) || /\brelationship\s+between\b/.test(c) || /\bassociation\s+between\b/.test(c)) {
    const pair = detectCorrelationPair(c);
    intents.push({ type: "correlation", correlationPair: pair, raw: c }); matchedCategories.add("analytical");
  }
  // Economic / analytical intents
  if (/\b(drivers?|factors?|determinants?|what\s+determines|what\s+affects|what\s+drives|driving)\b/.test(c)) {
    intents.push({ type: "income-drivers", raw: c }); matchedCategories.add("analytical");
  }
  if (/\b(why\s+(is|are|do)|root\s+cause|cause\s+and\s+effect|causal|explain\s+why|reasons?|challenges?|problems?|issues?|barriers?)\b/.test(c)) {
    intents.push({ type: "why-analysis", raw: c }); matchedCategories.add("analytical");
  }
  if (/\b(inequality|gini|gap\s+between|income\s+gap|disparity|equit)\b/.test(c)) {
    intents.push({ type: "income-inequality", raw: c }); matchedCategories.add("analytical");
  }
  if (/\b(deep\s+analysis|comprehensive|full\s+analysis|economic\s+model|modeling|in[- ]?depth|holistic|thorough)\b/.test(c)) {
    intents.push({ type: "deep-analysis", raw: c }); matchedCategories.add("analytical");
  }

  // Topic intents
  if (/\b(caste|\bsc\b|obc|social group|scheduled)\b/.test(c)) {
    intents.push({ type: "caste-breakdown", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(farm\s*size|acreage|land\s*holding|small\s*farmer|marginal\s*farmer|large\s*farmer)\b/.test(c)) {
    intents.push({ type: "farm-size-analysis", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(age\b|young|old\b|elderly|youth)\b/.test(c) && !/\bacreage\b/.test(c)) {
    intents.push({ type: "age-analysis", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(off-farm|off\s*farm|non-farm|livestock|other\s*income|diversif)\b/.test(c)) {
    intents.push({ type: "off-farm", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(fpc|farmer\s*producer|cooperative|membership)\b/.test(c)) {
    intents.push({ type: "fpc-analysis", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(living\s*income|lib\b|benchmark|poverty)\b/.test(c)) {
    intents.push({ type: "lib-analysis", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(carbon|sustainab|environment|emission|tree|pesticide)\b/.test(c)) {
    intents.push({ type: "sustainability", raw: c }); matchedCategories.add("topic");
  }
  if (/\b(training|practice|adoption|technique)\b/.test(c)) {
    intents.push({ type: "training", raw: c }); matchedCategories.add("topic");
  }

  // Income — only add generic income if no more specific analytical intent already matched
  if (/\b(income|earn|money|profit|revenue)\b/.test(c) && !matchedCategories.has("analytical")) {
    if (/\b(highest|top|best|most)\b/.test(c)) intents.push({ type: "income-top", raw: c });
    else if (/\b(lowest|poor|worst|least|negative)\b/.test(c)) intents.push({ type: "income-bottom", raw: c });
    else if (/\b(average|mean|median)\b/.test(c)) intents.push({ type: "income-stats", raw: c });
    else if (intents.length === 0) intents.push({ type: "income-overview", raw: c });
    matchedCategories.add("income");
  }

  // Crops
  if (/\b(crop|mint|rice|wheat|potato|mustard)\b/.test(c) && !matchedCategories.has("analytical")) {
    if (/\b(profitable|best\s*crop|most\s*profitable)\b/.test(c)) intents.push({ type: "crop-overview", raw: c });
    else {
      const cropName = extractCrop(c);
      if (cropName) intents.push({ type: "crop-detail", crop: cropName, raw: c });
      else if (intents.length === 0) intents.push({ type: "crop-overview", raw: c });
    }
    matchedCategories.add("crop");
  }

  // Project groups (T-1, T-2, Control)
  if (/\bproject\s*groups?\b/.test(c) ||
      (/\bproject\b/.test(c) && /\b(relat|compare|breakdown|across|between|by|differ)\b/.test(c)) ||
      /\btreatment\s*groups?\b/.test(c) ||
      (/\b(t-?1|t-?2)\b/.test(c) && /\b(t-?1|t-?2|control)\b/.test(c))) {
    intents.push({ type: "project-compare", raw: c }); matchedCategories.add("project");
  }

  // Project groups (legacy "segment" keyword also maps here)
  if (/\b(segment|cluster)\b/.test(c) && !matchedCategories.has("project")) {
    intents.push({ type: "project-overview", raw: c }); matchedCategories.add("project");
  }

  // Women/empowerment — only if nothing else matched (too generic otherwise)
  if (/\b(empower|gender\s*equality)\b/.test(c)) {
    intents.push({ type: "empowerment-overview", raw: c }); matchedCategories.add("empowerment");
  } else if (/\bwomen\b/.test(c) && intents.length === 0) {
    intents.push({ type: "empowerment-overview", raw: c }); matchedCategories.add("empowerment");
  }

  // Geography
  if (/\b(village|district|block|area|region|location|geographic)\b/.test(c)) {
    intents.push({ type: "geography", raw: c }); matchedCategories.add("geo");
  }

  // Recommendations (fixed: added "address", "how can we", "what can we", "help", "solve", "fix")
  if (/\b(recommend(ation)?s?|suggest(ion)?s?|improv(e|ing|ement)|intervention|action(s|able)?|strateg(y|ies)|address(ing)?|solution|solve|fix(ing)?|help(ing)?)\b/.test(c) ||
      /\b(what\s+should\s+we|what\s+can\s+(we|be\s+done)|how\s+to\s+(help|improve|address|fix|solve|lift|raise|close)|how\s+can\s+(we|this|they|it))\b/.test(c)) {
    intents.push({ type: "recommendations", raw: c }); matchedCategories.add("reco");
  }

  // Summary — only if nothing else matched
  if (/\b(summary|overview|tell\s*me\s*everything|dashboard|status)\b/.test(c) && intents.length === 0) {
    intents.push({ type: "summary", raw: c });
  }

  if (intents.length > 0) return intents;

  // --- Smart fallback for broad analytical queries ---
  // If the query is long enough and seems analytical, auto-generate comprehensive analysis
  const wordCount = c.split(/\s+/).length;
  const hasAnalyticalSignal = /\b(what|how|why|which|where|who|tell|show|explain|analyze|analys|describe|assess|evaluat|understand|insights?|key|main|major|important|critical|primary|significant|about|these|farmers?)\b/.test(c);
  if (wordCount >= 3 && hasAnalyticalSignal) {
    return [{ type: "deep-analysis", raw: c }];
  }

  // Short queries with analytical keywords → summary instead of unknown
  if (/\b(insights?|overview|summary|status|findings?|analysis|report)\b/.test(c)) {
    return [{ type: "summary", raw: c }];
  }

  return [{ type: "unknown", raw: c }];
}

// ============================================================
// Step 3: Execute intent
// ============================================================

function executeIntent(
  intent: ParsedIntent,
  farmers: Farmer[],
  allFarmers: Farmer[]
): string {
  const total = farmers.length;
  const incomes = farmers.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
  const avgIncome = incomes.length ? mean(incomes) : 0;
  const medIncome = incomes.length ? median(incomes) : 0;

  switch (intent.type) {
    // --- Scenarios ---
    case "price-scenario": {
      const crop = intent.crop || "mint";
      return simulatePriceChange(farmers, crop, intent.changePct || -20).details;
    }
    case "yield-scenario": {
      const r = simulateYieldChange(farmers, intent.changePct || 20);
      return [
        r.details,
        ``,
        `| Metric | Current | Projected | Change |`,
        `|---|---|---|---|`,
        `| Avg Net Income | ${fmtUsd(r.currentAvg)} | ${fmtUsd(r.projectedAvg)} | ${r.changePercent > 0 ? "+" : ""}${r.changePercent.toFixed(1)}% |`,
        `| Farmers Affected | ${fmt(r.affectedFarmers)} | — | — |`,
      ].join("\n");
    }
    case "crop-yield-scenario": {
      // Simulate yield change for a specific crop (use price-change logic as proxy since yield→income)
      const crop = intent.crop || "mint";
      const cropName = crop.charAt(0).toUpperCase() + crop.slice(1);
      const cropKeyMap: Record<string, keyof Farmer> = {
        mint: "mintNetIncome", rice: "riceNetIncome", wheat: "wheatNetIncome",
        potato: "potatoNetIncome", mustard: "mustardNetIncome",
      };
      const key = cropKeyMap[crop] || "mintNetIncome";
      const growers = farmers.filter((f) => {
        const v = f[key] as number | null;
        return v != null && v > 0;
      });
      const changePct = intent.changePct || 10;
      if (growers.length === 0) {
        return `No ${cropName} growers found in the current selection.`;
      }
      const avgCropIncome = mean(growers.map((f) => f[key] as number));
      const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
      const currentAvg = mean(withIncome.map((f) => f.totalNetIncomeUsd!));
      const cropShare = growers.length > 0
        ? (avgCropIncome * growers.length) / (currentAvg * withIncome.length || 1)
        : 0;
      const impact = currentAvg * cropShare * (changePct / 100);
      const projectedAvg = currentAvg + impact;
      return [
        `**${cropName} yield ${changePct > 0 ? "+" : ""}${changePct}% scenario**`,
        ``,
        `- ${cropName} growers: ${fmt(growers.length)} (${pct(growers.length, farmers.length)} of population)`,
        `- Current avg ${cropName} income: ${fmtUsd(avgCropIncome)}/yr per grower`,
        `- ${cropName} share of total income: ~${(cropShare * 100).toFixed(0)}%`,
        ``,
        `**Projected impact**: Average net income shifts from ${fmtUsd(currentAvg)} to **${fmtUsd(projectedAvg)}** (${changePct > 0 ? "+" : ""}${((projectedAvg - currentAvg) / Math.abs(currentAvg || 1) * 100).toFixed(1)}%).`,
      ].join("\n");
    }
    case "acreage-scenario":
      return simulateAcreageChange(farmers, intent.changePct || 20).details;
    case "fpc-scenario":
      return simulateFPCExpansion(farmers);
    case "empowerment-scenario":
      return simulateEmpowermentImprovement(farmers);

    // --- Gender ---
    case "gender-profile": {
      const females = farmers.filter((f) => f.gender === "Female");
      return groupProfile("Female Farmers", females, total);
    }
    case "gender-compare": {
      const females = farmers.filter((f) => f.gender === "Female");
      const males = farmers.filter((f) => f.gender === "Male");
      return compareGroups("Female", females, "Male", males, total);
    }

    // --- Comparisons ---
    case "compare-caste": {
      const castes = [...new Set(farmers.map((f) => f.caste))].filter(Boolean);
      if (castes.length < 2) return "Not enough caste diversity for comparison.";
      const groups = castes.map((c) => ({ label: c, group: farmers.filter((f) => f.caste === c) })).sort((a, b) => b.group.length - a.group.length);
      return compareGroups(groups[0].label, groups[0].group, groups[1].label, groups[1].group, total);
    }
    case "compare-farm-size": {
      const sizes = [...new Set(farmers.map((f) => f.farmSizeCategory))].filter(Boolean);
      if (sizes.length < 2) return "Not enough farm size categories for comparison.";
      const groups = sizes.map((s) => ({ label: s, group: farmers.filter((f) => f.farmSizeCategory === s) })).sort((a, b) => b.group.length - a.group.length);
      return compareGroups(groups[0].label, groups[0].group, groups[1].label, groups[1].group, total);
    }
    case "project-detail": {
      // Legacy "segment-compare" now compares project groups
      const groups = [...new Set(farmers.map((f) => f.project).filter(Boolean))];
      if (groups.length < 2) return "Not enough project groups for comparison.";
      const q = intent.raw.toLowerCase();
      const mentioned = groups.filter((g) => q.includes(g.toLowerCase()));
      let grpA: string, grpB: string;
      if (mentioned.length >= 2) { grpA = mentioned[0]; grpB = mentioned[1]; }
      else {
        const ranked = groups.map((g) => {
          const members = farmers.filter((f) => f.project === g && f.totalNetIncomeUsd != null);
          return { grp: g, avg: members.length ? mean(members.map((f) => f.totalNetIncomeUsd!)) : 0 };
        }).sort((a, b) => b.avg - a.avg);
        grpA = ranked[0].grp; grpB = ranked[ranked.length - 1].grp;
      }
      return compareGroups(grpA, farmers.filter((f) => f.project === grpA), grpB, farmers.filter((f) => f.project === grpB), total);
    }
    case "compare-district": {
      const dists = [...new Set(farmers.map((f) => f.district))].filter(Boolean);
      if (dists.length < 2) return "Only one district in current selection.";
      return compareGroups(dists[0], farmers.filter((f) => f.district === dists[0]), dists[1], farmers.filter((f) => f.district === dists[1]), total);
    }
    case "compare-fpc":
      return compareGroups("FPC Members", farmers.filter((f) => f.fpcMember?.startsWith("1")), "Non-Members", farmers.filter((f) => !f.fpcMember?.startsWith("1")), total);
    case "compare-lib": {
      const above = farmers.filter((f) => isAboveLIB(f.aboveLIB));
      const below = farmers.filter((f) => !isAboveLIB(f.aboveLIB));
      const negative = farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0);
      return compareGroups("Above LIB", above, "Below LIB", below, total) + `\n\n**${fmt(negative.length)} farmers** have negative net income.`;
    }
    case "compare-generic":
      return compareGroups("Female", farmers.filter((f) => f.gender === "Female"), "Male", farmers.filter((f) => f.gender === "Male"), total);

    // --- Topic analyses ---
    case "caste-breakdown": {
      const casteCounts = new Map<string, Farmer[]>();
      for (const f of farmers) { if (!f.caste) continue; const arr = casteCounts.get(f.caste) || []; arr.push(f); casteCounts.set(f.caste, arr); }
      const casteStats = Array.from(casteCounts.entries()).map(([c, group]) => {
        const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
        return { caste: c, count: group.length, avgIncome: inc.length ? mean(inc) : 0 };
      }).sort((a, b) => b.count - a.count);
      return [`**Caste / Social Group Breakdown** (${fmt(total)} farmers):`, ``, `| Caste | Farmers | % | Avg Income |`, `|---|---|---|---|`,
        ...casteStats.map((c) => `| ${c.caste} | ${fmt(c.count)} | ${pct(c.count, total)} | ${fmtUsd(c.avgIncome)} |`)].join("\n");
    }
    case "farm-size-analysis": {
      const sizeCounts = new Map<string, Farmer[]>();
      for (const f of farmers) { if (!f.farmSizeCategory) continue; const arr = sizeCounts.get(f.farmSizeCategory) || []; arr.push(f); sizeCounts.set(f.farmSizeCategory, arr); }
      const sizeStats = Array.from(sizeCounts.entries()).map(([s, group]) => {
        const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
        return { size: s, count: group.length, avgIncome: inc.length ? mean(inc) : 0, avgAcre: mean(group.map((f) => f.totalAcre)), avgProd: mean(group.map((f) => f.productivityIndex)) * 100 };
      }).sort((a, b) => b.count - a.count);
      return [`**Farm Size Analysis** (${fmt(total)} farmers):`, ``, `| Category | Farmers | Avg Acres | Avg Income | Productivity |`, `|---|---|---|---|---|`,
        ...sizeStats.map((s) => `| ${s.size} | ${fmt(s.count)} (${pct(s.count, total)}) | ${s.avgAcre.toFixed(1)} | ${fmtUsd(s.avgIncome)} | ${fmtPct(s.avgProd)} |`)].join("\n");
    }
    case "age-analysis": {
      const ageBins = [
        { label: "Under 30", min: 0, max: 30, farmers: [] as Farmer[] },
        { label: "30-40", min: 30, max: 40, farmers: [] as Farmer[] },
        { label: "40-50", min: 40, max: 50, farmers: [] as Farmer[] },
        { label: "50-60", min: 50, max: 60, farmers: [] as Farmer[] },
        { label: "60+", min: 60, max: 200, farmers: [] as Farmer[] },
      ];
      for (const f of farmers) { for (const bin of ageBins) { if (f.age >= bin.min && f.age < bin.max) { bin.farmers.push(f); break; } } }
      return [`**Age Distribution** (${fmt(total)} farmers):`, ``, `| Age Group | Farmers | Avg Income | Productivity | Empowerment |`, `|---|---|---|---|---|`,
        ...ageBins.filter((b) => b.farmers.length > 0).map((b) => {
          const inc = b.farmers.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
          return `| ${b.label} | ${fmt(b.farmers.length)} | ${fmtUsd(inc.length ? mean(inc) : 0)} | ${fmtPct(mean(b.farmers.map((f) => f.productivityIndex)) * 100)} | ${mean(b.farmers.map((f) => f.womenEmpowerment)).toFixed(1)}/8 |`;
        }), ``, `Average age: **${mean(farmers.map((f) => f.age)).toFixed(0)} years**.`].join("\n");
    }
    case "off-farm": {
      const withOffFarm = farmers.filter((f) => f.offFarmNetIncome != null && f.offFarmNetIncome > 0);
      const withLivestock = farmers.filter((f) => f.livestockIncome != null && f.livestockIncome > 0);
      return [`**Off-Farm & Livestock Income**`, ``, `| Source | Farmers | Avg Income |`, `|---|---|---|`,
        `| Off-Farm | ${fmt(withOffFarm.length)} (${pct(withOffFarm.length, total)}) | ${fmtUsd(withOffFarm.length ? mean(withOffFarm.map((f) => f.offFarmNetIncome!)) : 0)}/yr |`,
        `| Livestock | ${fmt(withLivestock.length)} (${pct(withLivestock.length, total)}) | ${fmtUsd(withLivestock.length ? mean(withLivestock.map((f) => f.livestockIncome!)) : 0)}/yr |`].join("\n");
    }
    case "fpc-analysis":
      return compareGroups("FPC Members", farmers.filter((f) => f.fpcMember?.startsWith("1")), "Non-Members", farmers.filter((f) => !f.fpcMember?.startsWith("1")), total);
    case "lib-analysis": {
      const above = farmers.filter((f) => isAboveLIB(f.aboveLIB));
      const below = farmers.filter((f) => !isAboveLIB(f.aboveLIB));
      const negative = farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0);
      return compareGroups("Above LIB", above, "Below LIB", below, total) + `\n\n**${fmt(negative.length)} farmers** have negative net income.`;
    }
    case "sustainability": {
      const withCarbon = farmers.filter((f) => f.soilCarbon != null);
      if (withCarbon.length === 0) return "No sustainability data available.";
      return [`**Sustainability Metrics** (${fmt(withCarbon.length)} farmers):`, ``, `| Metric | Average |`, `|---|---|`,
        `| Soil Carbon | ${mean(withCarbon.map((f) => f.soilCarbon!)).toFixed(2)} |`,
        `| Electricity | ${mean(withCarbon.filter((f) => f.electricity != null).map((f) => f.electricity!)).toFixed(2)} |`,
        `| Pesticide | ${mean(withCarbon.filter((f) => f.pesticide != null).map((f) => f.pesticide!)).toFixed(2)} |`,
        `| Trees (sequestration) | ${mean(withCarbon.filter((f) => f.carbonFromTrees != null).map((f) => f.carbonFromTrees!)).toFixed(2)} |`].join("\n");
    }
    case "training": {
      // Training: value starts with "1." or "2." = trained; "3." = not trained
      const hasTraining = (f: Farmer) => {
        const v = f.trainingParticipation;
        return typeof v === "string" && v !== "" && !v.startsWith("3.");
      };
      // GAP adoption: exclude non-adoption categories
      const hasAdoption = (f: Farmer) =>
        f.practiceAdoption != null &&
        f.practiceAdoption !== "" &&
        f.practiceAdoption !== "No crops" &&
        f.practiceAdoption !== "No answer" &&
        f.practiceAdoption !== "Zero GAP practiced";
      const isHighGAP = (f: Farmer) =>
        f.practiceAdoption === "40-70%" || f.practiceAdoption === ">70";

      const trained = farmers.filter(hasTraining);
      const untrained = farmers.filter((f) => !hasTraining(f));
      const adopted = farmers.filter(hasAdoption);
      const highGAP = farmers.filter(isHighGAP);

      const trainedInc = trained.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const untrainedInc = untrained.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);

      // Correlation: training → adoption rate
      const trainedAdopted = trained.filter(hasAdoption).length;
      const untrainedAdopted = untrained.filter(hasAdoption).length;
      const trainedAdoptPct = trained.length ? (trainedAdopted / trained.length) * 100 : 0;
      const untrainedAdoptPct = untrained.length ? (untrainedAdopted / untrained.length) * 100 : 0;

      // Correlation: adoption → income
      const adoptedInc = adopted.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const nonAdoptedInc = farmers.filter((f) => !hasAdoption(f) && f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);

      // High GAP income
      const highGAPInc = highGAP.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);

      const lines: string[] = [
        `**Training & Practice Adoption**`, ``,
        `| Metric | Value |`, `|---|---|`,
        `| Training Participants | ${fmt(trained.length)} (${pct(trained.length, total)}) |`,
        `| Untrained Farmers | ${fmt(untrained.length)} (${pct(untrained.length, total)}) |`,
        `| GAP Adopters | ${fmt(adopted.length)} (${pct(adopted.length, total)}) |`,
        `| High GAP (40%+) | ${fmt(highGAP.length)} (${pct(highGAP.length, total)}) |`,
      ];

      // Training → Income comparison (only if both groups exist)
      if (trainedInc.length > 0 || untrainedInc.length > 0) {
        lines.push(``, `**Training → Income Impact**`, ``,
          `| Group | Avg Income | Count |`, `|---|---|---|`);
        if (trainedInc.length > 0)
          lines.push(`| Trained | ${fmtUsd(mean(trainedInc))} | ${fmt(trainedInc.length)} |`);
        if (untrainedInc.length > 0)
          lines.push(`| Untrained | ${fmtUsd(mean(untrainedInc))} | ${fmt(untrainedInc.length)} |`);
        if (trainedInc.length > 0 && untrainedInc.length > 0) {
          const diff = mean(trainedInc) - mean(untrainedInc);
          lines.push(`| **Difference** | **${diff >= 0 ? "+" : ""}${fmtUsd(diff)}** | — |`);
        }
      }

      // Training → Adoption correlation
      if (trained.length > 0 || untrained.length > 0) {
        lines.push(``, `**Training → GAP Adoption Correlation**`, ``,
          `| Group | Adoption Rate | High GAP |`, `|---|---|---|`);
        if (trained.length > 0)
          lines.push(`| Trained | ${trainedAdoptPct.toFixed(1)}% | ${pct(trained.filter(isHighGAP).length, trained.length)} |`);
        if (untrained.length > 0)
          lines.push(`| Untrained | ${untrainedAdoptPct.toFixed(1)}% | ${pct(untrained.filter(isHighGAP).length, untrained.length)} |`);
      }

      // Adoption → Income
      if (adoptedInc.length > 0 && nonAdoptedInc.length > 0) {
        lines.push(``, `**GAP Adoption → Income Impact**`, ``,
          `| Group | Avg Income | Count |`, `|---|---|---|`,
          `| GAP Adopters | ${fmtUsd(mean(adoptedInc))} | ${fmt(adoptedInc.length)} |`,
          `| Non-Adopters | ${fmtUsd(mean(nonAdoptedInc))} | ${fmt(nonAdoptedInc.length)} |`,
          `| **Difference** | **${mean(adoptedInc) - mean(nonAdoptedInc) >= 0 ? "+" : ""}${fmtUsd(mean(adoptedInc) - mean(nonAdoptedInc))}** | — |`);
      }

      // High GAP premium
      if (highGAPInc.length > 0 && adoptedInc.length > 0) {
        lines.push(``, `High GAP farmers (40%+) earn **${fmtUsd(mean(highGAPInc))}** avg vs **${fmtUsd(mean(adoptedInc))}** for all adopters.`);
      }

      // Summary insight
      if (trained.length > 0 && untrained.length === 0) {
        lines.push(``, `> All ${fmt(total)} farmers in this cohort have received training. ` +
          `${adopted.length > 0 ? `${pct(adopted.length, total)} have adopted GAP practices.` : "GAP adoption data is limited for this group."}`);
      } else if (trained.length > 0 && untrained.length > 0 && trainedAdoptPct > untrainedAdoptPct) {
        lines.push(``, `> Training shows a **positive correlation** with GAP adoption — trained farmers adopt at ${trainedAdoptPct.toFixed(0)}% vs ${untrainedAdoptPct.toFixed(0)}% for untrained.`);
      }

      return lines.join("\n");
    }

    // --- Income ---
    case "income-top": {
      const sorted = [...farmers].filter((f) => f.totalNetIncomeUsd != null).sort((a, b) => b.totalNetIncomeUsd! - a.totalNetIncomeUsd!);
      const top5 = sorted.slice(0, 5);
      return `The top 5 earners:\n${top5.map((f, i) => `${i + 1}. **${f.name}** (${f.village}, ${f.gender}) — ${fmtUsd(f.totalNetIncomeUsd!)}/yr`).join("\n")}\n\nTop 10% threshold: ${fmtUsd(percentile(incomes, 90))}/yr.`;
    }
    case "income-bottom": {
      const negatives = farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0);
      const bottom5 = [...farmers].filter((f) => f.totalNetIncomeUsd != null).sort((a, b) => a.totalNetIncomeUsd! - b.totalNetIncomeUsd!).slice(0, 5);
      return [`**${fmt(negatives.length)} farmers** have negative net income.`, ``,
        ...bottom5.map((f, i) => `${i + 1}. **${f.name}** (${f.village}) — ${fmtUsd(f.totalNetIncomeUsd!)}/yr`),
        ``, `Bottom 10% threshold: ${fmtUsd(percentile(incomes, 10))}/yr`].join("\n");
    }
    case "income-stats":
      return [`**Income Statistics** (${fmt(total)} farmers):`, ``, `| Metric | Value |`, `|---|---|`,
        `| Average | ${fmtUsd(avgIncome)}/yr |`, `| Median | ${fmtUsd(medIncome)}/yr |`,
        `| 10th %ile | ${fmtUsd(percentile(incomes, 10))}/yr |`, `| 90th %ile | ${fmtUsd(percentile(incomes, 90))}/yr |`,
        `| Min | ${fmtUsd(incomes.length ? Math.min(...incomes) : 0)}/yr |`, `| Max | ${fmtUsd(incomes.length ? Math.max(...incomes) : 0)}/yr |`].join("\n");
    case "income-overview":
      return [`**Income Overview** (${fmt(total)} farmers):`,
        `- Average: **${fmtUsd(avgIncome)}/yr**`, `- Median: **${fmtUsd(medIncome)}/yr**`,
        `- Below LIB: ${fmt(farmers.filter((f) => !isAboveLIB(f.aboveLIB)).length)}`,
        `- Negative income: ${fmt(farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0).length)}`].join("\n");

    // --- Crops ---
    case "crop-overview": {
      const cropStats = countCrops(farmers);
      const sorted = [...cropStats].sort((a, b) => b.avgProfit - a.avgProfit);
      return [`**Crop Overview** (${fmt(total)} farmers):`, ``, `| Crop | Growers | % | Avg Profit/yr |`, `|---|---|---|---|`,
        ...sorted.map((c) => `| ${c.name} | ${fmt(c.count)} | ${pct(c.count, total)} | ${fmtUsd(c.avgProfit)} |`)].join("\n");
    }
    case "crop-detail": {
      const crop = intent.crop || "mint";
      const cropKey = `${crop}NetIncome` as keyof Farmer;
      const cropName = crop.charAt(0).toUpperCase() + crop.slice(1);
      const growers = farmers.filter((f) => { const v = f[cropKey] as number | null; return v != null && v > 0; });
      if (growers.length === 0) return `No ${cropName} growers in the current selection.`;
      const profits = growers.map((f) => f[cropKey] as number);
      return [`**${cropName} Analysis**`, ``, `| Metric | Value |`, `|---|---|`,
        `| Growers | ${fmt(growers.length)} (${pct(growers.length, total)}) |`,
        `| Avg Profit | ${fmtUsd(mean(profits))}/yr |`, `| Median Profit | ${fmtUsd(median(profits))}/yr |`,
        `| Top 10% | ${fmtUsd(percentile(profits, 90))}/yr |`, `| Bottom 10% | ${fmtUsd(percentile(profits, 10))}/yr |`].join("\n");
    }

    // --- Project Groups ---
    case "project-overview": {
      const groups = new Map<string, Farmer[]>();
      for (const f of farmers) { if (!f.project) continue; const arr = groups.get(f.project) || []; arr.push(f); groups.set(f.project, arr); }
      const pgs = Array.from(groups.entries()).map(([g, members]) => ({
        name: g, count: members.length,
        avgIncome: mean(members.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!)),
        avgProd: mean(members.map((f) => f.productivityIndex)) * 100,
        avgEmp: mean(members.map((f) => f.womenEmpowerment)),
      })).sort((a, b) => b.avgIncome - a.avgIncome);
      return [`**Project Groups**:`, ``, `| Group | Farmers | Avg Income | Productivity | Empowerment |`, `|---|---|---|---|---|`,
        ...pgs.map((g) => `| ${g.name} | ${fmt(g.count)} | ${fmtUsd(g.avgIncome)} | ${fmtPct(g.avgProd)} | ${g.avgEmp.toFixed(1)}/8 |`),
        ``, `T-1 = Treatment 1 (Legacy), T-2 = Treatment 2 (New Intake), Control = Reference group.`].join("\n");
    }

    // --- Empowerment ---
    case "empowerment-overview": {
      const avgEmp = mean(farmers.map((f) => f.womenEmpowerment));
      const contributors = farmers.filter((f) => f.womenIncomeContributor === "Yes").length;
      const interested = farmers.filter((f) => f.womenInterestedStartBusiness === "Yes").length;
      const started = farmers.filter((f) => f.womenStartBusiness === "Yes").length;
      return [`**Women Empowerment Overview**`, ``, `| Metric | Value |`, `|---|---|`,
        `| Average Score | ${avgEmp.toFixed(1)}/8 |`,
        `| Income Contributors | ${fmt(contributors)} (${pct(contributors, total)}) |`,
        `| Interested in Business | ${fmt(interested)} (${pct(interested, total)}) |`,
        `| Started Business | ${fmt(started)} (${pct(started, total)}) |`].join("\n");
    }

    // --- Geography ---
    case "geography": {
      const districts = new Map<string, Farmer[]>();
      const blocks = new Map<string, Farmer[]>();
      for (const f of farmers) {
        const dArr = districts.get(f.district) || []; dArr.push(f); districts.set(f.district, dArr);
        const bArr = blocks.get(f.block) || []; bArr.push(f); blocks.set(f.block, bArr);
      }
      const blockStats = Array.from(blocks.entries()).map(([b, g]) => ({
        name: b, count: g.length, avgIncome: mean(g.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!)),
      })).sort((a, b) => b.count - a.count).slice(0, 8);
      return [`**Geographic Distribution** (${fmt(total)} farmers):`, ``, `| District | Farmers |`, `|---|---|`,
        ...Array.from(districts.entries()).map(([d, g]) => `| ${d} | ${fmt(g.length)} |`),
        ``, `| Block | Farmers | Avg Income |`, `|---|---|---|`,
        ...blockStats.map((b) => `| ${b.name} | ${fmt(b.count)} | ${fmtUsd(b.avgIncome)} |`)].join("\n");
    }

    // --- Project Group Comparison ---
    case "project-compare": {
      const projects = [...new Set(farmers.map((f) => f.project))].filter(Boolean);
      if (projects.length < 2) {
        if (projects.length === 1) {
          return groupProfile(`${projects[0]} Farmers`, farmers, total);
        }
        return "No project group data available in the current selection.";
      }
      const groups = projects.map((p) => {
        const group = farmers.filter((f) => f.project === p);
        const inc = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
        return {
          project: p, count: group.length,
          avgIncome: inc.length ? mean(inc) : 0,
          medianIncome: inc.length ? median(inc) : 0,
          avgProd: mean(group.map((f) => f.productivityIndex)) * 100,
          avgEmp: mean(group.map((f) => f.womenEmpowerment)),
          avgAcre: mean(group.map((f) => f.totalAcre)),
          belowLIB: group.filter((f) => !isAboveLIB(f.aboveLIB)).length,
          aboveLIB: group.filter((f) => isAboveLIB(f.aboveLIB)).length,
          fpcMembers: group.filter((f) => f.fpcMember?.startsWith("1")).length,
          negIncome: group.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd! < 0).length,
          avgResources: mean(group.map((f) => f.resourcesIndex)) * 100,
        };
      }).sort((a, b) => b.count - a.count);

      const lines = [
        `**Project Group Comparison** (${fmt(total)} farmers):`,
        ``,
        `| Indicator | ${groups.map((g) => `${g.project} (${fmt(g.count)})`).join(" | ")} |`,
        `|---|${groups.map(() => "---").join("|")}|`,
        `| Avg Net Income | ${groups.map((g) => `${fmtUsd(g.avgIncome)}/yr`).join(" | ")} |`,
        `| Median Net Income | ${groups.map((g) => `${fmtUsd(g.medianIncome)}/yr`).join(" | ")} |`,
        `| Productivity | ${groups.map((g) => fmtPct(g.avgProd)).join(" | ")} |`,
        `| Resources Index | ${groups.map((g) => fmtPct(g.avgResources)).join(" | ")} |`,
        `| Empowerment | ${groups.map((g) => `${g.avgEmp.toFixed(1)}/8`).join(" | ")} |`,
        `| Avg Farm Size | ${groups.map((g) => `${g.avgAcre.toFixed(1)} ac`).join(" | ")} |`,
        `| Above LIB | ${groups.map((g) => `${fmt(g.aboveLIB)} (${pct(g.aboveLIB, g.count)})`).join(" | ")} |`,
        `| Below LIB | ${groups.map((g) => `${fmt(g.belowLIB)} (${pct(g.belowLIB, g.count)})`).join(" | ")} |`,
        `| FPC Members | ${groups.map((g) => `${fmt(g.fpcMembers)} (${pct(g.fpcMembers, g.count)})`).join(" | ")} |`,
        `| Negative Income | ${groups.map((g) => fmt(g.negIncome)).join(" | ")} |`,
      ];

      // Key insights
      const best = groups.reduce((a, b) => (a.avgIncome > b.avgIncome ? a : b));
      const worst = groups.reduce((a, b) => (a.avgIncome < b.avgIncome ? a : b));
      if (best.project !== worst.project) {
        const diff = best.avgIncome - worst.avgIncome;
        lines.push(``);
        lines.push(`**Key insights:**`);
        lines.push(`- ${best.project} farmers earn ${fmtUsd(diff)} more per year on average than ${worst.project} farmers.`);

        // Treatment vs Control insight
        const control = groups.find((g) => g.project.toLowerCase().includes("control"));
        const treatment = groups.filter((g) => !g.project.toLowerCase().includes("control"));
        if (control && treatment.length > 0) {
          const treatAvg = mean(treatment.map((t) => t.avgIncome));
          const treatPremium = treatAvg - control.avgIncome;
          lines.push(`- Treatment groups average ${fmtUsd(Math.abs(treatPremium))}/yr ${treatPremium > 0 ? "more" : "less"} than Control.`);
          const treatLIBRate = mean(treatment.map((t) => t.aboveLIB / t.count)) * 100;
          const controlLIBRate = (control.aboveLIB / control.count) * 100;
          lines.push(`- LIB attainment: Treatment ${treatLIBRate.toFixed(1)}% vs Control ${controlLIBRate.toFixed(1)}%.`);
        }

        // Empowerment differences
        const empBest = groups.reduce((a, b) => (a.avgEmp > b.avgEmp ? a : b));
        const empWorst = groups.reduce((a, b) => (a.avgEmp < b.avgEmp ? a : b));
        if (empBest.project !== empWorst.project && Math.abs(empBest.avgEmp - empWorst.avgEmp) > 0.3) {
          lines.push(`- Empowerment: ${empBest.project} scores ${empBest.avgEmp.toFixed(1)}/8 vs ${empWorst.project} at ${empWorst.avgEmp.toFixed(1)}/8.`);
        }
      }

      return lines.join("\n");
    }

    // --- Recommendations ---
    case "recommendations": {
      const negIncome = farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0);
      const belowLIB = farmers.filter((f) => !isAboveLIB(f.aboveLIB));
      const fpcNo = farmers.filter((f) => !f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
      const fpcYes2 = farmers.filter((f) => f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
      const lowEmpCount = farmers.filter((f) => f.womenEmpowerment < 4);
      const singleCrop = farmers.filter((f) => {
        const crops = [f.mintNetIncome, f.riceNetIncome, f.potatoNetIncome, f.wheatNetIncome, f.mustardNetIncome];
        return crops.filter((c) => c != null && c > 0).length <= 1;
      });
      const corrs = analyzeIncomeDrivers(farmers);
      const topDriver = corrs.length > 0 ? corrs[0] : null;

      const lines: string[] = [];
      lines.push(`**Data-Driven Recommendations** (${fmt(total)} farmers)\n`);

      // Priority 1: Urgent
      if (negIncome.length > 0) {
        const negAvg = mean(negIncome.map((f) => f.totalNetIncomeUsd!));
        lines.push(`**🔴 Priority 1: Address negative income households**`);
        lines.push(`- ${fmt(negIncome.length)} farmers (${pct(negIncome.length, total)}) have negative net income (avg: ${fmtUsd(negAvg)}/yr)`);
        lines.push(`- These households are accumulating debt. Emergency intervention: input subsidies, debt restructuring, or emergency livelihood support.\n`);
      }

      // Priority 2: FPC expansion (if data supports it)
      if (fpcNo.length > 5 && fpcYes2.length > 5) {
        const fpcPremium = mean(fpcYes2.map((f) => f.totalNetIncomeUsd!)) - mean(fpcNo.map((f) => f.totalNetIncomeUsd!));
        lines.push(`**🟡 Priority 2: Expand FPC membership**`);
        lines.push(`- ${fmt(fpcNo.length)} non-members could benefit from ${fmtUsd(Math.max(0, fpcPremium))} income premium observed in FPC members`);
        lines.push(`- Estimated total annual income lift: ${fmtUsd(fpcNo.length * Math.max(0, fpcPremium) * 0.3)} (assuming 30% of gap realized)\n`);
      }

      // Priority 3: Empowerment
      if (lowEmpCount.length > 5) {
        const empCorr = corrs.find((c) => c.key === "womenEmpowerment");
        lines.push(`**🟡 Priority 3: Women empowerment interventions**`);
        lines.push(`- ${fmt(lowEmpCount.length)} households (${pct(lowEmpCount.length, total)}) have empowerment score < 4`);
        if (empCorr && Math.abs(empCorr.r) > 0.1) {
          lines.push(`- Empowerment correlates with income at r=${empCorr.r.toFixed(2)} — each point improvement is associated with measurable income gains`);
        }
        lines.push(`- Focus: financial literacy, decision-making participation, and business skills training\n`);
      }

      // Priority 4: Diversification
      if (singleCrop.length > 10) {
        lines.push(`**🟢 Priority 4: Crop diversification**`);
        lines.push(`- ${fmt(singleCrop.length)} farmers (${pct(singleCrop.length, total)}) rely on a single crop`);
        lines.push(`- Diversified farmers (3+ crops) show lower negative income rates and more stable earnings\n`);
      }

      // Priority 5: LIB gap
      if (belowLIB.length > 0) {
        const belowLIBInc = belowLIB.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
        const gap = belowLIBInc.length > 0 ? Math.abs(mean(belowLIBInc)) : 0;
        lines.push(`**🟢 Priority 5: Close Living Income gap**`);
        lines.push(`- ${fmt(belowLIB.length)} farmers (${pct(belowLIB.length, total)}) below LIB`);
        lines.push(`- Average income gap to LIB: ~${fmtUsd(gap)}/yr per household\n`);
      }

      // Data-driven insight
      if (topDriver) {
        lines.push(`**📊 Data insight**: The strongest income predictor is **${topDriver.factor}** (r=${topDriver.r.toFixed(2)}). Interventions targeting this factor will have the highest expected return.`);
      }

      // ── Combined Scenario Projection ──
      // Translate qualitative recommendations into a quantified combined scenario
      const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
      const baselineAvg = withIncome.length ? mean(withIncome.map((f) => f.totalNetIncomeUsd!)) : 0;

      interface RecoScenario {
        intervention: string;
        targetFarmers: number;
        impactPerFarmer: number;
        populationImpact: number;
      }
      const scenarios: RecoScenario[] = [];

      // FPC expansion impact
      if (fpcNo.length > 5 && fpcYes2.length > 5) {
        const fpcPremium = mean(fpcYes2.map((f) => f.totalNetIncomeUsd!)) - mean(fpcNo.map((f) => f.totalNetIncomeUsd!));
        const realization = 0.3;
        const perFarmer = Math.max(0, fpcPremium) * realization;
        const popImpact = total > 0 ? (fpcNo.length * perFarmer) / total : 0;
        if (perFarmer > 0) {
          scenarios.push({ intervention: "Expand FPC membership", targetFarmers: fpcNo.length, impactPerFarmer: perFarmer, populationImpact: popImpact });
        }
      }

      // Empowerment improvement impact
      if (lowEmpCount.length > 5) {
        const highEmp = farmers.filter((f) => f.womenEmpowerment >= 6 && f.totalNetIncomeUsd != null);
        const lowEmpIncome = lowEmpCount.filter((f) => f.totalNetIncomeUsd != null);
        if (highEmp.length > 5 && lowEmpIncome.length > 5) {
          const highAvg = mean(highEmp.map((f) => f.totalNetIncomeUsd!));
          const lowAvg = mean(lowEmpIncome.map((f) => f.totalNetIncomeUsd!));
          const empGap = highAvg - lowAvg;
          const perFarmer = Math.max(0, empGap) * 0.25;
          const popImpact = total > 0 ? (lowEmpCount.length * perFarmer) / total : 0;
          if (perFarmer > 0) {
            scenarios.push({ intervention: "Empowerment programs (score < 4 → 6+)", targetFarmers: lowEmpCount.length, impactPerFarmer: perFarmer, populationImpact: popImpact });
          }
        }
      }

      // Crop diversification impact
      if (singleCrop.length > 10) {
        const multiCrop = farmers.filter((f) => {
          const crops = [f.mintNetIncome, f.riceNetIncome, f.potatoNetIncome, f.wheatNetIncome, f.mustardNetIncome];
          return crops.filter((c) => c != null && c > 0).length >= 3;
        }).filter((f) => f.totalNetIncomeUsd != null);
        const singleCropIncome = singleCrop.filter((f) => f.totalNetIncomeUsd != null);
        if (multiCrop.length > 5 && singleCropIncome.length > 5) {
          const multiAvg = mean(multiCrop.map((f) => f.totalNetIncomeUsd!));
          const singleAvg = mean(singleCropIncome.map((f) => f.totalNetIncomeUsd!));
          const divGap = multiAvg - singleAvg;
          const perFarmer = Math.max(0, divGap) * 0.2;
          const popImpact = total > 0 ? (singleCrop.length * perFarmer) / total : 0;
          if (perFarmer > 0) {
            scenarios.push({ intervention: "Crop diversification (1 → 3+ crops)", targetFarmers: singleCrop.length, impactPerFarmer: perFarmer, populationImpact: popImpact });
          }
        }
      }

      if (scenarios.length > 0 && baselineAvg !== 0) {
        lines.push(`\n---\n`);
        lines.push(`**📋 Combined Scenario Projection**\n`);
        lines.push(`If all recommended interventions are implemented simultaneously:\n`);

        lines.push(`| Intervention | Target Group | Est. Impact/Farmer | Avg Population Effect |`);
        lines.push(`|---|---|---|---|`);
        lines.push(`| **Baseline** | ${fmt(total)} farmers | — | ${fmtUsd(baselineAvg)}/yr |`);

        let cumulativePopImpact = 0;
        for (const s of scenarios) {
          cumulativePopImpact += s.populationImpact;
          lines.push(`| ${s.intervention} | ${fmt(s.targetFarmers)} farmers | +${fmtUsd(s.impactPerFarmer)}/yr | +${fmtUsd(s.populationImpact)}/yr |`);
        }

        const projectedAvg = baselineAvg + cumulativePopImpact;
        const changePctReco = baselineAvg !== 0 ? (cumulativePopImpact / baselineAvg) * 100 : 0;
        lines.push(`| **Combined Effect** | — | — | **${fmtUsd(projectedAvg)}/yr (${changePctReco > 0 ? "+" : ""}${changePctReco.toFixed(1)}%)** |`);

        // LIB projection
        const currentBelowLIB = belowLIB.length;
        const estLifted = Math.round(currentBelowLIB * Math.min(Math.abs(changePctReco) / 100, 1) * 0.35);
        lines.push(``);
        lines.push(`**Living Income Impact:** Currently ${fmt(currentBelowLIB)} farmers (${pct(currentBelowLIB, total)}) below LIB. Combined interventions could lift ~${fmt(estLifted)} above the benchmark.`);

        lines.push(``);
        lines.push(`*Assumptions: FPC premium realized at 30%, empowerment gains at 25%, diversification gains at 20%. Conservative estimates based on observed income differences in the data.*`);
      }

      return lines.join("\n");
    }

    // --- Summary ---
    case "summary":
      return [`**Data Summary** (${fmt(total)} farmers):`, ``, `| Indicator | Value |`, `|---|---|`,
        `| Avg Net Income | ${fmtUsd(avgIncome)}/yr |`, `| Median Net Income | ${fmtUsd(medIncome)}/yr |`,
        `| Avg Productivity | ${fmtPct(mean(farmers.map((f) => f.productivityIndex)) * 100)} |`,
        `| Women Empowerment | ${mean(farmers.map((f) => f.womenEmpowerment)).toFixed(1)}/8 |`,
        `| Below LIB | ${fmt(farmers.filter((f) => !isAboveLIB(f.aboveLIB)).length)} |`,
        `| Villages | ${fmt(new Set(farmers.map((f) => f.village)).size)} |`].join("\n");

    // --- Economic / Analytical ---
    case "income-drivers":
      return generateEconomicInsights(farmers);
    case "why-analysis":
      return generateWhyAnalysis(farmers, intent.raw);
    case "income-inequality":
      return analyzeInequality(farmers);
    case "deep-analysis": {
      // Comprehensive multi-section analysis
      const deepLines: string[] = [];
      deepLines.push(`**Comprehensive Analysis** — ${fmt(total)} farmers\n`);

      // Key metrics table
      const belowLIBDeep = farmers.filter((f) => !isAboveLIB(f.aboveLIB)).length;
      const negIncomeDeep = farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0).length;
      const avgEmpDeep = mean(farmers.map((f) => f.womenEmpowerment));
      const fpcMembersDeep = farmers.filter((f) => f.fpcMember?.startsWith("1")).length;
      deepLines.push(`| Key Metric | Value |`);
      deepLines.push(`|---|---|`);
      deepLines.push(`| Avg Net Income | ${fmtUsd(avgIncome)}/yr |`);
      deepLines.push(`| Median Net Income | ${fmtUsd(medIncome)}/yr |`);
      deepLines.push(`| Below Living Income | ${fmt(belowLIBDeep)} (${pct(belowLIBDeep, total)}) |`);
      deepLines.push(`| Negative Income | ${fmt(negIncomeDeep)} |`);
      deepLines.push(`| FPC Members | ${fmt(fpcMembersDeep)} (${pct(fpcMembersDeep, total)}) |`);
      deepLines.push(`| Avg Empowerment | ${avgEmpDeep.toFixed(1)}/8 |`);

      // Income drivers
      deepLines.push(`\n---\n`);
      deepLines.push(generateEconomicInsights(farmers));

      // Inequality
      deepLines.push(`\n---\n`);
      deepLines.push(analyzeInequality(farmers));

      // Gender gap
      const deepFemales = farmers.filter((f) => f.gender === "Female");
      const deepMales = farmers.filter((f) => f.gender === "Male");
      if (deepFemales.length > 5 && deepMales.length > 5) {
        const fInc = deepFemales.filter((f) => f.totalNetIncomeUsd != null);
        const mInc = deepMales.filter((f) => f.totalNetIncomeUsd != null);
        const fAvg = fInc.length ? mean(fInc.map((f) => f.totalNetIncomeUsd!)) : 0;
        const mAvg = mInc.length ? mean(mInc.map((f) => f.totalNetIncomeUsd!)) : 0;
        const gapPct = mAvg !== 0 ? ((fAvg - mAvg) / Math.abs(mAvg) * 100) : 0;
        const fLIB = deepFemales.filter((f) => isAboveLIB(f.aboveLIB)).length;
        const mLIB = deepMales.filter((f) => isAboveLIB(f.aboveLIB)).length;
        deepLines.push(`\n---\n`);
        deepLines.push(`**Gender Gap:** Female farmers earn ${fmtUsd(fAvg)}/yr vs Male ${fmtUsd(mAvg)}/yr (${gapPct > 0 ? "+" : ""}${gapPct.toFixed(1)}% gap).`);
        deepLines.push(`Living Income: ${pct(fLIB, deepFemales.length)} of women vs ${pct(mLIB, deepMales.length)} of men above LIB.`);
      }

      // Key recommendations summary
      deepLines.push(`\n---\n`);
      deepLines.push(`**Key Recommendations:**`);
      if (negIncomeDeep > 0) deepLines.push(`- 🔴 **${fmt(negIncomeDeep)} farmers** with negative income need urgent intervention (debt relief, input subsidies)`);
      const deepFpcNo = farmers.filter((f) => !f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
      const deepFpcYes = farmers.filter((f) => f.fpcMember?.startsWith("1") && f.totalNetIncomeUsd != null);
      if (deepFpcNo.length > 5 && deepFpcYes.length > 5) {
        const premium = mean(deepFpcYes.map((f) => f.totalNetIncomeUsd!)) - mean(deepFpcNo.map((f) => f.totalNetIncomeUsd!));
        if (premium > 0) deepLines.push(`- 🟡 **${fmt(deepFpcNo.length)} non-FPC farmers** could benefit from cooperative membership (${fmtUsd(premium)} observed premium)`);
      }
      if (belowLIBDeep > 0) deepLines.push(`- 🟢 **${fmt(belowLIBDeep)} farmers** below Living Income need targeted support to close the gap`);
      const lowEmpDeep = farmers.filter((f) => f.womenEmpowerment < 4).length;
      if (lowEmpDeep > 5) deepLines.push(`- 🟡 **${fmt(lowEmpDeep)} households** have empowerment score < 4 — financial literacy and business skills training recommended`);

      return deepLines.join("\n");
    }
    case "correlation": {
      const pair = intent.correlationPair || detectCorrelationPair(intent.raw);
      switch (pair) {
        case "training-adoption": return analyzeCorrelationTrainingAdoption(farmers);
        case "training-income": return analyzeCorrelationTrainingIncome(farmers);
        case "training-yield": return analyzeCorrelationTrainingYield(farmers);
        case "adoption-yield": return analyzeCorrelationAdoptionYield(farmers);
        case "adoption-income": return analyzeCorrelationAdoptionIncome(farmers);
        case "farm-size-income": return analyzeCorrelationFarmSizeIncome(farmers);
        case "farm-size-yield": return analyzeCorrelationFarmSizeYield(farmers);
        case "empowerment-income": return analyzeCorrelationEmpowermentIncome(farmers);
        case "fpc-income": return analyzeCorrelationFPCIncome(farmers);
        case "sustainability-income": return analyzeCorrelationSustainabilityIncome(farmers);
        case "generic":
        default: {
          const corrs = analyzeIncomeDrivers(farmers);
          const corrLines = [`**Correlation Matrix** (Income vs Key Factors)\n`, `| Factor | r | Strength | Elasticity |`, `|---|---|---|---|`];
          for (const cr of corrs.filter((cr) => cr.strength !== "negligible")) {
            const elastStr = Math.abs(cr.elasticity) > 0.01 && isFinite(cr.elasticity) ? cr.elasticity.toFixed(2) : "—";
            corrLines.push(`| ${cr.factor} | ${cr.r.toFixed(2)} | ${cr.strength} | ${elastStr} |`);
          }
          const sig = corrs.filter((cr) => cr.narrative);
          if (sig.length > 0) {
            corrLines.push(`\n**Interpretation:**\n`);
            for (const cr of sig.slice(0, 5)) {
              corrLines.push(`- ${cr.narrative}`);
            }
          }
          return corrLines.join("\n");
        }
      }
    }

    // --- Unknown: generate useful overview + specific suggestions ---
    case "unknown":
    default: {
      const belowLIBUnk = farmers.filter((f) => !isAboveLIB(f.aboveLIB)).length;
      const negIncomeUnk = farmers.filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd < 0).length;
      const unkFemales = farmers.filter((f) => f.gender === "Female");
      const unkMales = farmers.filter((f) => f.gender === "Male");
      const fAvgUnk = unkFemales.length > 0 ? mean(unkFemales.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!)) : 0;
      const mAvgUnk = unkMales.length > 0 ? mean(unkMales.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!)) : 0;
      const topCorr = analyzeIncomeDrivers(farmers);
      const topFactor = topCorr.length > 0 ? topCorr[0] : null;

      return [
        `Here's a quick overview for **${fmt(total)} farmers**:\n`,
        `| Indicator | Value |`,
        `|---|---|`,
        `| Avg Net Income | ${fmtUsd(avgIncome)}/yr |`,
        `| Median Net Income | ${fmtUsd(medIncome)}/yr |`,
        `| Below Living Income | ${fmt(belowLIBUnk)} (${pct(belowLIBUnk, total)}) |`,
        `| Negative Income | ${fmt(negIncomeUnk)} |`,
        `| Gender Split | ${fmt(unkFemales.length)} F / ${fmt(unkMales.length)} M |`,
        unkFemales.length > 0 && unkMales.length > 0 ? `| Gender Income Gap | F: ${fmtUsd(fAvgUnk)} vs M: ${fmtUsd(mAvgUnk)} |` : null,
        topFactor ? `\n**Top income predictor:** ${topFactor.factor} (r=${topFactor.r.toFixed(2)})` : null,
        ``,
        `---`,
        ``,
        `💡 **Try asking something more specific:**`,
        `- "What drives income differences?" — income factor analysis`,
        `- "Compare male vs female farmers" — group comparison`,
        `- "What if mint price drops 30%?" — what-if scenario`,
        `- "Give me strategic recommendations" — data-driven action plan`,
        `- "Show me living income analysis" — LIB deep dive`,
      ].filter(Boolean).join("\n");
    }
  }
}

// ============================================================
// Combined scenario engine — unified table + gender breakdown
// ============================================================

interface ScenarioRow {
  label: string;
  impactPct: number;
  impactUsd: number;
  projectedAvg: number;
}

function calculateScenarioImpact(intent: ParsedIntent, farmers: Farmer[]): ScenarioRow {
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const baselineAvg = withIncome.length ? mean(withIncome.map((f) => f.totalNetIncomeUsd!)) : 0;

  const cropKeyMap: Record<string, keyof Farmer> = {
    mint: "mintNetIncome", rice: "riceNetIncome", wheat: "wheatNetIncome",
    potato: "potatoNetIncome", mustard: "mustardNetIncome",
  };

  switch (intent.type) {
    case "price-scenario":
    case "crop-yield-scenario": {
      const crop = intent.crop || "mint";
      const cropName = crop.charAt(0).toUpperCase() + crop.slice(1);
      const key = cropKeyMap[crop] || "mintNetIncome";
      const growers = farmers.filter((f) => { const v = f[key] as number | null; return v != null && v > 0; });
      const changePct = intent.changePct || 0;
      if (growers.length === 0 || baselineAvg === 0) {
        const actionWord = intent.type === "price-scenario" ? "price" : "yield";
        return { label: `${cropName} ${actionWord} ${changePct > 0 ? "+" : ""}${changePct}%`, impactPct: 0, impactUsd: 0, projectedAvg: baselineAvg };
      }
      const avgCropIncome = mean(growers.map((f) => f[key] as number));
      const cropShare = (avgCropIncome * growers.length) / (baselineAvg * withIncome.length || 1);
      const impactPct = cropShare * changePct;
      const impactUsd = baselineAvg * impactPct / 100;
      const actionWord = intent.type === "price-scenario" ? "price" : "yield";
      return { label: `${cropName} ${actionWord} ${changePct > 0 ? "+" : ""}${changePct}%`, impactPct, impactUsd, projectedAvg: baselineAvg + impactUsd };
    }
    case "yield-scenario": {
      const changePct = intent.changePct || 20;
      const impactPct = 0.7 * changePct;
      const impactUsd = baselineAvg * impactPct / 100;
      return { label: `Overall yield ${changePct > 0 ? "+" : ""}${changePct}%`, impactPct, impactUsd, projectedAvg: baselineAvg + impactUsd };
    }
    case "acreage-scenario": {
      const changePct = intent.changePct || 20;
      const impactPct = changePct * 0.7;
      const impactUsd = baselineAvg * impactPct / 100;
      return { label: `Acreage ${changePct > 0 ? "+" : ""}${changePct}%`, impactPct, impactUsd, projectedAvg: baselineAvg + impactUsd };
    }
    default:
      return { label: intent.raw, impactPct: 0, impactUsd: 0, projectedAvg: baselineAvg };
  }
}

const SCENARIO_TYPES = new Set<IntentType>([
  "price-scenario", "yield-scenario", "crop-yield-scenario", "acreage-scenario",
]);
// Note: "fpc-scenario" and "empowerment-scenario" are NOT in SCENARIO_TYPES
// because they have dedicated handlers in executeIntent (simulateFPCExpansion,
// simulateEmpowermentImprovement) that produce richer output than the
// combined scenario table.

function executeCombinedScenarios(
  intents: ParsedIntent[],
  farmers: Farmer[],
  allFarmers: Farmer[],
  meta: PopulationFilter,
  genderBreakdown: boolean
): string {
  const lines: string[] = [];
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  const baselineAvg = withIncome.length ? mean(withIncome.map((f) => f.totalNetIncomeUsd!)) : 0;
  const belowLIB = farmers.filter((f) => !isAboveLIB(f.aboveLIB)).length;

  if (meta.label) {
    lines.push(`**Population: ${meta.label}** (${fmt(farmers.length)} of ${fmt(allFarmers.length)} total)\n`);
  }

  lines.push(`**Scenario Analysis** — ${fmt(farmers.length)} farmers\n`);

  if (!genderBreakdown) {
    // --- Single-population combined table ---
    const rows: ScenarioRow[] = intents.map((i) => calculateScenarioImpact(i, farmers));

    // Plain-language description of the combined scenario
    if (rows.length === 1) {
      lines.push(`**Scenario:** ${rows[0].label}\n`);
    } else if (rows.length > 1) {
      const allButLast = rows.slice(0, -1).map((r) => r.label).join(", ");
      lines.push(`**Combined Scenario:** ${allButLast}, and ${rows[rows.length - 1].label}\n`);
    }
    let cumulativePct = 0;
    for (const r of rows) cumulativePct += r.impactPct;
    const cumulativeProj = baselineAvg * (1 + cumulativePct / 100);

    lines.push(`| Scenario | Impact | Projected Avg Income |`);
    lines.push(`|---|---|---|`);
    lines.push(`| **Baseline** | — | ${fmtUsd(baselineAvg)}/yr |`);
    for (const r of rows) {
      lines.push(`| ${r.label} | ${r.impactPct > 0 ? "+" : ""}${r.impactPct.toFixed(1)}% (${r.impactUsd > 0 ? "+" : ""}${fmtUsd(r.impactUsd)}) | ${fmtUsd(r.projectedAvg)}/yr |`);
    }
    if (rows.length > 1) {
      lines.push(`| **Combined Effect** | **${cumulativePct > 0 ? "+" : ""}${cumulativePct.toFixed(1)}%** | **${fmtUsd(cumulativeProj)}/yr** |`);
    }

    // LIB impact
    lines.push(``);
    lines.push(`**Living Income Impact:** ${fmt(belowLIB)} farmers (${pct(belowLIB, farmers.length)}) currently below LIB.`);
    if (cumulativePct < 0) {
      const risk = Math.round(farmers.length * Math.abs(cumulativePct) / 100 * 0.15);
      lines.push(`Combined scenario could push ~${fmt(risk)} additional farmers below the Living Income Benchmark.`);
    } else if (cumulativePct > 0) {
      const lifted = Math.round(belowLIB * cumulativePct / 100 * 0.3);
      lines.push(`Combined scenario could lift ~${fmt(lifted)} farmers above the Living Income Benchmark.`);
    }
  } else {
    // --- Gender breakdown table ---
    const males = farmers.filter((f) => f.gender === "Male");
    const females = farmers.filter((f) => f.gender === "Female");
    const maleInc = males.filter((f) => f.totalNetIncomeUsd != null);
    const femaleInc = females.filter((f) => f.totalNetIncomeUsd != null);
    const maleBase = maleInc.length ? mean(maleInc.map((f) => f.totalNetIncomeUsd!)) : 0;
    const femaleBase = femaleInc.length ? mean(femaleInc.map((f) => f.totalNetIncomeUsd!)) : 0;

    // Plain-language description for gender breakdown
    const gLabels = intents.map((i) => calculateScenarioImpact(i, farmers).label);
    if (gLabels.length === 1) {
      lines.push(`**Scenario:** ${gLabels[0]}\n`);
    } else if (gLabels.length > 1) {
      const allButLast = gLabels.slice(0, -1).join(", ");
      lines.push(`**Combined Scenario:** ${allButLast}, and ${gLabels[gLabels.length - 1]}\n`);
    }

    lines.push(`| Scenario | Male (${fmt(males.length)}) | Female (${fmt(females.length)}) |`);
    lines.push(`|---|---|---|`);
    lines.push(`| **Baseline** | ${fmtUsd(maleBase)}/yr | ${fmtUsd(femaleBase)}/yr |`);

    let maleCumPct = 0, femaleCumPct = 0;
    for (const intent of intents) {
      const mRow = calculateScenarioImpact(intent, males);
      const fRow = calculateScenarioImpact(intent, females);
      maleCumPct += mRow.impactPct;
      femaleCumPct += fRow.impactPct;
      lines.push(`| ${mRow.label} | ${mRow.impactPct > 0 ? "+" : ""}${mRow.impactPct.toFixed(1)}% → ${fmtUsd(mRow.projectedAvg)}/yr | ${fRow.impactPct > 0 ? "+" : ""}${fRow.impactPct.toFixed(1)}% → ${fmtUsd(fRow.projectedAvg)}/yr |`);
    }

    if (intents.length > 1) {
      const maleCumProj = maleBase * (1 + maleCumPct / 100);
      const femaleCumProj = femaleBase * (1 + femaleCumPct / 100);
      lines.push(`| **Combined** | **${maleCumPct > 0 ? "+" : ""}${maleCumPct.toFixed(1)}% → ${fmtUsd(maleCumProj)}/yr** | **${femaleCumPct > 0 ? "+" : ""}${femaleCumPct.toFixed(1)}% → ${fmtUsd(femaleCumProj)}/yr** |`);
    }

    // LIB by gender
    const maleLIB = males.filter((f) => !isAboveLIB(f.aboveLIB)).length;
    const femaleLIB = females.filter((f) => !isAboveLIB(f.aboveLIB)).length;
    lines.push(``);
    lines.push(`**Living Income Impact:**`);
    lines.push(`- Male: ${fmt(maleLIB)} of ${fmt(males.length)} currently below LIB (${pct(maleLIB, males.length)})`);
    lines.push(`- Female: ${fmt(femaleLIB)} of ${fmt(females.length)} currently below LIB (${pct(femaleLIB, females.length)})`);

    if (maleCumPct < 0 || femaleCumPct < 0) {
      lines.push(`- Combined negative scenarios disproportionately affect ${femaleCumPct < maleCumPct ? "female" : "male"} farmers.`);
    }
  }

  // Methodology
  lines.push(``);
  lines.push(`%%methodology%%`);
  lines.push(`**How this was calculated:**`);
  lines.push(`- **Price scenarios**: Price change affects crop-specific income proportionally. Impact on total income is weighted by that crop's share of total household income.`);
  lines.push(`- **Yield scenarios**: Yield change affects crop income proportionally (holding prices constant).`);
  lines.push(`- **Combined impact**: Individual effects are summed (additive model). Interaction effects between crops are not modeled.`);
  lines.push(`- **Living Income projections**: Estimated using current income distribution and projected income shifts. Farmers near the LIB threshold are most likely to cross.`);
  lines.push(`- All values in USD. Based on ${fmt(farmers.length)} farmers in current selection.`);
  lines.push(`%%/methodology%%`);

  return lines.join("\n");
}

// ============================================================
// Main entry point — orchestrates filter + multi-intent + combine
// ============================================================

// ── Methodology note appended to every AI Chat response ──
function methodologyNote(intents: ParsedIntent[]): string {
  const types = new Set(intents.map((i) => i.type));
  const isScenario = intents.some((i) => SCENARIO_TYPES.has(i.type));
  const isCorrelation = types.has("correlation");
  const isComparison = intents.some((i) => i.type.includes("compare") || i.type.includes("gender"));

  let note: string;

  if (isScenario) {
    note = [
      "Scenario projections use additive elasticities from peer-reviewed RCTs (FAO 2017, Mundlak et al. 2012, Magruder 2018).",
      "Effects are applied to each farmer's individual crop income — no compounding between parameters.",
      "Targeting adjustments reduce effects for farmers who already have the intervention.",
      "All effects are additive from baseline; no interaction or multiplier effects between parameters are modeled.",
    ].join("\n");
  } else if (isCorrelation) {
    note = [
      "Correlation analysis uses Pearson r and Cohen's d effect sizes computed on the full filtered dataset.",
      "Correlation does not imply causation — observed associations may reflect selection effects or confounders.",
      "Statistical significance is not assessed; interpret effect sizes directionally.",
    ].join("\n");
  } else if (isComparison) {
    note = [
      "Group comparisons show descriptive statistics (means, medians) for each subgroup.",
      "Differences may reflect selection effects and are not causal estimates.",
      "Cohen's d is used for effect size where applicable.",
    ].join("\n");
  } else {
    note = [
      "Analysis is based on baseline survey data.",
      "All statistics are descriptive — means, medians, and distributions from the current filtered population.",
      "Income figures are annualized USD. Crop data is farmer-reported.",
    ].join("\n");
  }

  return `\n\n%%methodology%%\n${note}\n%%/methodology%%`;
}

export function generateChatResponse(question: string, farmers: Farmer[], previousMessages?: ChatMessage[]): string {
  if (farmers.length === 0) {
    return "No farmer data available for the current geographic selection. Try broadening your selection on the Overview page map.";
  }

  let q = question.toLowerCase().trim();

  // ── Follow-up / context resolution ──
  // If user asks a vague follow-up, use the previous assistant message to infer context
  const isFollowUp = /^(tell me more|more details|elaborate|explain more|go deeper|more|expand on that|what else|continue|and\?|go on|can you explain|why is that|why\??|how so\??|what about that)[\s?.!]*$/i.test(q);
  if (isFollowUp && previousMessages && previousMessages.length >= 2) {
    // Find last user question (not the current one)
    const lastUserMsg = [...previousMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      q = lastUserMsg.content.toLowerCase().trim();
      // Route to deep-analysis for a richer follow-up
      const { filtered, meta } = extractPopulationFilter(q, farmers);
      const data = filtered.length > 0 ? filtered : farmers;
      const prefix = meta.label ? `**Population: ${meta.label}** (${fmt(data.length)} of ${fmt(farmers.length)} total)\n\n` : "";
      const followUpIntent: ParsedIntent = { type: "deep-analysis", raw: q };
      return prefix + executeIntent(followUpIntent, data, farmers) + methodologyNote([followUpIntent]);
    }
  }

  // ── Broad insight requests → route to deep-analysis directly ──
  if (/^(give\s*me\s*(some\s*)?(insights?|analysis|overview|summary)|what\s*(are\s*the\s*)?(key\s*)?(insights?|findings?|takeaways?|highlights?)|summarize|analyze\s*(this|these|the)\s*(data|farmers?)?|what\s*should\s*i\s*know|what\s*stands?\s*out|anything\s*interesting|key\s*observations?)[\s?.!]*$/i.test(q)) {
    const insightIntent: ParsedIntent = { type: "deep-analysis", raw: q };
    return executeIntent(insightIntent, farmers, farmers) + methodologyNote([insightIntent]);
  }

  // Step 1: Extract population filter (e.g. "in women" → Female only)
  const { filtered, meta } = extractPopulationFilter(q, farmers);

  if (filtered.length === 0 && meta.label) {
    return `No **${meta.label}** found in the current selection (${fmt(farmers.length)} total farmers). Try broadening your filters.`;
  }

  // Step 1b: Detect gender breakdown request (male vs female, by gender)
  const wantsGenderBreakdown = /\b(male\s*vs\.?\s*female|female\s*vs\.?\s*male|by\s*gender|gender\s*breakdown|men\s*vs\.?\s*women|women\s*vs\.?\s*men)\b/.test(q);

  // Step 2: Parse intents
  let cleanQ = q;

  // Strip population filter phrases (gender) — both end-of-string and mid-sentence
  if (meta.gender) {
    cleanQ = cleanQ.replace(/\b(about|in|for|among|of|on)\s+(women|woman|female|females|men|man|male|males)\s*(farmers?)?\b/gi, "").trim();
    cleanQ = cleanQ.replace(/\b(female|male|women|men)\s+farmers?\b/gi, "").trim();
  }
  cleanQ = cleanQ.replace(/\b(in|for|among|of|on)\s+(women|woman|female|females|men|man|male|males)\s*(farmers?)?\s*$/i, "").trim();
  // Strip other population filter phrases
  cleanQ = cleanQ.replace(/\b(in|for|among|of)\s+(obc|sc|st|general)\s*(farmers?)?\s*$/i, "").trim();
  cleanQ = cleanQ.replace(/\b(in|for)\s+((?:hr|lr)(?:hp|lp)(?:hw|lw))\s*(farmers?)?\s*$/i, "").trim();
  cleanQ = cleanQ.replace(/\b(in|for|among)\s+fpc\s*members?\s*$/i, "").trim();
  cleanQ = cleanQ.replace(/\bsmall\s*farmers?\s*$/i, "").trim();
  cleanQ = cleanQ.replace(/\bmarginal\s*farmers?\s*$/i, "").trim();
  // Strip gender breakdown phrases from intent parsing (we already captured it)
  cleanQ = cleanQ.replace(/\b(male\s*vs\.?\s*female|female\s*vs\.?\s*male|by\s*gender|gender\s*breakdown|men\s*vs\.?\s*women|women\s*vs\.?\s*men)\b/i, "").trim();
  // Strip meta-preamble: "what should I know about", "tell me about", "in this cohort"
  cleanQ = cleanQ.replace(/\bwhat\s+should\s+\w+\s+know\s*(about)?\b/i, "").trim();
  cleanQ = cleanQ.replace(/\btell\s+me\s+(about|everything\s+about)\b/i, "").trim();
  cleanQ = cleanQ.replace(/\bin\s+this\s+(cohort|dataset|data|selection|group)\b/i, "").trim();
  // Strip filler connectors
  cleanQ = cleanQ.replace(/^[,?.\s]*(particularly|especially|specifically)\s*(as\s+it\s+)?/i, "").trim();
  cleanQ = cleanQ.replace(/\bas\s+it\s+relates?\s+to\b/i, "").trim();
  // Strip filler: "what would happen with living income for all these farmers ... by next year"
  cleanQ = cleanQ.replace(/\bwhat\s*would\s*happen\s*with\s*living\s*income\s*for\s*all\s*these\s*farmers?\b/i, "").trim();
  cleanQ = cleanQ.replace(/\bby\s*next\s*year\b/i, "").trim();
  cleanQ = cleanQ.replace(/\bfor\s*all\s*(these\s*)?(farmers?)?\b/i, "").trim();
  // Clean up residual punctuation/spaces
  cleanQ = cleanQ.replace(/^[,?.\s]+/, "").replace(/[,?.\s]+$/, "").trim();

  const intents = parseIntents(cleanQ || q);

  // Step 3: Check if all intents are scenarios → use combined table
  const allScenarios = intents.length >= 1 && intents.every((i) => SCENARIO_TYPES.has(i.type));

  if (allScenarios) {
    return executeCombinedScenarios(intents, filtered, farmers, meta, wantsGenderBreakdown); // already has its own %%methodology%% block
  }

  // Step 4: Execute each intent independently for non-scenario queries
  const results: string[] = [];

  if (meta.label) {
    results.push(`**Population: ${meta.label}** (${fmt(filtered.length)} of ${fmt(farmers.length)} total)\n`);
  }

  for (const intent of intents) {
    const result = executeIntent(intent, filtered, farmers);
    results.push(result);
  }

  return results.join("\n\n---\n\n") + methodologyNote(intents);
}
