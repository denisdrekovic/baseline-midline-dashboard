"use client";

import { useMemo } from "react";
import { Heart } from "lucide-react";
import { formatUSD } from "@/lib/utils/formatters";
import { GENDER_COLORS, WOMEN_EMPOWERMENT_QUESTIONS } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
import {
  Section,
  SubChart,
  MiniBarChart,
  MiniGroupedBarChart,
  MiniColorBarChart,
  StatRow,
  pct,
  genderPct,
  safeMean,
  SectionActionLink,
  type TableRow,
} from "./shared";

interface Props {
  data: Farmer[];
}

/** Influence level colors and labels (1=no influence → 5=sole decision maker) */
const INFLUENCE_LEVELS = [
  { label: "None", color: "#FB8500" },
  { label: "Little", color: "#FFB703" },
  { label: "Equal", color: "#8ECAE6" },
  { label: "Strong", color: "#00CCCC" },
  { label: "Sole", color: "#00A17D" },
];

/** Stacked 100% horizontal bars showing influence distribution per decision domain */
function InfluenceStackedBars({
  data,
}: {
  data: { name: string; levels: number[] }[];
}) {
  return (
    <div className="space-y-1">
      {data.map((row) => (
        <div key={row.name} className="flex items-center gap-1.5">
          <div
            className="text-[9px] text-[var(--text-tertiary)] shrink-0 text-right"
            style={{ width: 68 }}
          >
            {row.name}
          </div>
          <div className="flex-1 flex h-3 rounded-sm overflow-hidden">
            {row.levels.map(
              (pct, i) =>
                pct > 0 && (
                  <div
                    key={i}
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background: INFLUENCE_LEVELS[i].color,
                    }}
                    title={`${INFLUENCE_LEVELS[i].label}: ${pct}%`}
                  />
                )
            )}
          </div>
        </div>
      ))}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-1 justify-center">
        {INFLUENCE_LEVELS.map((l) => (
          <div key={l.label} className="flex items-center gap-0.5">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: l.color }}
            />
            <span className="text-[8px] text-[var(--text-tertiary)]">
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WomenEmpowermentSection({ data }: Props) {
  const women = useMemo(() => {
    if (!data.length) return null;
    const empValues = data
      .map((f) => f.womenEmpowerment)
      .filter((v): v is number => typeof v === "number" && isFinite(v));
    const avgEmpowerment = empValues.length ? safeMean(empValues) : 0;

    const contributorPct = pct(
      data,
      (f) => f.womenIncomeContributor === "Yes"
    );
    const interestedPct = pct(
      data,
      (f) => f.womenInterestedStartBusiness === "Yes"
    );
    const confidentPct = pct(
      data,
      (f) =>
        f.womenStartBusiness === "Confident" ||
        f.womenStartBusiness === "Very confident"
    );

    // Empowerment score distribution
    const scoreBins = [
      { label: "0-2", min: 0, max: 2 },
      { label: "3-4", min: 3, max: 4 },
      { label: "5-6", min: 5, max: 6 },
      { label: "7-8", min: 7, max: 8 },
    ];
    const scoreData = scoreBins.map((bin) => ({
      name: `Score ${bin.label}`,
      count: empValues.filter((v) => v >= bin.min && v <= bin.max).length,
    }));

    // Women's income
    const womenIncomeVals = data
      .map((f) => f.womenIncomeAmountUsd)
      .filter((v) => typeof v === "number" && v > 0);
    const avgWomenIncome = womenIncomeVals.length ? safeMean(womenIncomeVals) : 0;

    // Q1-Q8 empowerment questions breakdown
    // Data uses ordinal scales — classify "positive" per question type:
    //   Q1-Q5, Q7 (influence): "3. Has equal influence..." or "4. Has strong influence..." = positive
    //   Q6 (involvement): "1. Highly involved", "2. Moderately...", "3. Somewhat..." = positive
    //   Q8 (freedom): "4. Significant freedom" or "5. Complete freedom" = positive
    const isPositive = (value: string | null | undefined, qIndex: number): boolean => {
      if (!value || typeof value !== "string") return false;
      const prefix = value.charAt(0);
      if (qIndex === 5) {
        // Q6: involvement scale — positive = 1,2,3 (at least somewhat involved)
        return prefix === "1" || prefix === "2" || prefix === "3";
      }
      if (qIndex === 7) {
        // Q8: freedom scale — positive = 4,5 (significant or complete freedom)
        return prefix === "4" || prefix === "5";
      }
      // Q1-Q5, Q7: influence scale — positive = 3,4 (equal or strong influence)
      return prefix === "3" || prefix === "4";
    };

    const qKeys = ["womenQ1", "womenQ2", "womenQ3", "womenQ4", "womenQ5", "womenQ6", "womenQ7", "womenQ8"] as const;
    const SHORT_Q_LABELS: Record<string, string> = {
      "Agricultural production": "Agri. Prod.",
      "Livestock management": "Livestock",
      "Non-farm activities": "Non-Farm",
      "Income usage": "Income Use",
      "Credit & savings": "Credit/Savings",
      "Community groups": "Community",
      "Freedom of movement": "Movement",
      "Time allocation": "Time Alloc.",
    };
    const questionData = WOMEN_EMPOWERMENT_QUESTIONS.map((label, i) => {
      const key = qKeys[i];
      const yesCount = data.filter((f) => isPositive(f[key], i)).length;
      return {
        name: SHORT_Q_LABELS[label] ?? label,
        fullName: label,
        pct: data.length ? +((yesCount / data.length) * 100).toFixed(1) : 0,
      };
    });

    // Time allocation
    const parseHours = (val: string | number | null): number => {
      if (val == null) return 0;
      const n = typeof val === "number" ? val : parseFloat(val);
      return isFinite(n) ? n : 0;
    };
    const avgHoursHousehold = safeMean(data.map((f) => parseHours(f.womenHoursHousehold)));
    const avgHoursLivestock = safeMean(data.map((f) => parseHours(f.womenHoursLivestock)));
    const avgHoursIncome = safeMean(data.map((f) => parseHours(f.womenHoursIncomeGenerating)));

    // Gender comparison for key metrics
    const femaleContributor = genderPct(data, "Female", (f) => f.womenIncomeContributor === "Yes");
    const maleContributor = genderPct(data, "Male", (f) => f.womenIncomeContributor === "Yes");
    const femaleInterested = genderPct(data, "Female", (f) => f.womenInterestedStartBusiness === "Yes");
    const maleInterested = genderPct(data, "Male", (f) => f.womenInterestedStartBusiness === "Yes");

    // ── Decision Influence — FULL distribution per domain (Q1-Q5, Q7) ──
    const influenceQs = [
      { label: "Agri. Production", key: "womenQ1" as const },
      { label: "Livestock Mgmt", key: "womenQ2" as const },
      { label: "Non-Farm", key: "womenQ3" as const },
      { label: "Income Usage", key: "womenQ4" as const },
      { label: "Credit & Savings", key: "womenQ5" as const },
      { label: "Movement", key: "womenQ7" as const },
    ];
    const influenceDistribution = influenceQs.map(({ label, key }) => {
      const answered = data.filter((f) => f[key] && f[key] !== "No Answer");
      const total = answered.length || 1;
      const levels = ["1", "2", "3", "4", "5"].map((prefix) => {
        const count = answered.filter((f) => (f[key] as string).charAt(0) === prefix).length;
        return +((count / total) * 100).toFixed(1);
      });
      return { name: label, levels };
    });

    // ── Participation / Community Involvement (Q6) — percentages ──
    const q6Levels = [
      { label: "Very Involved", prefix: "1", color: "#00A17D" },
      { label: "Moderately", prefix: "2", color: "#00CCCC" },
      { label: "Somewhat", prefix: "3", color: "#FFB703" },
      { label: "Rarely", prefix: "4", color: "#FB8500" },
      { label: "Not At All", prefix: "5", color: "#E74C3C" },
    ];
    const q6Answered = data.filter((f) => f.womenQ6 && f.womenQ6 !== "No Answer");
    const q6Total = q6Answered.length || 1;
    const participationData = q6Levels
      .map(({ label, prefix, color }) => ({
        name: label,
        value: +((q6Answered.filter((f) => (f.womenQ6 as string).charAt(0) === prefix).length / q6Total) * 100).toFixed(1),
        color,
      }))
      .filter((d) => d.value > 0);

    // Knowledge rating distribution
    const knowledgeRatings = ["Very good", "Good", "Average", "Poor", "Very poor"];
    const knowledgeData = knowledgeRatings
      .map((rating) => ({
        name: rating,
        value: data.filter((f) => f.womenRateKnowledge === rating).length,
        color:
          rating === "Very good" ? "#00CCCC" :
          rating === "Good" ? "#0DCAF0" :
          rating === "Average" ? "#FFB703" :
          rating === "Poor" ? "#FB8500" :
          "#17A2B8",
      }))
      .filter((d) => d.value > 0);

    return {
      avgEmpowerment,
      contributorPct,
      interestedPct,
      confidentPct,
      scoreData,
      avgWomenIncome,
      questionData,
      influenceDistribution,
      participationData,
      avgHoursHousehold,
      avgHoursLivestock,
      avgHoursIncome,
      femaleContributor,
      maleContributor,
      femaleInterested,
      maleInterested,
      knowledgeData,
    };
  }, [data]);

  const tableData: TableRow[] = useMemo(() => {
    if (!women) return [];
    return [
      { Metric: "Avg Empowerment Score", Value: +women.avgEmpowerment.toFixed(1) },
      { Metric: "Income Contributors %", Value: +women.contributorPct.toFixed(1) },
      { Metric: "Business Interest %", Value: +women.interestedPct.toFixed(1) },
      { Metric: "Confident to Start Business %", Value: +women.confidentPct.toFixed(1) },
      { Metric: "Avg Women's Income (USD)", Value: +women.avgWomenIncome.toFixed(2) },
      { Metric: "Avg Hours Household", Value: +women.avgHoursHousehold.toFixed(1) },
      { Metric: "Avg Hours Livestock", Value: +women.avgHoursLivestock.toFixed(1) },
      { Metric: "Avg Hours Income Gen.", Value: +women.avgHoursIncome.toFixed(1) },
      ...women.questionData.map((q) => ({ Metric: q.fullName, Value: q.pct })),
    ];
  }, [women]);

  // Gender comparison bar data — only include metrics with non-zero data
  const genderCompData = useMemo(() => {
    if (!women) return [];
    const items = [];
    if (women.femaleContributor > 0 || women.maleContributor > 0) {
      items.push({
        category: "Income Contributor",
        female: +women.femaleContributor.toFixed(1),
        male: +women.maleContributor.toFixed(1),
      });
    }
    if (women.femaleInterested > 0 || women.maleInterested > 0) {
      items.push({
        category: "Business Interest",
        female: +women.femaleInterested.toFixed(1),
        male: +women.maleInterested.toFixed(1),
      });
    }
    return items;
  }, [women]);

  // Time allocation donut data
  const timeDonutData = useMemo(() => {
    if (!women) return [];
    const items = [
      { name: "Household", value: women.avgHoursHousehold, color: "#6F42C1" },
      { name: "Livestock", value: women.avgHoursLivestock, color: "#0DCAF0" },
      { name: "Income Gen.", value: women.avgHoursIncome, color: "#00CCCC" },
    ].filter((d) => d.value > 0);
    return items;
  }, [women]);

  const totalHours = useMemo(() => {
    if (!women) return 0;
    return women.avgHoursHousehold + women.avgHoursLivestock + women.avgHoursIncome;
  }, [women]);

  return (
    <Section
      id="analytics-women"
      title="Women Empowerment"
      icon={<Heart size={14} />}
      description="Empowerment scores, income contribution, business confidence, and time allocation"
      expandable
      tableData={tableData}
      summary={women ? `${women.avgEmpowerment.toFixed(1)}/8` : undefined}
    >
      {women && (
        <>
          {/* Key metrics */}
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                {women.avgEmpowerment.toFixed(1)}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {" "}
                  /8
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Avg Empowerment
              </div>
            </div>
            <div
              className="w-px h-6"
              style={{ background: "var(--card-border)" }}
            />
            <div className="text-center flex-1">
              <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                {women.contributorPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Income Contributors
              </div>
            </div>
          </div>

          {women.interestedPct > 0 && (
            <StatRow
              label="Business Interest"
              value={`${women.interestedPct.toFixed(1)}%`}
            />
          )}
          {women.confidentPct > 0 && (
            <StatRow
              label="Confident to Start Business"
              value={`${women.confidentPct.toFixed(1)}%`}
            />
          )}
          {women.avgWomenIncome > 0 && (
            <StatRow
              label="Avg Women's Income"
              value={formatUSD(women.avgWomenIncome)}
            />
          )}

          {/* Empowerment Score Distribution */}
          <SubChart
            title="Empowerment Score Distribution"
            tableData={women.scoreData.map((d) => ({ "Score Range": d.name, Farmers: d.count }))}
            expandedContent={
              <MiniBarChart data={women.scoreData} dataKey="count" nameKey="name" color="#8ECAE6" height={280} tooltipTitle="Empowerment Scores" tooltipUnit="farmers" />
            }
          >
            <MiniBarChart data={women.scoreData} dataKey="count" nameKey="name" color="#8ECAE6" height={110} tooltipTitle="Empowerment Scores" tooltipUnit="farmers" />
          </SubChart>

          {/* Empowerment Dimensions (Q1-Q8) */}
          <SubChart
            title="Empowerment Dimensions (% Positive)"
            tableData={women.questionData.map((d) => ({ Dimension: d.fullName, "Positive %": d.pct }))}
            expandedContent={
              <MiniBarChart data={women.questionData} dataKey="pct" nameKey="name" color="#8ECAE6" height={300} layout="vertical" tooltipTitle="Empowerment Dimensions" tooltipFormatter={(v) => `${v.toFixed(1)}%`} />
            }
          >
            <MiniBarChart data={women.questionData} dataKey="pct" nameKey="name" color="#8ECAE6" height={200} layout="vertical" tooltipTitle="Empowerment Dimensions" tooltipFormatter={(v) => `${v.toFixed(1)}%`} />
          </SubChart>

          {/* Decision Influence (Q1-Q5, Q7) — stacked 100% bars */}
          {women.influenceDistribution.length > 0 && (
            <SubChart
              title="Women Influence on Decisions"
              tableData={women.influenceDistribution.map((d) => ({ Domain: d.name, "None %": d.levels[0], "Little %": d.levels[1], "Equal %": d.levels[2], "Strong %": d.levels[3], "Sole %": d.levels[4] }))}
            >
              <InfluenceStackedBars data={women.influenceDistribution} />
            </SubChart>
          )}

          {/* Participation in Activities (Q6 breakdown) — percentages */}
          {women.participationData.length > 0 && (
            <SubChart
              title="Participation in Activities"
              tableData={women.participationData.map((d) => ({ Level: d.name, "% of Respondents": d.value }))}
              expandedContent={
                <MiniColorBarChart data={women.participationData} height={280} tooltipTitle="Community Involvement" tooltipUnit="%" layout="vertical" />
              }
            >
              <MiniColorBarChart data={women.participationData} height={140} tooltipTitle="Community Involvement" tooltipUnit="%" layout="vertical" />
            </SubChart>
          )}

          {/* Time Allocation */}
          {totalHours > 0 && (
            <SubChart
              title="Avg Daily Time Allocation (hours)"
              tableData={timeDonutData.map((d) => ({ Activity: d.name, "Avg Hours": d.value.toFixed(1) }))}
              expandedContent={
                <MiniColorBarChart data={timeDonutData} height={280} tooltipTitle="Time Allocation" tooltipUnit="hours" layout="vertical" />
              }
            >
              <MiniColorBarChart data={timeDonutData} height={100} tooltipTitle="Time Allocation" tooltipUnit="hours" layout="vertical" />
            </SubChart>
          )}

          {/* Gender Comparison for Key Metrics */}
          {genderCompData.length > 0 && (
            <SubChart
              title="Gender Comparison (%)"
              tableData={genderCompData.map((d) => ({ Metric: d.category, "Female %": d.female, "Male %": d.male }))}
              expandedContent={
                <MiniGroupedBarChart
                  data={genderCompData}
                  keys={[
                    { dataKey: "female", color: GENDER_COLORS.Female, label: "Female" },
                    { dataKey: "male", color: GENDER_COLORS.Male, label: "Male" },
                  ]}
                  nameKey="category"
                  height={280}
                  tooltipTitle="Gender Comparison (% of group)"
                  tooltipFormatter={(v) => `${v.toFixed(1)}%`}
                />
              }
            >
              <MiniGroupedBarChart
                data={genderCompData}
                keys={[
                  { dataKey: "female", color: GENDER_COLORS.Female, label: "Female" },
                  { dataKey: "male", color: GENDER_COLORS.Male, label: "Male" },
                ]}
                nameKey="category"
                height={110}
                tooltipTitle="Gender Comparison (% of group)"
                tooltipFormatter={(v) => `${v.toFixed(1)}%`}
              />
            </SubChart>
          )}

          {/* Knowledge Self-Rating */}
          {women.knowledgeData.length > 0 && (
            <SubChart
              title="Knowledge Self-Rating"
              tableData={women.knowledgeData.map((d) => ({ Rating: d.name, Farmers: d.value }))}
              expandedContent={
                <MiniBarChart data={women.knowledgeData} dataKey="value" nameKey="name" color="#6F42C1" height={280} tooltipTitle="Knowledge Rating" tooltipUnit="farmers" />
              }
            >
              <MiniBarChart data={women.knowledgeData} dataKey="value" nameKey="name" color="#6F42C1" height={100} tooltipTitle="Knowledge Rating" tooltipUnit="farmers" />
            </SubChart>
          )}

          <SectionActionLink href="/analytics" label="Ask AI About Gender Gaps" />
        </>
      )}
    </Section>
  );
}
