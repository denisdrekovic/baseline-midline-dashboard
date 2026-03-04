"use client";

import { useMemo } from "react";
import { GraduationCap } from "lucide-react";
import { GENDER_COLORS, PROJECT_COLORS, PROJECT_SHORT } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
import {
  Section,
  SubChart,
  MiniBarChart,
  MiniColorBarChart,
  MiniGroupedBarChart,
  MiniStackedBarChart,
  StatRow,
  safeMean,
  type TableRow,
} from "./shared";

interface Props {
  data: Farmer[];
}

export default function AgroforestrySection({ data }: Props) {
  const practices = useMemo(() => {
    if (!data.length) return null;

    // GAP adoption: exclude "Zero GAP practiced" as non-adopted
    const isAdopted = (f: Farmer) =>
      f.practiceAdoption != null &&
      f.practiceAdoption !== "" &&
      f.practiceAdoption !== "No crops" &&
      f.practiceAdoption !== "No answer" &&
      f.practiceAdoption !== "Zero GAP practiced";

    const adopted = data.filter(isAdopted);
    const adoptionPct = (adopted.length / data.length) * 100;

    // GAP adoption distribution (for chart)
    const gapCategories: Record<string, number> = {};
    for (const f of data) {
      const v = f.practiceAdoption;
      if (v != null && v !== "" && v !== "No crops" && v !== "No answer") {
        gapCategories[v] = (gapCategories[v] || 0) + 1;
      }
    }
    const gapDistribution = Object.entries(gapCategories)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name: name === "Zero GAP practiced" ? "Zero GAP" : name,
        count,
        pct: +((count / data.length) * 100).toFixed(1),
      }));

    // Training: trainingParticipation is a string (e.g. "1. Yes, Shubh Mint/ Tannager")
    // Farmer has training if value does NOT start with "3." (i.e., "3. No")
    const hasTraining = (f: Farmer) => {
      const v = f.trainingParticipation;
      return typeof v === "string" && v !== "" && !v.startsWith("3.");
    };

    const allTrainings: Record<string, number> = {};
    for (const f of data) {
      const v = f.trainingParticipation;
      if (typeof v !== "string" || !v || v.startsWith("3.")) continue;
      // Split comma-separated entries, clean up numbering prefix
      const parts = v.split(",").map((s) => s.trim().replace(/^\d+\.\s*/, ""));
      for (const t of parts) {
        if (t) allTrainings[t] = (allTrainings[t] || 0) + 1;
      }
    }
    const topTrainings = Object.entries(allTrainings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name,
        count,
        pct: (count / data.length) * 100,
      }));

    const anyTraining = data.filter(hasTraining).length;
    const trainingPct = (anyTraining / data.length) * 100;

    const mintRates = data
      .map((f) => f.practiceAdoptRateMint)
      .filter((v): v is number => v != null && isFinite(v));
    const avgMintAdopt = mintRates.length ? safeMean(mintRates) : null;

    const male = data.filter((f) => f.gender === "Male");
    const female = data.filter((f) => f.gender === "Female");
    const maleAdopt = male.length
      ? (male.filter(isAdopted).length / male.length) * 100
      : 0;
    const femaleAdopt = female.length
      ? (female.filter(isAdopted).length / female.length) * 100
      : 0;

    return {
      adoptionPct,
      gapDistribution,
      topTrainings,
      trainingPct,
      avgMintAdopt,
      maleAdopt,
      femaleAdopt,
    };
  }, [data]);

  // GAP adoption distribution chart data
  const gapChartData = useMemo(() => {
    if (!practices) return [];
    const GAP_COLORS: Record<string, string> = {
      "Zero GAP": "#FB8500",
      "0-40%": "#FFB703",
      "40-70%": "#0DCAF0",
      ">70": "#00CCCC",
    };
    return practices.gapDistribution.map((d) => ({
      name: d.name,
      value: d.pct,
      color: GAP_COLORS[d.name] || "#6F42C1",
    }));
  }, [practices]);

  // GAP adoption by Project Group — stacked bar chart data
  const gapByProjectData = useMemo(() => {
    if (!practices || !data.length) return [];
    // Canonical category order
    const categoryOrder = ["Zero GAP", "0-40%", "40-70%", ">70"];
    const projectGroups = ["T-1", "T-2", "Control"];

    // Count farmers per category+group
    const counts = new Map<string, Record<string, number>>();
    for (const cat of categoryOrder) counts.set(cat, { "T-1": 0, "T-2": 0, Control: 0 });

    for (const f of data) {
      const v = f.practiceAdoption;
      if (v == null || v === "" || v === "No crops" || v === "No answer") continue;
      const cat = v === "Zero GAP practiced" ? "Zero GAP" : v;
      if (!counts.has(cat)) continue;
      const group = f.project;
      if (!group || !projectGroups.includes(group)) continue;
      counts.get(cat)![group]++;
    }

    // Convert to percentage of each group's total
    const groupTotals: Record<string, number> = { "T-1": 0, "T-2": 0, Control: 0 };
    for (const f of data) {
      if (f.project && projectGroups.includes(f.project)) {
        const v = f.practiceAdoption;
        if (v != null && v !== "" && v !== "No crops" && v !== "No answer") {
          groupTotals[f.project]++;
        }
      }
    }

    return categoryOrder.map((cat) => {
      const row: Record<string, unknown> = { category: cat };
      for (const g of projectGroups) {
        const total = groupTotals[g] || 1;
        row[g] = +((counts.get(cat)![g] / total) * 100).toFixed(1);
      }
      return row;
    });
  }, [data, practices]);

  // Training chart data
  const trainingBarData = useMemo(() => {
    if (!practices) return [];
    return practices.topTrainings.map((t) => ({
      name: t.name.length > 20 ? t.name.slice(0, 18) + "…" : t.name,
      count: t.count,
    }));
  }, [practices]);

  const tableData: TableRow[] = useMemo(() => {
    if (!practices) return [];
    return [
      { Metric: "GAP Adoption (any) %", Value: +practices.adoptionPct.toFixed(1) },
      ...practices.gapDistribution.map((d) => ({ Metric: `GAP: ${d.name}`, Value: d.pct })),
      { Metric: "Any Training %", Value: +practices.trainingPct.toFixed(1) },
      { Metric: "Avg Mint Adopt Rate %", Value: practices.avgMintAdopt != null ? +practices.avgMintAdopt.toFixed(1) : null },
      { Metric: "Female Adoption %", Value: +practices.femaleAdopt.toFixed(1) },
      { Metric: "Male Adoption %", Value: +practices.maleAdopt.toFixed(1) },
      ...practices.topTrainings.map((t) => ({ Metric: `Training: ${t.name}`, Value: t.count })),
    ];
  }, [practices]);

  // SubChart-level table data
  const gapTableData: TableRow[] = useMemo(() => {
    if (!practices) return [];
    return practices.gapDistribution.map((d) => ({ Category: d.name, Farmers: d.count, "% of Total": `${d.pct}%` }));
  }, [practices]);

  const gapByProjectTableData: TableRow[] = useMemo(() => {
    return gapByProjectData.map((row) => ({
      Category: row.category as string,
      "T-1 (%)": row["T-1"] as number,
      "T-2 (%)": row["T-2"] as number,
      "Control (%)": row["Control"] as number,
    }));
  }, [gapByProjectData]);

  const genderAdoptTableData: TableRow[] = useMemo(() => {
    if (!practices) return [];
    return [
      { Metric: "Practice Adoption", "Female %": +practices.femaleAdopt.toFixed(1), "Male %": +practices.maleAdopt.toFixed(1) },
    ];
  }, [practices]);

  const trainingTableData: TableRow[] = useMemo(() => {
    if (!practices) return [];
    return practices.topTrainings.map((t) => ({ Program: t.name, Farmers: t.count, "% of Total": `${t.pct.toFixed(1)}%` }));
  }, [practices]);

  // Gender adoption comparison
  const genderAdoptData = useMemo(() => {
    if (!practices) return [];
    return [
      {
        category: "Practice Adoption",
        female: +practices.femaleAdopt.toFixed(1),
        male: +practices.maleAdopt.toFixed(1),
      },
    ];
  }, [practices]);

  const projectStackKeys = useMemo(() => [
    { dataKey: "T-1", color: (PROJECT_COLORS as Record<string, string>)["T-1"], label: (PROJECT_SHORT as Record<string, string>)["T-1"] || "T-1" },
    { dataKey: "T-2", color: (PROJECT_COLORS as Record<string, string>)["T-2"], label: (PROJECT_SHORT as Record<string, string>)["T-2"] || "T-2" },
    { dataKey: "Control", color: (PROJECT_COLORS as Record<string, string>)["Control"], label: (PROJECT_SHORT as Record<string, string>)["Control"] || "Control" },
  ], []);

  return (
    <Section
      id="analytics-agro"
      title="Agroforestry Practice"
      icon={<GraduationCap size={14} />}
      description="Adoption rates of sustainable practices and training participation"
      expandable
      tableData={tableData}
      summary={
        practices ? `${practices.adoptionPct.toFixed(0)}% adopt` : undefined
      }
    >
      {practices && (
        <>
          {/* Key metrics */}
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                {practices.adoptionPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Practice Adoption
              </div>
            </div>
            <div
              className="w-px h-6"
              style={{ background: "var(--card-border)" }}
            />
            <div className="text-center flex-1">
              <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                {practices.trainingPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Any Training
              </div>
            </div>
          </div>

          {/* GAP Adoption Distribution */}
          {gapChartData.length > 0 && (
            <SubChart
              title="GAP Adoption Distribution"
              tableData={gapTableData}
              expandedContent={
                <MiniColorBarChart data={gapChartData} height={280} tooltipTitle="GAP Adoption (% of farmers)" tooltipFormatter={(v) => `${v}%`} />
              }
            >
              <MiniColorBarChart data={gapChartData} height={110} tooltipTitle="GAP Adoption (% of farmers)" tooltipFormatter={(v) => `${v}%`} />
            </SubChart>
          )}

          {/* GAP Adoption by Project Group — stacked bar */}
          {gapByProjectData.length > 0 && (
            <SubChart
              title="GAP Adoption by Project Group"
              tableData={gapByProjectTableData}
              expandedContent={
                <MiniStackedBarChart
                  data={gapByProjectData}
                  keys={projectStackKeys}
                  nameKey="category"
                  height={280}
                  tooltipTitle="GAP Adoption by Group (% within group)"
                  tooltipFormatter={(v) => `${v.toFixed(1)}%`}
                  tooltipUnit="%"
                />
              }
            >
              <MiniStackedBarChart
                data={gapByProjectData}
                keys={projectStackKeys}
                nameKey="category"
                height={140}
                tooltipTitle="GAP Adoption by Group (% within group)"
                tooltipFormatter={(v) => `${v.toFixed(1)}%`}
                tooltipUnit="%"
              />
            </SubChart>
          )}

          {practices.avgMintAdopt != null && (
            <StatRow
              label="Avg Mint Adopt Rate"
              value={`${practices.avgMintAdopt.toFixed(1)}%`}
            />
          )}

          {/* Gender adoption */}
          {(practices.femaleAdopt > 0 || practices.maleAdopt > 0) && (
            <SubChart
              title="Adoption by Gender (%)"
              tableData={genderAdoptTableData}
              expandedContent={
                <MiniGroupedBarChart
                  data={genderAdoptData}
                  keys={[
                    { dataKey: "female", color: GENDER_COLORS.Female, label: "Female" },
                    { dataKey: "male", color: GENDER_COLORS.Male, label: "Male" },
                  ]}
                  nameKey="category"
                  height={250}
                  tooltipTitle="Gender Adoption (% of group)"
                  tooltipFormatter={(v) => `${v.toFixed(1)}%`}
                />
              }
            >
              <MiniGroupedBarChart
                data={genderAdoptData}
                keys={[
                  { dataKey: "female", color: GENDER_COLORS.Female, label: "Female" },
                  { dataKey: "male", color: GENDER_COLORS.Male, label: "Male" },
                ]}
                nameKey="category"
                height={100}
                tooltipTitle="Gender Adoption (% of group)"
                tooltipFormatter={(v) => `${v.toFixed(1)}%`}
              />
            </SubChart>
          )}

          {/* Training participation */}
          {trainingBarData.length > 0 && (
            <SubChart
              title="Training Participation"
              tableData={trainingTableData}
              expandedContent={
                <MiniBarChart data={trainingBarData} dataKey="count" nameKey="name" color="#6F42C1" height={280} layout="vertical" tooltipTitle="Training Programs" tooltipUnit="farmers" />
              }
            >
              <MiniBarChart data={trainingBarData} dataKey="count" nameKey="name" color="#6F42C1" height={130} layout="vertical" tooltipTitle="Training Programs" tooltipUnit="farmers" />
            </SubChart>
          )}
        </>
      )}
    </Section>
  );
}
