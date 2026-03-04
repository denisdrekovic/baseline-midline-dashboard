"use client";

import { useMemo } from "react";
import type { Farmer, ProjectGroup } from "@/lib/data/types";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { isAboveLIB } from "@/lib/utils/statistics";
import { formatPercent, formatUSD } from "@/lib/utils/formatters";
import { PROJECT_COLORS } from "@/lib/data/constants";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import DumbbellChart from "@/components/charts/DumbbellChart";
import ChartContainer from "@/components/ui/ChartContainer";
import RadarChartComponent from "@/components/charts/RadarChartComponent";
import BarChartComponent from "@/components/charts/BarChartComponent";
import MethodNote from "@/components/ui/MethodNote";

interface WomenComparativeProps {
  data: Farmer[];
  projectFilter?: string;
}

const ALL_GROUPS: ProjectGroup[] = ["T-1", "T-2", "Control"];
const TREATMENT_GROUPS: ProjectGroup[] = ["T-1", "T-2"];

/* Correct field names from Farmer type
 * Q6 is reverse-scored: lower values = more empowered (1=Very involved, 5=Not involved) */
const WEI_QUESTIONS = [
  { key: "womenQ1" as keyof Farmer, label: "Input in decisions", reverse: false },
  { key: "womenQ2" as keyof Farmer, label: "Autonomy in production", reverse: false },
  { key: "womenQ3" as keyof Farmer, label: "Ownership of assets", reverse: false },
  { key: "womenQ4" as keyof Farmer, label: "Purchase/sale decisions", reverse: false },
  { key: "womenQ5" as keyof Farmer, label: "Access to credit", reverse: false },
  { key: "womenQ6" as keyof Farmer, label: "Income decisions", reverse: true },
  { key: "womenQ7" as keyof Farmer, label: "Group membership", reverse: false },
  { key: "womenQ8" as keyof Farmer, label: "Workload balance", reverse: false },
];

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function getWEI(farmers: Farmer[]): number {
  const scores = farmers.map((f) => f.womenEmpowerment).filter((v): v is number => v != null && isFinite(v));
  return avg(scores);
}

function getFemaleLIBPct(farmers: Farmer[]): number {
  const females = farmers.filter((f) => f.gender === "Female");
  if (!females.length) return 0;
  return (females.filter((f) => isAboveLIB(f.aboveLIB)).length / females.length) * 100;
}

