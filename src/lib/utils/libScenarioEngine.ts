/**
 * Living Income Benchmark (LIB) Scenario Tool Engine
 *
 * Calculates the Mint Segment's official Living Income KPI across the
 * full supply shed (T1 Core, T2, Legacy/offboarded, and non-program farmers)
 * and projects forward from the most recent reported KPI year.
 *
 * Key features:
 * - Supply shed KPI: numerator (≥LIB) / denominator (total supply shed) with
 *   toggleable extrapolation rates (30%, 50%, 80%)
 * - Reported vs projected years — backward-facing KPIs from actual data,
 *   forward-facing from scenario levers
 * - Component-based LIB inflation (CPI, fertilizer index, energy index)
 * - Non-program population modeled from control group data
 * - Gradual T1→Legacy offboarding schedule
 * - Per-crop tenure-based improvement ramps for T2
 * - Lever mode: percentage change OR fixed value per crop
 * - Rabi season land-balance rules (potato, wheat, mustard compete)
 * - Only applies changes to farmers who actually grow each crop
 */

import type { Farmer } from "../data/types";
import type { ComparisonInsights } from "./comparisonInsights";
import { mean, median } from "./statistics";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Living Income Benchmark (household annual USD) - 2024 baseline (fallback when no lock exists) */
export const LIB_2024 = 4933.5;

/** Locked LIB anchor: when present, LIB for any year is computed by inflating/deflating
 *  from this year's locked value rather than from LIB_2024 / BASELINE_YEAR.
 *  Sourced from the Annual Lock (see /lib-calculator/setup). */
export interface LockedAnchor {
  year: number;
  lib: number;
}

/** LIB inflation component weights (sum to 1.0).
 *  Per Mars KPI guidance the LIB inflates by CPI only — the same basis the
 *  Annual Lock uses — so fertilizer/energy weights are zeroed. The component
 *  structure is kept for the Phase 5 index work (price/cost indices). */
export const DEFAULT_LIB_INFLATION_WEIGHTS = {
  cpi: 1.0,
  fertilizer: 0.0,
  energy: 0.0,
} as const;

/** Default annual index rates (decimal, not %) — used when no per-year overrides provided */
export const DEFAULT_INDEX_RATES = {
  cpi: 0.04,         // India CPI ~4%
  fertilizer: 0.03,  // Fertilizer price index ~3%
  energy: 0.025,     // Energy price index ~2.5%
} as const;

/** Per-year index overrides: year -> { cpi, fertilizer, energy } (decimal rates).
 *  When a year is not in this map, DEFAULT_INDEX_RATES apply.
 *  Users can configure this via the UI. */
export type YearlyIndexRates = Record<number, { cpi: number; fertilizer: number; energy: number }>;

/** Compute the blended LIB inflation rate for a given year */
export function getLIBInflationRate(
  year: number,
  yearlyIndices?: YearlyIndexRates,
  weights = DEFAULT_LIB_INFLATION_WEIGHTS
): number {
  const rates = yearlyIndices?.[year] ?? DEFAULT_INDEX_RATES;
  return rates.cpi * weights.cpi + rates.fertilizer * weights.fertilizer + rates.energy * weights.energy;
}

/** Flat display rate — matches the CPI default used for LIB inflation */
export const LIB_INFLATION_RATE = 0.04;

/** Program start year / baseline year */
export const BASELINE_YEAR = 2024;

/** Default program target year */
export const TARGET_YEAR = 2030;

/** Default modeled years (kept for backward compat) */
export const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030] as const;
export type ModelYear = number;

/** Min/max allowed projection years from baseline */
export const MIN_PROJECTION_YEARS = 1;
export const MAX_PROJECTION_YEARS = 15;

/** Generate an array of years from baseline to baseline + count */
export function generateYears(projectionYears: number): number[] {
  const clamped = Math.max(MIN_PROJECTION_YEARS, Math.min(MAX_PROJECTION_YEARS, projectionYears));
  return Array.from({ length: clamped + 1 }, (_, i) => BASELINE_YEAR + i);
}

/** Crops modeled in the tool */
export const MODELED_CROPS = ["mint", "rice", "potato", "wheat", "mustard"] as const;
export type ModeledCrop = (typeof MODELED_CROPS)[number];

/** Rabi season crops that compete for land */
export const RABI_CROPS: ModeledCrop[] = ["potato", "wheat", "mustard"];

/** Kharif season crops (independent land) */
export const KHARIF_CROPS: ModeledCrop[] = ["mint", "rice"];

/** Crops with user-facing intervention levers. Wheat has no interventions —
 *  its acreage is derived from the Rabi land balance (see getWheatAcreageChange). */
export const LEVER_CROPS: ModeledCrop[] = ["mint", "rice", "potato", "mustard"];

/** Per-crop cost-to-revenue ratios, derived from the baseline crop files as
 *  cost/revenue = 1 − netIncome/income, pooled across groups (Phase 1 of the
 *  June 2026 client feedback; per-group splits arrive with the Phase 2 data fix). */
export const CROP_COST_RATIOS: Record<ModeledCrop, number> = {
  mint: 0.517,
  rice: 0.584,
  potato: 0.416,
  wheat: 0.514,
  mustard: 0.541,
};

/** Baseline Rabi acreage shares from the baseline crop files (fraction of total Rabi land) */
export const RABI_ACREAGE_SHARES: Record<"potato" | "wheat" | "mustard", number> = {
  potato: 0.400,
  wheat: 0.362,
  mustard: 0.237,
};

/** Wheat acreage is the Rabi balancing term: when potato or mustard expand,
 *  wheat absorbs the land change. Returns wheat's derived % acreage change,
 *  clamped at −100% (wheat land fully reallocated — acreage can't go negative). */
export function getWheatAcreageChange(crops: Record<ModeledCrop, CropLever>): number {
  const { potato, wheat, mustard } = RABI_ACREAGE_SHARES;
  const landDelta =
    potato * (crops.potato.acreageChange / 100) +
    mustard * (crops.mustard.acreageChange / 100);
  return Math.max(-100, Math.round((-landDelta / wheat) * 100));
}

/** Normalize params before running the model: wheat carries no intervention
 *  levers, so its yield/price/cost are zeroed and its acreage is derived from
 *  the Rabi land balance. */
export function normalizeScenarioParams(params: LIBScenarioParams): LIBScenarioParams {
  return {
    ...params,
    crops: {
      ...params.crops,
      wheat: {
        yieldChange: 0,
        priceChange: 0,
        costChange: 0,
        acreageChange: getWheatAcreageChange(params.crops),
      },
    },
  };
}

/** Max total T2 farmers */
export const MAX_T2_FARMERS = 10_000;

/** Total T1 program farmers — fixed anchor (surveyed farmers are a representative
 *  sample scaled to this total). Offboarding moves farmers from active T1 to
 *  Legacy status within this total; it never changes it. */
export const PROGRAM_T1_FARMERS = 23_875;

/** Default total supply shed population estimate */
export const DEFAULT_SUPPLY_SHED_POPULATION = 50_000;

/** Extrapolation rate options — what fraction of the supply shed the
 *  measured program+control data credibly represents */
export const EXTRAPOLATION_RATES = [0.3, 0.5, 0.8] as const;
export type ExtrapolationRate = (typeof EXTRAPOLATION_RATES)[number];
export const DEFAULT_EXTRAPOLATION_RATE: ExtrapolationRate = 0.5;

/** Default T2 yearly intake for the standard 6-year horizon */
export const DEFAULT_T2_INTAKE: Record<number, number> = {
  2025: 2000,
  2026: 2000,
  2027: 2000,
  2028: 2000,
  2029: 1000,
  2030: 1000,
};

/** Generate default T2 intake for a given number of projection years.
 *  Distributes MAX_T2_FARMERS evenly, with remainder in early years. */
