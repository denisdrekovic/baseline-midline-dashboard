import { Farmer, Insight, ProjectGroup } from "../data/types";
import { mean, percentile, isAboveLIB } from "./statistics";
import { PROJECT_SHORT } from "../data/constants";

/* ===================================================================
   Helpers
   =================================================================== */
const isFpcMember = (f: Farmer) =>
  typeof f.fpcMember === "string" && f.fpcMember.startsWith("1");
const isHighGAP = (f: Farmer) =>
  f.practiceAdoption === "40-70%" || f.practiceAdoption === ">70";
const countProfitableCrops = (f: Farmer) => {
  let n = 0;
  if (f.mintNetIncome != null && f.mintNetIncome > 0) n++;
  if (f.riceNetIncome != null && f.riceNetIncome > 0) n++;
  if (f.potatoNetIncome != null && f.potatoNetIncome > 0) n++;
  if (f.mustardNetIncome != null && f.mustardNetIncome > 0) n++;
  if (f.wheatNetIncome != null && f.wheatNetIncome > 0) n++;
  return n;
};

/* ===================================================================
   Project Group helpers (replaces old segment-based buildGroups)
   =================================================================== */
interface ProjectGroupStats {
  group: ProjectGroup;
  label: string;
  farmers: Farmer[];
  avgIncome: number;
  belowLIBPct: number;
  aboveLIBPct: number;
  gapAdoptPct: number;
  fpcPct: number;
  avgCrops: number;
  singleCropPct: number;
}

function buildProjectGroups(farmers: Farmer[]): ProjectGroupStats[] {
  const groupMap = new Map<ProjectGroup, Farmer[]>();
  for (const f of farmers) {
    if (!f.project) continue;
    const arr = groupMap.get(f.project as ProjectGroup) || [];
    arr.push(f);
    groupMap.set(f.project as ProjectGroup, arr);
  }
  const groups: ProjectGroupStats[] = [];
  for (const [group, members] of groupMap) {
    const incomes = members
      .filter((f) => f.totalNetIncomeUsd != null)
      .map((f) => f.totalNetIncomeUsd!);
    const belowLIB = members.filter((f) => !isAboveLIB(f.aboveLIB)).length;
    const gapAdopt = members.filter(isHighGAP).length;
    const fpc = members.filter(isFpcMember).length;
    const cropCounts = members.map(countProfitableCrops);
    const singleCrop = cropCounts.filter((c) => c <= 1).length;
    groups.push({
      group,
      label: PROJECT_SHORT[group] || group,
      farmers: members,
      avgIncome: incomes.length ? mean(incomes) : 0,
      belowLIBPct: members.length ? (belowLIB / members.length) * 100 : 0,
      aboveLIBPct: members.length ? ((members.length - belowLIB) / members.length) * 100 : 0,
      gapAdoptPct: members.length ? (gapAdopt / members.length) * 100 : 0,
      fpcPct: members.length ? (fpc / members.length) * 100 : 0,
      avgCrops: cropCounts.length ? mean(cropCounts) : 0,
      singleCropPct: members.length ? (singleCrop / members.length) * 100 : 0,
    });
  }
  return groups;
}

/* ===================================================================
   GENERAL INSIGHTS — used on Dashboard Overview
   =================================================================== */

