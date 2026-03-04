import { Farmer } from "../data/types";
import { mean, median } from "./statistics";

export interface ScenarioParams {
  cropPrices: Record<string, number>; // crop name -> % change
  yieldChanges: Record<string, number>; // crop name -> % change in yield (per crop)
  acreageChange: number; // % change in acreage
  financialAccessChange: number; // % change in financial services adoption
  trainingChange: number; // % change in training participation
  safetyNetChange: number; // % change in safety net access
  offFarmChange: number; // % change in off-farm diversification
}

export interface ScenarioBreakdown {
  label: string;
  currentValue: number;
  projectedValue: number;
  changePercent: number;
}

export interface ScenarioResult {
  currentAvgIncome: number;
  projectedAvgIncome: number;
  currentMedianIncome: number;
  projectedMedianIncome: number;
  currentAboveLIB: number;
  projectedAboveLIB: number;
  currentBelowLIB: number;
  projectedBelowLIB: number;
  totalFarmers: number;
  incomeChangePercent: number;
  breakdown: ScenarioBreakdown[];
}

const CROP_INCOME_KEYS: Record<string, keyof Farmer> = {
  mint: "mintNetIncome",
  rice: "riceNetIncome",
  potato: "potatoNetIncome",
  wheat: "wheatNetIncome",
  mustard: "mustardNetIncome",
};

// Living income benchmark: $4,933.50/year household total
// Original pipeline: above_LIB = 'Yes' when total_net_income_usd > 4933.50
const LIB_HH_ANNUAL = 4933.50;

/* ────────────────────────────────────────────────────────────────────────────
 * METHODOLOGY NOTES (also displayed in UI)
 *
 * All effects are ADDITIVE from the baseline income — no compounding.
 * Each slider independently estimates a delta (∆) on the farmer's income.
 * Final projected = baseline + ∆_prices + ∆_yield + ∆_acreage + ∆_interventions.
 *
 * CROP PRICES — Direct / arithmetic
 *   If farmer earns $X from rice and rice price rises p%, their income changes by X × p%.
 *   Source: mechanical (price × quantity).
 *
 * YIELD (per crop) — Net of additional costs
 *   A y% yield increase for a specific crop raises that crop's revenue by y%, but higher
 *   yields require more inputs (fertilizer, labor, harvest costs). Net income elasticity
 *   to yield ≈ 0.65. Applied independently per crop using each farmer's actual crop income.
 *   Source: FAO (2017) farm-level cost–yield analysis; Mundlak et al. (2012).
 *
 * ACREAGE — Diminishing returns
 *   Expanding cultivated area increases income but with diminishing returns due to
 *   lower-quality marginal land and higher fixed costs. Elasticity ≈ 0.55.
 *   Source: Otsuka & Place (2001) land productivity studies.
 *
 * FINANCIAL ACCESS — Conservative RCT-based
 *   Increasing access to financial services (credit, savings, insurance) shows modest
 *   income effects in rigorous evaluations. Elasticity ≈ 0.12.
 *   Stronger effect (×1.0) for farmers currently WITHOUT access; dampened (×0.3) for
 *   those who already have it.
 *   Source: Banerjee et al. (2015) "Six Randomized Evaluations of Microcredit" — AEJ.
 *
 * TRAINING — Conservative RCT-based
 *   Agricultural extension and farmer training programs show 5–15% income gains in
 *   well-designed RCTs. Elasticity ≈ 0.10.
 *   Stronger for untrained farmers (×1.0); dampened for already-trained (×0.25).
 *   Source: Magruder (2018) "An Assessment of Experimental Evidence on Agricultural
 *   Technology Adoption in Developing Countries" — Annual Review of Resource Economics.
 *
 * SAFETY NET — Conservative
 *   Social protection programs (MGNREGA, PDS, insurance) primarily reduce risk rather
 *   than raise income directly. Modest elasticity ≈ 0.05.
 *   Source: Bandiera et al. (2017) "Labor Markets and Poverty in Village Economies" — QJE.
 *
 * OFF-FARM DIVERSIFICATION — Moderate
 *   Non-farm income sources (wage labor, small enterprises, remittances) can meaningfully
 *   supplement farm income. Elasticity ≈ 0.15.
 *   Stronger for farmers currently with low off-farm share (×1.0); dampened for those
 *   already diversified (×0.5).
 *   Source: Haggblade et al. (2010) "The Rural Non-farm Economy" — World Development.
 * ────────────────────────────────────────────────────────────────────────── */

