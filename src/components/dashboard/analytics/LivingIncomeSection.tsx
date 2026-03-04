"use client";

import { useMemo } from "react";
import { TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { isAboveLIB, median } from "@/lib/utils/statistics";
import { formatNumber, formatUSD } from "@/lib/utils/formatters";
import { LIB_COLORS, INCOME_SOURCE_COLORS, WATERFALL_COLORS, CROPS, CROP_COLORS, CROP_NAMES } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
import WaterfallChart from "@/components/charts/WaterfallChart";
import {
  Section,
  SubChart,
  MiniGroupedBarChart,
  ChartLegend,
  safeMean,
  SectionActionLink,
  type TableRow,
} from "./shared";

interface Props {
  data: Farmer[];
}

/**
 * Living Income Benchmark (LIB) thresholds.
 * Household level: above_LIB = 'Yes' when total_net_income_usd > 4933.50
 * Per capita: $830/year (fixed, matching original dashboard)
 *
 * The waterfall displays PER-CAPITA values (each farmer's income / their
 * family members, then averaged) with LIB = $830/year per capita.
 */
const LIB_PC_THRESHOLD = 830;

/** Waterfall crop order matching original dashboard */
const WATERFALL_CROP_ORDER = ["mint", "mustard", "rice", "wheat", "potato"] as const;

/** Safe per-capita divisor — clamp family size to ≥ 1 */
function pcDiv(f: Farmer): number {
  return Math.max(f.totalFamilyMembers || 1, 1);
}

export default function LivingIncomeSection({ data }: Props) {
  const libStats = useMemo(() => {
    if (!data.length) return null;
    const male = data.filter((f) => f.gender === "Male");
    const female = data.filter((f) => f.gender === "Female");
    const aboveLIB = data.filter((f) => isAboveLIB(f.aboveLIB));
    const belowLIB = data.filter((f) => !isAboveLIB(f.aboveLIB));
    const maleAbove = male.filter((f) => isAboveLIB(f.aboveLIB));
    const femaleAbove = female.filter((f) => isAboveLIB(f.aboveLIB));

    const n = data.length;

    // Per-capita net incomes (each farmer's net ÷ their family size)
    const pcIncomes = data
      .filter((f) => f.totalNetIncomeUsd != null && isFinite(f.totalNetIncomeUsd!))
      .map((f) => f.totalNetIncomeUsd! / pcDiv(f));
    const abovePCIncomes = aboveLIB
      .filter((f) => f.totalNetIncomeUsd != null && isFinite(f.totalNetIncomeUsd!))
      .map((f) => f.totalNetIncomeUsd! / pcDiv(f));
    const belowPCIncomes = belowLIB
      .filter((f) => f.totalNetIncomeUsd != null && isFinite(f.totalNetIncomeUsd!))
      .map((f) => f.totalNetIncomeUsd! / pcDiv(f));

    const medianAbove = abovePCIncomes.length ? median(abovePCIncomes) : 0;
    const medianBelow = belowPCIncomes.length ? median(belowPCIncomes) : 0;
    const medianAll = pcIncomes.length ? median(pcIncomes) : 0;
    const avgAll = pcIncomes.length ? safeMean(pcIncomes) : 0;

    // Income gap: per-capita LIB minus average per-capita income (all farmers)
    // This matches the waterfall gap: LIB threshold − NET income
    const avgGap = Math.max(LIB_PC_THRESHOLD - avgAll, 0);

    // ── Waterfall: per-capita averages (farmer_value / family_size, then mean) ──

    // Per-crop per-capita averages (include negatives — crop losses count)
    const cropAvgs: Record<string, number> = {};
    for (const crop of CROPS) {
      const key = `${crop}NetIncome` as keyof Farmer;
      cropAvgs[crop] = data.reduce((sum, f) => {
        const v = f[key] as number | null;
        return sum + (v != null && isFinite(v) ? v / pcDiv(f) : 0);
      }, 0) / n;
    }
    const avgOtherCrops = data.reduce((sum, f) => {
      const v = f.otherCropsNetIncome;
      return sum + (v != null && isFinite(v) ? v / pcDiv(f) : 0);
    }, 0) / n;

    const avgCropIncome =
      Object.values(cropAvgs).reduce((s, v) => s + v, 0) + avgOtherCrops;

    const avgOffFarm = data.reduce((sum, f) => {
      const v = f.offFarmNetIncome;
      return sum + (v != null && isFinite(v) ? v / pcDiv(f) : 0);
    }, 0) / n;

    const avgLivestock = data.reduce((sum, f) => {
      const inc = f.livestockIncome;
      const exp = f.livestockExpenses;
      const net = (inc != null && isFinite(inc) ? inc : 0) - (exp != null && isFinite(exp) ? exp : 0);
      return sum + net / pcDiv(f);
    }, 0) / n;

    // Fixed cost (only fixed overhead, variable costs already in crop net)
    const avgFixedCost = data.reduce((sum, f) => {
      const v = f.fixedCostAllCrops;
      return sum + (v != null && isFinite(v) ? Math.abs(v) / pcDiv(f) : 0);
    }, 0) / n;

    // FnF (Family & Friends) — residual between per-capita net and our component sum
    // The original pipeline includes other_familynfriends_income/expenses which aren't
    // exported as separate fields, so we derive it from the total.
    const componentSum = avgCropIncome + avgOffFarm + avgLivestock - avgFixedCost;
    const avgFnF = avgAll - componentSum;

    return {
      total: data.length,
      aboveLIB: aboveLIB.length,
      belowLIB: data.length - aboveLIB.length,
      libPct: (aboveLIB.length / data.length) * 100,
      male: male.length,
      female: female.length,
      maleAbove: maleAbove.length,
      femaleAbove: femaleAbove.length,
      malePct: male.length ? (maleAbove.length / male.length) * 100 : 0,
      femalePct: female.length
        ? (femaleAbove.length / female.length) * 100
        : 0,
      medianAbove,
      medianBelow,
      medianAll,
      avgAll,
      libThreshold: LIB_PC_THRESHOLD,
      avgGap: Math.max(avgGap, 0),
      cropAvgs,
      avgOtherCrops,
      avgCropIncome,
      avgOffFarm,
      avgLivestock,
      avgFixedCost,
      avgFnF,
    };
  }, [data]);

  const tableData: TableRow[] = useMemo(() => {
    if (!libStats) return [];
    return [
      { Metric: "Total Farmers", Value: libStats.total },
      { Metric: "Above LIB", Value: libStats.aboveLIB, Percentage: `${libStats.libPct.toFixed(1)}%` },
      { Metric: "Below LIB", Value: libStats.belowLIB, Percentage: `${(100 - libStats.libPct).toFixed(1)}%` },
      { Metric: "Avg Per-Capita Income", Value: `$${Math.round(libStats.avgAll).toLocaleString()}` },
      { Metric: "Median Per-Capita Income", Value: `$${Math.round(libStats.medianAll).toLocaleString()}` },
      { Metric: "Median PC (Above LIB)", Value: `$${Math.round(libStats.medianAbove).toLocaleString()}` },
      { Metric: "Median PC (Below LIB)", Value: `$${Math.round(libStats.medianBelow).toLocaleString()}` },
      { Metric: "Avg PC Gap to LIB", Value: `$${Math.round(libStats.avgGap).toLocaleString()}` },
      { Metric: "Male Above LIB %", Value: `${libStats.malePct.toFixed(1)}%` },
      { Metric: "Female Above LIB %", Value: `${libStats.femalePct.toFixed(1)}%` },
    ];
  }, [libStats]);

  const genderBarData = useMemo(() => {
    if (!libStats) return [];
    return [
      {
        category: "Female",
        above: libStats.femaleAbove,
        below: libStats.female - libStats.femaleAbove,
      },
      {
        category: "Male",
        above: libStats.maleAbove,
        below: libStats.male - libStats.maleAbove,
      },
    ];
  }, [libStats]);

  // Waterfall chart items — per-capita, bar order matching original dashboard
  const waterfallItems = useMemo(() => {
    if (!libStats) return [];
    let firstBar = true;
    const bars: { name: string; value: number; color: string; isTotal?: boolean }[] = [];

    // Per-crop bars in original order: Mint → Mustard → Rice → Wheat → Potato
    for (const crop of WATERFALL_CROP_ORDER) {
      if (Math.abs(libStats.cropAvgs[crop]) > 0.5) {
        bars.push({
          name: CROP_NAMES[crop],
          value: libStats.cropAvgs[crop],
          color: CROP_COLORS[crop],
          isTotal: firstBar,
        });
        firstBar = false;
      }
    }
    if (Math.abs(libStats.avgOtherCrops) > 0.5) {
      bars.push({ name: "Other Crops", value: libStats.avgOtherCrops, color: "#8ECAE6", isTotal: firstBar });
      firstBar = false;
    }

    // Off-Farm
    if (Math.abs(libStats.avgOffFarm) > 0.5) {
      bars.push({ name: "Off Farm", value: libStats.avgOffFarm, color: INCOME_SOURCE_COLORS.offFarm, isTotal: firstBar });
      firstBar = false;
    }

    // Fixed cost (negative — before livestock, matching original order)
    if (libStats.avgFixedCost > 0.5) {
      bars.push({ name: "Fixed Cost", value: -libStats.avgFixedCost, color: WATERFALL_COLORS.decrease });
    }

    // Livestock
    if (Math.abs(libStats.avgLivestock) > 0.5) {
      bars.push({ name: "Livestock", value: libStats.avgLivestock, color: INCOME_SOURCE_COLORS.livestock });
    }

    // FnF — family & friends net income (derived residual)
    if (Math.abs(libStats.avgFnF) > 0.5) {
      bars.push({
        name: "FnF",
        value: libStats.avgFnF,
        color: libStats.avgFnF >= 0 ? "#6F42C1" : WATERFALL_COLORS.decrease,
      });
    }

    // NET Income (total bar — per-capita)
    const net = libStats.avgAll;
    bars.push({ name: "NET Income", value: net, color: WATERFALL_COLORS.total, isTotal: true });

    // Gap to LIB (per-capita)
    const gap = libStats.libThreshold - net;
    if (gap > 0) {
      const gapPct = Math.round((gap / libStats.libThreshold) * 100);
      bars.push({ name: `Gap (${gapPct}%)`, value: gap, color: WATERFALL_COLORS.subtotal });
      // Total = LIB threshold (per-capita)
      bars.push({ name: "LIB", value: libStats.libThreshold, color: "#FF6B6B", isTotal: true });
    }

    return bars;
  }, [libStats]);

  // Whether Gap to LIB bar is shown (used for legend + table consistency)
  const hasGapToLIB = useMemo(() => {
    if (!libStats) return false;
    return libStats.libThreshold - libStats.avgAll > 0;
  }, [libStats]);

  // Narrative insight generation
  const insight = useMemo(() => {
    if (!libStats) return null;
    const belowPct = 100 - libStats.libPct;
    const genderGap = Math.abs(libStats.malePct - libStats.femalePct);
    const worse = libStats.femalePct < libStats.malePct ? "female" : "male";
    const libDisplay = `$${Math.round(libStats.libThreshold).toLocaleString()}/year per capita`;

    let narrative = "";
    let severity: "warning" | "success" | "info" = "info";

    if (belowPct > 70) {
      narrative = `${belowPct.toFixed(0)}% of households (${formatNumber(libStats.belowLIB)}) earn below the Living Income Benchmark (${libDisplay}). The average per-capita shortfall is ${formatUSD(libStats.avgGap)}/year. ${worse === "female" ? "Female" : "Male"}-headed households are disproportionately affected.`;
      severity = "warning";
    } else if (belowPct > 40) {
      narrative = `${formatNumber(libStats.belowLIB)} households (${belowPct.toFixed(0)}%) remain below the Living Income threshold (${libDisplay}). Bridging the average gap of ${formatUSD(libStats.avgGap)}/year per capita would require targeted crop diversification and off-farm income programs.`;
      severity = "warning";
    } else {
      narrative = `${libStats.libPct.toFixed(0)}% of households meet the Living Income Benchmark — a positive signal. Focus on sustaining gains and closing the ${genderGap.toFixed(0)}pp gender gap.`;
      severity = "success";
    }

    return { narrative, severity };
  }, [libStats]);

  // Waterfall table data (for expanded view) — per-capita, original bar order
  const waterfallTableData: TableRow[] = useMemo(() => {
    if (!libStats) return [];
    const net = libStats.avgAll;
    const gap = Math.max(libStats.libThreshold - net, 0);
    return [
      ...WATERFALL_CROP_ORDER.filter((crop) => Math.abs(libStats.cropAvgs[crop]) > 0.5).map((crop) => ({
        Component: CROP_NAMES[crop],
        "Per Capita (USD)": `$${libStats.cropAvgs[crop].toFixed(1)}`,
      })),
      ...(Math.abs(libStats.avgOtherCrops) > 0.5
        ? [{ Component: "Other Crops", "Per Capita (USD)": `$${libStats.avgOtherCrops.toFixed(1)}` }]
        : []),
      { Component: "Off Farm", "Per Capita (USD)": `$${libStats.avgOffFarm.toFixed(1)}` },
      { Component: "Fixed Cost", "Per Capita (USD)": `-$${libStats.avgFixedCost.toFixed(1)}` },
      { Component: "Livestock", "Per Capita (USD)": `$${libStats.avgLivestock.toFixed(1)}` },
      ...(Math.abs(libStats.avgFnF) > 0.5
        ? [{ Component: "FnF", "Per Capita (USD)": `$${libStats.avgFnF.toFixed(1)}` }]
        : []),
      { Component: "NET Income", "Per Capita (USD)": `$${Math.round(net).toLocaleString()}` },
      ...(gap > 0
        ? [
            { Component: `Gap (${Math.round((gap / libStats.libThreshold) * 100)}%)`, "Per Capita (USD)": `$${Math.round(gap).toLocaleString()}` },
            { Component: "LIB Threshold", "Per Capita (USD)": `$${Math.round(libStats.libThreshold).toLocaleString()}` },
          ]
        : []),
    ];
  }, [libStats]);

  return (
    <Section
      id="analytics-lib"
      title="Living Income Gap Analysis"
      icon={<TrendingUp size={14} />}
      description="Income waterfall & gap to Living Income Benchmark"
      expandable
      defaultOpen
      tableData={tableData}
    >
      {libStats && (
        <>
          {/* Narrative Insight Banner */}
          {insight && (
            <div
              className="rounded-lg px-3 py-2 flex items-start gap-2"
              style={{
                background:
                  insight.severity === "warning"
                    ? "rgba(255,183,3,0.08)"
                    : insight.severity === "success"
                    ? "rgba(0,161,125,0.08)"
                    : "rgba(0,123,255,0.08)",
                border: `1px solid ${
                  insight.severity === "warning"
                    ? "rgba(255,183,3,0.2)"
                    : insight.severity === "success"
                    ? "rgba(0,161,125,0.2)"
                    : "rgba(0,123,255,0.2)"
                }`,
              }}
            >
              {insight.severity === "warning" ? (
                <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: "#FFB703" }} />
              ) : (
                <Lightbulb size={12} className="shrink-0 mt-0.5" style={{ color: "#00CCCC" }} />
              )}
              <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                {insight.narrative}
              </p>
            </div>
          )}

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="text-center py-2 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Above LIB</div>
              <div className="text-sm font-bold font-mono mt-0.5" style={{ color: LIB_COLORS.above }}>
                {libStats.libPct.toFixed(1)}%
              </div>
              <div className="text-[9px] text-[var(--text-tertiary)]">{formatNumber(libStats.aboveLIB)} farmers</div>
            </div>
            <div className="text-center py-2 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                Avg PC Gap
              </div>
              <div className="text-sm font-bold font-mono mt-0.5" style={{ color: libStats.avgGap > 0 ? "#FB8500" : "#00CCCC" }}>
                {formatUSD(libStats.avgGap)}
              </div>
              <div className="text-[9px] text-[var(--text-tertiary)]">
                {libStats.avgGap > 0
                  ? "per capita/yr shortfall"
                  : "avg per capita above LIB"}
              </div>
            </div>
          </div>

          {/* ── Per-Capita Income Waterfall ── */}
          <SubChart
            title="LIB Income Waterfall"
            tableData={waterfallTableData}
            expandedContent={
              <WaterfallChart
                items={waterfallItems}
                height={350}
                tooltipTitle="Per-Capita Income (USD/year)"
                tooltipFormatter={(v) => `$${Math.abs(v).toFixed(1)} USD`}
              />
            }
            legend={
              <ChartLegend
                items={[
                  ...WATERFALL_CROP_ORDER.filter((crop) => Math.abs(libStats.cropAvgs[crop]) > 0.5).map((crop) => ({
                    label: CROP_NAMES[crop],
                    color: CROP_COLORS[crop],
                  })),
                  ...(Math.abs(libStats.avgOtherCrops) > 0.5 ? [{ label: "Other Crops", color: "#8ECAE6" }] : []),
                  { label: "Off Farm", color: INCOME_SOURCE_COLORS.offFarm },
                  { label: "Fixed Cost", color: WATERFALL_COLORS.decrease },
                  { label: "Livestock", color: INCOME_SOURCE_COLORS.livestock },
                  ...(Math.abs(libStats.avgFnF) > 0.5 ? [{ label: "FnF", color: "#6F42C1" }] : []),
                  { label: "NET Income", color: WATERFALL_COLORS.total },
                  ...(hasGapToLIB ? [{ label: "Gap", color: WATERFALL_COLORS.subtotal }, { label: "LIB", color: "#FF6B6B" }] : []),
                ]}
              />
            }
          >
            <WaterfallChart
              items={waterfallItems}
              height={180}
              tooltipTitle="Per-Capita Income (USD/year)"
              tooltipFormatter={(v) => `$${Math.abs(v).toFixed(1)} USD`}
            />
          </SubChart>

          {/* ── Gender LIB Breakdown (individual SubChart card) ── */}
          <SubChart
            title="LIB by Gender"
            tableData={[
              { Gender: "Female", "Above LIB": libStats.femaleAbove, "Below LIB": libStats.female - libStats.femaleAbove, "Above LIB %": `${libStats.femalePct.toFixed(1)}%` },
              { Gender: "Male", "Above LIB": libStats.maleAbove, "Below LIB": libStats.male - libStats.maleAbove, "Above LIB %": `${libStats.malePct.toFixed(1)}%` },
            ]}
            expandedContent={
              <MiniGroupedBarChart
                data={genderBarData}
                keys={[
                  { dataKey: "above", color: LIB_COLORS.above, label: "Above LIB" },
                  { dataKey: "below", color: LIB_COLORS.below, label: "Below LIB" },
                ]}
                nameKey="category"
                height={250}
                tooltipTitle="Gender Breakdown"
                tooltipUnit="farmers"
              />
            }
          >
            <MiniGroupedBarChart
              data={genderBarData}
              keys={[
                { dataKey: "above", color: LIB_COLORS.above, label: "Above LIB" },
                { dataKey: "below", color: LIB_COLORS.below, label: "Below LIB" },
              ]}
              nameKey="category"
              height={120}
              tooltipTitle="Gender Breakdown"
              tooltipUnit="farmers"
            />
          </SubChart>

          {/* Cohort comparison metrics — per-capita */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg px-2 py-1.5" style={{ background: "var(--card-bg-hover)", borderLeft: `3px solid ${LIB_COLORS.above}` }}>
              <div className="text-[9px] uppercase text-[var(--text-tertiary)]">Above-LIB Median (PC)</div>
              <div className="text-xs font-bold font-mono" style={{ color: LIB_COLORS.above }}>{formatUSD(libStats.medianAbove)}/yr</div>
            </div>
            <div className="rounded-lg px-2 py-1.5" style={{ background: "var(--card-bg-hover)", borderLeft: `3px solid ${LIB_COLORS.below}` }}>
              <div className="text-[9px] uppercase text-[var(--text-tertiary)]">Below-LIB Median (PC)</div>
              <div className="text-xs font-bold font-mono" style={{ color: LIB_COLORS.below }}>{formatUSD(libStats.medianBelow)}/yr</div>
            </div>
          </div>

          <SectionActionLink href="/farmers" label="View Individual Farmers" />
        </>
      )}
    </Section>
  );
}