export function generateDefaultT2Intake(projectionYears: number): Record<number, number> {
  const count = Math.max(1, projectionYears);
  const base = Math.floor(MAX_T2_FARMERS / count);
  let rem = MAX_T2_FARMERS - base * count;
  const intake: Record<number, number> = {};
  for (let i = 1; i <= projectionYears; i++) {
    intake[BASELINE_YEAR + i] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return intake;
}

/** Generate default T1 offboarding schedule — all zeros (user fills in the plan). */
export function generateDefaultT1Offboarding(projectionYears: number): Record<number, number> {
  const offboarding: Record<number, number> = {};
  for (let i = 1; i <= projectionYears; i++) {
    offboarding[BASELINE_YEAR + i] = 0; // default: no offboarding (user fills in)
  }
  return offboarding;
}

/**
 * Default tenure curve: years in program -> fraction of target improvement achieved.
 * A farmer who joined in 2025 and it's now 2028 has 3 years -> 0.75 of target.
 */
export const DEFAULT_TENURE_CURVE: Record<number, number> = {
  0: 0.0,
  1: 0.3,
  2: 0.55,
  3: 0.75,
  4: 0.9,
  5: 1.0,
  6: 1.0,
};

/** Per-crop tenure ramps: override the default curve per crop.
 *  Each entry is year-in-program -> fraction (0-1). */
export type CropTenureRamps = Partial<Record<ModeledCrop, Record<number, number>>>;

function getTenureFraction(
  yearsInProgram: number,
  cropRamp?: Record<number, number>
): number {
  const curve = cropRamp ?? DEFAULT_TENURE_CURVE;
  if (yearsInProgram <= 0) return 0;
  // Find the highest defined year <= yearsInProgram
  const keys = Object.keys(curve).map(Number).sort((a, b) => a - b);
  const maxKey = keys[keys.length - 1] ?? 5;
  if (yearsInProgram >= maxKey) return curve[maxKey] ?? 1;
  return curve[yearsInProgram] ?? curve[keys.filter(k => k <= yearsInProgram).pop() ?? 0] ?? 0;
}

/** Lever input mode */
export type LeverMode = "percentage" | "fixed";

// ─── Farmer income field mappings ─────────────────────────────────────────────

const CROP_NET_INCOME_KEY: Record<ModeledCrop, keyof Farmer> = {
  mint: "mintNetIncome",
  rice: "riceNetIncome",
  potato: "potatoNetIncome",
  wheat: "wheatNetIncome",
  mustard: "mustardNetIncome",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropLever {
  yieldChange: number;   // % change from baseline (when leverMode = "percentage")
  priceChange: number;   // % change from baseline
  costChange: number;    // % change from baseline (negative = cost reduction)
  acreageChange: number; // % change from baseline
  // Fixed-value overrides (used when leverMode = "fixed")
  yieldFixed?: number;   // absolute yield target (e.g., kg/acre)
  priceFixed?: number;   // absolute price target (e.g., INR/kg)
  costFixed?: number;    // absolute cost target
  acreageFixed?: number; // absolute acreage target
}

export interface LIBScenarioParams {
  name: string;
  crops: Record<ModeledCrop, CropLever>;
  otherOnFarmChange: number;    // % change — covers livestock too (no livestock interventions)
  offFarmChange: number;        // % change in off-farm income
  t2YearlyIntake: Record<number, number>; // year -> number of new T2 farmers
  includeT1Legacy: boolean;
  targetYear: ModelYear;
  /** Number of years to project from baseline (default: 6 → 2024-2030) */
  projectionYears: number;
  /** Lever input mode — percentage changes or fixed values */
  leverMode: LeverMode;
  /** Supply shed total estimated population (KPI denominator) */
  supplyShEdPopulation: number;
  /** Extrapolation rate: what fraction of the supply shed the data represents */
  extrapolationRate: ExtrapolationRate;
  /** Per-year inflation index overrides (CPI, fertilizer, energy) */
  yearlyIndices?: YearlyIndexRates;
  /** Per-crop tenure improvement ramps for T2 (overrides default curve) */
  cropTenureRamps?: CropTenureRamps;
  /** Yearly T1 offboarding schedule: year -> number of T1 farmers moved to Legacy */
  t1Offboarding: Record<number, number>;
  /** Reported KPI years — years where actual data exists (vs projected) */
  reportedYears?: number[];
  /** Locked LIB anchor from the Annual Lock. When present, replaces LIB_2024/BASELINE_YEAR
   *  as the inflation anchor — LIB for any year is computed by inflating from this point. */
  lockedAnchor?: LockedAnchor;
}

export interface YearlyResult {
  year: number;
  lib: number;                   // LIB benchmark for that year
  isReported: boolean;           // true = actual data, false = projection
  // T1 results
  t1TotalFarmers: number;
  t1AboveLIB: number;
  t1PctAboveLIB: number;
  t1AvgIncome: number;
  t1MedianIncome: number;
  t1AvgLIBGap: number;          // among below-LIB farmers
  t1MedianLIBGap: number;       // among below-LIB farmers
  t1MedianIncomeIncrease: number; // median income gain since joining (2024 for T1)
  t1MovedAboveLIB: number;      // only real transitions, not new entrants
  // Legacy results
  legacyTotalFarmers: number;
  legacyAboveLIB: number;
  legacyPctAboveLIB: number;
  legacyAvgIncome: number;
  // T2 results
  t2TotalFarmers: number;
  t2AboveLIB: number;
  t2PctAboveLIB: number;
  t2AvgIncome: number;
  t2MedianIncome: number;
  t2AvgLIBGap: number;
  t2MedianLIBGap: number;
  t2MedianIncomeIncrease: number; // median income gain since each cohort's join year
  t2MovedAboveLIB: number;
  // Non-program / supply shed results
  nonProgramTotalFarmers: number;
  nonProgramAboveLIB: number;
  nonProgramPctAboveLIB: number;
  nonProgramAvgIncome: number;
  nonProgramMedianIncome: number;
  nonProgramMedianLIBGap: number;
  nonProgramMedianIncomeIncrease: number; // inflation-only drift vs baseline
  // Program total (T1 + Legacy + T2, excludes non-program)
  totalFarmers: number;
  totalAboveLIB: number;
  totalPctAboveLIB: number;
  totalAvgIncome: number;
  totalMovedAboveLIB: number;
  totalAvgLIBGap: number;
  // Supply shed KPI (all populations including non-program)
  supplyShEdKPI: number;        // % of total supply shed at or above LIB
  supplyShEdTotalFarmers: number;
  supplyShEdAboveLIB: number;
}

export interface CropContribution {
  crop: string;
  baselineIncome: number;
  projectedIncome: number;
  change: number;
  changePercent: number;
  growerCount: number;
}

export interface LIBScenarioResult {
  params: LIBScenarioParams;
  yearlyResults: YearlyResult[];
  cropContributions: CropContribution[];
  // Summary for target year
  summary: YearlyResult;
  // Baseline anchor stats
  baselineAboveLIB: number;
  baselinePctAboveLIB: number;
  baselineTotalFarmers: number;
  // Supply shed KPI baseline
  baselineSupplyShEdKPI: number;
}

// ─── Methodology (for UI display) ─────────────────────────────────────────────

/** Human-readable methodology for UI display */
export const LIB_METHODOLOGY: {
  parameter: string;
  elasticity: string;
  maxEffect: string;
  mechanism: string;
  source: string;
  sourceUrl: string | null;
}[] = [
  {
    parameter: "Crop Yield",
    elasticity: "1.7–2.4 (per crop)",
    maxEffect: "+171% to +240% crop net at +100%",
    mechanism: "Revenue scales with yield; costs held separate. Applied only to farmers who actually grow each crop. Net elasticity > 1 because each crop's costs (42–58% of revenue, from the baseline survey) are fixed when yield changes.",
    source: "Farmer-level baseline survey",
    sourceUrl: null,
  },
  {
    parameter: "Crop Price",
    elasticity: "1.7–2.4 (per crop)",
    maxEffect: "+171% to +240% crop net at +100%",
    mechanism: "Direct arithmetic on revenue (price x quantity). Same net elasticity as yield — costs stay fixed while revenue scales. Applied per-crop to actual growers.",
    source: "Mechanical (price x quantity)",
    sourceUrl: null,
  },
  {
    parameter: "Cost of Production",
    elasticity: "-0.7 to -1.4 (per crop)",
    maxEffect: "Scales with each crop's cost share",
    mechanism: "Per-crop cost ratios derived from the baseline crop data (cost/revenue = 1 − net income/income): mint 52%, rice 58%, potato 42%, wheat 51%, mustard 54%. A c% cost change adjusts that crop's production costs; net income = revenue − costs.",
    source: "Farmer-level baseline survey (crop files)",
    sourceUrl: null,
  },
  {
    parameter: "Acreage Change",
    elasticity: "1.0 (on net income)",
    maxEffect: "+100% crop net at +100%",
    mechanism: "Expanding cultivated area increases both revenue and costs proportionally. Rabi crops compete for the same land: wheat has no intervention levers and absorbs the land balance when potato or mustard acreage changes (baseline Rabi shares: potato 40%, wheat 36%, mustard 24%).",
    source: "Otsuka & Place (2001)",
    sourceUrl: "https://doi.org/10.1016/S0305-750X(01)00012-4",
  },
  {
    parameter: "Tenure Curve (T2)",
    elasticity: "N/A (scaling factor)",
    maxEffect: "30% → 55% → 75% → 90% → 100%",
    mechanism: "T2 farmers realize improvements gradually over 5 years: Yr 1=30%, Yr 2=55%, Yr 3=75%, Yr 4=90%, Yr 5+=100% of target lever effect. Models realistic adoption lag.",
    source: "Program design assumption",
    sourceUrl: null,
  },
  {
    parameter: "Population Scaling",
    elasticity: "N/A (scaling)",
    maxEffect: `${PROGRAM_T1_FARMERS.toLocaleString()} T1 (fixed total)`,
    mechanism: `Baseline survey data (~1,068 T1, ~220 T2 farmers) is treated as a representative sample. The T1 program totals ${PROGRAM_T1_FARMERS.toLocaleString()} farmers (fixed anchor); the offboarding plan moves farmers from active T1 to Legacy status within that total. Both statuses use the T1 survey distribution. T2 farmers are added incrementally using the T2 survey distribution.`,
    source: "Shubh Samriddhi program design",
    sourceUrl: null,
  },
  {
    parameter: "T2 Cohort Intake",
    elasticity: "N/A (population)",
    maxEffect: "Up to 10,000 new farmers",
    mechanism: "T2 farmers join in yearly cohorts. Each cohort starts its own tenure clock. Income projected using T2 baseline survey distribution resampled to cohort size and scaled by tenure curve.",
    source: "Shubh Samriddhi program",
    sourceUrl: null,
  },
  {
    parameter: "LIB Benchmark",
    elasticity: "N/A (target line)",
    maxEffect: `$${LIB_2024.toLocaleString()} → ~$${Math.round(LIB_2024 * Math.pow(1 + LIB_INFLATION_RATE, 6)).toLocaleString()}`,
    mechanism: `Baseline LIB (2024): $${LIB_2024.toLocaleString()}. Inflates by CPI only (default ${(LIB_INFLATION_RATE * 100).toFixed(1)}% per year), matching the Annual Lock basis per Mars KPI guidance. Rising benchmark makes the target harder each year.`,
    source: "India CPI (Mars KPI guidance)",
    sourceUrl: null,
  },
  {
    parameter: "Other On-Farm Income",
    elasticity: "1.0 (direct)",
    maxEffect: "±100% at max",
    mechanism: "Applied as a simple percentage change to each farmer's baseline other on-farm income, including livestock (there are no livestock-specific interventions), scaled by tenure.",
    source: "Baseline survey decomposition",
    sourceUrl: null,
  },
  {
    parameter: "Off-Farm Income",
    elasticity: "1.0 (direct)",
    maxEffect: "±100% at max",
    mechanism: "Applied to wages, remittances, and non-agricultural income. Off-farm is ~4% of T1 income on average, but >10% for 29% of T1 farmers and >20% for 23%. Scaled by tenure for T2.",
    source: "Baseline survey decomposition",
    sourceUrl: null,
  },
  {
    parameter: "Legacy Farmers",
    elasticity: "N/A (inflation only)",
    maxEffect: `${(LIB_INFLATION_RATE * 100).toFixed(1)}% annual growth`,
    mechanism: `T1 farmers moved to Legacy status by the offboarding plan (enabled via the Include T1 Legacy toggle). Income inflates at ${(LIB_INFLATION_RATE * 100).toFixed(1)}% per year matching the LIB rate — no program lever effects applied. Uses T1 baseline survey distribution (not Control), since Legacy farmers had prior program support.`,
    source: "Shubh Samriddhi program design",
    sourceUrl: null,
  },
];

// ─── Baseline Stats Extraction ────────────────────────────────────────────────

interface FarmerBaseline {
  id: number;
  project: string;
  totalNetIncome: number;
  cropIncomes: Record<ModeledCrop, number>;
  otherCropsIncome: number;
  livestockIncome: number;
  offFarmIncome: number;
  isGrower: Record<ModeledCrop, boolean>;
}

function extractBaseline(farmer: Farmer): FarmerBaseline | null {
  if (farmer.totalNetIncomeUsd == null) return null;

  const cropIncomes: Record<string, number> = {};
  const isGrower: Record<string, boolean> = {};
  for (const crop of MODELED_CROPS) {
    const val = farmer[CROP_NET_INCOME_KEY[crop]] as number | null;
    cropIncomes[crop] = val ?? 0;
    isGrower[crop] = val != null && val !== 0;
  }

  return {
    id: farmer.id,
    project: farmer.project,
    totalNetIncome: farmer.totalNetIncomeUsd,
    cropIncomes: cropIncomes as Record<ModeledCrop, number>,
    otherCropsIncome: farmer.otherCropsNetIncome ?? 0,
    livestockIncome: farmer.livestockIncome ?? 0,
    offFarmIncome: farmer.offFarmNetIncome ?? 0,
    isGrower: isGrower as Record<ModeledCrop, boolean>,
  };
}

// ─── Core Engine ──────────────────────────────────────────────────────────────

/**
 * Get the LIB benchmark for a given year, inflated from the 2024 base.
 * Uses component-based inflation (CPI + fertilizer + energy) when per-year indices provided,
 * otherwise falls back to the compound default rates.
 */
export function getLIBForYear(
  year: number,
  yearlyIndices?: YearlyIndexRates,
  lockedAnchor?: LockedAnchor,
): number {
  const anchorYear = lockedAnchor?.year ?? BASELINE_YEAR;
  const anchorLib = lockedAnchor?.lib ?? LIB_2024;

  if (year === anchorYear) return anchorLib;

  if (!yearlyIndices) {
    const blended = getLIBInflationRate(BASELINE_YEAR, undefined);
    return anchorLib * Math.pow(1 + blended, year - anchorYear);
  }

  if (year > anchorYear) {
    let lib = anchorLib;
    for (let y = anchorYear + 1; y <= year; y++) {
      lib *= 1 + getLIBInflationRate(y, yearlyIndices);
    }
    return lib;
  }

  // year < anchorYear — deflate
  let lib = anchorLib;
  for (let y = anchorYear; y > year; y--) {
    lib /= 1 + getLIBInflationRate(y, yearlyIndices);
  }
  return lib;
}

/**
 * Compute the base inflation multiplier from baseline to a given year.
 * Uses component-based indices when available.
 */
function getBaseInflation(year: number, yearlyIndices?: YearlyIndexRates): number {
  if (!yearlyIndices) {
    const blended = getLIBInflationRate(BASELINE_YEAR, undefined);
    return Math.pow(1 + blended, year - BASELINE_YEAR);
  }
  let factor = 1;
  for (let y = BASELINE_YEAR + 1; y <= year; y++) {
    factor *= 1 + getLIBInflationRate(y, yearlyIndices);
  }
  return factor;
}

/**
 * Apply scenario levers to a single farmer for a given year.
 * Returns projected total net income.
 *
 * For T1 farmers: full lever application (they've been in program since start).
 * For T2 farmers: lever effect scaled by per-crop tenure ramp based on cohort join year.
 */
function projectFarmerIncome(
  baseline: FarmerBaseline,
  params: LIBScenarioParams,
  year: number,
  cohortJoinYear?: number
): number {
  const yearsInProgram = cohortJoinYear != null ? year - cohortJoinYear : year - BASELINE_YEAR;

  // Baseline inflation: all incomes grow at LIB rate so status quo holds steady.
  const baseInflation = getBaseInflation(year, params.yearlyIndices);

  let totalIncome = 0;

  // ── 1. Crop income projections ──
  for (const crop of MODELED_CROPS) {
    if (!baseline.isGrower[crop]) {
      totalIncome += baseline.cropIncomes[crop] * baseInflation;
      continue;
    }

    const lever = params.crops[crop];
    const baseCropIncome = baseline.cropIncomes[crop] * baseInflation;

    // Per-crop tenure fraction (allows different ramps per crop)
    const cropRamp = params.cropTenureRamps?.[crop];
    const tenureFrac = getTenureFraction(yearsInProgram, cropRamp);

    // Calculate effective changes scaled by tenure
    const effYield = (lever.yieldChange / 100) * tenureFrac;
    const effPrice = (lever.priceChange / 100) * tenureFrac;
    const effCost = (lever.costChange / 100) * tenureFrac;
    const effAcreage = (lever.acreageChange / 100) * tenureFrac;

    const costRatio = CROP_COST_RATIOS[crop];

    if (baseCropIncome <= 0) {
      totalIncome += baseCropIncome * (1 + effAcreage);
      continue;
    }

    const baseRevenue = baseCropIncome / (1 - costRatio);
    const baseCost = baseRevenue * costRatio;

    const projRevenue = baseRevenue * (1 + effYield) * (1 + effPrice) * (1 + effAcreage);
    const projCost = baseCost * (1 + effCost) * (1 + effAcreage);
    const projCropIncome = projRevenue - projCost;

    totalIncome += projCropIncome;
  }

  // ── 2. Other on-farm income (includes livestock — no livestock interventions) ──
  const globalTenure = getTenureFraction(yearsInProgram);
  const effOther = (params.otherOnFarmChange / 100) * globalTenure;
  totalIncome += (baseline.otherCropsIncome + baseline.livestockIncome) * baseInflation * (1 + effOther);

  // ── 4. Off-farm income ──
  const effOffFarm = (params.offFarmChange / 100) * globalTenure;
  totalIncome += baseline.offFarmIncome * baseInflation * (1 + effOffFarm);

  // ── 5. Remainder (unaccounted income) — inflated with baseline ──
  const accountedBaseline =
    Object.values(baseline.cropIncomes).reduce((a, b) => a + b, 0) +
    baseline.otherCropsIncome +
    baseline.livestockIncome +
    baseline.offFarmIncome;
  const remainder = baseline.totalNetIncome - accountedBaseline;
  totalIncome += remainder * baseInflation;

  return totalIncome;
}

/**
 * Run the full LIB scenario projection across all years.
 * Now includes non-program population, supply shed KPI, gradual offboarding,
 * and per-crop tenure ramps.
 */
export function runLIBScenario(
  farmers: Farmer[],
  rawParams: LIBScenarioParams
): LIBScenarioResult {
  // Wheat carries no intervention levers — its acreage is derived from the Rabi land balance
  const params = normalizeScenarioParams(rawParams);

  const allBaselines = farmers
    .map(extractBaseline)
    .filter((b): b is FarmerBaseline => b != null);

  // Split by project group (surveyed samples)
  const t1CoreSample = allBaselines.filter((f) => f.project === "T-1");
  const t2Base = allBaselines.filter((f) => f.project === "T-2");
  const controlSample = allBaselines.filter((f) => f.project === "Control");

  // Scale factor: survey sample → fixed program total (23,875)
  const t1ScaleFactor = PROGRAM_T1_FARMERS / (t1CoreSample.length || 1);

  const t1Active = t1CoreSample;

  // Supply shed params with defaults for backward compat
  const supplyShEdPop = params.supplyShEdPopulation ?? DEFAULT_SUPPLY_SHED_POPULATION;
  const extrapRate = params.extrapolationRate ?? DEFAULT_EXTRAPOLATION_RATE;
  const reportedYears = new Set(params.reportedYears ?? [BASELINE_YEAR]);

  // Baseline stats (2024)
  const baselineLIB = getLIBForYear(BASELINE_YEAR, params.yearlyIndices, params.lockedAnchor);
  const t1SampleAbove2024 = t1Active.filter((f) => f.totalNetIncome > baselineLIB).length;
  const baselineAbove = Math.round(t1SampleAbove2024 * t1ScaleFactor);

  const modelYears = generateYears(params.projectionYears ?? 6);

  // T2 cohort schedule
  const t2CohortSchedule = buildT2Cohorts(t2Base, params.t2YearlyIntake, modelYears);

  // T1 offboarding schedule: cumulative count of offboarded T1 farmers by year
  const offboarding = params.t1Offboarding ?? {};
  let cumulativeOffboarded = 0;

  // Track "previously above LIB" for each farmer to correctly compute "moved above"
  // Only count transitions from below→above within existing population
  const t1PrevAbove = new Set<number>();
  // Initialize with baseline above-LIB farmers
  for (const f of t1Active) {
    if (f.totalNetIncome > baselineLIB) t1PrevAbove.add(f.id);
  }

  const yearlyResults: YearlyResult[] = [];

  for (const year of modelYears) {
    const lib = getLIBForYear(year, params.yearlyIndices, params.lockedAnchor);
    const isReported = reportedYears.has(year);
    const baseInflation = getBaseInflation(year, params.yearlyIndices);

    // ── T1 offboarding: reduce active T1, grow Legacy — total stays anchored
    //    at PROGRAM_T1_FARMERS. The plan only applies when includeT1Legacy is on. ──
    const offboardedThisYear = params.includeT1Legacy ? (offboarding[year] ?? 0) : 0;
    cumulativeOffboarded += offboardedThisYear;
    const activeT1Count = Math.max(0, PROGRAM_T1_FARMERS - cumulativeOffboarded);
    const activeLegacyCount = Math.min(PROGRAM_T1_FARMERS, cumulativeOffboarded);
    const t1DisplayScale = activeT1Count / (t1CoreSample.length || 1);
    const legacyDisplayScale = activeLegacyCount / (t1CoreSample.length || 1);

    // ── T1 Core projections ──
    const t1SampleIncomes = t1Active.map((f) => projectFarmerIncome(f, params, year));
    const t1SampleAbove = t1SampleIncomes.filter((inc) => inc > lib).length;
    const t1SampleBelow = t1SampleIncomes.filter((inc) => inc <= lib);

    const t1Above = Math.round(t1SampleAbove * t1DisplayScale);
    const t1TotalDisplay = activeT1Count;

    // "Moved above" — only count transitions within existing population
    let t1Moved = 0;
    t1Active.forEach((f, i) => {
      const wasAbove = t1PrevAbove.has(f.id);
      const isAbove = t1SampleIncomes[i] > lib;
      if (!wasAbove && isAbove) t1Moved++;
    });
    const t1MovedScaled = Math.round(t1Moved * t1DisplayScale);

    // Update tracking for next year
    t1Active.forEach((f, i) => {
      if (t1SampleIncomes[i] > lib) t1PrevAbove.add(f.id);
      else t1PrevAbove.delete(f.id);
    });

    // ── Legacy projections (inflation-only, no lever effects) ──
    let legacySampleIncomes: number[] = [];
    let legacySampleAbove = 0;
    let legacyAbove = 0;
    let legacyTotalDisplay = 0;
    if (params.includeT1Legacy && activeLegacyCount > 0) {
      legacySampleIncomes = t1Active.map((f) => f.totalNetIncome * baseInflation);
      legacySampleAbove = legacySampleIncomes.filter((inc) => inc > lib).length;
      legacyAbove = Math.round(legacySampleAbove * legacyDisplayScale);
      legacyTotalDisplay = activeLegacyCount;
    }

    // ── T2 projections ──
    const t2ActiveFarmers: { income: number; incomeIncrease: number }[] = [];
    for (const [joinYear, cohortFarmers] of Object.entries(t2CohortSchedule)) {
      const jy = Number(joinYear);
      if (jy > year) continue;
      for (const farmer of cohortFarmers) {
        const income = projectFarmerIncome(farmer, params, year, jy);
        const joinIncome = projectFarmerIncome(farmer, params, jy, jy);
        t2ActiveFarmers.push({ income, incomeIncrease: income - joinIncome });
      }
    }

    const t2Incomes = t2ActiveFarmers.map((f) => f.income);
    const t2Above = t2Incomes.filter((inc) => inc > lib).length;
    const t2Below = t2Incomes.filter((inc) => inc <= lib);

    // Baseline year: no T2 cohort exists yet, but the line should start at the
    // T2 survey baseline rather than 0 (display stats only — counts stay 0).
    const t2BaselineSurveyStats = year === BASELINE_YEAR && t2Incomes.length === 0 && t2Base.length > 0
      ? (() => {
          const incomes = t2Base.map((f) => f.totalNetIncome);
          const above = incomes.filter((inc) => inc > lib).length;
          const below = incomes.filter((inc) => inc <= lib);
          return {
            pct: (above / incomes.length) * 100,
            avg: mean(incomes),
            med: median(incomes),
            avgGap: below.length > 0 ? mean(below.map((inc) => lib - inc)) : 0,
            medGap: below.length > 0 ? median(below.map((inc) => lib - inc)) : 0,
          };
        })()
      : null;

    // T2 "moved above": only count those who were below LIB in the *previous* year
    // and are now above. New entrants who were already above don't count.
    let t2Moved = 0;
    if (year > BASELINE_YEAR) {
      const prevLib = getLIBForYear(year - 1, params.yearlyIndices, params.lockedAnchor);
      for (const [joinYear, cohortFarmers] of Object.entries(t2CohortSchedule)) {
        const jy = Number(joinYear);
        if (jy > year) continue;
        for (const farmer of cohortFarmers) {
          if (jy === year) continue; // new entrant this year — skip
          const prevIncome = projectFarmerIncome(farmer, params, year - 1, jy);
          const currIncome = projectFarmerIncome(farmer, params, year, jy);
          if (prevIncome <= prevLib && currIncome > lib) t2Moved++;
        }
      }
    }

    // ── Non-program population (modeled from control group, inflation-only) ──
    // The control sample represents the non-program supply shed population.
    // We apply the extrapolation rate to determine how much of the supply shed
    // the measured data credibly covers.
    const nonProgramSampleIncomes = controlSample.map((f) => f.totalNetIncome * baseInflation);
    const nonProgramSampleAbove = nonProgramSampleIncomes.filter((inc) => inc > lib).length;
    const nonProgramPctAbove = controlSample.length > 0
      ? (nonProgramSampleAbove / controlSample.length) * 100
      : 0;
    const nonProgramAvgInc = nonProgramSampleIncomes.length > 0 ? mean(nonProgramSampleIncomes) : 0;

    // Non-program population = supply shed - all program farmers
    const programTotal = t1TotalDisplay + legacyTotalDisplay + t2Incomes.length;
    const nonProgramTotal = Math.max(0, supplyShEdPop - programTotal);
    const nonProgramAbove = Math.round(nonProgramTotal * (nonProgramPctAbove / 100));

    // ── Aggregate program totals ──
    const totalAbove = t1Above + legacyAbove + t2Above;
    const totalFarmersDisplay = programTotal;

    const t1Pct = t1Active.length > 0 ? (t1SampleAbove / t1Active.length) * 100 : 0;
    const legacyPct = legacyTotalDisplay > 0 && t1Active.length > 0
      ? (legacySampleAbove / t1Active.length) * 100 : 0;

    const t1Weight = t1TotalDisplay;
    const legacyWeight = legacyTotalDisplay;
    const t2Weight = t2Incomes.length;
    const totalWeight = t1Weight + legacyWeight + t2Weight;
    const t1AvgInc = t1SampleIncomes.length > 0 ? mean(t1SampleIncomes) : 0;
    const legacyAvgInc = legacySampleIncomes.length > 0 ? mean(legacySampleIncomes) : 0;
    const t2AvgInc = t2Incomes.length > 0 ? mean(t2Incomes) : 0;
    const totalAvgInc = totalWeight > 0
      ? (t1AvgInc * t1Weight + legacyAvgInc * legacyWeight + t2AvgInc * t2Weight) / totalWeight
      : 0;

    const allBelowIncomes = [
      ...t1SampleBelow,
      ...(params.includeT1Legacy ? legacySampleIncomes.filter((inc) => inc <= lib) : []),
      ...t2Below,
    ];

    const totalPctAboveLIB = totalWeight > 0 ? (totalAbove / totalFarmersDisplay) * 100 : 0;

    // ── Median metrics for the cohort tiles ──
    // Income increases are NOMINAL (include ~4%/yr inflation); the non-program
    // figure is the inflation-only comparator readers should difference against.
    const t1BelowGaps = t1SampleBelow.map((inc) => lib - inc);
    const t2BelowGaps = t2Below.map((inc) => lib - inc);
    const nonProgramBelowGaps = nonProgramSampleIncomes.filter((inc) => inc <= lib).map((inc) => lib - inc);
    const t1Increases = t1Active.map((f, i) => t1SampleIncomes[i] - f.totalNetIncome);
    const t2Increases = t2ActiveFarmers.map((f) => f.incomeIncrease);
    const nonProgramIncreases = controlSample.map((f) => f.totalNetIncome * (baseInflation - 1));

    // ── Supply Shed KPI ──
    // numerator = program above + non-program above (extrapolated)
    // denominator = total supply shed population
    const supplyShEdAbove = totalAbove + nonProgramAbove;
    const supplyShEdKPI = supplyShEdPop > 0 ? (supplyShEdAbove / supplyShEdPop) * 100 : 0;

    const result: YearlyResult = {
      year,
      lib,
      isReported,
      t1TotalFarmers: t1TotalDisplay,
      t1AboveLIB: t1Above,
      t1PctAboveLIB: t1Pct,
      t1AvgIncome: t1AvgInc,
      t1MedianIncome: t1SampleIncomes.length > 0 ? median(t1SampleIncomes) : 0,
      t1AvgLIBGap: t1SampleBelow.length > 0 ? mean(t1BelowGaps) : 0,
      t1MedianLIBGap: t1BelowGaps.length > 0 ? median(t1BelowGaps) : 0,
      t1MedianIncomeIncrease: t1Increases.length > 0 ? median(t1Increases) : 0,
      t1MovedAboveLIB: t1MovedScaled,
      legacyTotalFarmers: legacyTotalDisplay,
      legacyAboveLIB: legacyAbove,
      legacyPctAboveLIB: legacyPct,
      legacyAvgIncome: legacyAvgInc,
      t2TotalFarmers: t2Incomes.length,
      t2AboveLIB: t2Above,
      t2PctAboveLIB: t2BaselineSurveyStats
        ? t2BaselineSurveyStats.pct
        : t2Incomes.length > 0 ? (t2Above / t2Incomes.length) * 100 : 0,
      t2AvgIncome: t2BaselineSurveyStats ? t2BaselineSurveyStats.avg : t2AvgInc,
      t2MedianIncome: t2BaselineSurveyStats
        ? t2BaselineSurveyStats.med
        : t2Incomes.length > 0 ? median(t2Incomes) : 0,
      t2AvgLIBGap: t2BaselineSurveyStats
        ? t2BaselineSurveyStats.avgGap
        : t2Below.length > 0 ? mean(t2BelowGaps) : 0,
      t2MedianLIBGap: t2BaselineSurveyStats
        ? t2BaselineSurveyStats.medGap
        : t2BelowGaps.length > 0 ? median(t2BelowGaps) : 0,
      t2MedianIncomeIncrease: t2Increases.length > 0 ? median(t2Increases) : 0,
      t2MovedAboveLIB: t2Moved,
      nonProgramTotalFarmers: nonProgramTotal,
      nonProgramAboveLIB: nonProgramAbove,
      nonProgramPctAboveLIB: nonProgramPctAbove,
      nonProgramAvgIncome: nonProgramAvgInc,
      nonProgramMedianIncome: nonProgramSampleIncomes.length > 0 ? median(nonProgramSampleIncomes) : 0,
      nonProgramMedianLIBGap: nonProgramBelowGaps.length > 0 ? median(nonProgramBelowGaps) : 0,
      nonProgramMedianIncomeIncrease: nonProgramIncreases.length > 0 ? median(nonProgramIncreases) : 0,
      totalFarmers: totalFarmersDisplay,
      totalAboveLIB: totalAbove,
      totalPctAboveLIB,
      totalAvgIncome: totalAvgInc,
      totalMovedAboveLIB: t1MovedScaled + t2Moved,
      totalAvgLIBGap: allBelowIncomes.length > 0 ? mean(allBelowIncomes.map((inc) => lib - inc)) : 0,
      supplyShEdKPI,
      supplyShEdTotalFarmers: supplyShEdPop,
      supplyShEdAboveLIB: supplyShEdAbove,
    };

    yearlyResults.push(result);
  }

  // ── Crop contributions (for target year, T1 only for simplicity) ──
  const cropContributions = computeCropContributions(t1Active, params);

  const summary = yearlyResults.find((r) => r.year === params.targetYear) ?? yearlyResults[yearlyResults.length - 1];

  // Total T1 population is the fixed anchor — Legacy is a status within it
  const baselineTotalFarmers = PROGRAM_T1_FARMERS;

  // Baseline supply shed KPI
  const baselineResult = yearlyResults[0];
  const baselineSupplyShEdKPI = baselineResult?.supplyShEdKPI ?? 0;

  return {
    params,
    yearlyResults,
    cropContributions,
    summary,
    baselineAboveLIB: baselineAbove,
    baselinePctAboveLIB: baselineTotalFarmers > 0 ? (baselineAbove / baselineTotalFarmers) * 100 : 0,
    baselineTotalFarmers,
    baselineSupplyShEdKPI,
  };
}

// ─── T2 Cohort Builder ────────────────────────────────────────────────────────

/**
 * Build T2 cohorts by resampling from T2 baseline data.
 * Each cohort year gets a set of "synthetic" farmers based on the T2 baseline distribution.
 */
function buildT2Cohorts(
  t2Base: FarmerBaseline[],
  intake: Record<number, number>,
  modelYears?: number[]
): Record<number, FarmerBaseline[]> {
  if (t2Base.length === 0) return {};

  const cohorts: Record<number, FarmerBaseline[]> = {};
  let totalAssigned = 0;
  const yearsToUse = modelYears ?? [...YEARS];

  for (const year of yearsToUse) {
    if (year === BASELINE_YEAR) continue; // T2 cohorts start from 2025
    const count = intake[year] ?? 0;
    if (count === 0 || totalAssigned >= MAX_T2_FARMERS) {
      cohorts[year] = [];
      continue;
    }

    const actualCount = Math.min(count, MAX_T2_FARMERS - totalAssigned);

    // Sample from T2 base with replacement (cycling through)
    const cohortFarmers: FarmerBaseline[] = [];
    for (let i = 0; i < actualCount; i++) {
      const baseIdx = i % t2Base.length;
      cohortFarmers.push({
        ...t2Base[baseIdx],
        id: 100_000 + year * 10_000 + i, // unique synthetic ID
      });
    }

    cohorts[year] = cohortFarmers;
    totalAssigned += actualCount;
  }

  return cohorts;
}

// ─── Crop Contribution Analysis ───────────────────────────────────────────────

function computeCropContributions(
  farmers: FarmerBaseline[],
  params: LIBScenarioParams
): CropContribution[] {
  const contributions: CropContribution[] = [];

  for (const crop of MODELED_CROPS) {
    const growers = farmers.filter((f) => f.isGrower[crop]);
    if (growers.length === 0) {
      contributions.push({
        crop,
        baselineIncome: 0,
        projectedIncome: 0,
        change: 0,
        changePercent: 0,
        growerCount: 0,
      });
      continue;
    }

    const baselineAvg = mean(growers.map((f) => f.cropIncomes[crop]));

    // Project with full tenure (T1 farmers, max years)
    const lever = params.crops[crop];
    const costRatio = CROP_COST_RATIOS[crop];
    const projectedAvg = mean(
      growers.map((f) => {
        const baseCropIncome = f.cropIncomes[crop];
        // Same handling as projectFarmerIncome: loss-making growers can't be
        // decomposed into revenue/cost via the ratio — only acreage scales them.
        if (baseCropIncome <= 0) {
          return baseCropIncome * (1 + lever.acreageChange / 100);
        }
        const baseRevenue = baseCropIncome / (1 - costRatio);
        const baseCost = baseRevenue * costRatio;

        const projRevenue = baseRevenue *
          (1 + lever.yieldChange / 100) *
          (1 + lever.priceChange / 100) *
          (1 + lever.acreageChange / 100);
        const projCost = baseCost *
          (1 + lever.costChange / 100) *
          (1 + lever.acreageChange / 100);
        return projRevenue - projCost;
      })
    );

    const change = projectedAvg - baselineAvg;

    contributions.push({
      crop,
      baselineIncome: baselineAvg,
      projectedIncome: projectedAvg,
      change,
      changePercent: baselineAvg !== 0 ? (change / Math.abs(baselineAvg)) * 100 : 0,
      growerCount: growers.length,
    });
  }

  return contributions;
}

// ─── Rabi Land Balance Helper ─────────────────────────────────────────────────

/**
 * Adjusts Rabi crop acreage changes to maintain land balance.
 * When one Rabi crop's acreage increases, others decrease proportionally.
 *
 * Returns adjusted acreage changes for all Rabi crops.
 * Used by the UI to auto-adjust sliders.
 */
export function balanceRabiAcreage(
  changedCrop: ModeledCrop,
  newAcreageChange: number,
  currentChanges: Record<ModeledCrop, number>,
  baselineAcreageShares: Record<ModeledCrop, number> // fraction of total Rabi area
): Record<ModeledCrop, number> {
  if (!RABI_CROPS.includes(changedCrop)) {
    return { ...currentChanges, [changedCrop]: newAcreageChange };
  }

  const result = { ...currentChanges };
  result[changedCrop] = newAcreageChange;

  // Calculate the net area change from the modified crop
  const changedShare = baselineAcreageShares[changedCrop] || 1 / 3;
  const areaIncrease = changedShare * (newAcreageChange / 100);

  // Distribute the decrease among other Rabi crops proportionally
  const otherRabi = RABI_CROPS.filter((c) => c !== changedCrop);
  const otherTotalShare = otherRabi.reduce((sum, c) => sum + (baselineAcreageShares[c] || 1 / 3), 0);

  if (otherTotalShare > 0 && areaIncrease !== 0) {
    for (const other of otherRabi) {
      const otherShare = baselineAcreageShares[other] || 1 / 3;
      const otherFrac = otherShare / otherTotalShare;
      const decrease = (areaIncrease * otherFrac) / otherShare;
      result[other] = Math.round(-decrease * 100);
    }
  }

  return result;
}

// ─── Default / Empty Params ───────────────────────────────────────────────────

export function createDefaultParams(name = "Untitled Scenario", projectionYears = 6): LIBScenarioParams {
  const crops = {} as Record<ModeledCrop, CropLever>;
  for (const crop of MODELED_CROPS) {
    crops[crop] = { yieldChange: 0, priceChange: 0, costChange: 0, acreageChange: 0 };
  }

  return {
    name,
    crops,
    otherOnFarmChange: 0,
    offFarmChange: 0,
    t2YearlyIntake: projectionYears === 6 ? { ...DEFAULT_T2_INTAKE } : generateDefaultT2Intake(projectionYears),
    includeT1Legacy: true,  // now on by default since legacy is part of supply shed
    targetYear: BASELINE_YEAR + projectionYears,
    projectionYears,
    leverMode: "percentage",
    supplyShEdPopulation: DEFAULT_SUPPLY_SHED_POPULATION,
    extrapolationRate: DEFAULT_EXTRAPOLATION_RATE,
    t1Offboarding: generateDefaultT1Offboarding(projectionYears),
    reportedYears: [BASELINE_YEAR],
  };
}

// ─── Preset Example Scenarios ─────────────────────────────────────────────────

/** Three starter scenarios that illustrate different strategic approaches. */
export function getPresetScenarios(projectionYears = 6): LIBScenarioParams[] {
  const base = (name: string) => createDefaultParams(name, projectionYears);

  // 1. Business as Usual — no lever changes; shows the natural trajectory
  const bau = base("Business as Usual");

  // 2. T2 Intensification — ramp up T2 intake with moderate crop improvements
  const t2 = base("T2 Intensification");
  t2.crops.mint  = { yieldChange: 15, priceChange: 5,  costChange: -5, acreageChange: 10 };
  t2.crops.rice  = { yieldChange: 10, priceChange: 5,  costChange: 0,  acreageChange: 0  };
  t2.crops.potato = { yieldChange: 10, priceChange: 10, costChange: -5, acreageChange: 0  };
  t2.crops.mustard = { yieldChange: 5, priceChange: 5,  costChange: 0,  acreageChange: 0  };
  // Bigger T2 cohorts each year
  const t2Intake = generateDefaultT2Intake(projectionYears);
  for (const yr of Object.keys(t2Intake)) t2Intake[Number(yr)] = 3000;
  t2.t2YearlyIntake = t2Intake;
  t2.otherOnFarmChange = 10;

  // 3. T1 Diversification — shift T1 farmers toward higher-value crops
  const t1 = base("T1 Diversification");
  t1.crops.mint  = { yieldChange: 20, priceChange: 10, costChange: -10, acreageChange: 25 };
  t1.crops.rice  = { yieldChange: 5,  priceChange: 0,  costChange: 0,  acreageChange: -10 };
  t1.crops.potato = { yieldChange: 25, priceChange: 15, costChange: -10, acreageChange: 15 };
  t1.crops.mustard = { yieldChange: 10, priceChange: 10, costChange: -5, acreageChange: 10 };
  t1.otherOnFarmChange = 15;

  return [bau, t2, t1];
}

// ─── Saved Scenario Management ────────────────────────────────────────────────

const STORAGE_KEY = "lib-scenarios";
const MAX_SAVED = 5;

export function loadSavedScenarios(): LIBScenarioParams[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LIBScenarioParams[];
  } catch {
    return [];
  }
}

export function saveScenario(scenario: LIBScenarioParams): LIBScenarioParams[] {
  const existing = loadSavedScenarios();
  // Replace if same name, otherwise add
  const idx = existing.findIndex((s) => s.name === scenario.name);
  if (idx >= 0) {
    existing[idx] = scenario;
  } else {
    if (existing.length >= MAX_SAVED) {
      existing.shift(); // remove oldest
    }
    existing.push(scenario);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return existing;
}

export function deleteSavedScenario(name: string): LIBScenarioParams[] {
  const existing = loadSavedScenarios().filter((s) => s.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return existing;
}

// ─── Scenario File Export / Import (Excel) ────────────────────────────────────

import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

const CROP_DISPLAY: Record<string, string> = {
  mint: "Mint", rice: "Rice", potato: "Potato", wheat: "Wheat", mustard: "Mustard",
};

const CROP_HEX: Record<string, string> = {
  mint: "00CCCC", rice: "FFB703", potato: "6F42C1", wheat: "FB8500", mustard: "219EBC",
};

function fmtPct(v: number): string {
  if (v === 0) return "0%";
  return `${v > 0 ? "+" : ""}${v}%`;
}

// ── Brand palette (ARGB hex without #, as exceljs expects) ──
const BRAND = {
  deepPurple: "FF2A1055",
  plum:       "FF910D63",
  green:      "FF00A17D",
  gold:       "FFFFC000",
  gray:       "FF6D6A6A",
  lightPurple:"FFE4D5F5",
  lightGreen: "FFD4F0E7",
  lightGold:  "FFFFF4D1",
  lavender:   "FFF5F3F7",
  nearWhite:  "FFFAFAFA",
  white:      "FFFFFFFF",
  black:      "FF000000",
  darkText:   "FF1A1A2E",
  mutedText:  "FF6B7280",
};

/** Thin border style for exceljs */
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE0E0E0" } },
  left: { style: "thin", color: { argb: "FFE0E0E0" } },
  bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
  right: { style: "thin", color: { argb: "FFE0E0E0" } },
};

const sectionHeaderFill: ExcelJS.FillPattern = {
  type: "pattern", pattern: "solid", fgColor: { argb: BRAND.deepPurple },
};

const sectionHeaderFont: Partial<ExcelJS.Font> = {
  bold: true, size: 11, color: { argb: BRAND.white }, name: "Calibri",
};

const tableHeaderFill: ExcelJS.FillPattern = {
  type: "pattern", pattern: "solid", fgColor: { argb: BRAND.lavender },
};

const tableHeaderFont: Partial<ExcelJS.Font> = {
  bold: true, size: 10, color: { argb: BRAND.deepPurple }, name: "Calibri",
};

const bodyFont: Partial<ExcelJS.Font> = {
  size: 10, color: { argb: BRAND.darkText }, name: "Calibri",
};

const mutedFont: Partial<ExcelJS.Font> = {
  size: 9, italic: true, color: { argb: BRAND.mutedText }, name: "Calibri",
};

const kpiValueFont: Partial<ExcelJS.Font> = {
  bold: true, size: 14, color: { argb: BRAND.deepPurple }, name: "Calibri",
};

const kpiLabelFont: Partial<ExcelJS.Font> = {
  size: 9, color: { argb: BRAND.mutedText }, name: "Calibri",
};

/** Helper: apply section header style to a merged row */
function addSectionHeader(ws: ExcelJS.Worksheet, row: number, text: string, cols: number): void {
  ws.mergeCells(row, 1, row, cols);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = sectionHeaderFont;
  cell.fill = sectionHeaderFill;
  cell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(row).height = 26;
}

/** Helper: apply table header style to cells in a row */
function addTableHeaderRow(ws: ExcelJS.Worksheet, row: number, headers: string[]): void {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = tableHeaderFont;
    cell.fill = tableHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
  });
  ws.getRow(row).height = 22;
}

