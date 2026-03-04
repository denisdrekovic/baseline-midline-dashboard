"use client";

import { useMemo } from "react";
import type { Farmer } from "@/lib/data/types";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import {
  computeAllGroupComparisons,
  computeAllDID,
  computeDrivers,
  getMetricDefs,
  type ComparisonKPI,
  type GroupComparison,
} from "@/lib/utils/comparison";
import { formatUSD, formatPercent, formatNumber } from "@/lib/utils/formatters";
import { PROJECT_COLORS, CROP_NAMES, CROP_COLORS } from "@/lib/data/constants";
import { isAboveLIB } from "@/lib/utils/statistics";
import type { ProjectGroup } from "@/lib/data/types";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import DIDCard from "@/components/ui/DIDCard";
import DumbbellChart from "@/components/charts/DumbbellChart";
import ChartContainer from "@/components/ui/ChartContainer";
import BarChartComponent from "@/components/charts/BarChartComponent";
import SlopeChart from "@/components/charts/SlopeChart";
import ParallelTrendsChart from "@/components/charts/ParallelTrendsChart";
import DistributionShiftChart from "@/components/charts/DistributionShiftChart";
import AlluvialChart from "@/components/charts/AlluvialChart";
import HeroKPIGauges from "@/components/charts/HeroKPIGauges";
import MetricHeatmap from "@/components/charts/MetricHeatmap";
import MethodNote from "@/components/ui/MethodNote";
import InsightsPanel from "@/components/ui/InsightsPanel";
import { generateComparativeInsights } from "@/lib/utils/comparativeInsights";

interface OverviewComparativeProps {
  data: Farmer[];
  projectFilter?: string;
}

function fmtKPI(kpi: ComparisonKPI): string {
  switch (kpi.format) {
    case "currency": return formatUSD(kpi.midlineValue);
    case "percent": return formatPercent(kpi.midlineValue);
    default: return kpi.midlineValue.toFixed(2);
  }
}