/** Conservative elasticities grounded in development economics literature.
 *  Each value = expected income % change per 1 percentage-point slider move. */
const ELASTICITY = {
  yieldNet: 0.65,    // net-of-costs yield elasticity
  acreage: 0.55,     // diminishing returns to land
  financial: 0.12,   // Banerjee et al. 2015
  training: 0.10,    // Magruder 2018
  safetyNet: 0.05,   // Bandiera et al. 2017
  offFarm: 0.15,     // Haggblade et al. 2010
} as const;

/** Human-readable methodology for UI display */
export const METHODOLOGY: {
  parameter: string;
  elasticity: string;
  maxEffect: string;
  source: string;
  sourceUrl: string | null;
}[] = [
  {
    parameter: "Crop Prices",
    elasticity: "1.0 (direct)",
    maxEffect: "Direct (price × volume)",
    source: "Arithmetic",
    sourceUrl: null,
  },
  {
    parameter: "Yield (per crop)",
    elasticity: "0.65 (net of costs)",
    maxEffect: "~33% at max",
    source: "FAO 2017; Mundlak et al. 2012",
    sourceUrl: "https://doi.org/10.1016/j.jdeveco.2012.01.002",
  },
  {
    parameter: "Acreage",
    elasticity: "0.55 (diminishing)",
    maxEffect: "~17% at max",
    source: "Otsuka & Place 2001",
    sourceUrl: "https://doi.org/10.1016/S0305-750X(01)00012-4",
  },
  {
    parameter: "Financial Access",
    elasticity: "0.12",
    maxEffect: "~6% at max",
    source: "Banerjee et al. 2015",
    sourceUrl: "https://doi.org/10.1257/app.20140287",
  },
  {
    parameter: "Training",
    elasticity: "0.10",
    maxEffect: "~8% at max",
    source: "Magruder 2018",
    sourceUrl: "https://doi.org/10.1146/annurev-resource-100517-023202",
  },
  {
    parameter: "Safety Net",
    elasticity: "0.05",
    maxEffect: "~2.5% at max",
    source: "Bandiera et al. 2017",
    sourceUrl: "https://doi.org/10.1093/qje/qjx003",
  },
  {
    parameter: "Off-Farm",
    elasticity: "0.15",
    maxEffect: "~7.5% at max",
    source: "Haggblade et al. 2010",
    sourceUrl: "https://doi.org/10.1016/j.worlddev.2010.01.008",
  },
];

/**
 * Run a composite scenario. All effects are computed as independent,
 * additive deltas from the baseline income — no compounding between parameters.
 */