/** Helper: apply body cell style */
function addBodyRow(ws: ExcelJS.Worksheet, row: number, values: (string | number)[], opts?: { altRow?: boolean }): void {
  const alt = opts?.altRow ?? false;
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    cell.font = bodyFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
    if (alt) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.nearWhite } };
    }
  });
}

export function downloadScenarioExcel(
  scenario: LIBScenarioParams,
  result?: LIBScenarioResult,
): void {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shubh Samriddhi LIB Scenario Tool";
  wb.created = new Date();

  const intakeYears = generateYears(scenario.projectionYears ?? 6).filter((y) => y > BASELINE_YEAR);
  const intakeTotal = Object.values(scenario.t2YearlyIntake).reduce((a, b) => a + b, 0);
  const exportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: Executive Summary (branded, beautiful)
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet("Executive Summary", {
    properties: { tabColor: { argb: "2A1055" } },
  });

  // Column widths
  ws1.columns = [
    { width: 24 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 },
  ];

  let r = 1;

  // ── Title banner ──
  ws1.mergeCells(r, 1, r, 8);
  const titleCell = ws1.getCell(r, 1);
  titleCell.value = "SHUBH SAMRIDDHI — LIB SCENARIO REPORT";
  titleCell.font = { bold: true, size: 16, color: { argb: BRAND.white }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.deepPurple } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(r).height = 40;
  r++;

  // ── Subtitle bar ──
  ws1.mergeCells(r, 1, r, 8);
  const subCell = ws1.getCell(r, 1);
  subCell.value = `Scenario: ${scenario.name}  •  Target: ${scenario.targetYear}  •  Exported: ${exportDate}`;
  subCell.font = { size: 10, color: { argb: BRAND.white }, name: "Calibri" };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.plum } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(r).height = 28;
  r++;

  // ── KPI Summary Row (if results available) ──
  if (result) {
    r++; // blank spacer
    ws1.mergeCells(r, 1, r, 8);
    const kpiTitle = ws1.getCell(r, 1);
    kpiTitle.value = "KEY PERFORMANCE INDICATORS";
    kpiTitle.font = { bold: true, size: 10, color: { argb: BRAND.deepPurple }, name: "Calibri" };
    kpiTitle.alignment = { horizontal: "center" };
    ws1.getRow(r).height = 20;
    r++;

    const summary = result.summary;
    const kpis = [
      { label: "Total Farmers", value: summary.totalFarmers.toLocaleString(), bg: BRAND.lightPurple },
      { label: "% Above LIB", value: `${summary.totalPctAboveLIB.toFixed(1)}%`, bg: BRAND.lightGreen },
      { label: "Avg Income", value: `$${Math.round(summary.totalAvgIncome).toLocaleString()}`, bg: BRAND.lightGold },
      { label: "Moved Above LIB", value: `+${summary.totalMovedAboveLIB.toLocaleString()}`, bg: BRAND.lightGreen },
    ];

    // KPI values row
    kpis.forEach((kpi, i) => {
      const col = i * 2 + 1;
      ws1.mergeCells(r, col, r, col + 1);
      const vc = ws1.getCell(r, col);
      vc.value = kpi.value;
      vc.font = kpiValueFont;
      vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.bg } };
      vc.alignment = { horizontal: "center", vertical: "middle" };
      vc.border = thinBorder;
    });
    ws1.getRow(r).height = 36;
    r++;

    // KPI labels row
    kpis.forEach((kpi, i) => {
      const col = i * 2 + 1;
      ws1.mergeCells(r, col, r, col + 1);
      const lc = ws1.getCell(r, col);
      lc.value = kpi.label;
      lc.font = kpiLabelFont;
      lc.alignment = { horizontal: "center", vertical: "top" };
    });
    ws1.getRow(r).height = 18;
    r++;

    // Baseline comparison row
    ws1.mergeCells(r, 1, r, 8);
    const baseLine = ws1.getCell(r, 1);
    baseLine.value = `Baseline (${BASELINE_YEAR}): ${result.baselinePctAboveLIB.toFixed(1)}% above LIB • ${result.baselineTotalFarmers.toLocaleString()} farmers • LIB benchmark $${Math.round(result.yearlyResults[0]?.lib ?? LIB_2024).toLocaleString()} → $${Math.round(summary.lib).toLocaleString()} (${scenario.targetYear})`;
    baseLine.font = mutedFont;
    baseLine.alignment = { horizontal: "center" };
    r++;
  }

  r++; // spacer

  // ── General Settings ──
  addSectionHeader(ws1, r, "⚙  GENERAL SETTINGS", 8);
  r++;
  addTableHeaderRow(ws1, r, ["Setting", "Value"]);
  r++;
  const settings: [string, string | number][] = [
    ["Projection Horizon", `${scenario.projectionYears ?? 6} years (${BASELINE_YEAR}–${scenario.targetYear})`],
    ["Target Year", scenario.targetYear],
    ["T1 Program Farmers (fixed total)", PROGRAM_T1_FARMERS.toLocaleString()],
    ["T1 Offboarding Plan", scenario.includeT1Legacy ? "✓ Enabled" : "✗ Disabled"],
    ["Supply Shed Population", (scenario.supplyShEdPopulation ?? DEFAULT_SUPPLY_SHED_POPULATION).toLocaleString()],
    ["Extrapolation Rate", `${((scenario.extrapolationRate ?? DEFAULT_EXTRAPOLATION_RATE) * 100).toFixed(0)}%`],
    ["Lever Mode", scenario.leverMode ?? "percentage"],
    ["Other On-Farm Income Change (incl. livestock)", fmtPct(scenario.otherOnFarmChange)],
    ["Off-Farm Income Change", fmtPct(scenario.offFarmChange)],
  ];
  settings.forEach(([label, val], i) => {
    addBodyRow(ws1, r, [label, typeof val === "number" ? val : val], { altRow: i % 2 === 1 });
    r++;
  });

  r++; // spacer

  // ── Crop Lever Adjustments ──
  addSectionHeader(ws1, r, "🌾  CROP LEVER ADJUSTMENTS (% change from baseline)", 8);
  r++;
  addTableHeaderRow(ws1, r, ["Crop", "Season", "Yield", "Price", "Cost", "Acreage"]);
  r++;
  MODELED_CROPS.forEach((crop, i) => {
    const l = scenario.crops[crop];
    const season = RABI_CROPS.includes(crop) ? "Rabi" : "Kharif";
    addBodyRow(ws1, r, [CROP_DISPLAY[crop] || crop, season, fmtPct(l.yieldChange), fmtPct(l.priceChange), fmtPct(l.costChange), fmtPct(l.acreageChange)], { altRow: i % 2 === 1 });
    // Color-code the crop name cell
    const nameCell = ws1.getCell(r, 1);
    const hex = CROP_HEX[crop];
    if (hex) {
      nameCell.font = { ...bodyFont, bold: true, color: { argb: `FF${hex}` } };
    }
    r++;
  });

  r++; // spacer

  // ── T2 Cohort Intake ──
  addSectionHeader(ws1, r, "👥  T2 FARMER COHORT INTAKE", 8);
  r++;
  const intakeHeaders = ["", ...intakeYears.map(String), "Total"];
  addTableHeaderRow(ws1, r, intakeHeaders);
  r++;
  const intakeVals: (string | number)[] = ["New Farmers", ...intakeYears.map((y) => scenario.t2YearlyIntake[y] ?? 0), intakeTotal];
  addBodyRow(ws1, r, intakeVals);
  // Bold the total
  const totalCell = ws1.getCell(r, intakeHeaders.length);
  totalCell.font = { ...bodyFont, bold: true, color: { argb: BRAND.green } };
  r++;

  ws1.mergeCells(r, 1, r, intakeHeaders.length);
  const capNote = ws1.getCell(r, 1);
  capNote.value = `Maximum program capacity: ${MAX_T2_FARMERS.toLocaleString()} farmers`;
  capNote.font = mutedFont;
  r++;

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: Detailed Results (if result data is available)
  // ═══════════════════════════════════════════════════════════════════════════
  if (result && result.yearlyResults.length > 0) {
    const ws2 = wb.addWorksheet("Projection Results", {
      properties: { tabColor: { argb: "00A17D" } },
    });
    ws2.columns = [
      { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    let r2 = 1;

    // Title
    ws2.mergeCells(r2, 1, r2, 10);
    const t2Title = ws2.getCell(r2, 1);
    t2Title.value = `YEAR-BY-YEAR PROJECTION — ${scenario.name}`;
    t2Title.font = { bold: true, size: 14, color: { argb: BRAND.white }, name: "Calibri" };
    t2Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.green } };
    t2Title.alignment = { vertical: "middle", horizontal: "center" };
    ws2.getRow(r2).height = 36;
    r2++;

    r2++; // spacer

    // ── Yearly trajectory table ──
    addSectionHeader(ws2, r2, "📈  LIB TRAJECTORY BY YEAR", 10);
    r2++;

    const trajHeaders = ["Year", "LIB ($)", "T1 Farmers", "T1 % Above", "T1 Avg ($)", "T2 Farmers", "T2 % Above", "T2 Avg ($)", "Total % Above", "Total Avg ($)"];
    addTableHeaderRow(ws2, r2, trajHeaders);
    r2++;

    result.yearlyResults.forEach((yr, i) => {
      addBodyRow(ws2, r2, [
        yr.year,
        `$${Math.round(yr.lib).toLocaleString()}`,
        yr.t1TotalFarmers.toLocaleString(),
        `${yr.t1PctAboveLIB.toFixed(1)}%`,
        `$${Math.round(yr.t1AvgIncome).toLocaleString()}`,
        yr.t2TotalFarmers.toLocaleString(),
        yr.t2TotalFarmers > 0 || yr.t2PctAboveLIB > 0 ? `${yr.t2PctAboveLIB.toFixed(1)}%` : "—",
        yr.t2TotalFarmers > 0 || yr.t2AvgIncome > 0 ? `$${Math.round(yr.t2AvgIncome).toLocaleString()}` : "—",
        `${yr.totalPctAboveLIB.toFixed(1)}%`,
        `$${Math.round(yr.totalAvgIncome).toLocaleString()}`,
      ], { altRow: i % 2 === 1 });

      // Highlight the target year row
      if (yr.year === scenario.targetYear) {
        for (let c = 1; c <= 10; c++) {
          const cell = ws2.getCell(r2, c);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.lightGreen } };
          cell.font = { ...bodyFont, bold: true };
        }
      }
      r2++;
    });

    r2 += 2; // spacer

    // ── Crop contributions ──
    if (result.cropContributions.length > 0) {
      addSectionHeader(ws2, r2, "🌿  CROP INCOME CONTRIBUTIONS (at target year)", 10);
      r2++;

      const cropHeaders = ["Crop", "Baseline ($)", "Projected ($)", "Change ($)", "Change (%)", "Growers"];
      addTableHeaderRow(ws2, r2, cropHeaders);
      r2++;

      result.cropContributions.forEach((cc, i) => {
        const changeStr = cc.change >= 0 ? `+$${Math.round(cc.change).toLocaleString()}` : `-$${Math.round(Math.abs(cc.change)).toLocaleString()}`;
        const pctStr = cc.changePercent >= 0 ? `+${cc.changePercent.toFixed(1)}%` : `${cc.changePercent.toFixed(1)}%`;
        addBodyRow(ws2, r2, [
          CROP_DISPLAY[cc.crop] || cc.crop,
          `$${Math.round(cc.baselineIncome).toLocaleString()}`,
          `$${Math.round(cc.projectedIncome).toLocaleString()}`,
          changeStr,
          pctStr,
          cc.growerCount.toLocaleString(),
        ], { altRow: i % 2 === 1 });

        // Color the crop name
        const hex = CROP_HEX[cc.crop];
        if (hex) {
          ws2.getCell(r2, 1).font = { ...bodyFont, bold: true, color: { argb: `FF${hex}` } };
        }
        // Color the change: green if positive, red if negative
        const changeCell = ws2.getCell(r2, 4);
        changeCell.font = {
          ...bodyFont,
          bold: true,
          color: { argb: cc.change >= 0 ? BRAND.green : "FFE53E3E" },
        };
        r2++;
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3: Scenario Data (machine-readable, for re-import — uses same format)
  // ═══════════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet("Scenario Data", {
    properties: { tabColor: { argb: "FFC000" } },
  });
  ws3.columns = [{ width: 20 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];

  const dataRows: (string | number)[][] = [
    ["_format", "lib-scenario-v1"],
    ["name", scenario.name],
    ["targetYear", scenario.targetYear],
    ["projectionYears", scenario.projectionYears ?? 6],
    ["includeT1Legacy", scenario.includeT1Legacy ? 1 : 0],
    ["otherOnFarmChange", scenario.otherOnFarmChange],
    ["offFarmChange", scenario.offFarmChange],
    ["leverMode", scenario.leverMode ?? "percentage"],
    ["supplyShEdPopulation", scenario.supplyShEdPopulation ?? DEFAULT_SUPPLY_SHED_POPULATION],
    ["extrapolationRate", scenario.extrapolationRate ?? DEFAULT_EXTRAPOLATION_RATE],
    [],
    ["Crop", "yieldChange", "priceChange", "costChange", "acreageChange"],
  ];
  for (const crop of MODELED_CROPS) {
    const l = scenario.crops[crop];
    dataRows.push([crop, l.yieldChange, l.priceChange, l.costChange, l.acreageChange]);
  }
  dataRows.push([]);
  dataRows.push(["T2 Intake Year", "Farmers"]);
  for (const y of intakeYears) {
    dataRows.push([y, scenario.t2YearlyIntake[y] ?? 0]);
  }

  // Style Sheet 3 header
  let r3 = 1;
  ws3.mergeCells(r3, 1, r3, 5);
  const dataTitle = ws3.getCell(r3, 1);
  dataTitle.value = "SCENARIO DATA — Machine Readable (for re-import)";
  dataTitle.font = { bold: true, size: 10, color: { argb: BRAND.white }, name: "Calibri" };
  dataTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.gold } };
  dataTitle.alignment = { horizontal: "center" };
  ws3.getRow(r3).height = 24;
  r3++;

  // Write the data rows with minimal styling
  dataRows.forEach((row) => {
    row.forEach((val, i) => {
      const cell = ws3.getCell(r3, i + 1);
      cell.value = val;
      cell.font = { size: 10, name: "Calibri" };
    });
    r3++;
  });

  // ── Write and download ──
  wb.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario.name.replace(/\s+/g, "_").toLowerCase()}_scenario.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export function parseScenarioFile(content: string | ArrayBuffer): LIBScenarioParams | { error: string } {
  // Try JSON first for string content — XLSX.read would otherwise swallow it as CSV
  if (typeof content === "string" && content.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      if (parsed._format === "lib-scenario-v1" && parsed.scenario) {
        return validateScenarioParams(parsed.scenario);
      }
      if (parsed.name && parsed.crops) {
        return validateScenarioParams(parsed);
      }
    } catch {
      // Not JSON — fall through to Excel
    }
  }

  // Try parsing as Excel
  try {
    // Convert ArrayBuffer → Uint8Array for SheetJS compatibility
    const data = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
    const wb = XLSX.read(data, { type: content instanceof ArrayBuffer ? "array" : "string" });

    // Look for the "Scenario Data" sheet
    const dataSheet = wb.Sheets["Scenario Data"];
    if (dataSheet) {
      return parseExcelDataSheet(dataSheet);
    }

    // If no data sheet, try the first sheet
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    if (firstSheet) {
      return parseExcelDataSheet(firstSheet);
    }
  } catch {
    // Not an Excel file, try other formats
  }

  // Try parsing as JSON string
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      if (parsed._format === "lib-scenario-v1" && parsed.scenario) {
        return validateScenarioParams(parsed.scenario);
      }
      if (parsed.name && parsed.crops) {
        return validateScenarioParams(parsed);
      }
    } catch {
      // Not JSON
    }
  }

  return { error: "Could not read this file. Please upload an Excel (.xlsx) file downloaded from this tool." };
}

