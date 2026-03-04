"use client";

import { useMemo } from "react";
import type { Farmer, ProjectGroup } from "@/lib/data/types";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { formatNumber } from "@/lib/utils/formatters";
import { PROJECT_COLORS } from "@/lib/data/constants";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import DumbbellChart from "@/components/charts/DumbbellChart";
import ChartContainer from "@/components/ui/ChartContainer";
import BarChartComponent from "@/components/charts/BarChartComponent";
import MethodNote from "@/components/ui/MethodNote";

interface SustainabilityComparativeProps {
  data: Farmer[];
  projectFilter?: string;
}

const ALL_GROUPS: ProjectGroup[] = ["T-1", "T-2", "Control"];
const TREATMENT_GROUPS: ProjectGroup[] = ["T-1", "T-2"];

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function getAvg(farmers: Farmer[], key: keyof Farmer): number {
  const vals = farmers.map((f) => f[key] as number).filter((v) => v != null && isFinite(v));
  return avg(vals);
}

/* Correct field names from Farmer type */
const CARBON_SOURCES = [
  { key: "soilCarbon" as keyof Farmer, label: "Soil Carbon", higherIsBetter: false },
  { key: "pesticide" as keyof Farmer, label: "Pesticide", higherIsBetter: false },
  { key: "electricity" as keyof Farmer, label: "Electricity", higherIsBetter: false },
  { key: "transportation" as keyof Farmer, label: "Transportation", higherIsBetter: false },
  { key: "miscActivities" as keyof Farmer, label: "Misc Activities", higherIsBetter: false },
  { key: "carbonFromTrees" as keyof Farmer, label: "Tree Carbon Offset", higherIsBetter: true },
  { key: "carbonFromHousehold" as keyof Farmer, label: "Household Carbon", higherIsBetter: false },
];