export function generateInsights(farmers: Farmer[]): Insight[] {
  const insights: Insight[] = [];
  if (!farmers.length) return insights;

  // 1. Income inequality
  const incomes = farmers
    .filter((f) => f.totalNetIncomeUsd != null && f.totalNetIncomeUsd > 0)
    .map((f) => f.totalNetIncomeUsd!);
  if (incomes.length > 10) {
    const p90 = percentile(incomes, 90);
    const p10 = percentile(incomes, 10);
    if (p10 > 0 && p90 / p10 > 3) {
      insights.push({
        type: "anomaly",
        icon: "TrendingUp",
        title: "Income Inequality Detected",
        body: `Top 10% earners make ${(p90 / p10).toFixed(1)}x more than bottom 10%.`,
        severity: "warning",
      });
    }
  }

  // 2. Gender gap
  const males = farmers.filter((f) => f.gender === "Male" && f.totalNetIncomeUsd != null);
  const females = farmers.filter((f) => f.gender === "Female" && f.totalNetIncomeUsd != null);
  if (males.length > 5 && females.length > 5) {
    const maleAvg = mean(males.map((f) => f.totalNetIncomeUsd!));
    const femaleAvg = mean(females.map((f) => f.totalNetIncomeUsd!));
    const gap = ((maleAvg - femaleAvg) / maleAvg) * 100;
    if (Math.abs(gap) > 10) {
      insights.push({
        type: "comparison",
        icon: "Users",
        title: "Gender Income Gap",
        body:
          gap > 0
            ? `Male farmers earn ${gap.toFixed(0)}% more than female farmers on average.`
            : `Female farmers earn ${Math.abs(gap).toFixed(0)}% more than male farmers on average.`,
        severity: gap > 20 ? "warning" : "info",
      });
    }
  }

  // 3. Below living income benchmark
  const belowLIB = farmers.filter((f) => !isAboveLIB(f.aboveLIB)).length;
  const libRate = (belowLIB / farmers.length) * 100;
  if (libRate > 50) {
    insights.push({
      type: "anomaly",
      icon: "AlertTriangle",
      title: "Below Living Income",
      body: `${libRate.toFixed(0)}% of farmers fall below the Living Income Benchmark.`,
      severity: "warning",
    });
  }

  // 4. Treatment vs Control comparison
  const groups = buildProjectGroups(farmers);
  const t1 = groups.find((g) => g.group === "T-1");
  const ctrl = groups.find((g) => g.group === "Control");
  if (t1 && ctrl && t1.farmers.length > 30 && ctrl.farmers.length > 30) {
    const incomeDiff = ctrl.avgIncome > 0
      ? ((t1.avgIncome - ctrl.avgIncome) / ctrl.avgIncome) * 100
      : 0;
    insights.push({
      type: "comparison",
      icon: "Leaf",
      title: "Treatment vs Control",
      body: `T-1 farmers earn ${incomeDiff > 0 ? `${incomeDiff.toFixed(0)}% more` : `${Math.abs(incomeDiff).toFixed(0)}% less`} than Control ($${Math.round(t1.avgIncome).toLocaleString()} vs $${Math.round(ctrl.avgIncome).toLocaleString()}/yr). LIB attainment: ${t1.aboveLIBPct.toFixed(1)}% (T-1) vs ${ctrl.aboveLIBPct.toFixed(1)}% (Control).`,
      severity: incomeDiff > 10 ? "success" : incomeDiff > 0 ? "info" : "warning",
    });
  }

  // 5. Women empowerment correlation
  const highEmp = farmers.filter(
    (f) => f.womenEmpowerment >= 6 && f.totalNetIncomeUsd != null
  );
  const lowEmp = farmers.filter(
    (f) => f.womenEmpowerment < 4 && f.totalNetIncomeUsd != null
  );
  if (highEmp.length > 5 && lowEmp.length > 5) {
    const highAvg = mean(highEmp.map((f) => f.totalNetIncomeUsd!));
    const lowAvg = mean(lowEmp.map((f) => f.totalNetIncomeUsd!));
    if (highAvg > lowAvg * 1.1) {
      insights.push({
        type: "trend",
        icon: "Heart",
        title: "Empowerment Boosts Income",
        body: `High women empowerment households earn ${((highAvg / lowAvg - 1) * 100).toFixed(0)}% more.`,
        severity: "success",
      });
    }
  }

  // 6. Mint dominance
  const mintGrowers = farmers.filter(
    (f) => f.mintNetIncome != null && f.mintNetIncome > 0
  ).length;
  const mintPct = (mintGrowers / farmers.length) * 100;
  if (mintPct > 40) {
    insights.push({
      type: "trend",
      icon: "Leaf",
      title: "Mint is Dominant Crop",
      body: `${mintPct.toFixed(0)}% of farmers grow mint, making it the primary cash crop.`,
      severity: "info",
    });
  }

  return insights.slice(0, 5);
}

