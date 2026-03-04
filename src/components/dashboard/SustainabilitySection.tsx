"use client";

import { useMemo } from "react";
import ChartContainer from "@/components/ui/ChartContainer";
import type { TableRow } from "@/components/ui/ChartContainer";
import KPICard from "@/components/ui/KPICard";
import BarChartComponent from "@/components/charts/BarChartComponent";
import ScatterPlotChart from "@/components/charts/ScatterPlotChart";
import BentoGrid from "@/components/layout/BentoGrid";
import { Leaf, Zap, Bug, TreePine } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { mean } from "@/lib/utils/statistics";
import { PROJECT_COLORS, PROJECT_SHORT } from "@/lib/data/constants";

export default function SustainabilitySection({ data }: { data: import("@/lib/data/types").Farmer[] }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  // Filter data to only farmers with sustainability data
  const susData = useMemo(() => data.filter((f) => f.soilCarbon != null), [data]);

  // KPIs
  const kpis = useMemo(() => {
    if (!susData.length) return null;
    const soilCarbon = mean(
      susData.filter((f) => f.soilCarbon != null).map((f) => f.soilCarbon!)
    );
    const electricity = mean(
      susData.filter((f) => f.electricity != null).map((f) => f.electricity!)
    );
    const pesticide = mean(
      susData.filter((f) => f.pesticide != null).map((f) => f.pesticide!)
    );
    const treeCarbon = mean(
      susData.filter((f) => f.carbonFromTrees != null).map((f) => f.carbonFromTrees!)
    );
    return { soilCarbon, electricity, pesticide, treeCarbon };
  }, [susData]);

  // Carbon sources stacked bar (average per source)
  const carbonSources = useMemo(() => {
    const sources = [
      { name: "Soil", key: "soilCarbon" as const, color: "var(--color-accent)" },
      { name: "Electricity", key: "electricity" as const, color: "#FFB703" },
      { name: "Pesticide", key: "pesticide" as const, color: "var(--color-negative)" },
      { name: "Transport", key: "transportation" as const, color: "#007BFF" },
      { name: "Misc", key: "miscActivities" as const, color: "#6F42C1" },
      { name: "Trees (offset)", key: "carbonFromTrees" as const, color: "#00CCCC" },
      { name: "Household", key: "carbonFromHousehold" as const, color: "#219EBC" },
    ];
    return sources.map((s) => {
      const vals = susData
        .map((f) => f[s.key] as number | null)
        .filter((v): v is number => v != null);
      return {
        name: s.name,
        value: vals.length ? Math.round(mean(vals) * 100) / 100 : 0,
        color: s.color,
      };
    });
  }, [susData]);

  // Carbon vs Income scatter (random sample if > 500)
  const { carbonScatter, carbonScatterTotal } = useMemo(() => {
    const eligible = susData.filter(
      (f) =>
        f.soilCarbon != null &&
        f.totalNetIncomeUsd != null &&
        f.totalNetIncomeUsd > 0
    );
    const total = eligible.length;
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
      carbonScatter: sampled.map((f) => ({
        x: f.soilCarbon!,
        y: f.totalNetIncomeUsd!,
        name: isAdmin ? f.name : "Farmer",
        color: f.project
          ? (PROJECT_COLORS as Record<string, string>)[f.project] || "#17A2B8"
          : "#17A2B8",
      })),
      carbonScatterTotal: total,
    };
  }, [susData, isAdmin]);

  // Sustainability by project group comparison
  const groupSustainability = useMemo(() => {
    const groups = new Map<string, { carbon: number[]; trees: number[] }>();
    for (const f of susData) {
      if (!f.project) continue;
      const g = groups.get(f.project) || { carbon: [], trees: [] };
      if (f.soilCarbon != null) g.carbon.push(f.soilCarbon);
      if (f.carbonFromTrees != null) g.trees.push(f.carbonFromTrees);
      groups.set(f.project, g);
    }
    return Array.from(groups.entries())
      .map(([project, g]) => ({
        name: (PROJECT_SHORT as Record<string, string>)[project] || project,
        avgCarbon: g.carbon.length ? Math.round(mean(g.carbon) * 100) / 100 : 0,
        treeOffset: g.trees.length ? Math.round(mean(g.trees) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.avgCarbon - a.avgCarbon);
  }, [susData]);

  // Table data for charts
  const sourceTableData: TableRow[] = useMemo(
    () => carbonSources.map((d) => ({ Source: d.name, "Avg tCO₂e": d.value })),
    [carbonSources]
  );
  const scatterTableData: TableRow[] = useMemo(
    () => isAdmin
      ? carbonScatter.slice(0, 50).map((d) => ({ Farmer: d.name || "—", "Soil Carbon (tCO₂e)": d.x.toFixed(2), "Income ($)": Math.round(d.y) }))
      : carbonScatter.slice(0, 50).map((d, i) => ({ "#": i + 1, "Soil Carbon (tCO₂e)": d.x.toFixed(2), "Income ($)": Math.round(d.y) })),
    [carbonScatter, isAdmin]
  );
  const segTableData: TableRow[] = useMemo(
    () => groupSustainability.map((d) => ({ "Project Group": d.name, "Avg Carbon (tCO₂e)": d.avgCarbon, "Tree Offset (tCO₂e)": d.treeOffset })),
    [groupSustainability]
  );

  if (!data.length) {
    return <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">No data for this selection.</p>;
  }

  if (!susData.length || !kpis) {
    return <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">No sustainability data available for the selected farmers. Carbon and emissions data is collected for a subset of the population.</p>;
  }

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <BentoGrid cols={2}>
        <KPICard
          label="Avg Soil Carbon"
          value={kpis.soilCarbon}
          formatter={(n) => `${n.toFixed(2)} t`}
          icon={<Leaf size={16} />}
          accent="var(--color-accent)"
        />
        <KPICard
          label="Avg Electricity"
          value={kpis.electricity}
          formatter={(n) => `${n.toFixed(2)} t`}
          icon={<Zap size={16} />}
          accent="#FFB703"
        />
        <KPICard
          label="Avg Pesticide"
          value={kpis.pesticide}
          formatter={(n) => `${n.toFixed(2)} t`}
          icon={<Bug size={16} />}
          accent="var(--color-negative)"
        />
        <KPICard
          label="Tree Carbon Offset"
          value={kpis.treeCarbon}
          formatter={(n) => `${n.toFixed(2)} t`}
          icon={<TreePine size={16} />}
          accent="#00CCCC"
        />
      </BentoGrid>

      {/* Charts — only render charts that have meaningful data */}
      <div className="grid gap-3 grid-cols-1">
        {carbonSources.some((d) => d.value > 0) && (
          <ChartContainer
            title="Carbon Sources"
            subtitle="Average emissions by source (tCO₂e)"
            tableData={sourceTableData}
          >
            <BarChartComponent
              data={carbonSources}
              dataKey="value"
              nameKey="name"
              layout="vertical"
              color="var(--color-accent)"
              height={160}
              tooltipTitle="Carbon Sources"
              tooltipFormatter={(v) => `${v.toFixed(2)} tCO₂e`}
            />
          </ChartContainer>
        )}

        {carbonScatter.length > 0 && (
          <ChartContainer
            title="Carbon vs Income"
            subtitle={`Soil carbon emissions vs net income${carbonScatterTotal > 500 ? ` (sample of 500 / ${carbonScatterTotal.toLocaleString()})` : ""}`}
            tableData={scatterTableData}
          >
            <ScatterPlotChart
              data={carbonScatter}
              xLabel="Soil Carbon (tCO₂e)"
              yLabel="Net Income (USD)"
              height={160}
              tooltipTitle="Carbon-Income Relationship"
            />
          </ChartContainer>
        )}

        {groupSustainability.some((d) => d.avgCarbon > 0) && (
          <ChartContainer
            title="Sustainability by Project Group"
            subtitle="Average carbon by project group"
            tableData={segTableData}
          >
            <BarChartComponent
              data={groupSustainability}
              dataKey="avgCarbon"
              nameKey="name"
              layout="vertical"
              color="#00CCCC"
              height={200}
              yAxisWidth={80}
              tooltipTitle="Project Group Sustainability"
              tooltipFormatter={(v) => `${v.toFixed(2)} tCO₂e`}
            />
          </ChartContainer>
        )}
      </div>

      {/* Methodology note */}
      <div
        className="p-3 rounded-xl text-xs leading-relaxed text-[var(--text-tertiary)]"
        style={{ background: "var(--card-bg-hover)", border: "1px solid var(--card-border)" }}
      >
        <div className="font-semibold text-[var(--text-secondary)] mb-1 text-xs">
          Methodology Note
        </div>
        <p>
          Carbon emissions are estimated using activity-based emission factors scaled to farm size (acres) and household size, aligned with{" "}
          <span className="font-medium text-[var(--text-secondary)]">IPCC 2006 Tier 1</span>{" "}
          guidelines for national greenhouse gas inventories in the agriculture sector.
        </p>
        <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
          <li><span className="font-medium text-[var(--text-secondary)]">Soil carbon:</span> Tillage and fertilizer application factors (10{"\u2013"}15 tCO{"\u2082"}e/acre/yr)</li>
          <li><span className="font-medium text-[var(--text-secondary)]">Transport & electricity:</span> Regional averages for smallholder agriculture in South Asia</li>
          <li><span className="font-medium text-[var(--text-secondary)]">Pesticide & misc:</span> Input-proportional emission factors per acre</li>
          <li><span className="font-medium text-[var(--text-secondary)]">Household:</span> Per-capita domestic emissions (1{"\u2013"}3 tCO{"\u2082"}e/member/yr)</li>
          <li><span className="font-medium text-[var(--text-secondary)]">Tree offset:</span> Agroforestry sequestration rates (10{"\u2013"}35 tCO{"\u2082"}e/acre/yr) from published literature</li>
        </ul>
        <p className="mt-1.5">
          All values are reported in tonnes of CO{"\u2082"} equivalent (tCO{"\u2082"}e) per year. Emission factors are consistent with IPCC default values for tropical/subtropical agriculture and may be refined with site-specific measurements.
        </p>
      </div>
    </div>
  );
}
