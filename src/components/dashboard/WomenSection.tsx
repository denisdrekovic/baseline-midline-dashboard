"use client";

import { useMemo, useState } from "react";
import ChartContainer from "@/components/ui/ChartContainer";
import type { TableRow } from "@/components/ui/ChartContainer";
import KPICard from "@/components/ui/KPICard";
import BarChartComponent from "@/components/charts/BarChartComponent";
import BentoGrid from "@/components/layout/BentoGrid";
import { Heart, Users, Briefcase, Clock } from "lucide-react";
import { mean } from "@/lib/utils/statistics";
import { formatNumber } from "@/lib/utils/formatters";
import { WOMEN_EMPOWERMENT_QUESTIONS } from "@/lib/data/constants";

/** Interactive bar chart for daily hours with hover tooltip */
function HoursBarChart({ data }: { data: { name: string; hours: number; color: string }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxHours = Math.max(...data.map((d) => d.hours), 1);

  return (
    <div className="relative flex items-end gap-6 h-28 px-4">
      {data.map((item, i) => {
        const isHovered = hovered === i;
        return (
          <div
            key={item.name}
            className="flex-1 flex flex-col items-center gap-2 cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ opacity: hovered !== null && !isHovered ? 0.4 : 1, transition: "opacity 0.15s" }}
          >
            <span className="text-lg font-bold font-mono" style={{ color: item.color }}>
              {item.hours}h
            </span>
            <div className="relative w-full">
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(10, (item.hours / maxHours) * 100)}%`,
                  backgroundColor: item.color,
                  opacity: isHovered ? 1 : 0.7,
                }}
              />
              {/* Floating tooltip on hover */}
              {isHovered && (
                <div
                  className="absolute z-10 pointer-events-none"
                  style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4 }}
                >
                  <div
                    className="px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                    style={{
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--card-border)",
                      boxShadow: "var(--shadow-tooltip)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold mt-0.5 block" style={{ color: "var(--text-primary)" }}>
                      {item.hours} hours/day
                    </span>
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-[var(--text-tertiary)] text-center leading-tight">
              {item.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Influence level colors and labels (1=no influence → 5=sole decision maker) */
const INFLUENCE_LEVELS = [
  { label: "None", color: "#FB8500" },
  { label: "Little", color: "#FFB703" },
  { label: "Equal", color: "#8ECAE6" },
  { label: "Strong", color: "#00CCCC" },
  { label: "Sole", color: "#00A17D" },
];

/** Stacked 100% bars — full-tab version with larger labels and bars */
function InfluenceStackedBarsLarge({
  data,
}: {
  data: { name: string; levels: number[] }[];
}) {
  return (
    <div className="space-y-2 py-2">
      {data.map((row) => (
        <div key={row.name} className="flex items-center gap-2">
          <div
            className="text-[11px] text-[var(--text-secondary)] shrink-0 text-right"
            style={{ width: 120 }}
          >
            {row.name}
          </div>
          <div className="flex-1 flex h-5 rounded overflow-hidden">
            {row.levels.map(
              (pct, i) =>
                pct > 0 && (
                  <div
                    key={i}
                    className="h-full relative group transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background: INFLUENCE_LEVELS[i].color,
                    }}
                  >
                    {pct >= 10 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">
                        {Math.round(pct)}%
                      </span>
                    )}
                  </div>
                )
            )}
          </div>
        </div>
      ))}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 justify-center">
        {INFLUENCE_LEVELS.map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: l.color }}
            />
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WomenSection({ data }: { data: import("@/lib/data/types").Farmer[] }) {
  // KPIs
  const kpis = useMemo(() => {
    if (!data.length) return null;
    const avgEmpowerment = mean(data.map((f) => f.womenEmpowerment));
    const contributors = data.filter((f) => f.womenIncomeContributor === "Yes").length;
    const contributorPct = (contributors / data.length) * 100;
    const interestedBusiness = data.filter(
      (f) => f.womenInterestedStartBusiness === "Yes"
    ).length;
    const businessPct = (interestedBusiness / data.length) * 100;
    const startedBusiness = data.filter(
      (f) => f.womenStartBusiness === "Yes"
    ).length;
    const startedPct = data.length ? (startedBusiness / data.length) * 100 : 0;

    return { avgEmpowerment, contributorPct, businessPct, startedPct, contributors, interestedBusiness };
  }, [data]);

  // 8 survey questions grouped bar (Yes count per question)
  const surveyData = useMemo(() => {
    const qKeys = [
      "womenQ1", "womenQ2", "womenQ3", "womenQ4",
      "womenQ5", "womenQ6", "womenQ7", "womenQ8",
    ] as const;
    return qKeys.map((key, i) => {
      const yesCount = data.filter((f) => f[key] === "Yes").length;
      const total = data.length;
      return {
        name: WOMEN_EMPOWERMENT_QUESTIONS[i] || `Q${i + 1}`,
        yes: yesCount,
        pct: total ? Math.round((yesCount / total) * 100) : 0,
      };
    });
  }, [data]);

  // Hours analysis
  const hoursData = useMemo(() => {
    const parseHours = (val: string): number => {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    const household = mean(data.map((f) => parseHours(f.womenHoursHousehold)));
    const livestock = mean(data.map((f) => parseHours(f.womenHoursLivestock)));
    const incomeGen = mean(data.map((f) => parseHours(f.womenHoursIncomeGenerating)));

    return [
      { name: "Household", hours: Math.round(household * 10) / 10, color: "#8ECAE6" },
      { name: "Livestock", hours: Math.round(livestock * 10) / 10, color: "#FFB703" },
      { name: "Income Generating", hours: Math.round(incomeGen * 10) / 10, color: "var(--color-accent)" },
    ];
  }, [data]);

  // Business activity donut
  const businessDonut = useMemo(() => {
    const interested = data.filter((f) => f.womenInterestedStartBusiness === "Yes").length;
    const started = data.filter((f) => f.womenStartBusiness === "Yes").length;
    const neither = data.length - interested;
    return [
      { name: "Started Business", value: started, color: "var(--color-accent)" },
      { name: "Interested", value: Math.max(0, interested - started), color: "#FFB703" },
      { name: "Not Interested", value: Math.max(0, neither), color: "#17A2B8" },
    ];
  }, [data]);

  // Income contribution bar
  const incomeContribution = useMemo(() => {
    const contributors = data.filter((f) => f.womenIncomeContributor === "Yes");
    const nonContributors = data.filter((f) => f.womenIncomeContributor !== "Yes");

    const contribAvg = contributors.length
      ? mean(contributors.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!))
      : 0;
    const nonContribAvg = nonContributors.length
      ? mean(nonContributors.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!))
      : 0;

    return [
      { name: "Contributors", income: Math.round(contribAvg) },
      { name: "Non-Contributors", income: Math.round(nonContribAvg) },
    ];
  }, [data]);

  // Decision Influence — full distribution per domain (Q1-Q5, Q7)
  const influenceDistribution = useMemo(() => {
    const influenceQs = [
      { label: "Agri. Production", key: "womenQ1" as const },
      { label: "Livestock Mgmt", key: "womenQ2" as const },
      { label: "Non-Farm Activities", key: "womenQ3" as const },
      { label: "Income Usage", key: "womenQ4" as const },
      { label: "Credit & Savings", key: "womenQ5" as const },
      { label: "Freedom of Movement", key: "womenQ7" as const },
    ];
    return influenceQs.map(({ label, key }) => {
      const answered = data.filter((f) => f[key] && f[key] !== "No Answer");
      const total = answered.length || 1;
      const levels = ["1", "2", "3", "4", "5"].map((prefix) => {
        const count = answered.filter((f) => (f[key] as string).charAt(0) === prefix).length;
        return +((count / total) * 100).toFixed(1);
      });
      return { name: label, levels };
    });
  }, [data]);

  // Participation in Activities (Q6 — involvement level distribution) — percentages
  const participationData = useMemo(() => {
    const q6Levels = [
      { label: "Very Involved", prefix: "1", color: "#00A17D" },
      { label: "Moderately", prefix: "2", color: "#00CCCC" },
      { label: "Somewhat", prefix: "3", color: "#FFB703" },
      { label: "Rarely", prefix: "4", color: "#FB8500" },
      { label: "Not At All", prefix: "5", color: "#E74C3C" },
    ];
    const answered = data.filter((f) => f.womenQ6 && f.womenQ6 !== "No Answer");
    const total = answered.length || 1;
    return q6Levels
      .map(({ label, prefix, color }) => ({
        name: label,
        value: +((answered.filter((f) => (f.womenQ6 as string).charAt(0) === prefix).length / total) * 100).toFixed(1),
        color,
      }))
      .filter((d) => d.value > 0);
  }, [data]);

  // Table data for each chart
  const surveyTableData: TableRow[] = useMemo(
    () => surveyData.map((d) => ({ Question: d.name, "Yes Count": d.yes, "Yes %": `${d.pct}%` })),
    [surveyData]
  );
  const businessTableData: TableRow[] = useMemo(
    () => businessDonut.map((d) => ({ Category: d.name, Farmers: d.value })),
    [businessDonut]
  );
  const incomeTableData: TableRow[] = useMemo(
    () => incomeContribution.map((d) => ({ Group: d.name, "Avg Income ($)": d.income })),
    [incomeContribution]
  );
  const hoursTableData: TableRow[] = useMemo(
    () => hoursData.map((d) => ({ Activity: d.name, "Avg Hours/Day": d.hours })),
    [hoursData]
  );
  const influenceTableData: TableRow[] = useMemo(
    () => influenceDistribution.map((d) => ({
      Domain: d.name,
      "None %": `${d.levels[0]}%`,
      "Little %": `${d.levels[1]}%`,
      "Equal %": `${d.levels[2]}%`,
      "Strong %": `${d.levels[3]}%`,
      "Sole %": `${d.levels[4]}%`,
    })),
    [influenceDistribution]
  );
  const participationTableData: TableRow[] = useMemo(
    () => participationData.map((d) => ({ Level: d.name, "%": `${d.value}%` })),
    [participationData]
  );

  if (!data.length || !kpis) {
    return <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">No data for this selection.</p>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <BentoGrid cols={2}>
        <KPICard
          label="Avg Empowerment"
          value={kpis.avgEmpowerment}
          formatter={(n) => `${n.toFixed(1)}/8`}
          icon={<Heart size={16} />}
          accent="#8ECAE6"
        />
        <KPICard
          label="Income Contributors"
          value={kpis.contributorPct}
          formatter={(n) => `${n.toFixed(1)}%`}
          icon={<Users size={16} />}
          accent="#6F42C1"
        />
        <KPICard
          label="Business Interest"
          value={kpis.businessPct}
          formatter={(n) => `${n.toFixed(1)}%`}
          icon={<Briefcase size={16} />}
          accent="#FFB703"
        />
        <KPICard
          label="Started Business"
          value={kpis.startedPct}
          formatter={(n) => `${n.toFixed(1)}%`}
          icon={<Clock size={16} />}
          accent="var(--color-accent)"
        />
      </BentoGrid>

      {/* Charts — only render charts that have meaningful data */}
      <div className="grid gap-3 grid-cols-1">
        {surveyData.some((d) => d.pct > 0) && (
          <ChartContainer
            title="Empowerment Survey"
            subtitle="'Yes' responses per question"
            tableData={surveyTableData}
          >
            <BarChartComponent
              data={surveyData}
              dataKey="pct"
              nameKey="name"
              layout="vertical"
              color="#8ECAE6"
              height={160}
              tooltipTitle="Survey Responses"
              tooltipFormatter={(v) => `${v}%`}
              tooltipUnit="%"
            />
          </ChartContainer>
        )}

        {businessDonut.some((d) => d.value > 0) && (
          <ChartContainer
            title="Business Activity"
            subtitle="Women's business participation"
            tableData={businessTableData}
          >
            <BarChartComponent
              data={businessDonut}
              dataKey="value"
              nameKey="name"
              layout="vertical"
              colors={businessDonut.map((d) => d.color)}
              height={160}
              tooltipTitle="Business Participation"
              tooltipUnit="farmers"
              tooltipFormatter={(v) => `${v.toLocaleString()} farmers`}
            />
          </ChartContainer>
        )}

        {incomeContribution.some((d) => d.income > 0) && (
          <ChartContainer
            title="Income: Contributors vs Non"
            subtitle="Avg household income comparison"
            tableData={incomeTableData}
          >
            <BarChartComponent
              data={incomeContribution}
              dataKey="income"
              nameKey="name"
              color="#6F42C1"
              height={160}
              tooltipTitle="Income Comparison"
              tooltipFormatter={(v) => `$${v.toLocaleString()} USD`}
            />
          </ChartContainer>
        )}

        {/* Decision Influence — stacked 100% bars per domain */}
        {influenceDistribution.length > 0 && (
          <ChartContainer
            title="Women Influence on Decisions"
            subtitle="Distribution of influence levels per decision domain"
            tableData={influenceTableData}
          >
            <InfluenceStackedBarsLarge data={influenceDistribution} />
          </ChartContainer>
        )}

        {/* Participation in Activities (Q6 — community involvement %) */}
        {participationData.length > 0 && (
          <ChartContainer
            title="Participation in Activities"
            subtitle="Community group involvement level (%)"
            tableData={participationTableData}
          >
            <BarChartComponent
              data={participationData}
              dataKey="value"
              nameKey="name"
              layout="vertical"
              colors={participationData.map((d) => d.color)}
              height={180}
              tooltipTitle="Involvement Level"
              tooltipUnit="%"
              tooltipFormatter={(v) => `${v}%`}
            />
          </ChartContainer>
        )}
      </div>

      {/* Hours analysis */}
      <ChartContainer
        title="Average Daily Hours"
        subtitle="Time allocation by activity type"
        tableData={hoursTableData}
      >
        <HoursBarChart data={hoursData} />
      </ChartContainer>
    </div>
  );
}
