"use client";

import { useMemo, useState } from "react";
import ChartContainer from "@/components/ui/ChartContainer";
import type { TableRow } from "@/components/ui/ChartContainer";
import KPICard from "@/components/ui/KPICard";
import BarChartComponent from "@/components/charts/BarChartComponent";
import ScatterPlotChart from "@/components/charts/ScatterPlotChart";
import RadarChartComponent from "@/components/charts/RadarChartComponent";
import BentoGrid from "@/components/layout/BentoGrid";
import { DollarSign, TrendingUp, BarChart3, Wheat } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { mean, median } from "@/lib/utils/statistics";
import { formatUSD, formatNumber } from "@/lib/utils/formatters";
import { CROP_COLORS, CROP_NAMES, CROPS } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
const CROP_INCOME_KEYS: Record<string, keyof Farmer> = {
  mint: "mintNetIncome",
  rice: "riceNetIncome",
  potato: "potatoNetIncome",
  wheat: "wheatNetIncome",
  mustard: "mustardNetIncome",
};

export default function CropsSection({ data }: { data: Farmer[] }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [activeCrop, setActiveCrop] = useState<string>("mint");

  // Crop KPIs
  const cropKpis = useMemo(() => {
    const key = CROP_INCOME_KEYS[activeCrop];
    const growers = data.filter((f) => {
      const v = f[key] as number | null;
      return v != null && v > 0;
    });
    const incomes = growers.map((f) => f[key] as number);

    return {
      growers: growers.length,
      avgIncome: incomes.length ? mean(incomes) : 0,
      medianIncome: incomes.length ? median(incomes) : 0,
      shareOfFarmers: data.length ? (growers.length / data.length) * 100 : 0,
    };
  }, [data, activeCrop]);

  // Income distribution histogram for active crop
  const yieldDistribution = useMemo(() => {
    const key = CROP_INCOME_KEYS[activeCrop];
    const vals = data
      .map((f) => f[key] as number | null)
      .filter((v): v is number => v != null && v > 0);
    const bins = [
      { range: "< $50", min: 0, max: 50, count: 0 },
      { range: "$50-200", min: 50, max: 200, count: 0 },
      { range: "$200-500", min: 200, max: 500, count: 0 },
      { range: "$500-1K", min: 500, max: 1000, count: 0 },
      { range: "$1K-2K", min: 1000, max: 2000, count: 0 },
      { range: "$2K+", min: 2000, max: Infinity, count: 0 },
    ];
    for (const v of vals) {
      for (const bin of bins) {
        if (v >= bin.min && v < bin.max) {
          bin.count++;
          break;
        }
      }
    }
    return bins.map((b) => ({ name: b.range, count: b.count }));
  }, [data, activeCrop]);

  // Income vs Expenses scatter (random sample if > 500)
  const { scatterData, scatterTotal } = useMemo(() => {
    const eligible = data
      .filter((f) => f.totalIncomeUsd != null && f.totalExpensesUsd != null && f.totalIncomeUsd > 0);
    const total = eligible.length;
    // Random sample if too many points
    let sampled = eligible;
    if (eligible.length > 500) {
      const shuffled = [...eligible];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      sampled = shuffled.slice(0, 500);
    }
    return {
      scatterData: sampled.map((f) => ({
        x: f.totalExpensesUsd!,
        y: f.totalIncomeUsd!,
        name: isAdmin ? f.name : "Farmer",
        color: CROP_COLORS[activeCrop],
      })),
      scatterTotal: total,
    };
  }, [data, activeCrop, isAdmin]);

  // Radar comparison across all 5 crops
  const radarData = useMemo(() => {
    // Pre-compute avg incomes per crop for data-driven normalization
    const cropAvgs: Record<string, number> = {};
    for (const crop of CROPS) {
      const key = CROP_INCOME_KEYS[crop];
      const incomes = data
        .filter((f) => { const v = f[key] as number | null; return v != null && v > 0; })
        .map((f) => f[key] as number);
      cropAvgs[crop] = incomes.length ? mean(incomes) : 0;
    }
    const maxAvgIncome = Math.max(...Object.values(cropAvgs), 1);

    const metrics = ["Growers", "Avg Income", "Avg Profit %", "Participation %"];
    return metrics.map((metric) => {
      const row: { subject: string; [key: string]: number | string } = { subject: metric };
      for (const crop of CROPS) {
        const key = CROP_INCOME_KEYS[crop];
        const growers = data.filter((f) => {
          const v = f[key] as number | null;
          return v != null && v > 0;
        });
        const incomes = growers.map((f) => f[key] as number);

        if (metric === "Growers") {
          row[crop] = growers.length;
        } else if (metric === "Avg Income") {
          row[crop] = incomes.length ? Math.round(mean(incomes)) : 0;
        } else if (metric === "Avg Profit %") {
          // Normalized: ratio of avg income to max crop avg income
          row[crop] = cropAvgs[crop] > 0 ? Math.min(100, (cropAvgs[crop] / maxAvgIncome) * 100) : 0;
        } else if (metric === "Participation %") {
          row[crop] = data.length ? (growers.length / data.length) * 100 : 0;
        }
      }
      return row;
    });
  }, [data]);

  const radarDataKeys = CROPS.map((crop) => ({
    key: crop,
    color: CROP_COLORS[crop],
    label: CROP_NAMES[crop],
  }));

  // Table data for charts
  const distTableData: TableRow[] = useMemo(
    () => yieldDistribution.map((d) => ({ "Income Range": d.name, Farmers: d.count })),
    [yieldDistribution]
  );
  const scatterTableData: TableRow[] = useMemo(
    () => isAdmin
      ? scatterData.slice(0, 50).map((d) => ({ Farmer: d.name || "—", "Expenses ($)": Math.round(d.x), "Income ($)": Math.round(d.y) }))
      : scatterData.slice(0, 50).map((d, i) => ({ "#": i + 1, "Expenses ($)": Math.round(d.x), "Income ($)": Math.round(d.y) })),
    [scatterData, isAdmin]
  );
  const radarTableData: TableRow[] = useMemo(
    () => radarData.map((d) => {
      const row: TableRow = { Metric: d.subject as string };
      for (const crop of CROPS) row[CROP_NAMES[crop]] = typeof d[crop] === "number" ? Math.round(d[crop] as number) : d[crop];
      return row;
    }),
    [radarData]
  );

  if (!data.length) {
    return <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">No data for this selection.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Crop selector tabs */}
      <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Crop selector">
        {CROPS.map((crop) => {
          const isActive = activeCrop === crop;
          // Use dark text on light/warm backgrounds for contrast
          const needsDarkText = ["rice", "wheat"].includes(crop);
          const activeText = needsDarkText ? "#1A0E2E" : "#fff";
          const activeDot = needsDarkText ? "#1A0E2E" : "#fff";
          return (
            <button
              key={crop}
              onClick={() => setActiveCrop(crop)}
              role="tab"
              aria-selected={isActive}
              aria-label={CROP_NAMES[crop]}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "border border-transparent"
                  : "text-[var(--text-tertiary)] border border-[var(--card-border)] hover:text-[var(--text-secondary)] hover:border-[var(--card-border-hover)]"
              }`}
              style={{
                backgroundColor: isActive ? CROP_COLORS[crop] : "transparent",
                color: isActive ? activeText : undefined,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: !isActive ? CROP_COLORS[crop] : activeDot }}
                aria-hidden="true"
              />
              {CROP_NAMES[crop]}
            </button>
          );
        })}
      </div>

      {/* KPI cards for selected crop */}
      <BentoGrid cols={2}>
        <KPICard
          label={`${CROP_NAMES[activeCrop]} Growers`}
          value={cropKpis.growers}
          formatter={formatNumber}
          icon={<Wheat size={16} />}
          accent={CROP_COLORS[activeCrop]}
        />
        <KPICard
          label="Avg Net Income"
          value={cropKpis.avgIncome}
          formatter={formatUSD}
          icon={<DollarSign size={16} />}
          accent={CROP_COLORS[activeCrop]}
        />
        <KPICard
          label="Median Income"
          value={cropKpis.medianIncome}
          formatter={formatUSD}
          icon={<TrendingUp size={16} />}
          accent={CROP_COLORS[activeCrop]}
        />
        <KPICard
          label="Farmer Share"
          value={cropKpis.shareOfFarmers}
          formatter={(n) => `${n.toFixed(1)}%`}
          icon={<BarChart3 size={16} />}
          accent={CROP_COLORS[activeCrop]}
        />
      </BentoGrid>

      {/* Charts — only render charts that have meaningful data */}
      <div className="grid gap-3 grid-cols-1">
        {yieldDistribution.some((d) => d.count > 0) && (
          <ChartContainer
            title={`${CROP_NAMES[activeCrop]} Income Distribution`}
            subtitle="Net income per farmer"
            tableData={distTableData}
          >
            <BarChartComponent
              data={yieldDistribution}
              dataKey="count"
              nameKey="name"
              color={CROP_COLORS[activeCrop]}
              height={160}
              tooltipTitle={`${CROP_NAMES[activeCrop]} Distribution`}
              tooltipUnit="farmers"
            />
          </ChartContainer>
        )}

        {scatterData.length > 0 && (
          <ChartContainer
            title="Income vs Expenses"
            subtitle={`${CROP_NAMES[activeCrop]} growers${scatterTotal > 500 ? ` (random sample of 500 / ${scatterTotal.toLocaleString()})` : ""}`}
            tableData={scatterTableData}
          >
            <ScatterPlotChart
              data={scatterData}
              xLabel="Expenses (USD)"
              yLabel="Income (USD)"
              height={160}
              tooltipTitle={`${CROP_NAMES[activeCrop]} Economics`}
            />
          </ChartContainer>
        )}

        <ChartContainer
          title="5-Crop Comparison"
          subtitle="Radar across all metrics"
          tableData={radarTableData}
        >
          <RadarChartComponent
            data={radarData}
            dataKeys={radarDataKeys}
            height={160}
            tooltipTitle="Crop Comparison"
          />
        </ChartContainer>
      </div>
    </div>
  );
}