export default function OverviewComparative({ data, projectFilter }: OverviewComparativeProps) {
  const { getRound } = useData();
  const { geoFilterRound } = useGeo();

  /* All farmers (geo+demo filtered) — used for by-group comparison charts */
  const baselineFarmers = useMemo(
    () => geoFilterRound(getRound("baseline").farmers),
    [getRound, geoFilterRound]
  );
  const midlineFarmers = useMemo(
    () => geoFilterRound(getRound("midline").farmers),
    [getRound, geoFilterRound]
  );

  /* Project-filtered farmers — used for KPIs, distributions, overall metrics */
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

  const groupComparisons = useMemo(
    () => computeAllGroupComparisons(baselineFarmers, midlineFarmers),
    [baselineFarmers, midlineFarmers]
  );

  const overallKPIs = useMemo(
    () => {
      const heroMetrics = [
        "libPct", "medianIncome", "avgIncome", "femaleLIBPct",
        "gapAdoptionPct", "fpcMembershipPct", "trainingPct",
        "avgWEI", "avgResources", "avgProductivity", "offFarmDep",
      ];
      const all = computeAllGroupComparisons(bFiltered, mFiltered, heroMetrics);
      const metrics = heroMetrics;
      return metrics.map((id) => {
        const values = all.flatMap((g) => g.kpis.filter((k) => k.metric === id));
        if (!values.length) return null;
        // Use overall (not per-group) for hero KPIs
        const defs = getMetricDefs();
        const def = defs.find((d) => d.id === id);
        if (!def) return null;
        const bVal = bFiltered.length ? def.extract(bFiltered) : 0;
        const mVal = mFiltered.length ? def.extract(mFiltered) : 0;
        return {
          metric: id,
          label: def.label,
          baseline: bVal,
          midline: mVal,
          change: mVal - bVal,
          format: def.format as "percent" | "currency" | "number" | "index",
          higherIsBetter: def.higherIsBetter,
          pctChange: bVal !== 0 ? ((mVal - bVal) / Math.abs(bVal)) * 100 : 0,
        };
      }).filter(Boolean) as {
        metric: string; label: string; baseline: number; midline: number;
        change: number; format: "percent" | "currency" | "number" | "index";
        higherIsBetter: boolean; pctChange: number;
      }[];
    },
    [bFiltered, mFiltered]
  );

  const didResults = useMemo(
    () => computeAllDID(baselineFarmers, midlineFarmers, [
      "libPct", "medianIncome", "gapAdoptionPct", "avgWEI",
    ]),
    [baselineFarmers, midlineFarmers]
  );

  const drivers = useMemo(
    () => computeDrivers(bFiltered, mFiltered),
    [bFiltered, mFiltered]
  );

  /* ── Which groups to show in by-group charts ──
   * Control is the counterfactual — it should NOT appear alongside treatment
   * groups in aggregate comparison charts (dumbbell, heatmap).
   * It only appears in DiD cards and Parallel Trends where it explicitly
   * serves as the counterfactual reference. */
  const visibleGroups = useMemo((): ProjectGroup[] => {
    if (!projectFilter || projectFilter === "all") return ["T-1", "T-2"];
    return [projectFilter as ProjectGroup];
  }, [projectFilter]);

  const dumbbellData = useMemo(() => {
    return visibleGroups.map((g) => {
      const gc = groupComparisons.find((c) => c.group === g);
      const libKPI = gc?.kpis.find((k) => k.metric === "libPct");
      return {
        label: g,
        baseline: libKPI?.baselineValue ?? 0,
        midline: libKPI?.midlineValue ?? 0,
        color: PROJECT_COLORS[g],
      };
    });
  }, [groupComparisons, visibleGroups]);

  const driverChartData = useMemo(() => {
    return drivers.drivers
      .filter((d) => Math.abs(d.change) > 0.001)
      .slice(0, 8)
      .map((d) => ({
        name: d.factor,
        change: +(d.change * 100).toFixed(1),
      }));
  }, [drivers]);

  const metricDefs = getMetricDefs();

  /* ── Heatmap cell data — for the new colour-intensity grid ── */
  const heatmapCells = useMemo(() => {
    const cells: {
      metricId: string; label: string; group: ProjectGroup;
      baselineValue: number; midlineValue: number;
      absoluteChange: number; percentChange: number;
      format: "percent" | "currency" | "number" | "index";
      higherIsBetter: boolean;
    }[] = [];
    for (const def of metricDefs) {
      for (const g of visibleGroups) {
        const gc = groupComparisons.find((c) => c.group === g);
        const kpi = gc?.kpis.find((k) => k.metric === def.id);
        if (kpi) {
          cells.push({
            metricId: def.id,
            label: def.label,
            group: g,
            baselineValue: kpi.baselineValue,
            midlineValue: kpi.midlineValue,
            absoluteChange: kpi.absoluteChange,
            percentChange: kpi.percentChange,
            format: kpi.format as "percent" | "currency" | "number" | "index",
            higherIsBetter: kpi.higherIsBetter,
          });
        }
      }
    }
    return cells;
  }, [metricDefs, groupComparisons, visibleGroups]);

  /* ── New Chart Data: Slope Chart ── */
  const slopeData = useMemo(() => {
    return overallKPIs
      .filter((k) => Math.abs(k.change) > 0.001)
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
      .slice(0, 8)
      .map((k, i) => {
        const palette = [
          "#007BFF", "#6F42C1", "#00CCCC", "#FFB703", "#FB8500",
          "#0DCAF0", "#219EBC", "#17A2B8",
        ];
        const fmt =
          k.format === "currency"
            ? (v: number) => formatUSD(v)
            : k.format === "percent"
            ? (v: number) => formatPercent(v)
            : (v: number) => v.toFixed(2);
        return {
          label: k.label.replace(/ Index| Rate| Dependency/g, "").slice(0, 18),
          start: k.baseline,
          end: k.midline,
          color: palette[i % palette.length],
          formatter: fmt,
        };
      });
  }, [overallKPIs]);

  /* ── New Chart Data: Parallel Trends (DiD visual) ── */
  const parallelTrendsData = useMemo(() => {
    const metric = "medianIncome";
    // When a treatment group is selected, show it + Control for DiD context
    // When Control or All is selected, show all groups
    const groups: ProjectGroup[] =
      projectFilter === "T-1" ? ["T-1", "Control"]
      : projectFilter === "T-2" ? ["T-2", "Control"]
      : ["T-1", "T-2", "Control"];
    return groups.map((g) => {
      const gc = groupComparisons.find((c) => c.group === g);
      const kpi = gc?.kpis.find((k) => k.metric === metric);
      return {
        key: g,
        label: g === "T-1" ? "Treatment 1" : g === "T-2" ? "Treatment 2" : "Control",
        color: PROJECT_COLORS[g],
        baseline: kpi?.baselineValue ?? 0,
        midline: kpi?.midlineValue ?? 0,
        showCounterfactual: g !== "Control",
      };
    });
  }, [groupComparisons, projectFilter]);

  /* ── New Chart Data: Income Distribution Shift ── */
  const distributionData = useMemo(() => {
    const bIncomes = bFiltered
      .map((f) => f.totalNetIncomeUsd)
      .filter((v): v is number => v != null && isFinite(v) && v > -5000 && v < 20000);
    const mIncomes = mFiltered
      .map((f) => f.totalNetIncomeUsd)
      .filter((v): v is number => v != null && isFinite(v) && v > -5000 && v < 20000);
    return [
      { key: "baseline", label: "Baseline", color: "var(--text-tertiary)", values: bIncomes },
      { key: "midline", label: "Midline", color: "#00A17D", values: mIncomes },
    ];
  }, [bFiltered, mFiltered]);

  /* ── New Chart Data: Alluvial (LIB category transitions) ── */
  const alluvialData = useMemo(() => {
    // Categorise farmers into income quintiles or LIB status
    const categories = [
      { key: "above", label: "Above LIB", color: "#00A17D" },
      { key: "below", label: "Below LIB", color: "#FFB703" },
    ];

    // Match farmers between rounds by ID
    const baseMap = new Map(bFiltered.map((f) => [f.id, f]));
    const flows: { from: string; to: string; value: number }[] = [];
    const flowCounts = new Map<string, number>();

    for (const mf of mFiltered) {
      const bf = baseMap.get(mf.id);
      if (!bf) continue;

      const fromCat = isAboveLIB(bf.aboveLIB) ? "above" : "below";
      const toCat = isAboveLIB(mf.aboveLIB) ? "above" : "below";
      const key = `${fromCat}->${toCat}`;
      flowCounts.set(key, (flowCounts.get(key) ?? 0) + 1);
    }

    for (const [key, value] of flowCounts) {
      const [from, to] = key.split("->");
      flows.push({ from, to, value });
    }

    return { categories, flows };
  }, [bFiltered, mFiltered]);

  /* ── AI Insights — programmatic comparative analysis ── */
  const insights = useMemo(
    () => generateComparativeInsights(bFiltered, mFiltered),
    [bFiltered, mFiltered]
  );

  /* ── Crop Income Summary (farmer-level per-crop net income) ── */
  const cropSummary = useMemo(() => {
    const cropKeys: { crop: string; key: keyof Farmer }[] = [
      { crop: "mint", key: "mintNetIncome" },
      { crop: "rice", key: "riceNetIncome" },
      { crop: "potato", key: "potatoNetIncome" },
      { crop: "wheat", key: "wheatNetIncome" },
      { crop: "mustard", key: "mustardNetIncome" },
    ];
    return cropKeys.map(({ crop, key }) => {
      const bVals = bFiltered.map((f) => f[key] as number).filter((v) => v != null && isFinite(v) && v !== 0);
      const mVals = mFiltered.map((f) => f[key] as number).filter((v) => v != null && isFinite(v) && v !== 0);
      const bAvg = bVals.length ? bVals.reduce((a, b) => a + b, 0) / bVals.length : 0;
      const mAvg = mVals.length ? mVals.reduce((a, b) => a + b, 0) / mVals.length : 0;
      return {
        crop,
        name: CROP_NAMES[crop] || crop,
        color: CROP_COLORS[crop] || "#007BFF",
        baseline: bAvg,
        midline: mAvg,
        bGrowers: bVals.length,
        mGrowers: mVals.length,
      };
    }).filter((c) => c.bGrowers > 0 || c.mGrowers > 0);
  }, [bFiltered, mFiltered]);

  const cropIncomeDumbbell = useMemo(
    () => cropSummary.map((c) => ({ label: c.name, baseline: c.baseline, midline: c.midline, color: c.color })),
    [cropSummary]
  );

  /* ── Productivity & Resources Index by Group (dumbbell) ── */
  const productivityDumbbell = useMemo(() => {
    return visibleGroups.map((g) => {
      const bGroup = baselineFarmers.filter((f) => f.project === g);
      const mGroup = midlineFarmers.filter((f) => f.project === g);
      const bVals = bGroup.map((f) => f.productivityIndex).filter((v) => isFinite(v));
      const mVals = mGroup.map((f) => f.productivityIndex).filter((v) => isFinite(v));
      const bAvg = bVals.length ? bVals.reduce((a, b) => a + b, 0) / bVals.length : 0;
      const mAvg = mVals.length ? mVals.reduce((a, b) => a + b, 0) / mVals.length : 0;
      return { label: g, baseline: bAvg, midline: mAvg, color: PROJECT_COLORS[g] };
    });
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  if (!baselineFarmers.length || !midlineFarmers.length) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
        Both baseline and midline data are required for comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ══════════════════════════════════════════════════════════
          STORYLINE ORDER (Mars LIB-focused narrative)
          1. Where are we now? → Hero KPIs
          2. Key findings → AI Insights
          3. Did the program work? → Treatment Effects (DiD)
          4. Visual proof → Parallel Trends
          5. Which group improved most? → LIB by Group dumbbell
          6. Who crossed the threshold? → Alluvial LIB transitions
          7. How did the income curve move? → Distribution shift
          8. What's driving income? → Crop & Productivity snapshot
          9. Comprehensive metric view → Heatmap
          10. All KPIs at a glance → Slope chart
          11. What drove the changes? → Drivers
         ══════════════════════════════════════════════════════════ */}

      {/* ── 1. Hero KPI Gauges — "Where are we now?" ── */}
      <HeroKPIGauges kpis={overallKPIs} heroCount={4} />

      {/* ── 2. AI Insights — "Key findings" ── */}
      {insights.length > 0 && (
        <div className="brand-card p-4">
          <InsightsPanel insights={insights} maxVisible={4} compact />
        </div>
      )}

      {/* ── 3. Treatment Effects (DiD) — "Did the program work?" ── */}
      {projectFilter !== "Control" && (<div className="space-y-2">
        <h3
          className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Treatment Effects (Diff-in-Diff)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {didResults
            .filter((r) => !projectFilter || projectFilter === "all" || r.treatmentGroup === projectFilter)
            .map((r) => (
            <DIDCard key={`${r.treatmentGroup}-${r.metric}`} result={r} />
          ))}
        </div>
        <MethodNote
          summary={`Difference-in-Differences (DiD): Net Effect = (Treatment_midline \u2212 Treatment_baseline) \u2212 (Control_midline \u2212 Control_baseline). Controls for time-invariant confounders common to both groups.`}
          details={[
            `The DiD estimator isolates the treatment effect by subtracting the control group\u2019s change from the treatment group\u2019s change, removing secular trends and baseline-level differences.`,
            `Statistical significance is assessed via two-sample t-tests with Welch\u2019s correction for unequal variances. Effect size reported as Cohen\u2019s d.`,
          ]}
          caveats={[
            `Only two time points (baseline + midline) \u2014 the parallel trends assumption cannot be empirically verified with pre-treatment data.`,
            "Non-random group assignment means residual selection bias may persist even after differencing.",
            "Estimates assume no spillover effects between treatment and control farmers.",
            "Sample attrition between rounds may introduce survivorship bias if dropout is non-random.",
          ]}
        />
      </div>)}

      {/* ── 4. Parallel Trends — "Visual proof of treatment effect" ── */}
      <ChartContainer
        title="Parallel Trends — Median Income by Group"
        subtitle="Treatment vs Control — dashed line shows projected path without intervention"
        delay={0.05}
        tableData={parallelTrendsData.map((g) => ({
          Group: g.label,
          Baseline: formatUSD(g.baseline),
          Midline: formatUSD(g.midline),
          Change: formatUSD(g.midline - g.baseline),
          "Change (%)": g.baseline !== 0 ? `${(((g.midline - g.baseline) / Math.abs(g.baseline)) * 100).toFixed(1)}%` : "\u2014",
        }))}
      >
        <ParallelTrendsChart
          groups={parallelTrendsData}
          controlKey="Control"
          height={280}
          yAxisFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          tooltipUnit="USD"
          tooltipTitle="Median Income"
        />
        <MethodNote
          summary="Difference-in-Differences visualised: dashed line projects where treatment groups would be if they followed the control group's trend (i.e., no intervention effect)."
          details={[
            `Projected value = Treatment_baseline + (Control_midline \u2212 Control_baseline). The gap between the actual treatment line and this projection is the DiD treatment effect estimate.`,
            "Median income (not mean) is used to reduce sensitivity to outliers in skewed income distributions.",
          ]}
          caveats={[
            `With only 2 time points the parallel trends assumption is untestable \u2014 pre-intervention parallel trajectories cannot be verified.`,
            `Non-random group assignment \u2014 groups may have differed systematically at baseline.`,
            "Medians do not decompose linearly like means, so standard DiD regression properties do not strictly hold.",
            `No confidence intervals shown \u2014 visual gaps should be interpreted alongside the Treatment Effects statistical tests above.`,
          ]}
        />
      </ChartContainer>

      {/* ── 5. % Above Living Income by Group — "Which group improved most?" ── */}
      <ChartContainer
        title="% Above Living Income by Group"
        subtitle="Baseline \u2192 Midline progression"
        tableData={dumbbellData.map((d) => ({
          Group: d.label,
          Baseline: formatPercent(d.baseline),
          Midline: formatPercent(d.midline),
          "Change (pp)": formatPercent(d.midline - d.baseline),
        }))}
      >
        <DumbbellChart
          rows={dumbbellData}
          formatter={(v) => formatPercent(v)}
          height={160}
        />
        <MethodNote
          summary="Unadjusted group-level comparison: percentage of farmers above the Living Income Benchmark (LIB) at each time point."
          details={[
            "LIB threshold is set at the national per-capita level (INR 83,356/yr). Farmers are classified as above/below based on their total net household income.",
            "Treatment groups (T-1, T-2) receive different intervention intensities; the Control group receives no program support.",
          ]}
          caveats={[
            `Groups are not randomly assigned \u2014 differences may reflect selection effects rather than program impact alone.`,
          ]}
        />
      </ChartContainer>

      {/* ── 6. Living Income Transitions — "Who crossed the threshold?" ── */}
      {alluvialData.flows.length > 0 && (
        <ChartContainer
          title="Living Income Transitions"
          subtitle="How farmers moved between LIB categories across rounds"
          delay={0.1}
          tableData={alluvialData.flows.map((f) => ({
            From: alluvialData.categories.find((c) => c.key === f.from)?.label ?? f.from,
            To: alluvialData.categories.find((c) => c.key === f.to)?.label ?? f.to,
            "Farmer Count": f.value,
          }))}
        >
          <AlluvialChart
            categories={alluvialData.categories}
            flows={alluvialData.flows}
            leftLabel="Baseline"
            rightLabel="Midline"
            height={200}
          />
          <MethodNote
            summary="Panel-matched farmer transitions: only farmers present in both rounds are included. Categories based on the Living Income Benchmark threshold."
            details={[
              "Farmers are matched by unique ID across rounds. Flow widths are proportional to the count of farmers making each transition (e.g., Below\u2192Above, Above\u2192Above).",
              "LIB classification uses the national per-capita benchmark (INR 83,356/yr). A farmer's total net household income determines their category.",
            ]}
            caveats={[
              "Only panel-matched farmers are shown \u2014 those who dropped out between rounds are excluded, which may bias transition rates if attrition is non-random.",
              "Binary above/below classification masks movement within categories (e.g., a farmer far below LIB moving closer but not crossing the threshold).",
            ]}
          />
        </ChartContainer>
      )}

      {/* ── 7. Income Distribution Shift — "How did the income curve move?" ── */}
      {distributionData[0].values.length > 10 && (
        <ChartContainer
          title="Income Distribution Shift"
          subtitle="Full population distribution from baseline to midline"
          delay={0.15}
          tableData={[
            {
              Statistic: "Count",
              Baseline: distributionData[0].values.length,
              Midline: distributionData[1].values.length,
            },
            {
              Statistic: "Median",
              Baseline: formatUSD(distributionData[0].values.sort((a, b) => a - b)[Math.floor(distributionData[0].values.length / 2)] ?? 0),
              Midline: formatUSD(distributionData[1].values.sort((a, b) => a - b)[Math.floor(distributionData[1].values.length / 2)] ?? 0),
            },
            {
              Statistic: "Mean",
              Baseline: formatUSD(distributionData[0].values.reduce((a, b) => a + b, 0) / (distributionData[0].values.length || 1)),
              Midline: formatUSD(distributionData[1].values.reduce((a, b) => a + b, 0) / (distributionData[1].values.length || 1)),
            },
          ]}
        >
          <DistributionShiftChart
            series={distributionData}
            height={240}
            xLabel="Net Income (USD)"
            xAxisFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            showMedians
            showShiftAnnotation
          />
          <MethodNote
            summary="Kernel Density Estimation (KDE) with Gaussian kernel and Silverman's bandwidth. Shows the full shape of the income distribution, not just summary statistics."
            details={[
              `Income values are filtered to the \u2212$5k to $20k range to exclude extreme outliers that distort the density curve.`,
              "Vertical dashed lines mark the median of each distribution. The horizontal shift annotation shows the change in median income between rounds.",
            ]}
            caveats={[
              `KDE bandwidth selection (Silverman\u2019s rule) may over-smooth multi-modal distributions or under-smooth sparse tails.`,
              `This is a repeated cross-section comparison \u2014 not all the same individuals appear in both rounds. Panel attrition may shift the distribution shape.`,
              `Outlier filtering (\u2212$5k to $20k) excludes real extreme values; the true tails may be wider.`,
            ]}
          />
        </ChartContainer>
      )}

      {/* ── 8. Crop & Productivity Snapshot — "What's driving income?" ── */}
      {cropIncomeDumbbell.length > 0 && (
        <div className="space-y-2">
          <h3
            className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Crop & Productivity Snapshot
          </h3>

          {/* 8a. Crop Income Dumbbell */}
          <ChartContainer
            title="Avg Net Income by Crop"
            subtitle="Baseline \u2192 Midline"
            tableData={cropSummary.map((c) => ({
              Crop: c.name,
              Baseline: formatUSD(c.baseline),
              Midline: formatUSD(c.midline),
              Change: formatUSD(c.midline - c.baseline),
              "B Growers": c.bGrowers,
              "M Growers": c.mGrowers,
            }))}
          >
            <DumbbellChart
              rows={cropIncomeDumbbell}
              formatter={(v) => formatUSD(v)}
              height={cropIncomeDumbbell.length * 44 + 24}
            />
          </ChartContainer>

          {/* 8b. Productivity Index by Group */}
          <ChartContainer
            title="Productivity Index by Group"
            subtitle="Higher is better"
            tableData={productivityDumbbell.map((d) => ({
              Group: d.label,
              Baseline: d.baseline.toFixed(2),
              Midline: d.midline.toFixed(2),
              Change: (d.midline - d.baseline).toFixed(2),
            }))}
          >
            <DumbbellChart
              rows={productivityDumbbell}
              formatter={(v) => v.toFixed(2)}
              height={160}
            />
          </ChartContainer>
        </div>
      )}

      {/* ── 9. Change Heatmap — "Comprehensive metric view" ── */}
      <ChartContainer
        title="Change Heatmap \u2014 All Metrics"
        subtitle="Colour intensity encodes magnitude of baseline \u2192 midline shift"
        tableData={heatmapCells.map((c) => ({
          Metric: c.label,
          Group: c.group,
          Baseline: c.format === "currency" ? formatUSD(c.baselineValue) : c.format === "percent" ? formatPercent(c.baselineValue) : c.baselineValue.toFixed(2),
          Midline: c.format === "currency" ? formatUSD(c.midlineValue) : c.format === "percent" ? formatPercent(c.midlineValue) : c.midlineValue.toFixed(2),
          Change: c.format === "currency" ? formatUSD(c.absoluteChange) : c.format === "percent" ? formatPercent(c.absoluteChange) : c.absoluteChange.toFixed(2),
          "% Change": `${c.percentChange > 0 ? "+" : ""}${c.percentChange.toFixed(1)}%`,
        }))}
      >
        <MetricHeatmap cells={heatmapCells} />
        <MethodNote
          summary="Unadjusted pre-post comparison per project group. Colour maps direction (green = improvement, red = decline) and intensity maps magnitude relative to the largest change observed."
          caveats={[
            `Does not control for confounders or secular trends \u2014 refer to the Treatment Effects cards above for causal estimates.`,
            `Percentage-point and absolute changes are shown; interpret magnitudes in context of each metric\u2019s scale.`,
          ]}
        />
      </ChartContainer>

      {/* ── 10. KPI Trajectories (Slope) — "All KPIs at a glance" ── */}
      {slopeData.length > 0 && (
        <ChartContainer
          title="KPI Trajectories \u2014 Slope View"
          subtitle="Direction and magnitude of change across all indicators"
          delay={0.2}
          tableData={slopeData.map((d) => ({
            Metric: d.label,
            Baseline: d.formatter(d.start),
            Midline: d.formatter(d.end),
            "Change (%)": `${d.start !== 0 ? (((d.end - d.start) / Math.abs(d.start)) * 100 > 0 ? "+" : "") + (((d.end - d.start) / Math.abs(d.start)) * 100).toFixed(1) + "%" : "\u2014"}`,
          }))}
        >
          <SlopeChart
            rows={slopeData}
            startLabel="Baseline"
            endLabel="Midline"
            highlightTopN={4}
          />
          <MethodNote
            summary={`Descriptive: unadjusted aggregate values at each time point. Percentage change = (midline \u2212 baseline) / |baseline|. Metrics are ranked by absolute % change.`}
            caveats={[
              `These are population-level descriptive statistics, not causal estimates \u2014 refer to the Treatment Effects cards for impact attribution.`,
            ]}
          />
        </ChartContainer>
      )}

      {/* ── 11. Income Change Drivers — "What drove the changes?" ── */}
      {driverChartData.length > 0 && (
        <ChartContainer
          title="Income Change Drivers"
          subtitle="Factors most changed between rounds"
          delay={0.25}
          tableData={driverChartData.map((d) => ({
            Factor: d.name,
            "Change (%)": `${d.change > 0 ? "+" : ""}${d.change}%`,
          }))}
        >
          <BarChartComponent
            data={driverChartData}
            dataKey="change"
            nameKey="name"
            layout="vertical"
            color="#00A17D"
            height={driverChartData.length * 32 + 40}
            tooltipTitle="Factor Change"
            tooltipUnit="%"
          />
          <MethodNote
            summary="Descriptive decomposition: factors ranked by absolute magnitude of change between rounds. Shows which input variables shifted most, not causal attribution."
            caveats={[
              `Correlation-based ranking \u2014 does not establish which factors caused income changes.`,
              "Factors may be collinear (e.g., training access and adoption rates move together).",
            ]}
          />
        </ChartContainer>
      )}
    </div>
  );
}
