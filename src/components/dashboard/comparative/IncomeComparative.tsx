"use client";

import { useMemo } from "react";
import type { Farmer, ProjectGroup } from "@/lib/data/types";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { formatUSD, formatPercent, formatNumber } from "@/lib/utils/formatters";
import { PROJECT_COLORS, CROP_COLORS, CROP_NAMES } from "@/lib/data/constants";
import { median, isAboveLIB } from "@/lib/utils/statistics";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import DumbbellChart from "@/components/charts/DumbbellChart";
import ChartContainer from "@/components/ui/ChartContainer";
import BarChartComponent from "@/components/charts/BarChartComponent";
import CropIncomeBarCard from "@/components/charts/CropIncomeBarCard";
import MethodNote from "@/components/ui/MethodNote";

interface IncomeComparativeProps {
  data: Farmer[];
  projectFilter?: string;
}

const ALL_GROUPS: ProjectGroup[] = ["T-1", "T-2", "Control"];
const TREATMENT_GROUPS: ProjectGroup[] = ["T-1", "T-2"];
const CROPS = ["mint", "rice", "potato", "wheat", "mustard"];

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function med(arr: number[]): number {
  return arr.length ? median(arr) : 0;
}
function getIncome(farmers: Farmer[], key: keyof Farmer): number {
  const vals = farmers.map((f) => f[key] as number).filter((v): v is number => v != null && isFinite(v));
  return avg(vals);
}