/* ===================================================================
   OVERVIEW / CROSS-CUTTING INSIGHTS
   Project-group-based analytics for the dashboard overview
   =================================================================== */

export function generateOverviewInsights(farmers: Farmer[]): Insight[] {
  const insights: Insight[] = [];
  if (farmers.length < 20) return insights;

  const groups = buildProjectGroups(farmers);
  const t1 = groups.find((g) => g.group === "T-1");
  const t2 = groups.find((g) => g.group === "T-2");
  const ctrl = groups.find((g) => g.group === "Control");

  // Only treatment groups for recommendations
  const treatmentFarmers = farmers.filter((f) => f.project !== "Control");

  // ── 1. GAP Adoption as the primary income lever (treatment groups only) ──
  const adopters = treatmentFarmers.filter(
    (f) => isHighGAP(f) && f.totalNetIncomeUsd != null
  );
  const nonAdopters = treatmentFarmers.filter(
    (f) => !isHighGAP(f) && f.totalNetIncomeUsd != null
  );
  if (adopters.length > 10 && nonAdopters.length > 10) {
    const adopterIncome = mean(adopters.map((f) => f.totalNetIncomeUsd!));
    const nonAdopterIncome = mean(nonAdopters.map((f) => f.totalNetIncomeUsd!));
    const premium = nonAdopterIncome > 0
      ? ((adopterIncome - nonAdopterIncome) / nonAdopterIncome) * 100
      : 0;
    // Find which treatment group has lower GAP adoption
    const lowGapGroup = t1 && t2 && t2.gapAdoptPct < t1.gapAdoptPct ? t2 : t1;
    insights.push({
      type: "trend",
      icon: "TrendingUp",
      title: "GAP Adoption Is the Strongest Income Lever",
      body: `Treatment farmers practicing Good Agricultural Practices (≥40% adoption) earn ${premium.toFixed(0)}% more ($${Math.round(adopterIncome).toLocaleString()} vs $${Math.round(nonAdopterIncome).toLocaleString()}/yr).${lowGapGroup && lowGapGroup.gapAdoptPct < 30 ? ` Priority: ${lowGapGroup.label} has only ${lowGapGroup.gapAdoptPct.toFixed(0)}% adoption among ${lowGapGroup.farmers.length} farmers.` : ""}`,
      severity: "warning",
    });
  }

  // ── 2. FPC membership income differential (treatment groups only) ──
  const treatmentFpc = treatmentFarmers.filter(
    (f) => isFpcMember(f) && f.totalNetIncomeUsd != null
  );
  const treatmentNonFpc = treatmentFarmers.filter(
    (f) => !isFpcMember(f) && f.totalNetIncomeUsd != null
  );
  if (treatmentFpc.length > 10 && treatmentNonFpc.length > 10) {
    const fpcIncome = mean(treatmentFpc.map((f) => f.totalNetIncomeUsd!));
    const nonFpcIncome = mean(treatmentNonFpc.map((f) => f.totalNetIncomeUsd!));
    const diff = nonFpcIncome > 0 ? ((fpcIncome - nonFpcIncome) / nonFpcIncome) * 100 : 0;
    const overallFpcRate = (treatmentFpc.length / treatmentFarmers.length) * 100;
    insights.push({
      type: "comparison",
      icon: "Users",
      title: "FPC Membership Effect in Treatment Groups",
      body: `Among treatment farmers, FPC members earn ${diff > 0 ? `${diff.toFixed(0)}% more` : `${Math.abs(diff).toFixed(0)}% less`} ($${Math.round(fpcIncome).toLocaleString()} vs $${Math.round(nonFpcIncome).toLocaleString()}/yr). Only ${overallFpcRate.toFixed(0)}% are FPC members — expanding membership could ${diff > 0 ? "replicate this income advantage" : "still provide market access and collective bargaining benefits"}.`,
      severity: diff > 15 ? "success" : "info",
    });
  }

  // ── 3. T-1 vs T-2 effectiveness comparison ──
  if (t1 && t2 && t1.farmers.length > 30 && t2.farmers.length > 10) {
    const incomeDiff = t2.avgIncome > 0
      ? ((t1.avgIncome - t2.avgIncome) / t2.avgIncome) * 100
      : 0;
    const t1Advantages: string[] = [];
    const t2Advantages: string[] = [];
    if (t1.gapAdoptPct > t2.gapAdoptPct + 5) t1Advantages.push(`GAP adoption (${t1.gapAdoptPct.toFixed(0)}% vs ${t2.gapAdoptPct.toFixed(0)}%)`);
    else if (t2.gapAdoptPct > t1.gapAdoptPct + 5) t2Advantages.push(`GAP adoption (${t2.gapAdoptPct.toFixed(0)}% vs ${t1.gapAdoptPct.toFixed(0)}%)`);
    if (t1.fpcPct > t2.fpcPct + 5) t1Advantages.push(`FPC membership (${t1.fpcPct.toFixed(0)}% vs ${t2.fpcPct.toFixed(0)}%)`);
    else if (t2.fpcPct > t1.fpcPct + 5) t2Advantages.push(`FPC membership (${t2.fpcPct.toFixed(0)}% vs ${t1.fpcPct.toFixed(0)}%)`);

    insights.push({
      type: "comparison",
      icon: "Leaf",
      title: "T-1 vs T-2: Treatment Arm Comparison",
      body: `T-1 (${t1.farmers.length} legacy farmers, $${Math.round(t1.avgIncome).toLocaleString()}/yr) ${Math.abs(incomeDiff) > 5 ? (incomeDiff > 0 ? `earns ${incomeDiff.toFixed(0)}% more than` : `earns ${Math.abs(incomeDiff).toFixed(0)}% less than`) : "is comparable to"} T-2 (${t2.farmers.length} new intake, $${Math.round(t2.avgIncome).toLocaleString()}/yr).${t1Advantages.length ? ` T-1 leads in: ${t1Advantages.join(", ")}.` : ""}${t2Advantages.length ? ` T-2 leads in: ${t2Advantages.join(", ")}.` : ""}`,
      severity: "info",
    });
  }

  // ── 4. Crop diversification vulnerability in treatment groups ──
  const treatmentSingleCrop = treatmentFarmers.filter((f) => countProfitableCrops(f) <= 1).length;
  const treatmentSinglePct = treatmentFarmers.length > 0
    ? (treatmentSingleCrop / treatmentFarmers.length) * 100
    : 0;
  if (treatmentFarmers.length > 20 && treatmentSinglePct > 20) {
    const avgCrops = mean(treatmentFarmers.map(countProfitableCrops));
    insights.push({
      type: "anomaly",
      icon: "AlertTriangle",
      title: "Crop Concentration Risk in Treatment Groups",
      body: `${treatmentSinglePct.toFixed(0)}% of treatment farmers (${treatmentSingleCrop} of ${treatmentFarmers.length}) depend on ≤1 profitable crop, averaging ${avgCrops.toFixed(1)} crops. Diversification support is critical for resilience against price and climate shocks.`,
      severity: "warning",
    });
  }

  // ── 5. Near-LIB transition opportunity (treatment groups only) ──
  const nearLIB = treatmentFarmers.filter(
    (f) => f.incomeCategory === "Moderate Poverty to LIB"
  );
  if (nearLIB.length > 10) {
    const nearByGroup = new Map<string, number>();
    for (const f of nearLIB) {
      nearByGroup.set(f.project, (nearByGroup.get(f.project) || 0) + 1);
    }
    const groupLabels = [...nearByGroup.entries()]
      .map(([g, n]) => `${g} (${n})`)
      .join(", ");
    insights.push({
      type: "highlight",
      icon: "Star",
      title: "Near-LIB Transition Opportunity",
      body: `${nearLIB.length} treatment farmers (${((nearLIB.length / treatmentFarmers.length) * 100).toFixed(0)}%) are in the "Moderate Poverty to LIB" band — closest to crossing the Living Income Benchmark. Breakdown: ${groupLabels}. Targeted interventions for this group offer the highest probability of measurable LIB graduation.`,
      severity: "success",
    });
  }

  // ── 6. Treatment vs Control: program impact ──
  if (t1 && ctrl && t1.farmers.length > 30 && ctrl.farmers.length > 30) {
    const incomeDiff = ctrl.avgIncome > 0 ? ((t1.avgIncome - ctrl.avgIncome) / ctrl.avgIncome) * 100 : 0;
    insights.push({
      type: "comparison",
      icon: "Leaf",
      title: "Treatment vs Control: Program Impact",
      body: `T-1 (n=${t1.farmers.length}) earns ${incomeDiff > 0 ? `${incomeDiff.toFixed(0)}% more` : `${Math.abs(incomeDiff).toFixed(0)}% less`} than Control (n=${ctrl.farmers.length}): $${Math.round(t1.avgIncome).toLocaleString()} vs $${Math.round(ctrl.avgIncome).toLocaleString()}/yr. LIB attainment: ${t1.aboveLIBPct.toFixed(1)}% (T-1) vs ${ctrl.aboveLIBPct.toFixed(1)}% (Control). ${incomeDiff > 10 ? "The program shows a meaningful positive treatment effect." : incomeDiff > 0 ? "The treatment effect is modest — consider intensifying key interventions." : "No clear positive treatment effect detected — review program design."}`,
      severity: incomeDiff > 10 ? "success" : incomeDiff > 0 ? "info" : "warning",
    });
  }

  return insights.slice(0, 6);
}