export default function SustainabilityComparative({ data, projectFilter }: SustainabilityComparativeProps) {
  const { getRound } = useData();
  const { geoFilterRound } = useGeo();

  /* All farmers — for by-group comparisons */
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

  // KPIs for all carbon sources — project-filtered
  const susKPIs = useMemo(() => {
    return CARBON_SOURCES.map((src) => {
      const bVal = getAvg(bFiltered, src.key);
      const mVal = getAvg(mFiltered, src.key);
      return { ...src, baseline: bVal, midline: mVal };
    }).filter((k) => k.baseline > 0 || k.midline > 0);
  }, [bFiltered, mFiltered]);

  // Net carbon footprint (emissions - offsets) — project-filtered
  const netCarbon = useMemo(() => {
    const emissionKeys: (keyof Farmer)[] = ["soilCarbon", "pesticide", "electricity", "transportation", "miscActivities", "carbonFromHousehold"];
    const offsetKeys: (keyof Farmer)[] = ["carbonFromTrees"];
    const calcNet = (farmers: Farmer[]) => {
      const emissions = emissionKeys.reduce((sum, k) => sum + getAvg(farmers, k), 0);
      const offsets = offsetKeys.reduce((sum, k) => sum + getAvg(farmers, k), 0);
      return emissions - offsets;
    };
    return { baseline: calcNet(bFiltered), midline: calcNet(mFiltered) };
  }, [bFiltered, mFiltered]);

  // Carbon sources comparison table
  const carbonCompare = useMemo(() => {
    return susKPIs.map((k) => ({
      name: k.label,
      Baseline: +k.baseline.toFixed(2),
      Midline: +k.midline.toFixed(2),
      Change: +(k.midline - k.baseline).toFixed(2),
    }));
  }, [susKPIs]);

  /* Control = counterfactual — exclude from treatment-focused group comparisons */
  const visibleGroups = useMemo((): ProjectGroup[] => {
    if (!projectFilter || projectFilter === "all") return TREATMENT_GROUPS;
    return [projectFilter as ProjectGroup];
  }, [projectFilter]);

  // Per-group carbon footprint dumbbell (net emissions)
  const netCarbonByGroup = useMemo(() => {
    const emissionKeys: (keyof Farmer)[] = ["soilCarbon", "pesticide", "electricity", "transportation", "miscActivities", "carbonFromHousehold"];
    const offsetKeys: (keyof Farmer)[] = ["carbonFromTrees"];
    return visibleGroups.map((g) => {
      const bGroup = baselineFarmers.filter((f) => f.project === g);
      const mGroup = midlineFarmers.filter((f) => f.project === g);
      const bNet = emissionKeys.reduce((s, k) => s + getAvg(bGroup, k), 0) - offsetKeys.reduce((s, k) => s + getAvg(bGroup, k), 0);
      const mNet = emissionKeys.reduce((s, k) => s + getAvg(mGroup, k), 0) - offsetKeys.reduce((s, k) => s + getAvg(mGroup, k), 0);
      return { label: g, baseline: bNet, midline: mNet, color: PROJECT_COLORS[g] };
    });
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Pesticide by group
  const pesticideDumbbell = useMemo(() => {
    return visibleGroups.map((g) => ({
      label: g,
      baseline: getAvg(baselineFarmers.filter((f) => f.project === g), "pesticide"),
      midline: getAvg(midlineFarmers.filter((f) => f.project === g), "pesticide"),
      color: PROJECT_COLORS[g],
    }));
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Tree carbon by group
  const treeDumbbell = useMemo(() => {
    return visibleGroups.map((g) => ({
      label: g,
      baseline: getAvg(baselineFarmers.filter((f) => f.project === g), "carbonFromTrees"),
      midline: getAvg(midlineFarmers.filter((f) => f.project === g), "carbonFromTrees"),
      color: PROJECT_COLORS[g],
    }));
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Electricity by group
  const electricityDumbbell = useMemo(() => {
    return visibleGroups.map((g) => ({
      label: g,
      baseline: getAvg(baselineFarmers.filter((f) => f.project === g), "electricity"),
      midline: getAvg(midlineFarmers.filter((f) => f.project === g), "electricity"),
      color: PROJECT_COLORS[g],
    }));
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  if (!baselineFarmers.length || !midlineFarmers.length) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
        Both baseline and midline data are required for sustainability comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Net Carbon KPI ── */}
      <div className="brand-card p-3 space-y-1.5">
        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          Net Carbon Footprint (Emissions − Offsets)
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-[var(--text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
            {formatNumber(netCarbon.midline, 2)} kg
          </span>
          <ChangeIndicator value={netCarbon.midline - netCarbon.baseline} format="number" higherIsBetter={false} />
        </div>
        <div className="text-[9px] text-[var(--text-tertiary)] font-mono">was {formatNumber(netCarbon.baseline, 2)} kg</div>
      </div>

      {/* ── 2. Net Carbon by Group — "How do treatment groups compare?" ── */}
      <ChartContainer title="Net Carbon by Group" subtitle="Emissions minus offsets \u2014 lower is better"
        tableData={netCarbonByGroup.map((d) => ({
          Group: d.label,
          "Baseline (kg)": formatNumber(d.baseline, 1),
          "Midline (kg)": formatNumber(d.midline, 1),
          "Change (kg)": formatNumber(d.midline - d.baseline, 1),
        }))}
      >
        <DumbbellChart rows={netCarbonByGroup} formatter={(v) => formatNumber(v, 1) + " kg"} height={160} />
        <MethodNote
          summary="Net carbon = total emissions (soil, pesticide, electricity, transport, misc, household) − tree carbon offsets. Avg kg CO₂e per farmer per year. Lower is better."
          details={[
            "Emission factors are model estimates based on self-reported activity data (e.g., fuel use, fertiliser rates).",
          ]}
          caveats={[
            "Groups are not randomly assigned — between-group differences may reflect baseline characteristics. See Overview for DiD.",
          ]}
        />
      </ChartContainer>

      {/* ── 3. Per-source KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {susKPIs.map((kpi) => (
          <div key={kpi.label} className="brand-card p-3 space-y-1.5">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {kpi.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold font-mono text-[var(--text-primary)]">
                {formatNumber(kpi.midline, 2)}
              </span>
              <ChangeIndicator value={kpi.midline - kpi.baseline} format="number" higherIsBetter={kpi.higherIsBetter} />
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)] font-mono">was {formatNumber(kpi.baseline, 2)}</div>
          </div>
        ))}
      </div>

      {/* ── 4. Carbon Sources Comparison ── */}
      <ChartContainer title="All Carbon Sources" subtitle="Avg per farmer (kg CO\u2082e)" tableData={carbonCompare}>
        <BarChartComponent data={carbonCompare} dataKey="Midline" nameKey="name" layout="vertical" color="#00A17D" height={carbonCompare.length * 28 + 40} tooltipTitle="Carbon" tooltipUnit=" kg" />
        <MethodNote
          summary="Per-source carbon contribution (avg kg CO₂e per farmer). Sources: soil carbon, pesticide, electricity, transportation, misc activities, household, and tree offsets."
          caveats={[
            "Emission factors are model estimates, not direct measurements. Self-reported activity data subject to recall bias.",
          ]}
        />
      </ChartContainer>

      {/* ── 5. Tree Carbon Offset by Group — positive impact first ── */}
      <ChartContainer title="Tree Carbon Offset by Group" subtitle="Higher is better"
        tableData={treeDumbbell.map((d) => ({
          Group: d.label,
          Baseline: formatNumber(d.baseline, 2),
          Midline: formatNumber(d.midline, 2),
          Change: formatNumber(d.midline - d.baseline, 2),
        }))}
      >
        <DumbbellChart rows={treeDumbbell} formatter={(v) => formatNumber(v, 2)} height={160} />
        <MethodNote
          summary="Tree carbon offset estimated from number, species, and age of trees reported by farmers. Higher = more carbon sequestered. Uses standard biomass-to-carbon conversion factors."
        />
      </ChartContainer>

      {/* ── 6. Pesticide by Group ── */}
      <ChartContainer title="Pesticide Use by Group" subtitle="Lower is better"
        tableData={pesticideDumbbell.map((d) => ({
          Group: d.label,
          Baseline: formatNumber(d.baseline, 2),
          Midline: formatNumber(d.midline, 2),
          Change: formatNumber(d.midline - d.baseline, 2),
        }))}
      >
        <DumbbellChart rows={pesticideDumbbell} formatter={(v) => formatNumber(v, 2)} height={160} />
        <MethodNote
          summary="Pesticide-related carbon emissions (kg CO₂e) derived from reported pesticide application rates and standard emission factors. Lower = less environmental impact."
        />
      </ChartContainer>

      {/* ── 7. Electricity by Group ── */}
      <ChartContainer title="Electricity Carbon by Group" subtitle="Lower is better"
        tableData={electricityDumbbell.map((d) => ({
          Group: d.label,
          Baseline: formatNumber(d.baseline, 2),
          Midline: formatNumber(d.midline, 2),
          Change: formatNumber(d.midline - d.baseline, 2),
        }))}
      >
        <DumbbellChart rows={electricityDumbbell} formatter={(v) => formatNumber(v, 2)} height={160} />
        <MethodNote
          summary="Carbon emissions from electricity consumption (kg CO₂e). Based on reported electricity use and regional grid emission factors. Lower = less environmental impact."
          caveats={[
            "Pre-post comparison only — does not control for energy price changes or grid decarbonisation between rounds.",
          ]}
        />
      </ChartContainer>
    </div>
  );
}