function parseExcelDataSheet(sheet: XLSX.WorkSheet): LIBScenarioParams | { error: string } {
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

  // Find key-value pairs
  const kv: Record<string, string | number> = {};
  const cropData: Record<string, Record<string, number>> = {};
  const intakeData: Record<number, number> = {};

  let mode: "kv" | "crops" | "intake" | null = null;

  for (const row of rows) {
    if (!row || row.length === 0) { mode = null; continue; }

    const first = String(row[0] ?? "").trim();

    // Detect sections
    if (first === "Crop" && String(row[1] ?? "") === "yieldChange") {
      mode = "crops"; continue;
    }
    if (first === "T2 Intake Year") {
      mode = "intake"; continue;
    }

    if (mode === "crops" && first) {
      cropData[first] = {
        yieldChange: Number(row[1]) || 0,
        priceChange: Number(row[2]) || 0,
        costChange: Number(row[3]) || 0,
        acreageChange: Number(row[4]) || 0,
      };
    } else if (mode === "intake" && first) {
      intakeData[Number(first)] = Number(row[1]) || 0;
    } else if (first && row.length >= 2) {
      kv[first] = row[1] as string | number;
    }
  }

  if (kv._format !== "lib-scenario-v1") {
    return { error: "This Excel file doesn't contain LIB scenario data. Please use a file downloaded from the Scenario Tool." };
  }

  const raw: Record<string, unknown> = {
    name: kv.name || "Imported Scenario",
    targetYear: Number(kv.targetYear) || 2030,
    projectionYears: kv.projectionYears,
    includeT1Legacy: kv.includeT1Legacy === 1 || kv.includeT1Legacy === "1",
    // Older exports carried a separate livestockChange — fold it into other on-farm
    otherOnFarmChange: (Number(kv.otherOnFarmChange) || 0) + (Number(kv.livestockChange) || 0),
    offFarmChange: kv.offFarmChange,
    supplyShEdPopulation: kv.supplyShEdPopulation,
    extrapolationRate: kv.extrapolationRate,
    crops: cropData,
    t2YearlyIntake: intakeData,
  };

  return validateScenarioParams(raw);
}