/* ===================================================================
   PROJECT GROUP INSIGHTS
   Per-group findings for the /segments page
   Recommendations target T-1 and T-2 only; Control is reference
   =================================================================== */

export function generateProjectGroupInsights(farmers: Farmer[]): Insight[] {
  const insights: Insight[] = [];
  if (farmers.length < 20) return insights;

  const groups = buildProjectGroups(farmers);
  const t1 = groups.find((g) => g.group === "T-1");
  const t2 = groups.find((g) => g.group === "T-2");
  const ctrl = groups.find((g) => g.group === "Control");
  if (!t1 && !t2) return insights;

  const treatmentFarmers = farmers.filter((f) => f.project !== "Control");
  const overallGAPPct = treatmentFarmers.length > 0
    ? (treatmentFarmers.filter(isHighGAP).length / treatmentFarmers.length) * 100
    : 0;

  // ── 1. Which treatment arm needs most support ──
  const treatment = [t1, t2].filter(Boolean) as ProjectGroupStats[];
  const neediest = [...treatment].sort((a, b) => b.belowLIBPct - a.belowLIBPct)[0];
  if (neediest && neediest.belowLIBPct > 40) {
    const belowCount = Math.round(neediest.farmers.length * neediest.belowLIBPct / 100);
    insights.push({
      type: "anomaly",
      icon: "AlertTriangle",
      title: `${neediest.label}: Highest Priority for Intervention`,
      body: `${neediest.farmers.length} farmers, ${neediest.belowLIBPct.toFixed(0)}% below LIB (${belowCount} households). Avg income $${Math.round(neediest.avgIncome).toLocaleString()}/yr. GAP adoption: ${neediest.gapAdoptPct.toFixed(0)}%, FPC membership: ${neediest.fpcPct.toFixed(0)}%. Focus: ${neediest.gapAdoptPct < overallGAPPct ? "training + GAP expansion" : neediest.fpcPct < 20 ? "FPC enrollment + market linkages" : "income diversification"}.`,
      severity: "warning",
    });
  }

  // ── 2. T-1 vs T-2 head-to-head (with farm size context) ──
  if (t1 && t2 && t1.farmers.length > 20 && t2.farmers.length > 10) {
    const better = t1.avgIncome >= t2.avgIncome ? t1 : t2;
    const worse = t1.avgIncome >= t2.avgIncome ? t2 : t1;
    const pctDiff = worse.avgIncome > 0 ? ((better.avgIncome - worse.avgIncome) / worse.avgIncome) * 100 : 0;
    // Farm size context — detect structural confound
    const t1SmallPct = t1.farmers.length > 0
      ? (t1.farmers.filter((f) => f.totalAcre <= 2).length / t1.farmers.length) * 100 : 0;
    const t2SmallPct = t2.farmers.length > 0
      ? (t2.farmers.filter((f) => f.totalAcre <= 2).length / t2.farmers.length) * 100 : 0;
    const farmSizeNote = Math.abs(t1SmallPct - t2SmallPct) > 30
      ? ` Note: ${t1SmallPct > t2SmallPct ? "T-1" : "T-2"} has ${Math.abs(t1SmallPct - t2SmallPct).toFixed(0)}pp more smallholders (≤2 acres), which partly explains the income gap.`
      : "";
    insights.push({
      type: "comparison",
      icon: "Users",
      title: `${better.label} Outperforms ${worse.label}`,
      body: `${better.label} (${better.farmers.length} farmers) averages $${Math.round(better.avgIncome).toLocaleString()}/yr — ${pctDiff.toFixed(0)}% more than ${worse.label} ($${Math.round(worse.avgIncome).toLocaleString()}/yr). LIB attainment: ${better.aboveLIBPct.toFixed(0)}% vs ${worse.aboveLIBPct.toFixed(0)}%.${farmSizeNote}`,
      severity: pctDiff > 15 ? "success" : "info",
    });
  }

  // ── 3. T-2 Women Empowerment Paradox ──
  if (t1 && t2 && t1.farmers.length > 20 && t2.farmers.length > 10) {
    const t1AvgEmp = t1.farmers.length > 0
      ? mean(t1.farmers.filter((f) => f.womenEmpowerment != null).map((f) => f.womenEmpowerment)) : 0;
    const t2AvgEmp = t2.farmers.length > 0
      ? mean(t2.farmers.filter((f) => f.womenEmpowerment != null).map((f) => f.womenEmpowerment)) : 0;
    const t2LowEmpPct = t2.farmers.length > 0
      ? (t2.farmers.filter((f) => f.womenEmpowerment < 4).length / t2.farmers.length) * 100 : 0;
    if (t2AvgEmp < t1AvgEmp && t2LowEmpPct > 30) {
      insights.push({
        type: "highlight",
        icon: "Heart",
        title: "T-2 Women Empowerment Paradox",
        body: `Despite highest incomes, T-2 scores lowest on women empowerment (${t2AvgEmp.toFixed(1)}/8 vs T-1's ${t1AvgEmp.toFixed(1)}/8). ${t2LowEmpPct.toFixed(0)}% of T-2 households score below 4. Economic gains may not be translating to household equity — gender-inclusive programming is needed.`,
        severity: "warning",
      });
    }
  }

  // ── 4. Program Effect vs Control (Reference) ──
  if (t1 && ctrl && t1.farmers.length > 30 && ctrl.farmers.length > 30) {
    const premium = ctrl.avgIncome > 0 ? ((t1.avgIncome - ctrl.avgIncome) / ctrl.avgIncome) * 100 : 0;
    insights.push({
      type: "highlight",
      icon: "Star",
      title: "Program Effect vs Control (Reference)",
      body: `T-1 treatment farmers earn ${premium > 0 ? `${premium.toFixed(0)}% more` : `${Math.abs(premium).toFixed(0)}% less`} than the Control group ($${Math.round(t1.avgIncome).toLocaleString()} vs $${Math.round(ctrl.avgIncome).toLocaleString()}/yr). GAP adoption: ${t1.gapAdoptPct.toFixed(0)}% (T-1) vs ${ctrl.gapAdoptPct.toFixed(0)}% (Control). ${premium > 10 ? "Clear positive program impact." : premium > 0 ? "Modest positive impact — room for improvement." : "No detectable positive impact — program review warranted."}`,
      severity: premium > 10 ? "success" : premium > 0 ? "info" : "warning",
    });
  }

  // ── 5. GAP adoption gap in treatment groups ──
  const lowGapGroup = [...treatment].sort((a, b) => a.gapAdoptPct - b.gapAdoptPct)[0];
  if (lowGapGroup && lowGapGroup.gapAdoptPct < overallGAPPct - 5 && lowGapGroup.farmers.length > 10) {
    const gapAdopters = lowGapGroup.farmers.filter((f) => isHighGAP(f) && f.totalNetIncomeUsd != null);
    const gapNon = lowGapGroup.farmers.filter((f) => !isHighGAP(f) && f.totalNetIncomeUsd != null);
    const adopterAvg = gapAdopters.length > 3 ? mean(gapAdopters.map((f) => f.totalNetIncomeUsd!)) : null;
    const nonAvg = gapNon.length > 3 ? mean(gapNon.map((f) => f.totalNetIncomeUsd!)) : null;
    const withinPremium = adopterAvg && nonAvg && nonAvg > 0 ? ((adopterAvg - nonAvg) / nonAvg) * 100 : null;
    insights.push({
      type: "trend",
      icon: "TrendingUp",
      title: `${lowGapGroup.label}: Untapped GAP Training Opportunity`,
      body: `Only ${lowGapGroup.gapAdoptPct.toFixed(0)}% of ${lowGapGroup.farmers.length} farmers in ${lowGapGroup.label} practice ≥40% GAP.${withinPremium != null && withinPremium > 10 ? ` Within this group, GAP adopters earn ${withinPremium.toFixed(0)}% more, confirming the training ROI.` : ""} Prioritizing agricultural extension here could lift incomes significantly.`,
      severity: "warning",
    });
  }

  // ── 6. FPC enrollment gap in treatment groups ──
  const lowFpcGroup = [...treatment].sort((a, b) => a.fpcPct - b.fpcPct)[0];
  if (lowFpcGroup && lowFpcGroup.fpcPct < 25 && lowFpcGroup.farmers.length > 10) {
    const segFpc = lowFpcGroup.farmers.filter((f) => isFpcMember(f) && f.totalNetIncomeUsd != null);
    const segNonFpc = lowFpcGroup.farmers.filter((f) => !isFpcMember(f) && f.totalNetIncomeUsd != null);
    const fpcAvg = segFpc.length > 3 ? mean(segFpc.map((f) => f.totalNetIncomeUsd!)) : null;
    const nonFpcAvg = segNonFpc.length > 3 ? mean(segNonFpc.map((f) => f.totalNetIncomeUsd!)) : null;
    const fpcBenefit = fpcAvg && nonFpcAvg && nonFpcAvg > 0 ? ((fpcAvg - nonFpcAvg) / nonFpcAvg) * 100 : null;
    insights.push({
      type: "comparison",
      icon: "Users",
      title: `${lowFpcGroup.label}: FPC Enrollment Gap`,
      body: `Only ${lowFpcGroup.fpcPct.toFixed(0)}% of ${lowFpcGroup.farmers.length} farmers in ${lowFpcGroup.label} are FPC members.${fpcBenefit != null && fpcBenefit > 0 ? ` Members earn ${fpcBenefit.toFixed(0)}% more ($${Math.round(fpcAvg!).toLocaleString()} vs $${Math.round(nonFpcAvg!).toLocaleString()}/yr).` : ""} Expanding FPC access could improve collective bargaining and market linkages.`,
      severity: fpcBenefit != null && fpcBenefit > 15 ? "success" : "info",
    });
  }

  return insights.slice(0, 6);
}

// Legacy alias
export const generateSegmentInsights = generateProjectGroupInsights;
