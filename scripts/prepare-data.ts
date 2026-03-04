/**
 * Data preprocessing script
 * Loads reference dataset (2,579 records matching i4di.org dashboard),
 * merges sustainability data from FullData, normalizes fields, outputs to public/data/
 * Run: npx tsx scripts/prepare-data.ts
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");
const DASHBOARD = path.join(ROOT, "dashboard_preparation");
const GEO_DIR = path.join(ROOT, "data/Geojsons");
const OUT = path.join(__dirname, "../public/data");

// Load JSON
function loadJSON<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// Main
function main() {
  console.log("Loading data sources...");

  // 1. Load reference data (matches i4di.org/reports/india-dashboard)
  const refData: Record<string, unknown>[] = loadJSON(
    path.join(DASHBOARD, "Reference_Data.json")
  );
  console.log(`  Reference data: ${refData.length} records`);

  // 2. Load sustainability data from FullData
  const fullData: Record<string, unknown>[] = loadJSON(
    path.join(DASHBOARD, "Dashboard_Data_FullData.json")
  );
  console.log(`  FullData (sustainability): ${fullData.length} records`);

  // Build sustainability lookup by ID
  const sustainMap = new Map<number, Record<string, unknown>>();
  for (const r of fullData) {
    sustainMap.set(r.ID as number, {
      soilCarbon: r.soil_carbon ?? null,
      transportation: r.transportation ?? null,
      electricity: r.electricity ?? null,
      pesticide: r.pesticide ?? null,
      miscActivities: r.misc_activities ?? null,
      carbonFromTrees: r.carbon_from_trees ?? null,
      carbonFromHousehold: r.carbon_from_household ?? null,
    });
  }

  // 3. Process farmers
  console.log("Processing farmers...");
  const farmers = refData.map((r) => {
    const id = r.id as number;
    const sustain = sustainMap.get(id) || {};

    // Derive aboveLIB: reference uses income_category field as primary
    const incomeCategory = r.income_category as string;
    const aboveLIBValue = incomeCategory === "At or above LIB" ? "Yes" : "No";

    return {
      id,
      district: r.district,
      block: r.block,
      village: r.village,
      name: r.full_name,
      age: r.age,
      caste: r.caste,
      gender: r.gender,
      lat: r.latitude1 != null ? parseFloat(String(r.latitude1)) || null : null,
      lon: r.longitude1 != null ? parseFloat(String(r.longitude1)) || null : null,
      totalFamilyMembers: r.total_family_members,
      totalAcre: r.total_acre,
      farmSizeCategory: r.Farm_size_category,
      segment: r.segment ?? "No segment",
      project: r.Project,
      // Financial
      totalIncomeUsd: r.total_income_usd,
      totalExpensesUsd: r.total_expenses_usd,
      totalNetIncomeUsd: r.total_net_income_usd,
      netIncomeDaily: r.net_income_daily,
      netIncomeDailyIndividual: r.net_income_daily_individual,
      offFarmDependency: r.off_farm_dependency,
      // Per-crop net income
      mintNetIncome: r.mint_net_income_usd,
      riceNetIncome: r.rice_net_income_usd,
      potatoNetIncome: r.potato_net_income_usd,
      mustardNetIncome: r.mustard_net_income_usd,
      wheatNetIncome: r.wheat_net_income_usd,
      // Other income
      otherCropsNetIncome: r.other_crops_net_income_usd,
      offFarmNetIncome: r.off_farm_net_income_usd,
      livestockIncome: r.livestock_income_usd,
      livestockExpenses: r.livestock_expenses_usd,
      offFarmIncome: r.off_farm_income_usd,
      offFarmExpenses: r.off_farm_expenses_usd,
      fixedCostAllCrops: r.fixed_cost_all_crops_usd,
      // Indices
      resourcesIndex: r.resources_index,
      productivityIndex: r.productivity_index,
      womenEmpowerment: r.women_empowerment,
      // Quality & participation
      qualityOfLife: r.quality_of_life,
      targetCropBenefit: r.target_crop_benefit,
      fpcMember: r.fpc_member,
      accessSafetyNet: r.Acess_Safety_net,
      useFinancialServices: r.Use_financial_services,
      womenIncomeContributor: r.women_income_contributor,
      practiceAdoptRateMint: r.practice_adopt_rate_mint,
      aboveLIB: aboveLIBValue,
      incomeCategory: r.income_category,
      ownership: r.ownership,
      irrigationSession: null, // Not available in reference data
      timeChange: r.time_change,
      trainingParticipation: [
        r.training_participation1,
        r.training_participation2,
        r.training_participation3,
      ].filter(Boolean).join(", ") || null,
      practiceAdoption: r.GAP_adoption_category,
      // Women empowerment survey
      womenQ1: r.women_empoer_question1,
      womenQ2: r.women_empoer_question2,
      womenQ3: r.women_empoer_question3,
      womenQ4: r.women_empoer_question4,
      womenQ5: r.women_empoer_question5,
      womenQ6: r.women_empoer_question6,
      womenQ7: r.women_empoer_question7,
      womenQ8: r.women_empoer_question8,
      womenHoursHousehold: r.women_hr_spent_householdchores,
      womenHoursLivestock: r.women_hr_spent_lifestock,
      womenHoursIncomeGenerating: r.women_hr_spent_incomegenerating,
      womenActivityParticipation: null, // Field structure differs in reference
      womenInfoOnTraining: null, // Not directly available
      womenInterestedStartBusiness: null, // Not directly available
      womenStartBusiness: null, // Not directly available
      womenRateKnowledge: null, // Not directly available
      womenIncomeAmountUsd: r.women_contribution_USD ?? null,
      womenEnterpriseInterested: null, // Not directly available
      womenEmpoweredHH: r.women_empowered_hh,
      womenDecisionmaker: r.women_decisionmaker,
      // Sustainability
      ...sustain,
    };
  });

  // 4. Calculate aggregates
  console.log("Calculating aggregates...");
  const validIncome = farmers
    .filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd !== 0)
    .map((f) => f.totalNetIncomeUsd as number);

  const meanFn = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const medianFn = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

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

  // Use reference crop data files
  const crops = ["mint", "rice", "potato", "mustard", "wheat"] as const;
  const cropStats = crops.map((crop) => {
    const cropFile = path.join(DASHBOARD, `reference_${crop}.json`);
    // Fall back to old files if reference doesn't exist
    const cropPath = fs.existsSync(cropFile)
      ? cropFile
      : path.join(DASHBOARD, `${crop}_crop.json`);
    const cropData: Record<string, unknown>[] = loadJSON(cropPath);
    const validYields = cropData
      .filter((r) => (r.crop_yield as number) > 0)
      .map((r) => r.crop_yield as number);
    const validIncomes = cropData
      .filter((r) => (r.crop_net_income as number) !== 0)
      .map((r) => r.crop_net_income as number);
    const validAcres = cropData
      .filter((r) => (r.crop_acre as number) > 0)
      .map((r) => r.crop_acre as number);
    return {
      crop,
      totalFarmers: validAcres.length,
      avgYield: meanFn(validYields),
      avgIncome: meanFn(validIncomes),
      avgExpenses: meanFn(
        cropData
          .filter((r) => (r.crop_expenses as number) > 0)
          .map((r) => r.crop_expenses as number)
      ),
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
    crops: cropStats,
    genders: [...new Set(farmers.map((f) => f.gender))].filter(Boolean),
    castes: [...new Set(farmers.map((f) => f.caste))].filter(Boolean),
    farmSizes: [...new Set(farmers.map((f) => f.farmSizeCategory))].filter(Boolean),
    projects: [...new Set(farmers.map((f) => f.project))].filter(Boolean),
    villages: villages.sort(),
  };

  // 5. Write outputs
  console.log("Writing outputs...");
  fs.writeFileSync(path.join(OUT, "farmers.json"), JSON.stringify(farmers));
  console.log(`  farmers.json: ${farmers.length} records`);

  fs.writeFileSync(path.join(OUT, "aggregates.json"), JSON.stringify(aggregates, null, 2));
  console.log(`  aggregates.json written`);

  // Copy crop files (use reference data)
  for (const crop of crops) {
    const cropFile = path.join(DASHBOARD, `reference_${crop}.json`);
    const cropPath = fs.existsSync(cropFile)
      ? cropFile
      : path.join(DASHBOARD, `${crop}_crop.json`);
    const data: Record<string, unknown>[] = loadJSON(cropPath);
    const normalized = data.map((r) => ({
      id: r.ID,
      yield: r.crop_yield,
      acre: r.crop_acre,
      income: r.crop_income,
      expenses: r.crop_expenses,
      netIncome: r.crop_net_income,
      crop: r.crop,
    }));
    fs.writeFileSync(path.join(OUT, "crops", `${crop}.json`), JSON.stringify(normalized));
    console.log(`  crops/${crop}.json: ${normalized.length} records`);
  }

  // Merge GeoJSON files
  console.log("Processing GeoJSON...");
  const barabanki = loadJSON<GeoJSON>(path.join(GEO_DIR, "filteredBarabanki.geojson"));
  const sitapur = loadJSON<GeoJSON>(path.join(GEO_DIR, "filteredSitapur.geojson"));

  interface GeoJSON {
    type: string;
    features: Record<string, unknown>[];
  }

  const mergedGeo: GeoJSON = {
    type: "FeatureCollection",
    features: [...barabanki.features, ...sitapur.features],
  };
  fs.writeFileSync(path.join(OUT, "geo", "districts.geojson"), JSON.stringify(mergedGeo));
  console.log(
    `  districts.geojson: ${mergedGeo.features.length} features`
  );

  // Copy taluks (filter to UP only)
  const taluks = loadJSON<GeoJSON>(path.join(GEO_DIR, "taluks_new.geojson"));
  const upTaluks: GeoJSON = {
    type: "FeatureCollection",
    features: taluks.features.filter((f: Record<string, unknown>) => {
      const props = f.properties as Record<string, string>;
      const district = (props.District || props.DISTRICT || "").toUpperCase();
      return (
        props.STATE === "UTTARPRADESH" &&
        (district === "BARABANKI" || district.includes("S|T>PUR") || district === "SITAPUR")
      );
    }),
  };
  fs.writeFileSync(path.join(OUT, "geo", "taluks.geojson"), JSON.stringify(upTaluks));
  console.log(`  taluks.geojson: ${upTaluks.features.length} features`);

  // Verify key stats match reference
  console.log("\n--- VERIFICATION ---");
  const aboveLIBCount = farmers.filter((f) => f.aboveLIB === "Yes").length;
  const libPct = (aboveLIBCount / farmers.length) * 100;
  const dailyIncomes = farmers.map((f) => ((f.netIncomeDaily as number) || 0) * 365);
  const avgAnnualNet = dailyIncomes.reduce((a, b) => a + b, 0) / dailyIncomes.length;
  console.log(`  Total farmers: ${farmers.length} (expected: 2,579)`);
  console.log(`  Above LIB: ${aboveLIBCount} / ${farmers.length} = ${libPct.toFixed(2)}% (expected: 14.62%)`);
  console.log(`  Avg annual net income: $${avgAnnualNet.toFixed(2)} (expected: $2,394.74)`);
  console.log(`  Male: ${farmers.filter((f) => f.gender === "Male").length} Female: ${farmers.filter((f) => f.gender === "Female").length}`);

  console.log("\nDone!");
}

main();
