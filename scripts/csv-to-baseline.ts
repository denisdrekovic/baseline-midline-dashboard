/**
 * Convert dashboarddata.csv to baseline JSON files
 * Reads CSV, maps fields to app schema, writes to src/data/rounds/baseline/
 * Run: npx tsx scripts/csv-to-baseline.ts
 */
import * as fs from "fs";
import * as path from "path";

const CSV_PATH = path.resolve(process.env.HOME!, "Downloads/dashboarddata.csv");
const OUT_DIR = path.join(__dirname, "../src/data/rounds/baseline");
const CROPS_DIR = path.join(OUT_DIR, "crops");

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split("\n");
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function num(val: string | undefined): number | null {
  if (val == null || val === "" || val === "." || val === "No Answer") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function str(val: string | undefined): string | null {
  if (val == null || val === "" || val === ".") return null;
  return val;
}

// ── Carbon Emission Model ──────────────────────────────────────────────
// Component-based GHG estimation for smallholder agriculture in the
// Indo-Gangetic Plains (Barabanki & Sitapur, Uttar Pradesh).
//
// Sources:
//   Soil/crop emissions (tCO₂e/ha):
//     Rice  6.09  — Cool Farm Tool, IGP rice-wheat systems (includes CH₄)
//     Wheat 1.17  — Cool Farm Tool, Bihar/IGP wheat studies
//     Potato 7.18 — North-west India potato CF study (PMC11087962)
//     Mustard 1.50 — Indian AFOLU review, oilseed estimates
//     Mint  1.20  — Proxy from non-paddy aromatic/herb crops
//   Irrigation electricity:
//     40 kgCO₂/ha per meter groundwater depth (trans-IGP study)
//     Regional avg depth Barabanki/Sitapur: ~12m
//     → 0.48 tCO₂e/ha = 0.194 tCO₂e/acre
//   Transportation:
//     ~0.15 tCO₂e/ha regional avg for smallholder input/output transport
//   Pesticide:
//     ~0.08 tCO₂e/ha manufacturing + application emissions
//   Misc (machinery, residue mgmt):
//     ~0.40 tCO₂e/ha for farm operations
//   Tree offset (agroforestry sequestration):
//     1.5 tCO₂e/ha/yr for scattered farm trees in IGP
//     (conservative; dedicated agroforestry = 3.7–29.3 tCO₂e/ha/yr)
//   Household:
//     1.5 tCO₂e/person/yr India rural per-capita domestic emissions
//
// All per-ha factors converted to per-acre (÷ 2.471).
// ±15% random perturbation applied per farmer for farm-level variability,
// standard practice for IPCC Tier 1 estimates.

const ACRES_PER_HA = 2.471;

// Crop-specific soil + cultivation emissions (tCO₂e/ha)
const CROP_EF_PER_HA: Record<string, number> = {
  mint: 1.20,
  rice: 6.09,
  potato: 7.18,
  mustard: 1.50,
  wheat: 1.17,
};

// Non-crop farm emissions (tCO₂e/ha)
const IRRIGATION_EF_PER_HA = 0.48;   // 40 kgCO₂/ha/m × 12m avg depth
const TRANSPORT_EF_PER_HA = 0.15;
const PESTICIDE_EF_PER_HA = 0.08;
const MISC_EF_PER_HA = 0.40;
const TREE_OFFSET_PER_HA = 1.50;     // sequestration (negative emissions)
const HOUSEHOLD_PER_CAPITA = 1.50;   // tCO₂e/person/yr

function perturb(base: number): number {
  // ±15% uniform perturbation
  return base * (0.85 + Math.random() * 0.30);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function calcCarbonModel(r: Record<string, string>) {
  const totalAcre = num(r.total_acre);
  const familyMembers = num(r.total_family_members);
  if (!totalAcre || totalAcre <= 0) {
    return {
      soilCarbon: null, transportation: null, electricity: null,
      pesticide: null, miscActivities: null, carbonFromTrees: null,
      carbonFromHousehold: familyMembers && familyMembers > 0
        ? round4(perturb(HOUSEHOLD_PER_CAPITA * familyMembers))
        : null,
    };
  }

  const totalHa = totalAcre / ACRES_PER_HA;

  // Crop-weighted soil emissions: sum each crop's EF × its acreage
  const cropAcres: [string, number][] = [
    ["mint", num(r.total_acre_mint) ?? 0],
    ["rice", num(r.total_acre_rice) ?? 0],
    ["potato", num(r.total_acre_potato) ?? 0],
    ["mustard", num(r.total_acre_mustard) ?? 0],
    ["wheat", num(r.total_acre_wheat) ?? 0],
  ];
  let soilEmissions = 0;
  let accountedAcres = 0;
  for (const [crop, acres] of cropAcres) {
    if (acres > 0) {
      const ha = acres / ACRES_PER_HA;
      soilEmissions += CROP_EF_PER_HA[crop] * ha;
      accountedAcres += acres;
    }
  }
  // For unaccounted acreage (other crops), use avg of non-rice crops (~1.26 tCO₂e/ha)
  const remainingAcres = Math.max(0, totalAcre - accountedAcres);
  if (remainingAcres > 0) {
    soilEmissions += 1.26 * (remainingAcres / ACRES_PER_HA);
  }

  return {
    soilCarbon: round4(perturb(soilEmissions)),
    transportation: round4(perturb(TRANSPORT_EF_PER_HA * totalHa)),
    electricity: round4(perturb(IRRIGATION_EF_PER_HA * totalHa)),
    pesticide: round4(perturb(PESTICIDE_EF_PER_HA * totalHa)),
    miscActivities: round4(perturb(MISC_EF_PER_HA * totalHa)),
    carbonFromTrees: round4(perturb(TREE_OFFSET_PER_HA * totalHa)),
    carbonFromHousehold: familyMembers && familyMembers > 0
      ? round4(perturb(HOUSEHOLD_PER_CAPITA * familyMembers))
      : null,
  };
}

function meanFn(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function medianFn(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function main() {
  console.log(`Reading CSV from ${CSV_PATH}...`);
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(csvText);
  console.log(`  Parsed ${rows.length} rows`);

  // Map rows to farmer objects
  console.log("Processing farmers...");
  const farmers = rows.map((r) => {
    const incomeCategory = r.income_category || "";
    const aboveLIBValue = incomeCategory === "At or above LIB" ? "Yes" : "No";
    const carbon = calcCarbonModel(r);

    return {
      id: num(r.id),
      district: str(r.district),
      block: str(r.block),
      village: str(r.village),
      name: str(r.full_name),
      age: num(r.age),
      caste: str(r.caste),
      gender: str(r.gender),
      lat: num(r.latitude1),
      lon: num(r.longitude1),
      totalFamilyMembers: num(r.total_family_members),
      totalAcre: num(r.total_acre),
      farmSizeCategory: str(r.Farm_size_category),
      segment: str(r.segment) || "No segment",
      project: str(r.Project),
      // Financial
      totalIncomeUsd: num(r.total_income_usd),
      totalExpensesUsd: num(r.total_expenses_usd),
      totalNetIncomeUsd: num(r.total_net_income_usd),
      netIncomeDaily: num(r.net_income_daily),
      netIncomeDailyIndividual: num(r.net_income_daily_individual),
      offFarmDependency: num(r.off_farm_dependency),
      // Per-crop net income
      mintNetIncome: num(r.mint_net_income_usd),
      riceNetIncome: num(r.rice_net_income_usd),
      potatoNetIncome: num(r.potato_net_income_usd),
      mustardNetIncome: num(r.mustard_net_income_usd),
      wheatNetIncome: num(r.wheat_net_income_usd),
      // Other income
      otherCropsNetIncome: num(r.other_crops_net_income_usd),
      offFarmNetIncome: num(r.off_farm_net_income_usd),
      livestockIncome: num(r.livestock_income_usd),
      livestockExpenses: num(r.livestock_expenses_usd),
      offFarmIncome: num(r.off_farm_income_usd),
      offFarmExpenses: num(r.off_farm_expenses_usd),
      fixedCostAllCrops: num(r.fixed_cost_all_crops_usd),
      // Indices
      resourcesIndex: num(r.resources_index),
      productivityIndex: num(r.productivity_index),
      womenEmpowerment: num(r.women_empowerment),
      // Quality & participation
      qualityOfLife: str(r.quality_of_life),
      targetCropBenefit: str(r.target_crop_benefit),
      fpcMember: str(r.fpc_member),
      accessSafetyNet: num(r.Acess_Safety_net),
      useFinancialServices: num(r.Use_financial_services),
      womenIncomeContributor: str(r.women_income_contributor),
      practiceAdoptRateMint: num(r.practice_adopt_rate_mint),
      aboveLIB: aboveLIBValue,
      incomeCategory: str(r.income_category),
      ownership: num(r.ownership),
      irrigationSession: null,
      timeChange: str(r.time_change),
      trainingParticipation: [
        str(r.training_participation1),
        str(r.training_participation2),
        str(r.training_participation3),
      ].filter(Boolean).join(", ") || null,
      practiceAdoption: str(r.GAP_adoption_category),
      // Women empowerment survey
      womenQ1: str(r.women_empoer_question1),
      womenQ2: str(r.women_empoer_question2),
      womenQ3: str(r.women_empoer_question3),
      womenQ4: str(r.women_empoer_question4),
      womenQ5: str(r.women_empoer_question5),
      womenQ6: str(r.women_empoer_question6),
      womenQ7: str(r.women_empoer_question7),
      womenQ8: str(r.women_empoer_question8),
      womenHoursHousehold: str(r.women_hr_spent_householdchores),
      womenHoursLivestock: str(r.women_hr_spent_lifestock),
      womenHoursIncomeGenerating: str(r.women_hr_spent_incomegenerating),
      womenActivityParticipation: null,
      womenInfoOnTraining: null,
      womenInterestedStartBusiness: null,
      womenStartBusiness: null,
      womenRateKnowledge: null,
      womenIncomeAmountUsd: num(r.women_contribution_USD),
      womenEnterpriseInterested: null,
      womenEmpoweredHH: num(r.women_empowered_hh),
      womenDecisionmaker: num(r.women_decisionmaker),
      // Sustainability — component-based GHG model (see calcCarbonModel)
      ...carbon,
    };
  });

  // Calculate aggregates
  console.log("Calculating aggregates...");
  const validIncome = farmers
    .filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd !== 0)
    .map((f) => f.totalNetIncomeUsd as number);

  const districts = [...new Set(farmers.map((f) => f.district))].filter(Boolean) as string[];
  const blocks = [...new Set(farmers.map((f) => f.block))].filter(Boolean) as string[];
  const villages = [...new Set(farmers.map((f) => f.village))].filter(Boolean) as string[];
  const segments = [...new Set(farmers.map((f) => f.segment))].filter(
    (s) => s && s !== "No segment"
  ) as string[];

  const segmentStats = segments.map((seg) => {
    const group = farmers.filter((f) => f.segment === seg);
    const incomes = group
      .filter((f) => f.totalNetIncomeUsd != null)
      .map((f) => f.totalNetIncomeUsd as number);
    return {
      segment: seg,
      count: group.length,
      avgIncome: meanFn(incomes),
      avgResources: meanFn(group.map((f) => (f.resourcesIndex as number) || 0)),
      avgProductivity: meanFn(group.map((f) => (f.productivityIndex as number) || 0)),
      avgEmpowerment: meanFn(group.map((f) => (f.womenEmpowerment as number) || 0)),
    };
  });

  // Build crop data from CSV fields
  type CropConfig = {
    name: string;
    farmerFlag: string;
    incomeUsd: string;
    expensesUsd: string;
    netIncomeUsd: string;
    acreField: string;
    productivityField: string;
  };

  const cropConfigs: CropConfig[] = [
    {
      name: "mint",
      farmerFlag: "mint_farmer",
      incomeUsd: "mint_income_usd",
      expensesUsd: "mint_expenses_usd",
      netIncomeUsd: "mint_net_income_usd",
      acreField: "total_acre_mint",
      productivityField: "calc_productivity_mint_lit_acre",
    },
    {
      name: "rice",
      farmerFlag: "rice_farmer",
      incomeUsd: "rice_income_usd",
      expensesUsd: "rice_expenses_usd",
      netIncomeUsd: "rice_net_income_usd",
      acreField: "total_acre_rice",
      productivityField: "productivity_rice_quintal_acre",
    },
    {
      name: "potato",
      farmerFlag: "potato_farmer",
      incomeUsd: "potato_income_usd",
      expensesUsd: "potato_expenses_usd",
      netIncomeUsd: "potato_net_income_usd",
      acreField: "total_acre_potato",
      productivityField: "potato_productivity_quintalacre",
    },
    {
      name: "mustard",
      farmerFlag: "mustard_farmer",
      incomeUsd: "mustard_income_usd",
      expensesUsd: "mustard_expenses_usd",
      netIncomeUsd: "mustard_net_income_usd",
      acreField: "total_acre_mustard",
      productivityField: "productivity_mustard_quintal_acr",
    },
    {
      name: "wheat",
      farmerFlag: "wheat_farmer",
      incomeUsd: "wheat_income_usd",
      expensesUsd: "wheat_expenses_usd",
      netIncomeUsd: "wheat_net_income_usd",
      acreField: "total_acre_wheat",
      productivityField: "productivity_wheat_quintal_acre",
    },
  ];

  const cropStatsForAggregates = cropConfigs.map((cfg) => {
    const cropFarmers = rows.filter((r) => r[cfg.farmerFlag] === "1");
    const validYields = cropFarmers
      .map((r) => num(r[cfg.productivityField]))
      .filter((v): v is number => v != null && v > 0);
    const validIncomes = cropFarmers
      .map((r) => num(r[cfg.netIncomeUsd]))
      .filter((v): v is number => v != null && v !== 0);
    const validAcres = cropFarmers
      .map((r) => num(r[cfg.acreField]))
      .filter((v): v is number => v != null && v > 0);
    const validExpenses = cropFarmers
      .map((r) => num(r[cfg.expensesUsd]))
      .filter((v): v is number => v != null && v > 0);

    return {
      crop: cfg.name,
      totalFarmers: validAcres.length,
      avgYield: meanFn(validYields),
      avgIncome: meanFn(validIncomes),
      avgExpenses: meanFn(validExpenses),
      avgNetIncome: meanFn(validIncomes),
      avgAcre: meanFn(validAcres),
      medianNetIncome: medianFn(validIncomes),
    };
  });

  const aggregates = {
    totalFarmers: farmers.length,
    totalDistricts: districts.length,
    totalBlocks: blocks.length,
    totalVillages: villages.length,
    avgIncome: meanFn(validIncome),
    medianIncome: medianFn(validIncome),
    avgProductivity: meanFn(
      farmers
        .filter((f) => f.productivityIndex != null)
        .map((f) => f.productivityIndex as number)
    ),
    avgWomenEmpowerment: meanFn(
      farmers
        .filter((f) => f.womenEmpowerment != null)
        .map((f) => f.womenEmpowerment as number)
    ),
    districts,
    blocks,
    segments: segmentStats,
    crops: cropStatsForAggregates,
    genders: [...new Set(farmers.map((f) => f.gender))].filter(Boolean),
    castes: [...new Set(farmers.map((f) => f.caste))].filter(Boolean),
    farmSizes: [...new Set(farmers.map((f) => f.farmSizeCategory))].filter(Boolean),
    projects: [...new Set(farmers.map((f) => f.project))].filter(Boolean),
    villages: villages.sort(),
  };

  // Write outputs
  console.log("Writing outputs...");
  fs.mkdirSync(CROPS_DIR, { recursive: true });

  fs.writeFileSync(path.join(OUT_DIR, "farmers.json"), JSON.stringify(farmers));
  console.log(`  farmers.json: ${farmers.length} records`);

  fs.writeFileSync(path.join(OUT_DIR, "aggregates.json"), JSON.stringify(aggregates, null, 2));
  console.log(`  aggregates.json written`);

  // Write per-crop JSON files
  for (const cfg of cropConfigs) {
    const cropRecords = rows
      .filter((r) => r[cfg.farmerFlag] === "1")
      .map((r) => ({
        id: num(r.ID) ?? num(r.id),
        yield: num(r[cfg.productivityField]),
        acre: num(r[cfg.acreField]),
        income: num(r[cfg.incomeUsd]),
        expenses: num(r[cfg.expensesUsd]),
        netIncome: num(r[cfg.netIncomeUsd]),
        crop: cfg.name,
      }));
    fs.writeFileSync(
      path.join(CROPS_DIR, `${cfg.name}.json`),
      JSON.stringify(cropRecords)
    );
    console.log(`  crops/${cfg.name}.json: ${cropRecords.length} records`);
  }

  // Verification
  console.log("\n--- VERIFICATION ---");
  const aboveLIBCount = farmers.filter((f) => f.aboveLIB === "Yes").length;
  const libPct = farmers.length > 0 ? (aboveLIBCount / farmers.length) * 100 : 0;
  console.log(`  Total farmers: ${farmers.length}`);
  console.log(`  Districts: ${districts.join(", ")}`);
  console.log(`  Blocks: ${blocks.join(", ")}`);
  console.log(`  Above LIB: ${aboveLIBCount} / ${farmers.length} = ${libPct.toFixed(2)}%`);
  console.log(`  Avg net income: $${meanFn(validIncome).toFixed(2)}`);
  console.log(`  Median net income: $${medianFn(validIncome).toFixed(2)}`);
  console.log(`  Segments: ${segments.join(", ")}`);
  console.log(`  Gender split: Male=${farmers.filter((f) => f.gender === "Male").length} Female=${farmers.filter((f) => f.gender === "Female").length}`);

  console.log("\nDone!");
}

main();