function getGenderGap(farmers: Farmer[]): number {
  const males = farmers.filter((f) => f.gender === "Male");
  const females = farmers.filter((f) => f.gender === "Female");
  const mInc = avg(males.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  const fInc = avg(females.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  return mInc > 0 ? ((mInc - fInc) / mInc) * 100 : 0;
}

/**
 * Compute % of farmers who are "adequately empowered" on a Likert-scale
 * women empowerment question. Data values look like "3. Has equal influence…"
 * or could be numeric 1–5, or legacy "Yes"/"No".
 *
 * For most questions, score ≥ 3 = empowered.
 * For reverse-scored questions (Q6: involvement), score ≤ 3 = empowered
 * (1 = Very involved = most empowered).
 */
function getQuestionEmpoweredPct(farmers: Farmer[], key: keyof Farmer, reverse = false): number {
  const answered = farmers.filter((f) => {
    const v = f[key];
    if (v == null) return false;
    if (typeof v === "string" && (v === "No Answer" || v.trim() === "")) return false;
    return true;
  });
  if (!answered.length) return 0;

  const empowered = answered.filter((f) => {
    const v = f[key];
    // Numeric value (1–5)
    if (typeof v === "number") return reverse ? v <= 3 : v >= 3;
    // Boolean legacy
    if ((v as unknown) === true) return true;
    // String: try to extract leading number "3. Has equal influence…"
    if (typeof v === "string") {
      // Legacy Yes/No
      if (v === "Yes" || v === "yes") return true;
      if (v === "No" || v === "no") return false;
      // Likert: extract leading digit
      const match = v.match(/^(\d)/);
      if (match) {
        const score = parseInt(match[1], 10);
        return reverse ? score <= 3 : score >= 3;
      }
    }
    return false;
  }).length;
  return (empowered / answered.length) * 100;
}

function getAvgHours(farmers: Farmer[], key: keyof Farmer): number {
  const vals = farmers.map((f) => {
    const v = f[key];
    return typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  }).filter((v) => isFinite(v));
  return avg(vals);
}

export default function WomenComparative({ data, projectFilter }: WomenComparativeProps) {
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

  /* Project-filtered — for KPIs */
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

  // WEI KPIs
  const weiKPIs = useMemo(() => {
    const bWEI = getWEI(bFiltered);
    const mWEI = getWEI(mFiltered);
    const bFemLIB = getFemaleLIBPct(bFiltered);
    const mFemLIB = getFemaleLIBPct(mFiltered);
    const bGap = getGenderGap(bFiltered);
    const mGap = getGenderGap(mFiltered);
    const bFemInc = avg(bFiltered.filter((f) => f.gender === "Female").map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
    const mFemInc = avg(mFiltered.filter((f) => f.gender === "Female").map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
    const bWomenInc = avg(bFiltered.map((f) => f.womenIncomeAmountUsd).filter((v) => isFinite(v)));
    const mWomenInc = avg(mFiltered.map((f) => f.womenIncomeAmountUsd).filter((v) => isFinite(v)));
    const bBusiness = bFiltered.filter((f) => f.womenStartBusiness === "Yes" || f.womenStartBusiness === "yes").length / (bFiltered.length || 1) * 100;
    const mBusiness = mFiltered.filter((f) => f.womenStartBusiness === "Yes" || f.womenStartBusiness === "yes").length / (mFiltered.length || 1) * 100;

    return [
      { label: "WEI Score", baseline: bWEI, midline: mWEI, format: "index" as const, higherIsBetter: true },
      { label: "Female LIB %", baseline: bFemLIB, midline: mFemLIB, format: "percent" as const, higherIsBetter: true },
      { label: "Gender Income Gap", baseline: bGap, midline: mGap, format: "percent" as const, higherIsBetter: false },
      { label: "Female Avg Income", baseline: bFemInc, midline: mFemInc, format: "currency" as const, higherIsBetter: true },
      { label: "Women's Income Contribution", baseline: bWomenInc, midline: mWomenInc, format: "currency" as const, higherIsBetter: true },
      { label: "Started Business", baseline: bBusiness, midline: mBusiness, format: "percent" as const, higherIsBetter: true },
    ];
  }, [bFiltered, mFiltered]);

  /* Control = counterfactual — exclude from treatment-focused group comparisons */
  const visibleGroups = useMemo((): ProjectGroup[] => {
    if (!projectFilter || projectFilter === "all") return TREATMENT_GROUPS;
    return [projectFilter as ProjectGroup];
  }, [projectFilter]);

  // WEI by group dumbbell
  const weiDumbbell = useMemo(() => {
    return visibleGroups.map((g) => ({
      label: g,
      baseline: getWEI(baselineFarmers.filter((f) => f.project === g)),
      midline: getWEI(midlineFarmers.filter((f) => f.project === g)),
      color: PROJECT_COLORS[g],
    }));
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Female LIB by group
  const femaleLIBDumbbell = useMemo(() => {
    return visibleGroups.map((g) => ({
      label: g,
      baseline: getFemaleLIBPct(baselineFarmers.filter((f) => f.project === g)),
      midline: getFemaleLIBPct(midlineFarmers.filter((f) => f.project === g)),
      color: PROJECT_COLORS[g],
    }));
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Empowerment radar (overall — project-filtered)
  const radarData = useMemo(() => {
    return WEI_QUESTIONS.map((q) => ({
      subject: q.label,
      Baseline: +getQuestionEmpoweredPct(bFiltered, q.key, q.reverse).toFixed(1),
      Midline: +getQuestionEmpoweredPct(mFiltered, q.key, q.reverse).toFixed(1),
    }));
  }, [bFiltered, mFiltered]);

  // Per-group question changes (table format)
  const groupQuestionData = useMemo(() => {
    return WEI_QUESTIONS.map((q) => {
      const row: Record<string, string | number> = { Question: q.label };
      for (const g of visibleGroups) {
        const bPct = getQuestionEmpoweredPct(baselineFarmers.filter((f) => f.project === g), q.key, q.reverse);
        const mPct = getQuestionEmpoweredPct(midlineFarmers.filter((f) => f.project === g), q.key, q.reverse);
        row[`${g} B`] = +bPct.toFixed(1);
        row[`${g} M`] = +mPct.toFixed(1);
        row[`${g} Δ`] = +(mPct - bPct).toFixed(1);
      }
      return row;
    });
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  // Survey question changes bar chart (project-filtered)
  const surveyChanges = useMemo(() => {
    return WEI_QUESTIONS.map((q) => {
      const bPct = getQuestionEmpoweredPct(bFiltered, q.key, q.reverse);
      const mPct = getQuestionEmpoweredPct(mFiltered, q.key, q.reverse);
      return { name: q.label, change: +(mPct - bPct).toFixed(1) };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [bFiltered, mFiltered]);

  // Hours worked comparison (project-filtered)
  const hoursData = useMemo(() => {
    const keys: { key: keyof Farmer; label: string }[] = [
      { key: "womenHoursHousehold", label: "Household" },
      { key: "womenHoursLivestock", label: "Livestock" },
      { key: "womenHoursIncomeGenerating", label: "Income Generating" },
    ];
    return keys.map((k) => ({
      name: k.label,
      Baseline: +getAvgHours(bFiltered, k.key).toFixed(1),
      Midline: +getAvgHours(mFiltered, k.key).toFixed(1),
    })).filter((d) => d.Baseline > 0 || d.Midline > 0);
  }, [bFiltered, mFiltered]);

  if (!baselineFarmers.length || !midlineFarmers.length) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
        Both baseline and midline data are required for women comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. WEI KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {weiKPIs.map((kpi) => (
          <div key={kpi.label} className="brand-card p-3 space-y-1.5">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {kpi.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-[var(--text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
                {kpi.format === "percent" ? formatPercent(kpi.midline)
                  : kpi.format === "currency" ? formatUSD(kpi.midline)
                  : kpi.midline.toFixed(2)}
              </span>
              <ChangeIndicator value={kpi.midline - kpi.baseline} format={kpi.format} higherIsBetter={kpi.higherIsBetter} />
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)] font-mono">
              was {kpi.format === "percent" ? formatPercent(kpi.baseline) : kpi.format === "currency" ? formatUSD(kpi.baseline) : kpi.baseline.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. Female LIB by Group — Mars LIB focus first ── */}
      <ChartContainer title="Female LIB Attainment by Group" subtitle="Baseline → Midline"
        tableData={femaleLIBDumbbell.map((d) => ({
          Group: d.label,
          Baseline: formatPercent(d.baseline),
          Midline: formatPercent(d.midline),
          "Change (pp)": formatPercent(d.midline - d.baseline),
        }))}
      >
        <DumbbellChart rows={femaleLIBDumbbell} formatter={(v) => formatPercent(v)} height={160} />
        <MethodNote
          summary="Female LIB %: percentage of female-headed respondents whose total net household income exceeds the Living Income Benchmark ($4,933.50/yr)."
          caveats={[
            "Groups are not randomly assigned — differences may reflect selection effects. See Overview tab for DiD estimates.",
          ]}
        />
      </ChartContainer>

      {/* ── 3. WEI by Group ── */}
      <ChartContainer title="WEI Score by Group" subtitle="Baseline \u2192 Midline"
        tableData={weiDumbbell.map((d) => ({
          Group: d.label,
          Baseline: d.baseline.toFixed(2),
          Midline: d.midline.toFixed(2),
          Change: (d.midline - d.baseline).toFixed(2),
        }))}
      >
        <DumbbellChart rows={weiDumbbell} formatter={(v) => v.toFixed(2)} height={160} />
        <MethodNote
          summary="Women's Empowerment Index (WEI): composite score (0–10) across 5 domains — Production, Income, Assets, Leadership, and Time. Adapted from pro-WEAI."
          details={[
            "Based on 8 Likert-scale questions. Q6 (income decisions) is reverse-scored. Score ≥ 6 = empowered.",
          ]}
        />
      </ChartContainer>

      {/* ── 4. Empowerment Radar ── */}
      <ChartContainer title="Empowerment Dimensions" subtitle="% Empowered (score ≥ 3) — Baseline vs Midline"
        tableData={radarData.map((d) => ({
          Dimension: d.subject,
          "Baseline (%)": `${d.Baseline}%`,
          "Midline (%)": `${d.Midline}%`,
          "Change (pp)": `${(d.Midline - d.Baseline).toFixed(1)}pp`,
        }))}
      >
        <RadarChartComponent
          data={radarData}
          dataKeys={[
            { key: "Baseline", color: "#007BFF", label: "Baseline" },
            { key: "Midline", color: "#00A17D", label: "Midline" },
          ]}
          height={280}
        />
        <MethodNote
          summary="Each axis shows % of farmers scoring ≥ 3 (empowered) on a 1–5 Likert scale for that dimension. Q6 is reverse-scored."
          details={[
            "Dimensions: Input in decisions, Autonomy in production, Ownership of assets, Purchase/sale decisions, Access to credit, Income decisions (reverse), Group membership, Workload balance.",
          ]}
          caveats={[
            "Self-reported empowerment may be subject to social desirability bias — respondents may over-report empowerment.",
          ]}
        />
      </ChartContainer>

      {/* ── 5. Survey Question Changes ── */}
      <ChartContainer title="Survey Response Changes" subtitle="Change in % empowered (score ≥ 3)" tableData={surveyChanges}>
        <BarChartComponent data={surveyChanges} dataKey="change" nameKey="name" layout="vertical" color="#00A17D" height={surveyChanges.length * 28 + 40} tooltipTitle="Change" tooltipUnit="pp" />
        <MethodNote
          summary="Change in percentage of farmers classified as empowered (score ≥ 3) per question between rounds. Bars sorted by absolute change."
          caveats={[
            "Percentage-point change — interpret in context of baseline level (e.g., +5pp from 30% is different from +5pp from 90%).",
          ]}
        />
      </ChartContainer>

      {/* ── 6. Per-Group Question Breakdown ── */}
      <ChartContainer title="Empowerment by Group — All Questions" subtitle="% empowered per question per group" tableData={groupQuestionData}>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]" role="table">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left px-2 py-1.5 font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Question</th>
                {visibleGroups.map((g) => (
                  <th key={g} className="text-center px-1.5 py-1.5 font-semibold uppercase tracking-wider" style={{ color: PROJECT_COLORS[g] }}>{g} Δ</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEI_QUESTIONS.map((q) => (
                <tr key={q.key as string} className="border-b border-[var(--card-border)] last:border-0">
                  <td className="px-2 py-1.5 text-[var(--text-secondary)]">{q.label}</td>
                  {visibleGroups.map((g) => {
                    const bPct = getQuestionEmpoweredPct(baselineFarmers.filter((f) => f.project === g), q.key, q.reverse);
                    const mPct = getQuestionEmpoweredPct(midlineFarmers.filter((f) => f.project === g), q.key, q.reverse);
                    const delta = mPct - bPct;
                    return (
                      <td key={g} className="text-center px-1.5 py-1.5">
                        <ChangeIndicator value={delta} format="percent" size="sm" />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <MethodNote
          summary="Per-group empowerment breakdown: % empowered (score ≥ 3) for each WEI question, split by treatment group. Δ = midline − baseline (pp)."
          caveats={[
            "Groups are not randomly assigned — between-group differences may reflect baseline characteristics rather than intervention impact.",
          ]}
        />
      </ChartContainer>

      {/* ── 7. Hours Worked — grouped bar: baseline vs midline ── */}
      {hoursData.length > 0 && (
        <ChartContainer
          title="Women's Work Hours"
          subtitle="Avg hours per activity — Baseline vs Midline"
          tableData={hoursData.map((d) => ({
            Activity: d.name,
            "Baseline (hrs)": d.Baseline,
            "Midline (hrs)": d.Midline,
            Change: `${(d.Midline - d.Baseline) >= 0 ? "+" : ""}${(d.Midline - d.Baseline).toFixed(1)}`,
          }))}
        >
          <BarChartComponent
            data={hoursData}
            dataKey="Midline"
            nameKey="name"
            layout="vertical"
            series={[
              { key: "Baseline", label: "Baseline", color: "#6F42C1", opacity: 0.4 },
              { key: "Midline", label: "Midline", color: "#6F42C1" },
            ]}
            height={hoursData.length * 56 + 40}
            tooltipTitle="Work Hours"
            tooltipUnit="hrs"
            yAxisWidth={110}
          />
          <MethodNote
            summary="Self-reported average hours per activity category (household, livestock, income-generating). Change indicates shift in time allocation between rounds."
            caveats={[
              "Hours recall is approximate and subject to seasonal variation. Survey timing may affect comparability between rounds.",
            ]}
          />
        </ChartContainer>
      )}
    </div>
  );
}