export function runScenario(farmers: Farmer[], params: ScenarioParams): ScenarioResult {
  const withIncome = farmers.filter((f) => f.totalNetIncomeUsd != null);
  if (withIncome.length === 0) {
    return {
      currentAvgIncome: 0,
      projectedAvgIncome: 0,
      currentMedianIncome: 0,
      projectedMedianIncome: 0,
      currentAboveLIB: 0,
      projectedAboveLIB: 0,
      currentBelowLIB: 0,
      projectedBelowLIB: 0,
      totalFarmers: farmers.length,
      incomeChangePercent: 0,
      breakdown: [],
    };
  }

  const currentIncomes = withIncome.map((f) => f.totalNetIncomeUsd!);
  const currentAvg = mean(currentIncomes);
  const currentMed = median(currentIncomes);

  // Calculate projected incomes per farmer — all deltas additive from base
  const projectedIncomes = withIncome.map((f) => {
    const base = f.totalNetIncomeUsd!;
    // For intervention effects on negative-income farmers, use |base| as the
    // scale so effects don't perversely reduce their income further.
    const absBase = Math.max(Math.abs(base), 1);
    let delta = 0;

    // ── 1. Crop price changes — direct: price × volume ──
    for (const [crop, changePct] of Object.entries(params.cropPrices)) {
      if (changePct === 0) continue;
      const key = CROP_INCOME_KEYS[crop.toLowerCase()];
      if (!key) continue;
      const cropIncome = f[key] as number | null;
      if (cropIncome != null && cropIncome > 0) {
        delta += cropIncome * (changePct / 100);
      }
    }

    // ── 2. Yield changes — per-crop, applied to each crop's income, net of costs ──
    for (const [crop, changePct] of Object.entries(params.yieldChanges)) {
      if (changePct === 0) continue;
      const key = CROP_INCOME_KEYS[crop.toLowerCase()];
      if (!key) continue;
      const cropIncome = f[key] as number | null;
      if (cropIncome != null && cropIncome > 0) {
        delta += cropIncome * (changePct / 100) * ELASTICITY.yieldNet;
      } else {
        // Farmer doesn't grow this crop — no effect
      }
    }

    // ── 3. Acreage change — diminishing returns ──
    if (params.acreageChange !== 0) {
      delta += absBase * (params.acreageChange / 100) * ELASTICITY.acreage;
    }

    // ── 4. Financial access — stronger for unserved farmers ──
    if (params.financialAccessChange !== 0) {
      const hasAccess = f.useFinancialServices >= 1;
      const targeting = hasAccess ? 0.3 : 1.0;
      delta += absBase * (params.financialAccessChange / 100) * ELASTICITY.financial * targeting;
    }

    // ── 5. Training — stronger for untrained farmers ──
    if (params.trainingChange !== 0) {
      const hasTrained = Array.isArray(f.trainingParticipation)
        ? !f.trainingParticipation.includes("No programs")
        : false;
      const targeting = hasTrained ? 0.25 : 1.0;
      delta += absBase * (params.trainingChange / 100) * ELASTICITY.training * targeting;
    }

    // ── 6. Safety net — moderate, mostly risk reduction ──
    if (params.safetyNetChange !== 0) {
      const hasSafety = f.accessSafetyNet >= 1;
      const targeting = hasSafety ? 0.4 : 1.0;
      delta += absBase * (params.safetyNetChange / 100) * ELASTICITY.safetyNet * targeting;
    }

    // ── 7. Off-farm diversification — benefits low-diversification farmers ──
    if (params.offFarmChange !== 0) {
      const offFarmPct = f.offFarmDependency ?? 0;
      const targeting = offFarmPct < 20 ? 1.0 : 0.5;
      delta += absBase * (params.offFarmChange / 100) * ELASTICITY.offFarm * targeting;
    }

    return base + delta;
  });

  const projectedAvg = mean(projectedIncomes);
  const projectedMed = median(projectedIncomes);

  // LIB check: household total income > $4,933.50 (matches data pipeline)
  const currentAboveLIB = withIncome.filter((f) => {
    return f.totalNetIncomeUsd! > LIB_HH_ANNUAL;
  }).length;

  const projectedAboveLIB = projectedIncomes.filter((income) => {
    return income > LIB_HH_ANNUAL;
  }).length;

  // ── Build breakdown (population-level summary per parameter) ──
  const breakdown: ScenarioBreakdown[] = [];
  const absAvg = Math.max(Math.abs(currentAvg), 1);

  for (const [crop, changePct] of Object.entries(params.cropPrices)) {
    if (changePct === 0) continue;
    const key = CROP_INCOME_KEYS[crop.toLowerCase()];
    if (!key) continue;
    const growers = withIncome.filter((f) => {
      const v = f[key] as number | null;
      return v != null && v > 0;
    });
    if (growers.length === 0) continue;
    const avgCropIncome = mean(growers.map((f) => f[key] as number));
    const impact = avgCropIncome * (changePct / 100);
    breakdown.push({
      label: `${crop.charAt(0).toUpperCase() + crop.slice(1)} price ${changePct > 0 ? "+" : ""}${changePct}%`,
      currentValue: avgCropIncome,
      projectedValue: avgCropIncome + impact,
      changePercent: changePct,
    });
  }

  for (const [crop, changePct] of Object.entries(params.yieldChanges)) {
    if (changePct === 0) continue;
    const key = CROP_INCOME_KEYS[crop.toLowerCase()];
    if (!key) continue;
    const growers = withIncome.filter((f) => {
      const v = f[key] as number | null;
      return v != null && v > 0;
    });
    if (growers.length === 0) continue;
    const avgCropIncome = mean(growers.map((f) => f[key] as number));
    const impact = avgCropIncome * (changePct / 100) * ELASTICITY.yieldNet;
    breakdown.push({
      label: `${crop.charAt(0).toUpperCase() + crop.slice(1)} yield ${changePct > 0 ? "+" : ""}${changePct}%`,
      currentValue: avgCropIncome,
      projectedValue: avgCropIncome + impact,
      changePercent: avgCropIncome !== 0 ? (impact / avgCropIncome) * 100 : 0,
    });
  }

  if (params.acreageChange !== 0) {
    const impact = absAvg * (params.acreageChange / 100) * ELASTICITY.acreage;
    breakdown.push({
      label: `Acreage ${params.acreageChange > 0 ? "+" : ""}${params.acreageChange}%`,
      currentValue: currentAvg,
      projectedValue: currentAvg + impact,
      changePercent: absAvg !== 0 ? (impact / absAvg) * 100 : 0,
    });
  }

  if (params.financialAccessChange !== 0) {
    const impact = absAvg * (params.financialAccessChange / 100) * ELASTICITY.financial;
    breakdown.push({
      label: `Financial access ${params.financialAccessChange > 0 ? "+" : ""}${params.financialAccessChange}%`,
      currentValue: currentAvg,
      projectedValue: currentAvg + impact,
      changePercent: absAvg !== 0 ? (impact / absAvg) * 100 : 0,
    });
  }

  if (params.trainingChange !== 0) {
    const impact = absAvg * (params.trainingChange / 100) * ELASTICITY.training;
    breakdown.push({
      label: `Training ${params.trainingChange > 0 ? "+" : ""}${params.trainingChange}%`,
      currentValue: currentAvg,
      projectedValue: currentAvg + impact,
      changePercent: absAvg !== 0 ? (impact / absAvg) * 100 : 0,
    });
  }

  if (params.safetyNetChange !== 0) {
    const impact = absAvg * (params.safetyNetChange / 100) * ELASTICITY.safetyNet;
    breakdown.push({
      label: `Safety nets ${params.safetyNetChange > 0 ? "+" : ""}${params.safetyNetChange}%`,
      currentValue: currentAvg,
      projectedValue: currentAvg + impact,
      changePercent: absAvg !== 0 ? (impact / absAvg) * 100 : 0,
    });
  }

  if (params.offFarmChange !== 0) {
    const impact = absAvg * (params.offFarmChange / 100) * ELASTICITY.offFarm;
    breakdown.push({
      label: `Off-farm income ${params.offFarmChange > 0 ? "+" : ""}${params.offFarmChange}%`,
      currentValue: currentAvg,
      projectedValue: currentAvg + impact,
      changePercent: absAvg !== 0 ? (impact / absAvg) * 100 : 0,
    });
  }

  return {
    currentAvgIncome: currentAvg,
    projectedAvgIncome: projectedAvg,
    currentMedianIncome: currentMed,
    projectedMedianIncome: projectedMed,
    currentAboveLIB: currentAboveLIB,
    projectedAboveLIB: projectedAboveLIB,
    currentBelowLIB: withIncome.length - currentAboveLIB,
    projectedBelowLIB: projectedIncomes.length - projectedAboveLIB,
    totalFarmers: withIncome.length,
    incomeChangePercent: absAvg !== 0 ? ((projectedAvg - currentAvg) / absAvg) * 100 : 0,
    breakdown,
  };
}