export default function IncomeComparative({ data, projectFilter }: IncomeComparativeProps) {
  const { getRound } = useData();
  const { geoFilterRound } = useGeo();

  /* All farmers (geo+demo filtered) — for by-group comparison */
  const baselineFarmers = useMemo(
    () => geoFilterRound(getRound("baseline").farmers),
    [getRound, geoFilterRound]
  );
  const midlineFarmers = useMemo(
    () => geoFilterRound(getRound("midline").farmers),
    [getRound, geoFilterRound]
  );

  /* Project-filtered — for KPIs and overall metrics */
  const bFiltered = useMemo(
    () => projectFilter && projectFilter !== "all"
      ? baselineFarmers.filter((f) => f.project === projectFilter)
      : baselineFarmers,
    [baselineFarmers, projectFilter]
  );
  const mFiltered = useMemo(
    () => projectFilter && projectFilter !== "all"
      ? midlineFarmers.filter((f) => f.project === projectFilter)
      : midlineFarmers,
    [midlineFarmers, projectFilter]
  );

  // Comprehensive Income KPIs
  const incomeKPIs = useMemo(() => {
    const bInc = bFiltered.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
    const mInc = mFiltered.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
    const bOff = avg(bFiltered.map((f) => f.offFarmDependency).filter((v): v is number => v != null && isFinite(v)));
    const mOff = avg(mFiltered.map((f) => f.offFarmDependency).filter((v): v is number => v != null && isFinite(v)));
    const bLivestock = getIncome(bFiltered, "livestockIncome");
    const mLivestock = getIncome(mFiltered, "livestockIncome");
    const bOffFarm = getIncome(bFiltered, "offFarmIncome");
    const mOffFarm = getIncome(mFiltered, "offFarmIncome");
    const bFixed = getIncome(bFiltered, "fixedCostAllCrops");
    const mFixed = getIncome(mFiltered, "fixedCostAllCrops");
    const bLIB = bFiltered.length ? (bFiltered.filter((f) => isAboveLIB(f.aboveLIB)).length / bFiltered.length) * 100 : 0;
    const mLIB = mFiltered.length ? (mFiltered.filter((f) => isAboveLIB(f.aboveLIB)).length / mFiltered.length) * 100 : 0;

    return [
      { label: "Median Income", baseline: med(bInc), midline: med(mInc), format: "currency" as const, higherIsBetter: true },
      { label: "Mean Income", baseline: avg(bInc), midline: avg(mInc), format: "currency" as const, higherIsBetter: true },
      { label: "% Above LIB", baseline: bLIB, midline: mLIB, format: "percent" as const, higherIsBetter: true },
      { label: "Off-Farm Dependency", baseline: bOff, midline: mOff, format: "percent" as const, higherIsBetter: false },
      { label: "Avg Livestock Income", baseline: bLivestock, midline: mLivestock, format: "currency" as const, higherIsBetter: true },
      { label: "Avg Off-Farm Income", baseline: bOffFarm, midline: mOffFarm, format: "currency" as const, higherIsBetter: true },
      { label: "Avg Fixed Costs", baseline: bFixed, midline: mFixed, format: "currency" as const, higherIsBetter: false },
    ];
  }, [bFiltered, mFiltered]);

  /* Control = counterfactual — exclude from treatment-focused group comparisons */
  const visibleGroups = useMemo((): ProjectGroup[] => {
    if (!projectFilter || projectFilter === "all") return TREATMENT_GROUPS;
    return [projectFilter as ProjectGroup];
  }, [projectFilter]);

  // Income by group dumbbell
  const incomeDumbbell = useMemo(() => {
    return visibleGroups.map((g) => {
      const bGroup = baselineFarmers.filter((f) => f.project === g);
      const mGroup = midlineFarmers.filter((f) => f.project === g);
      const bInc = bGroup.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
      const mInc = mGroup.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
      return { label: g, baseline: med(bInc), midline: med(mInc), color: PROJECT_COLORS[g] };
    });
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Income composition comparison (on-farm vs off-farm vs livestock) — project-filtered
  const compositionData = useMemo(() => {
    const calc = (farmers: Farmer[], round: string) => {
      const cropInc = avg(farmers.map((f) => {
        const crops = (f.mintNetIncome ?? 0) + (f.riceNetIncome ?? 0) + (f.potatoNetIncome ?? 0) + (f.wheatNetIncome ?? 0) + (f.mustardNetIncome ?? 0) + (f.otherCropsNetIncome ?? 0);
        return crops;
      }));
      const offFarm = getIncome(farmers, "offFarmNetIncome");
      const livestock = avg(farmers.map((f) => (f.livestockIncome ?? 0) - (f.livestockExpenses ?? 0)));
      return { name: round, "Crop Income": +cropInc.toFixed(0), "Off-Farm": +offFarm.toFixed(0), "Livestock": +livestock.toFixed(0) };
    };
    return [calc(bFiltered, "Baseline"), calc(mFiltered, "Midline")];
  }, [bFiltered, mFiltered]);

  // Poverty progression by group
  const povertyData = useMemo(() => {
    const result: Record<string, string | number>[] = [];
    for (const round of [{ farmers: baselineFarmers, label: "B" }, { farmers: midlineFarmers, label: "M" }]) {
      for (const g of visibleGroups) {
        const gf = round.farmers.filter((f) => f.project === g);
        const gt = gf.length || 1;
        const extreme = gf.filter((f) => (f.totalNetIncomeUsd ?? 0) < 500).length;
        const moderate = gf.filter((f) => { const inc = f.totalNetIncomeUsd ?? 0; return inc >= 500 && inc < 1500; }).length;
        const above = gf.filter((f) => (f.totalNetIncomeUsd ?? 0) >= 1500).length;
        result.push({
          name: `${g} (${round.label})`,
          "Extreme (<$500)": +((extreme / gt) * 100).toFixed(1),
          "Moderate ($500-1.5K)": +((moderate / gt) * 100).toFixed(1),
          "Above LIB (>$1.5K)": +((above / gt) * 100).toFixed(1),
        });
      }
    }
    return result;
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Per-crop income changes — project-filtered
  const cropIncomeData = useMemo(() => {
    return CROPS.map((crop) => {
      const netKey = `${crop}NetIncome` as keyof Farmer;
      const bVals = bFiltered.map((f) => f[netKey] as number).filter((v) => v != null && isFinite(v) && v > 0);
      const mVals = mFiltered.map((f) => f[netKey] as number).filter((v) => v != null && isFinite(v) && v > 0);
      return {
        label: CROP_NAMES[crop] || crop,
        baseline: avg(bVals),
        midline: avg(mVals),
        color: CROP_COLORS[crop] || "#007BFF",
        bGrowers: bVals.length,
        mGrowers: mVals.length,
      };
    }).filter((d) => d.baseline > 0 || d.midline > 0);
  }, [bFiltered, mFiltered]);

  // Off-farm & Livestock averages — for extras row
  const incomeExtras = useMemo(() => {
    const bOffFarm = avg(bFiltered.map((f) => f.offFarmNetIncome as number).filter((v) => v != null && isFinite(v)));
    const mOffFarm = avg(mFiltered.map((f) => f.offFarmNetIncome as number).filter((v) => v != null && isFinite(v)));
    const bLivestock = avg(bFiltered.map((f) => ((f.livestockIncome ?? 0) - (f.livestockExpenses ?? 0))).filter((v) => isFinite(v)));
    const mLivestock = avg(mFiltered.map((f) => ((f.livestockIncome ?? 0) - (f.livestockExpenses ?? 0))).filter((v) => isFinite(v)));
    return [
      { label: "Off-Farm", baseline: bOffFarm, midline: mOffFarm },
      { label: "Livestock", baseline: bLivestock, midline: mLivestock },
    ];
  }, [bFiltered, mFiltered]);

  // Income distribution shift — project-filtered
  const distData = useMemo(() => {
    const bins = [
      { range: "< $0", min: -Infinity, max: 0 },
      { range: "$0-500", min: 0, max: 500 },
      { range: "$500-1K", min: 500, max: 1000 },
      { range: "$1K-2K", min: 1000, max: 2000 },
      { range: "$2K-3K", min: 2000, max: 3000 },
      { range: "$3K-5K", min: 3000, max: 5000 },
      { range: "$5K+", min: 5000, max: Infinity },
    ];
    const countBin = (farmers: Farmer[]) => {
      const total = farmers.length || 1;
      return bins.map((b) => {
        const count = farmers.filter((f) => {
          const inc = f.totalNetIncomeUsd ?? 0;
          return inc >= b.min && inc < b.max;
        }).length;
        return +((count / total) * 100).toFixed(1);
      });
    };
    const bCounts = countBin(bFiltered);
    const mCounts = countBin(mFiltered);
    return bins.map((b, i) => ({
      name: b.range,
      Baseline: bCounts[i],
      Midline: mCounts[i],
    }));
  }, [bFiltered, mFiltered]);

  if (!baselineFarmers.length || !midlineFarmers.length) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
        Both baseline and midline data are required for income comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Income KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {incomeKPIs.map((kpi) => (
          <div key={kpi.label} className="brand-card p-3 space-y-1.5">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{kpi.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold font-mono text-[var(--text-primary)]">
                {kpi.format === "currency" ? formatUSD(kpi.midline) : formatPercent(kpi.midline)}
              </span>
              <ChangeIndicator value={kpi.midline - kpi.baseline} format={kpi.format} higherIsBetter={kpi.higherIsBetter} />
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)] font-mono">
              was {kpi.format === "currency" ? formatUSD(kpi.baseline) : formatPercent(kpi.baseline)}
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. Income by Group ── */}
      <ChartContainer title="Median Income by Group" subtitle="Baseline → Midline"
        tableData={incomeDumbbell.map((d) => ({
          Group: d.label,
          Baseline: formatUSD(d.baseline),
          Midline: formatUSD(d.midline),
          Change: formatUSD(d.midline - d.baseline),
        }))}
      >
        <DumbbellChart rows={incomeDumbbell} formatter={(v) => formatUSD(v)} height={160} />
        <MethodNote
          summary="Unadjusted group-level comparison of median total net household income (PPP-adjusted USD). Median reduces sensitivity to outlier incomes."
          caveats={[
            "Groups are not randomly assigned — differences may reflect selection effects, not program impact alone. See Overview tab for DiD estimates.",
          ]}
        />
      </ChartContainer>

      {/* ── 3. Poverty Progression — "Who's escaping poverty?" ── */}
      <ChartContainer title="Poverty Progression by Group" subtitle="% of farmers by income category (stacked)" tableData={povertyData}>
        <BarChartComponent
          data={povertyData}
          dataKey="Above LIB (>$1.5K)"
          nameKey="name"
          layout="vertical"
          series={[
            { key: "Extreme (<$500)", label: "Extreme (<$500)", color: "#910D63", stackId: "a" },
            { key: "Moderate ($500-1.5K)", label: "Moderate ($500-1.5K)", color: "#FFB703", stackId: "a" },
            { key: "Above LIB (>$1.5K)", label: "Above LIB (>$1.5K)", color: "#00A17D", stackId: "a" },
          ]}
          height={povertyData.length * 36 + 40}
          tooltipTitle="Income Category"
          tooltipUnit="%"
        />
        <MethodNote
          summary="Poverty categories: Extreme (<$500/yr), Moderate ($500–$1,500/yr), Above LIB (>$1,500/yr). These are project-specific thresholds based on total net household income."
          details={[
            "Categories are computed per group per round. Stacked bars sum to 100% for each group-round combination.",
            "LIB threshold ($4,933.50/yr) differs from the 'Above LIB' bar label ($1,500) — the bar categories are simplified income tiers, not the formal LIB cutoff.",
          ]}
        />
      </ChartContainer>

      {/* ── 4. Income Distribution Shift — "How did the curve move?" ── */}
      <ChartContainer title="Income Distribution Shift" subtitle="% of farmers in each income bracket" tableData={distData}>
        <BarChartComponent
          data={distData}
          dataKey="Midline"
          nameKey="name"
          series={[
            { key: "Baseline", label: "Baseline", color: "#6F42C1", opacity: 0.4 },
            { key: "Midline", label: "Midline", color: "#00A17D" },
          ]}
          height={200}
          tooltipTitle="% Farmers"
          tooltipUnit="%"
        />
        <MethodNote
          summary="Income bins show the percentage of farmers falling in each income bracket. Shift rightward (toward higher brackets) indicates overall income growth."
          caveats={[
            "Bin boundaries are fixed across rounds — changes reflect actual income movement, not reclassification.",
            "Repeated cross-section: not all the same individuals appear in both rounds.",
          ]}
        />
      </ChartContainer>

      {/* ── 5. Income Composition — "Where does income come from?" ── */}
      <ChartContainer title="Income Composition" subtitle="Avg per farmer: crops vs off-farm vs livestock" tableData={compositionData}>
        <BarChartComponent
          data={compositionData}
          dataKey="Crop Income"
          nameKey="name"
          series={[
            { key: "Crop Income", label: "Crop Income", color: "#007BFF" },
            { key: "Off-Farm", label: "Off-Farm", color: "#FFB703" },
            { key: "Livestock", label: "Livestock", color: "#00A17D" },
          ]}
          height={150}
          tooltipTitle="Avg Income"
          tooltipFormatter={(v) => formatUSD(v)}
        />
        <MethodNote
          summary="Income decomposed into three sources: crop income (sum of net income from all cultivated crops), off-farm income, and livestock net income (income − expenses)."
          details={[
            "Crop income aggregates mint, rice, potato, wheat, mustard, and other crops. Off-farm includes wage labour, remittances, and non-agricultural enterprise.",
            "All values are average per farmer (PPP-adjusted USD, annualised).",
          ]}
        />
      </ChartContainer>

      {/* ── 6. Per-Crop Income — "Which crops contribute?" ── */}
      <ChartContainer title="Income by Crop" subtitle="Avg net income per grower — Baseline vs Midline"
        tableData={cropIncomeData.map((d) => ({
          Crop: d.label,
          Baseline: formatUSD(d.baseline),
          Midline: formatUSD(d.midline),
          Change: formatUSD(d.midline - d.baseline),
          "Baseline Growers": d.bGrowers,
          "Midline Growers": d.mGrowers,
        }))}
      >
        <CropIncomeBarCard
          rows={cropIncomeData.map((d) => ({
            crop: d.label,
            color: d.color,
            baseline: d.baseline,
            midline: d.midline,
            bGrowers: d.bGrowers,
            mGrowers: d.mGrowers,
          }))}
          extras={incomeExtras}
          metric="avg"
        />
        <MethodNote
          summary="Per-crop net income = gross crop income − crop expenses. Only farmers with non-zero income for each crop are included."
          details={[
            "All monetary values are PPP-adjusted USD. Income recall relies on farmer self-reporting.",
          ]}
          caveats={[
            "Pre-post comparison — does not control for weather, market prices, or other confounders between survey rounds.",
          ]}
        />
      </ChartContainer>
    </div>
  );
}