function validateScenarioParams(raw: Record<string, unknown>): LIBScenarioParams | { error: string } {
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return { error: "Scenario must have a name." };
  }

  const defaults = createDefaultParams(raw.name as string);
  const crops = { ...defaults.crops };

  if (raw.crops && typeof raw.crops === "object") {
    for (const crop of MODELED_CROPS) {
      const c = (raw.crops as Record<string, Record<string, unknown>>)[crop];
      if (c) {
        crops[crop] = {
          yieldChange: clamp(Number(c.yieldChange) || 0, -50, 100),
          priceChange: clamp(Number(c.priceChange) || 0, -50, 100),
          costChange: clamp(Number(c.costChange) || 0, -50, 100),
          acreageChange: clamp(Number(c.acreageChange) || 0, -50, 100),
        };
      }
    }
  }

  const projYears = clamp(Number(raw.projectionYears) || 6, MIN_PROJECTION_YEARS, MAX_PROJECTION_YEARS);
  const validYears = generateYears(projYears);

  const t2YearlyIntake = { ...generateDefaultT2Intake(projYears) };
  if (raw.t2YearlyIntake && typeof raw.t2YearlyIntake === "object") {
    for (const [yr, val] of Object.entries(raw.t2YearlyIntake as Record<string, unknown>)) {
      const yearNum = Number(yr);
      if (validYears.includes(yearNum) && yearNum > BASELINE_YEAR) {
        t2YearlyIntake[yearNum] = clamp(Number(val) || 0, 0, MAX_T2_FARMERS);
      }
    }
  }

  const rawTarget = Number(raw.targetYear);
  const targetYear = validYears.includes(rawTarget)
    ? rawTarget
    : BASELINE_YEAR + projYears;

  // Sanitize structured fields — imported files can carry anything
  const t1Offboarding = generateDefaultT1Offboarding(projYears);
  if (raw.t1Offboarding && typeof raw.t1Offboarding === "object" && !Array.isArray(raw.t1Offboarding)) {
    for (const [yr, val] of Object.entries(raw.t1Offboarding as Record<string, unknown>)) {
      const yearNum = Number(yr);
      if (validYears.includes(yearNum) && yearNum > BASELINE_YEAR) {
        t1Offboarding[yearNum] = clamp(Number(val) || 0, 0, PROGRAM_T1_FARMERS);
      }
    }
  }
  const reportedYears = Array.isArray(raw.reportedYears)
    ? (raw.reportedYears as unknown[]).map(Number).filter((y) => validYears.includes(y))
    : [BASELINE_YEAR];

  return {
    name: raw.name as string,
    crops,
    otherOnFarmChange: clamp((Number(raw.otherOnFarmChange) || 0) + (Number(raw.livestockChange) || 0), -50, 100),
    offFarmChange: clamp(Number(raw.offFarmChange) || 0, -50, 100),
    t2YearlyIntake,
    includeT1Legacy: raw.includeT1Legacy != null ? Boolean(raw.includeT1Legacy) : true,
    targetYear,
    projectionYears: projYears,
    // Fixed (₹) mode is disabled until driver-based levers land (Phase 3)
    leverMode: "percentage" as LeverMode,
    supplyShEdPopulation: clamp(Number(raw.supplyShEdPopulation) || DEFAULT_SUPPLY_SHED_POPULATION, 1000, 10_000_000),
    extrapolationRate: (EXTRAPOLATION_RATES.includes(Number(raw.extrapolationRate) as ExtrapolationRate)
      ? Number(raw.extrapolationRate)
      : DEFAULT_EXTRAPOLATION_RATE) as ExtrapolationRate,
    t1Offboarding,
    reportedYears,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Comparison Excel Export ─────────────────────────────────────────────────

export function downloadComparisonExcel(
  results: { params: LIBScenarioParams; result: LIBScenarioResult }[],
  insights?: ComparisonInsights,
): void {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shubh Samriddhi LIB Scenario Tool";
  wb.created = new Date();

  const exportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const bau = results.find((r) => r.params.name === "Business as Usual");
  const targetYear = results[0]?.params.targetYear ?? 2030;
  const projYears = results[0]?.params.projectionYears ?? 6;
  const years = generateYears(projYears);
  const scenarioNames = results.map((r) => r.params.name);
  const totalCols = 1 + scenarioNames.length; // metric col + one per scenario

  // ═══ Sheet 1: Comparison Summary ═══
  const ws1 = wb.addWorksheet("Comparison Summary", { properties: { tabColor: { argb: "2A1055" } } });
  ws1.columns = [{ width: 22 }, ...scenarioNames.map(() => ({ width: 20 }))];

  let r = 1;
  // Title
  ws1.mergeCells(r, 1, r, totalCols);
  const tc = ws1.getCell(r, 1);
  tc.value = "SHUBH SAMRIDDHI — SCENARIO COMPARISON REPORT";
  tc.font = { bold: true, size: 16, color: { argb: BRAND.white }, name: "Calibri" };
  tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.deepPurple } };
  tc.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(r).height = 40;
  r++;

  // Subtitle
  ws1.mergeCells(r, 1, r, totalCols);
  const sc = ws1.getCell(r, 1);
  sc.value = `${scenarioNames.length} Scenarios  •  Target: ${targetYear}  •  Exported: ${exportDate}`;
  sc.font = { size: 10, color: { argb: BRAND.white }, name: "Calibri" };
  sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.plum } };
  sc.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(r).height = 28;
  r += 2;

  // Section: KPI Comparison
  addSectionHeader(ws1, r, "KEY PERFORMANCE INDICATORS — Target Year " + targetYear, totalCols);
  r++;
  addTableHeaderRow(ws1, r, ["Metric", ...scenarioNames]);
  r++;

  const kpiRows: { label: string; key: keyof YearlyResult; fmt: (v: number) => string }[] = [
    { label: "Total Farmers", key: "totalFarmers", fmt: (v) => v.toLocaleString() },
    { label: "% Above LIB", key: "totalPctAboveLIB", fmt: (v) => v.toFixed(1) + "%" },
    { label: "# Above LIB", key: "totalAboveLIB", fmt: (v) => v.toLocaleString() },
    { label: "Moved Above LIB", key: "totalMovedAboveLIB", fmt: (v) => "+" + v.toLocaleString() },
    { label: "Avg Income", key: "totalAvgIncome", fmt: (v) => "$" + Math.round(v).toLocaleString() },
    { label: "Avg LIB Gap", key: "totalAvgLIBGap", fmt: (v) => "$" + Math.round(v).toLocaleString() },
    { label: "T1 % Above LIB", key: "t1PctAboveLIB", fmt: (v) => v.toFixed(1) + "%" },
    { label: "T2 % Above LIB", key: "t2PctAboveLIB", fmt: (v) => v.toFixed(1) + "%" },
    { label: "T1 Avg Income", key: "t1AvgIncome", fmt: (v) => "$" + Math.round(v).toLocaleString() },
    { label: "T2 Avg Income", key: "t2AvgIncome", fmt: (v) => "$" + Math.round(v).toLocaleString() },
  ];

  for (const row of kpiRows) {
    const vals: (string | number)[] = [row.label];
    for (const sr of results) {
      const val = Number(sr.result.summary[row.key]);
      const bauVal = bau ? Number(bau.result.summary[row.key]) : val;
      const delta = val - bauVal;
      const isBAU = sr.params.name === "Business as Usual";
      if (isBAU || Math.abs(delta) < 0.01) {
        vals.push(row.fmt(val));
      } else {
        const sign = delta > 0 ? "+" : "";
        vals.push(`${row.fmt(val)} (${sign}${row.fmt(delta)})`);
      }
    }
    addBodyRow(ws1, r, vals, { altRow: r % 2 === 0 });
    r++;
  }

  // Insights summary if available
  if (insights) {
    r += 1;
    addSectionHeader(ws1, r, "AI ANALYSIS SUMMARY", totalCols);
    r++;
    ws1.mergeCells(r, 1, r, totalCols);
    const insightCell = ws1.getCell(r, 1);
    insightCell.value = insights.summary;
    insightCell.font = { size: 10, italic: true, color: { argb: BRAND.darkText }, name: "Calibri" };
    insightCell.alignment = { wrapText: true, vertical: "top" };
    ws1.getRow(r).height = 60;
    r++;

    if (insights.bestPerformer.scenarioName !== "Business as Usual") {
      ws1.mergeCells(r, 1, r, totalCols);
      const bpCell = ws1.getCell(r, 1);
      bpCell.value = `★ Best Performer: ${insights.bestPerformer.scenarioName} — ${insights.bestPerformer.description}`;
      bpCell.font = { size: 10, color: { argb: BRAND.green.replace("FF", "") }, name: "Calibri" };
      bpCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.lightGreen } };
      bpCell.alignment = { wrapText: true, vertical: "top" };
      ws1.getRow(r).height = 40;
    }
  }

  // ═══ Sheet 2: Year-by-Year Trajectories ═══
  const ws2 = wb.addWorksheet("Trajectories", { properties: { tabColor: { argb: "910D63" } } });
  const trajHeaders = ["Year", "LIB ($)"];
  for (const name of scenarioNames) {
    trajHeaders.push(`${name} % Above`, `${name} Avg Income`);
  }
  ws2.columns = trajHeaders.map((_, i) => ({ width: i === 0 ? 8 : 18 }));

  let r2 = 1;
  addSectionHeader(ws2, r2, "YEAR-BY-YEAR PROJECTION TRAJECTORIES", trajHeaders.length);
  r2++;
  addTableHeaderRow(ws2, r2, trajHeaders);
  r2++;

  for (let yi = 0; yi < years.length; yi++) {
    const vals: (string | number)[] = [years[yi].toString()];
    // LIB from first result
    const firstYr = results[0]?.result.yearlyResults[yi];
    vals.push(firstYr ? "$" + Math.round(firstYr.lib).toLocaleString() : "—");

    for (const sr of results) {
      const yr = sr.result.yearlyResults[yi] ?? sr.result.yearlyResults.at(-1);
      if (yr) {
        vals.push(yr.totalPctAboveLIB.toFixed(1) + "%");
        vals.push("$" + Math.round(yr.totalAvgIncome).toLocaleString());
      } else {
        vals.push("—", "—");
      }
    }
    addBodyRow(ws2, r2, vals, { altRow: yi % 2 === 1 });
    r2++;
  }

  // ═══ Sheet 3: Scenario Parameters ═══
  const ws3 = wb.addWorksheet("Parameters", { properties: { tabColor: { argb: "FFC000" } } });
  ws3.columns = [{ width: 22 }, ...scenarioNames.map(() => ({ width: 18 }))];

  let r3 = 1;
  addSectionHeader(ws3, r3, "SCENARIO PARAMETERS COMPARISON", totalCols);
  r3++;
  addTableHeaderRow(ws3, r3, ["Parameter", ...scenarioNames]);
  r3++;

  // General params
  const generalRows: { label: string; getter: (p: LIBScenarioParams) => string }[] = [
    { label: "Target Year", getter: (p) => p.targetYear.toString() },
    { label: "Projection Years", getter: (p) => (p.projectionYears ?? 6).toString() },
    { label: "Include T1 Legacy", getter: (p) => p.includeT1Legacy ? "Yes" : "No" },
    { label: "Other On-Farm Change (incl. livestock)", getter: (p) => p.otherOnFarmChange + "%" },
    { label: "T2 Total Intake", getter: (p) => Object.values(p.t2YearlyIntake).reduce((a, b) => a + b, 0).toLocaleString() },
  ];

  for (const row of generalRows) {
    const vals: (string | number)[] = [row.label];
    for (const sr of results) vals.push(row.getter(sr.params));
    addBodyRow(ws3, r3, vals, { altRow: r3 % 2 === 0 });
    r3++;
  }

  // Crop levers
  r3++;
  addSectionHeader(ws3, r3, "CROP LEVER SETTINGS", totalCols);
  r3++;

  for (const crop of MODELED_CROPS) {
    const cropName = crop.charAt(0).toUpperCase() + crop.slice(1);
    for (const lever of ["yieldChange", "priceChange", "costChange", "acreageChange"] as const) {
      const label = `${cropName} — ${lever.replace("Change", " %")}`;
      const vals: (string | number)[] = [label];
      for (const sr of results) {
        const val = sr.params.crops[crop]?.[lever] ?? 0;
        vals.push(val === 0 ? "—" : val + "%");
      }
      addBodyRow(ws3, r3, vals, { altRow: r3 % 2 === 0 });
      r3++;
    }
  }

  // T2 intake schedule
  r3++;
  addSectionHeader(ws3, r3, "T2 INTAKE SCHEDULE", totalCols);
  r3++;
  const intakeYears = years.filter((y) => y > BASELINE_YEAR);
  for (const yr of intakeYears) {
    const vals: (string | number)[] = [yr.toString()];
    for (const sr of results) vals.push((sr.params.t2YearlyIntake[yr] ?? 0).toLocaleString());
    addBodyRow(ws3, r3, vals, { altRow: r3 % 2 === 0 });
    r3++;
  }

  // ── Write and download ──
  wb.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `scenario_comparison_${dateStr}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
