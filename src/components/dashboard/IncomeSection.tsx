"use client";

import { useMemo } from "react";
import ChartContainer from "@/components/ui/ChartContainer";
import type { TableRow } from "@/components/ui/ChartContainer";
import InsightsPanel from "@/components/ui/InsightsPanel";
import BarChartComponent from "@/components/charts/BarChartComponent";
import LineChartComponent from "@/components/charts/LineChartComponent";
import type { LineSeries } from "@/components/charts/LineChartComponent";
import BentoGrid from "@/components/layout/BentoGrid";
import BentoCard from "@/components/layout/BentoCard";
import { mean } from "@/lib/utils/statistics";
import { formatUSD } from "@/lib/utils/formatters";
import { generateInsights } from "@/lib/utils/insights";
import { PROJECT_COLORS, PROJECT_SHORT, CROP_COLORS, WB_EXTREME_POVERTY_PC, WB_MODERATE_POVERTY_PC } from "@/lib/data/constants";
export default function IncomeSection({ data }: { data: import("@/lib/data/types").Farmer[] }) {
  const insights = useMemo(() => generateInsights(data), [data]);

  const incomeDistribution = useMemo(() => {
    const bins = [
      { range: "< $0", min: -Infinity, max: 0, count: 0 },
      { range: "$0-200", min: 0, max: 200, count: 0 },
      { range: "$200-500", min: 200, max: 500, count: 0 },
      { range: "$500-1K", min: 500, max: 1000, count: 0 },
      { range: "$1K-2K", min: 1000, max: 2000, count: 0 },
      { range: "$2K-5K", min: 2000, max: 5000, count: 0 },
      { range: "$5K+", min: 5000, max: Infinity, count: 0 },
    ];
    for (const f of data) {
      const income = f.totalNetIncomeUsd;
      if (income == null) continue;
      for (const bin of bins) {
        if (income >= bin.min && income < bin.max) {
          bin.count++;
          break;
        }
      }
    }
    return bins.map((b) => ({ name: b.range, count: b.count }));
  }, [data]);

  const cropDonutData = useMemo(() => {
    const crops = [
      { key: "mintNetIncome", name: "Mint", color: CROP_COLORS.mint },
      { key: "riceNetIncome", name: "Rice", color: CROP_COLORS.rice },
      { key: "potatoNetIncome", name: "Potato", color: CROP_COLORS.potato },
      { key: "wheatNetIncome", name: "Wheat", color: CROP_COLORS.wheat },
      { key: "mustardNetIncome", name: "Mustard", color: CROP_COLORS.mustard },
    ];
    return crops.map((c) => ({
      name: c.name,
      value: data.filter((f) => {
        const val = f[c.key as keyof typeof f] as number | null;
        return val != null && val > 0;
      }).length,
      color: c.color,
    }));
  }, [data]);

  const incomeLineData = useMemo(() => {
    const crops = ["Mint", "Rice", "Potato", "Wheat", "Mustard"] as const;
    const cropKeys = {
      Mint: "mintNetIncome",
      Rice: "riceNetIncome",
      Potato: "potatoNetIncome",
      Wheat: "wheatNetIncome",
      Mustard: "mustardNetIncome",
    } as const;

    const maleFarmers = data.filter((f) => f.gender === "Male");
    const femaleFarmers = data.filter((f) => f.gender === "Female");
    const povertyLine = WB_EXTREME_POVERTY_PC;
    const moderatePovertyLine = WB_MODERATE_POVERTY_PC;

    return crops.map((crop) => {
      const key = cropKeys[crop] as keyof typeof data[0];
      const allWithCrop = data.filter((f) => {
        const v = f[key] as number | null;
        return v != null && v > 0;
      });
      const maleWithCrop = maleFarmers.filter((f) => {
        const v = f[key] as number | null;
        return v != null && v > 0;
      });
      const femaleWithCrop = femaleFarmers.filter((f) => {
        const v = f[key] as number | null;
        return v != null && v > 0;
      });

      return {
        crop,
        all: Math.round(mean(allWithCrop.map((f) => f[key] as number))),
        male: Math.round(mean(maleWithCrop.map((f) => f[key] as number))),
        female: Math.round(mean(femaleWithCrop.map((f) => f[key] as number))),
        povertyLine,
        moderatePovertyLine,
      };
    });
  }, [data]);

  const lineSeries: LineSeries[] = [
    { key: "all", label: "All Farmers", color: "var(--color-accent)" },
    { key: "male", label: "Male Farmers", color: "#007BFF" },
    { key: "female", label: "Female Farmers", color: "#8ECAE6" },
    { key: "povertyLine", label: "WB Extreme Poverty ($785/yr PC)", color: "var(--color-negative)", dashed: true },
    { key: "moderatePovertyLine", label: "WB Moderate Poverty ($1,332/yr PC)", color: "#FB8500", dashed: true },
  ];

  // Table data for each chart
  const distTableData: TableRow[] = useMemo(
    () => incomeDistribution.map((d) => ({ "Income Range": d.name, Farmers: d.count })),
    [incomeDistribution]
  );
  const cropTableData: TableRow[] = useMemo(
    () => cropDonutData.map((d) => ({ Crop: d.name, "Active Farmers": d.value })),
    [cropDonutData]
  );
  const lineTableData: TableRow[] = useMemo(
    () => incomeLineData.map((d) => ({
      Crop: d.crop,
      "All Avg ($)": d.all,
      "Male Avg ($)": d.male,
      "Female Avg ($)": d.female,
    })),
    [incomeLineData]
  );

  const projectCards = useMemo(() => {
    const groups = new Map<string, { count: number; incomes: number[] }>();
    for (const f of data) {
      if (!f.project) continue;
      const g = groups.get(f.project) || { count: 0, incomes: [] };
      g.count++;
      if (f.totalNetIncomeUsd != null) g.incomes.push(f.totalNetIncomeUsd);
      groups.set(f.project, g);
    }
    return Array.from(groups.entries())
      .map(([project, g]) => ({
        project,
        count: g.count,
        avgIncome: mean(g.incomes),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (!data.length) {
    return <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">No data for this selection.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Charts */}
      <div className="grid gap-3 grid-cols-1">
        <ChartContainer title="Income Distribution" subtitle="Net income per household" tableData={distTableData}>
          <BarChartComponent
            data={incomeDistribution}
            dataKey="count"
            nameKey="name"
            color="var(--color-accent)"
            height={160}
            tooltipTitle="Income Distribution"
            tooltipUnit="farmers"
          />
        </ChartContainer>

        <ChartContainer title="Crop Participation" subtitle="Active farmers by crop" tableData={cropTableData}>
          <BarChartComponent
            data={cropDonutData.map((d) => ({ name: d.name, count: d.value }))}
            dataKey="count"
            nameKey="name"
            colors={cropDonutData.map((d) => d.color)}
            layout="vertical"
            height={160}
            tooltipTitle="Crop Participation"
            tooltipUnit="farmers"
          />
        </ChartContainer>

        <ChartContainer title="Avg Income by Crop & Gender" subtitle="Click legend to isolate series" tableData={lineTableData}>
          <LineChartComponent
            data={incomeLineData}
            series={lineSeries}
            xKey="crop"
            height={160}
            tooltipTitle="Income by Crop"
            formatMap={{
              all: (v) => `$${v.toLocaleString()}`,
              male: (v) => `$${v.toLocaleString()}`,
              female: (v) => `$${v.toLocaleString()}`,
              povertyLine: (v) => `$${v.toLocaleString()}`,
              moderatePovertyLine: (v) => `$${v.toLocaleString()}`,
            }}
          />
        </ChartContainer>
      </div>

      {/* Insights + Segments */}
      <div className="grid gap-3 grid-cols-1">
        <BentoCard delay={0.1}>
          <InsightsPanel insights={insights} />
        </BentoCard>
        <BentoCard delay={0.15}>
          <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Project Group Breakdown</h3>
          <div className="space-y-2">
            {projectCards.map((pg) => (
              <div
                key={pg.project}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    background: (PROJECT_COLORS as Record<string, string>)[pg.project] || "#666",
                  }}
                />
                <span className="text-xs font-mono font-medium flex-1">
                  {(PROJECT_SHORT as Record<string, string>)[pg.project] || pg.project}
                </span>
                <span className="text-xs font-mono">{pg.count}</span>
                <span className="text-xs text-[var(--text-tertiary)] w-20 text-right">
                  {formatUSD(pg.avgIncome)}
                </span>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
