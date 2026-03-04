/**
 * Generate Mock Midline Dataset
 *
 * Simulates plausible changes after 1 year of agricultural interventions:
 *
 * Treatment groups (T-1, T-2) get stronger improvements than Control:
 *   - T-1 (full intervention): +15-30% income gains, better adoption, higher empowerment
 *   - T-2 (partial intervention): +8-18% income gains, moderate improvements
 *   - Control: +2-8% income gains (natural market/weather variation only)
 *
 * Plausible post-intervention effects:
 *   - Crop yields improve (better practices)
 *   - Crop income rises (better yields + market access)
 *   - Off-farm income grows slightly (diversification)
 *   - Women empowerment scores increase (training effects)
 *   - Practice adoption rates increase (intervention core)
 *   - Resources & productivity indices improve
 *   - Some farmers cross the Living Income Benchmark
 *   - Sustainability metrics shift slightly
 */

import * as fs from "fs";
import * as path from "path";

// ─── Seeded random for reproducibility ───
let seed = 42;
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function gaussianRandom(mean: number, stddev: number): number {
  const u1 = seededRandom();
  const u2 = seededRandom();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function jitter(value: number | null, multiplierMean: number, multiplierStd: number, minVal = 0): number | null {
  if (value === null || value === undefined) return value;
  const factor = gaussianRandom(multiplierMean, multiplierStd);
  const result = value * factor;
  return Math.round((result < minVal && value >= 0 ? minVal : result) * 100) / 100;
}

// ─── Intervention effect multipliers by project group ───
interface EffectConfig {
  // Income multipliers (mean, std)
  cropIncome: [number, number];
  offFarmIncome: [number, number];
  livestock: [number, number];
  // Yield improvement
  yieldBoost: [number, number];
  // Expense changes (better practices can reduce cost)
  expenses: [number, number];
  // Index improvements (additive)
  resourcesIndexBoost: [number, number];
  productivityIndexBoost: [number, number];
  empowermentBoost: [number, number];
  // Practice adoption rate boost (additive %)
  adoptionBoost: [number, number];
  // Probability of improved LIB status
  libImprovementProb: number;
  // Training participation shift probability
  trainingShift: number;
  // FPC membership gain probability
  fpcGainProb: number;
}

const EFFECTS: Record<string, EffectConfig> = {
  "T-1": {
    cropIncome: [1.25, 0.15],       // +25% avg, some variance
    offFarmIncome: [1.08, 0.06],     // slight off-farm growth
    livestock: [1.10, 0.08],
    yieldBoost: [1.20, 0.12],        // +20% yields
    expenses: [0.95, 0.08],          // -5% expenses (efficiency)
    resourcesIndexBoost: [0.08, 0.04],
    productivityIndexBoost: [0.10, 0.05],
    empowermentBoost: [1.2, 0.5],    // +1.2 points avg
    adoptionBoost: [18, 8],          // +18% adoption rate
    libImprovementProb: 0.25,        // 25% chance to cross LIB
    trainingShift: 0.7,              // 70% now trained
    fpcGainProb: 0.20,
  },
  "T-2": {
    cropIncome: [1.15, 0.12],
    offFarmIncome: [1.05, 0.05],
    livestock: [1.06, 0.06],
    yieldBoost: [1.12, 0.10],
    expenses: [0.98, 0.06],
    resourcesIndexBoost: [0.05, 0.03],
    productivityIndexBoost: [0.06, 0.04],
    empowermentBoost: [0.7, 0.4],
    adoptionBoost: [12, 6],
    libImprovementProb: 0.15,
    trainingShift: 0.5,
    fpcGainProb: 0.12,
  },
  "Control": {
    cropIncome: [1.04, 0.08],        // natural variation only
    offFarmIncome: [1.02, 0.04],
    livestock: [1.02, 0.05],
    yieldBoost: [1.03, 0.08],
    expenses: [1.02, 0.05],          // slight cost inflation
    resourcesIndexBoost: [0.01, 0.02],
    productivityIndexBoost: [0.02, 0.02],
    empowermentBoost: [0.2, 0.3],
    adoptionBoost: [3, 3],
    libImprovementProb: 0.05,
    trainingShift: 0.1,
    fpcGainProb: 0.03,
  },
};

// ─── LIB threshold (daily per capita in USD) ───
const LIB_DAILY_THRESHOLD = 3.65; // ~$1,332/year for a family of 1

// ─── Load baseline data ───
const baseDir = path.join(__dirname, "..", "src", "data", "rounds", "baseline");
const outDir = path.join(__dirname, "..", "src", "data", "rounds", "midline");

console.log("Loading baseline farmers...");
const baselineFarmers: any[] = JSON.parse(fs.readFileSync(path.join(baseDir, "farmers.json"), "utf-8"));
console.log(`  Loaded ${baselineFarmers.length} farmers`);

// ─── Generate midline farmers ───
console.log("Generating midline farmers...");

const midlineFarmers = baselineFarmers.map((f: any) => {
  const group = f.project as string;
  const fx = EFFECTS[group] || EFFECTS["Control"];
  const m = { ...f };

  // Age +1 year
  m.age = f.age + 1;

  // ── Crop incomes ──
  m.mintNetIncome = jitter(f.mintNetIncome, fx.cropIncome[0], fx.cropIncome[1]);
  m.riceNetIncome = jitter(f.riceNetIncome, fx.cropIncome[0], fx.cropIncome[1]);
  m.potatoNetIncome = jitter(f.potatoNetIncome, fx.cropIncome[0], fx.cropIncome[1]);
  m.mustardNetIncome = jitter(f.mustardNetIncome, fx.cropIncome[0], fx.cropIncome[1]);
  m.wheatNetIncome = jitter(f.wheatNetIncome, fx.cropIncome[0], fx.cropIncome[1]);
  m.otherCropsNetIncome = jitter(f.otherCropsNetIncome, fx.cropIncome[0], fx.cropIncome[1]);

  // ── Off-farm & livestock ──
  m.offFarmIncome = jitter(f.offFarmIncome, fx.offFarmIncome[0], fx.offFarmIncome[1]);
  m.offFarmExpenses = jitter(f.offFarmExpenses, 1.02, 0.03);
  m.offFarmNetIncome = m.offFarmIncome !== null && m.offFarmExpenses !== null
    ? Math.round((m.offFarmIncome - m.offFarmExpenses) * 100) / 100
    : f.offFarmNetIncome;
  m.livestockIncome = jitter(f.livestockIncome, fx.livestock[0], fx.livestock[1]);
  m.livestockExpenses = jitter(f.livestockExpenses, 1.03, 0.04);

  // ── Recompute totals ──
  const cropIncomes = [
    m.mintNetIncome, m.riceNetIncome, m.potatoNetIncome,
    m.mustardNetIncome, m.wheatNetIncome, m.otherCropsNetIncome,
  ].filter((v: any) => v !== null && v !== undefined);

  const cropTotal = cropIncomes.reduce((a: number, b: number) => a + b, 0);
  const offFarmTotal = (m.offFarmNetIncome || 0);
  const livestockNet = (m.livestockIncome || 0) - (m.livestockExpenses || 0);

  m.totalNetIncomeUsd = Math.round((cropTotal + offFarmTotal + livestockNet) * 100) / 100;
  m.totalIncomeUsd = Math.round((m.totalNetIncomeUsd + (m.totalExpensesUsd || 0) * gaussianRandom(fx.expenses[0], fx.expenses[1])) * 100) / 100;
  m.totalExpensesUsd = Math.round((m.totalIncomeUsd - m.totalNetIncomeUsd) * 100) / 100;
  if (m.totalExpensesUsd < 0) m.totalExpensesUsd = 0;

  m.netIncomeDaily = Math.round((m.totalNetIncomeUsd / 365) * 10000000) / 10000000;
  m.netIncomeDailyIndividual = f.totalFamilyMembers > 0
    ? Math.round((m.netIncomeDaily / f.totalFamilyMembers) * 10000000) / 10000000
    : m.netIncomeDaily;

  // Off-farm dependency
  if (m.totalNetIncomeUsd > 0 && offFarmTotal > 0) {
    m.offFarmDependency = Math.round((offFarmTotal / m.totalNetIncomeUsd) * 100000) / 100000;
  }

  // Fixed costs
  m.fixedCostAllCrops = jitter(f.fixedCostAllCrops, fx.expenses[0], fx.expenses[1]);

  // ── Acreage: slight changes (land consolidation/leasing) ──
  const acreChange = gaussianRandom(1.02, 0.04);
  m.totalAcre = Math.round(f.totalAcre * acreChange * 100) / 100;
  if (m.totalAcre <= 0) m.totalAcre = f.totalAcre;
  // Re-categorize
  if (m.totalAcre <= 2) m.farmSizeCategory = "0-2 Acres";
  else if (m.totalAcre <= 2.5) m.farmSizeCategory = "2-2.5 Acres";
  else if (m.totalAcre <= 5) m.farmSizeCategory = "2.5-5 Acres";
  else m.farmSizeCategory = ">5 Acres";

  // ── Indices ──
  const resBump = gaussianRandom(fx.resourcesIndexBoost[0], fx.resourcesIndexBoost[1]);
  m.resourcesIndex = clamp(Math.round((f.resourcesIndex + resBump) * 1000) / 1000, 0, 1);

  const prodBump = gaussianRandom(fx.productivityIndexBoost[0], fx.productivityIndexBoost[1]);
  m.productivityIndex = clamp(Math.round((f.productivityIndex + prodBump) * 1000) / 1000, 0, 1);

  // ── Women empowerment ──
  if (f.womenEmpowerment !== null && f.womenEmpowerment !== undefined) {
    const empBump = gaussianRandom(fx.empowermentBoost[0], fx.empowermentBoost[1]);
    m.womenEmpowerment = clamp(Math.round((f.womenEmpowerment + empBump) * 10) / 10, 0, 8);
  }
  // Upgrade Likert-scale women empowerment survey responses
  // Each question uses a 1-5 scale; we probabilistically upgrade scores for treatment groups
  if (f.womenQ1 !== "No Answer" && f.womenQ1 != null) {
    const LIKERT_MAPS: Record<string, string[]> = {
      // Q1-Q5, Q7: higher score = more empowered
      standard: [
        "", // 0 unused
        "1. Has no influence",
        "2. Has only a little influence",
        "3. Has equal influence with others",
        "4. Has strong influence over the decisions",
        "5. Solely or almost solely makes the decisions",
      ],
      // Q6: involvement scale (lower = MORE empowered, reversed)
      q6: [
        "",
        "1. Very involved",
        "2. Moderately involved",
        "3. Somewhat involved",
        "4. Rarely involved",
        "5. Not involved at all",
      ],
      // Q8: freedom scale (higher = more empowered)
      q8: [
        "",
        "1. No freedom",
        "2. Little freedom",
        "3. Some freedom",
        "4. Significant freedom",
        "5. Complete freedom",
      ],
    };

    const qMap: Record<string, string> = {
      womenQ1: "standard", womenQ2: "standard", womenQ3: "standard",
      womenQ4: "standard", womenQ5: "standard", womenQ6: "q6",
      womenQ7: "standard", womenQ8: "q8",
    };
    // Q6 is reverse-scored: upgrading means going from 5→4→3→2→1
    const reverseScored = new Set(["womenQ6"]);

    const upgradeProb = group === "T-1" ? 0.35 : group === "T-2" ? 0.22 : 0.06;
    const qs = ["womenQ1", "womenQ2", "womenQ3", "womenQ4", "womenQ5", "womenQ6", "womenQ7", "womenQ8"];

    for (const q of qs) {
      const val = m[q] as string;
      if (!val || val === "No Answer") continue;
      const scoreMatch = val.match(/^(\d)/);
      if (!scoreMatch) continue;
      const currentScore = parseInt(scoreMatch[1], 10);
      const mapKey = qMap[q] || "standard";
      const scale = LIKERT_MAPS[mapKey];
      const isReverse = reverseScored.has(q);

      if (seededRandom() < upgradeProb) {
        let newScore: number;
        if (isReverse) {
          // Lower score = more empowered for Q6
          newScore = Math.max(1, currentScore - 1);
        } else {
          // Higher score = more empowered
          newScore = Math.min(5, currentScore + 1);
        }
        if (newScore !== currentScore && scale[newScore]) {
          m[q] = scale[newScore];
        }
      }
    }
  }

  // ── Practice adoption ──
  if (f.practiceAdoptRateMint !== null && f.practiceAdoptRateMint !== undefined) {
    const adoptBump = gaussianRandom(fx.adoptionBoost[0], fx.adoptionBoost[1]);
    m.practiceAdoptRateMint = clamp(
      Math.round((f.practiceAdoptRateMint + adoptBump) * 100) / 100,
      0, 100
    );
  }
  // Update category
  if (m.practiceAdoptRateMint !== null) {
    if (m.practiceAdoptRateMint <= 40) m.practiceAdoption = "0-40%";
    else if (m.practiceAdoptRateMint <= 60) m.practiceAdoption = "40-60%";
    else if (m.practiceAdoptRateMint <= 80) m.practiceAdoption = "60-80%";
    else m.practiceAdoption = "80-100%";
  }

  // ── LIB status ──
  if (f.aboveLIB === "No" && seededRandom() < fx.libImprovementProb) {
    m.aboveLIB = "Yes";
  }
  // Also recalculate based on actual income
  if (m.netIncomeDailyIndividual !== null && m.netIncomeDailyIndividual >= LIB_DAILY_THRESHOLD) {
    m.aboveLIB = "Yes";
  }

  // Update income category
  const dailyPP = m.netIncomeDailyIndividual || 0;
  if (dailyPP >= LIB_DAILY_THRESHOLD) m.incomeCategory = "above LIB";
  else if (dailyPP >= 2.15) m.incomeCategory = "below LIB but above moderate poverty";
  else if (dailyPP >= 1.0) m.incomeCategory = "below moderate but above extreme poverty";
  else m.incomeCategory = "below extreme poverty";

  // ── Training participation ──
  if (f.trainingParticipation && !f.trainingParticipation.startsWith("1.") && seededRandom() < fx.trainingShift) {
    m.trainingParticipation = "1. Yes, Shubh Mint/ Tannager";
  }

  // ── FPC membership ──
  if (f.fpcMember === "2.No" && seededRandom() < fx.fpcGainProb) {
    m.fpcMember = "1. Yes";
  }

  // ── Quality of life: some improvement ──
  const qolLevels = ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"];
  const currentQol = qolLevels.indexOf(f.qualityOfLife);
  if (currentQol >= 0 && currentQol < qolLevels.length - 1) {
    const improveProb = group === "T-1" ? 0.30 : group === "T-2" ? 0.20 : 0.08;
    if (seededRandom() < improveProb) {
      m.qualityOfLife = qolLevels[currentQol + 1];
    }
  }

  // ── Sustainability: small shifts ──
  m.soilCarbon = jitter(f.soilCarbon, 1.03, 0.05);
  m.transportation = jitter(f.transportation, 0.97, 0.04);
  m.electricity = jitter(f.electricity, 1.01, 0.03);
  m.pesticide = jitter(f.pesticide, group === "T-1" ? 0.88 : group === "T-2" ? 0.93 : 0.99, 0.06);
  m.miscActivities = jitter(f.miscActivities, 1.0, 0.05);
  m.carbonFromTrees = jitter(f.carbonFromTrees, 1.05, 0.04);
  m.carbonFromHousehold = jitter(f.carbonFromHousehold, 0.98, 0.03);

  // ── Access & financial services: slight gains ──
  if (f.accessSafetyNet === 0 && seededRandom() < (group === "T-1" ? 0.15 : group === "T-2" ? 0.10 : 0.03)) {
    m.accessSafetyNet = 1;
  }
  if (f.useFinancialServices === 0 && seededRandom() < (group === "T-1" ? 0.12 : group === "T-2" ? 0.08 : 0.02)) {
    m.useFinancialServices = 1;
  }

  return m;
});

// ─── Generate crop files ───
console.log("Generating midline crop files...");
const cropNames = ["mint", "rice", "potato", "mustard", "wheat"];

for (const crop of cropNames) {
  const cropPath = path.join(baseDir, "crops", `${crop}.json`);
  const baselineCropData: any[] = JSON.parse(fs.readFileSync(cropPath, "utf-8"));

  const midlineCropData = baselineCropData.map((r: any) => {
    // Find the farmer to get their project group
    const farmer = baselineFarmers.find((f: any) => f.id === r.id);
    const group = farmer?.project || "Control";
    const fx = EFFECTS[group] || EFFECTS["Control"];

    const mr = { ...r };
    const yieldFactor = gaussianRandom(fx.yieldBoost[0], fx.yieldBoost[1]);
    mr.yield = Math.round(r.yield * yieldFactor * 100) / 100;
    if (mr.yield < 0) mr.yield = 0;

    // Acreage: slight change
    mr.acre = Math.round(r.acre * gaussianRandom(1.02, 0.04) * 1000) / 1000;
    if (mr.acre <= 0) mr.acre = r.acre;

    // Expenses
    mr.expenses = Math.round(r.expenses * gaussianRandom(fx.expenses[0], fx.expenses[1]) * 100) / 100;
    if (mr.expenses < 0) mr.expenses = 0;

    // Income from yield * price (simulate better prices for treatment groups)
    const priceFactor = gaussianRandom(group === "T-1" ? 1.08 : group === "T-2" ? 1.04 : 1.01, 0.05);
    mr.income = Math.round(r.income * yieldFactor * priceFactor * 100) / 100;
    if (mr.income < 0) mr.income = 0;

    mr.netIncome = Math.round((mr.income - mr.expenses) * 100) / 100;

    return mr;
  });

  const cropOutDir = path.join(outDir, "crops");
  fs.mkdirSync(cropOutDir, { recursive: true });
  fs.writeFileSync(path.join(cropOutDir, `${crop}.json`), JSON.stringify(midlineCropData));
  console.log(`  ${crop}: ${midlineCropData.length} records`);
}

// ─── Compute aggregates ───
console.log("Computing midline aggregates...");

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

const incomes = midlineFarmers
  .map((f: any) => f.totalNetIncomeUsd)
  .filter((v: any) => v !== null && v !== undefined);

const districts = [...new Set(midlineFarmers.map((f: any) => f.district))];
const blocks = [...new Set(midlineFarmers.map((f: any) => f.block))];
const villages = [...new Set(midlineFarmers.map((f: any) => f.village))].sort();
const genders = [...new Set(midlineFarmers.map((f: any) => f.gender))];
const castes = [...new Set(midlineFarmers.map((f: any) => f.caste))];
const farmSizes = [...new Set(midlineFarmers.map((f: any) => f.farmSizeCategory))];
const projects = [...new Set(midlineFarmers.map((f: any) => f.project))];

// Segments (legacy)
const segmentMap = new Map<string, any[]>();
for (const f of midlineFarmers) {
  const s = f.segment || "No segment";
  if (!segmentMap.has(s)) segmentMap.set(s, []);
  segmentMap.get(s)!.push(f);
}
const segments = [...segmentMap.entries()].map(([segment, farmers]) => ({
  segment,
  count: farmers.length,
  avgIncome: avg(farmers.map((f: any) => f.totalNetIncomeUsd).filter((v: any) => v != null)),
  avgResources: avg(farmers.map((f: any) => f.resourcesIndex)),
  avgProductivity: avg(farmers.map((f: any) => f.productivityIndex)),
  avgEmpowerment: avg(farmers.map((f: any) => f.womenEmpowerment).filter((v: any) => v != null)),
}));

// Crop aggregates
const cropAggs = cropNames.map((crop) => {
  const cropFile = path.join(outDir, "crops", `${crop}.json`);
  const data: any[] = JSON.parse(fs.readFileSync(cropFile, "utf-8"));
  const netIncomes = data.map((r: any) => r.netIncome).filter((v: any) => v != null);
  return {
    crop,
    totalFarmers: data.length,
    avgYield: avg(data.map((r: any) => r.yield)),
    avgIncome: avg(data.map((r: any) => r.income).filter((v: any) => v != null)),
    avgExpenses: avg(data.map((r: any) => r.expenses)),
    avgNetIncome: avg(netIncomes),
    avgAcre: avg(data.map((r: any) => r.acre)),
    medianNetIncome: median(netIncomes),
  };
});

const aggregates = {
  totalFarmers: midlineFarmers.length,
  totalDistricts: districts.length,
  totalBlocks: blocks.length,
  totalVillages: villages.length,
  avgIncome: avg(incomes),
  medianIncome: median(incomes),
  avgProductivity: avg(midlineFarmers.map((f: any) => f.productivityIndex)),
  avgWomenEmpowerment: avg(
    midlineFarmers.map((f: any) => f.womenEmpowerment).filter((v: any) => v != null)
  ),
  districts,
  blocks,
  segments,
  crops: cropAggs,
  genders,
  castes,
  farmSizes,
  projects,
  villages,
};

// ─── Write output ───
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "farmers.json"), JSON.stringify(midlineFarmers));
fs.writeFileSync(path.join(outDir, "aggregates.json"), JSON.stringify(aggregates, null, 2));

console.log("\n=== Midline Generation Summary ===");
console.log(`Farmers: ${midlineFarmers.length}`);
console.log(`Avg Net Income: $${aggregates.avgIncome.toFixed(2)} (baseline: $2,394.74)`);
console.log(`Median Net Income: $${aggregates.medianIncome.toFixed(2)} (baseline: $1,216.44)`);
console.log(`Avg Productivity: ${aggregates.avgProductivity.toFixed(4)} (baseline: 0.5114)`);
console.log(`Avg Women Empowerment: ${aggregates.avgWomenEmpowerment.toFixed(2)} (baseline: 4.44)`);

// Group-level summary
for (const group of ["T-1", "T-2", "Control"]) {
  const gFarmers = midlineFarmers.filter((f: any) => f.project === group);
  const gIncomes = gFarmers.map((f: any) => f.totalNetIncomeUsd).filter((v: any) => v != null);
  const aboveLIB = gFarmers.filter((f: any) => f.aboveLIB === "Yes").length;
  console.log(`\n  ${group}: ${gFarmers.length} farmers`);
  console.log(`    Avg Income: $${avg(gIncomes).toFixed(2)}`);
  console.log(`    Above LIB: ${aboveLIB} (${((aboveLIB / gFarmers.length) * 100).toFixed(1)}%)`);
  console.log(`    Avg Adoption: ${avg(gFarmers.map((f: any) => f.practiceAdoptRateMint).filter((v: any) => v != null)).toFixed(1)}%`);
}

console.log("\nDone! Midline data written to src/data/rounds/midline/");
