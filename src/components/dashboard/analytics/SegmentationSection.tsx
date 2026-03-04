"use client";

import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { formatUSD, formatNumber } from "@/lib/utils/formatters";
import { PROJECT_COLORS, PROJECT_SHORT } from "@/lib/data/constants";
import { isAboveLIB } from "@/lib/utils/statistics";
import type { Farmer } from "@/lib/data/types";
import {
  Section,
  SubChart,
  MiniGroupedBarChart,
  safeMean,
  SectionActionLink,
  type TableRow,
} from "./shared";

interface Props {
  data: Farmer[];
}

/** Canonical group order */
const GROUP_ORDER = ["T-1", "T-2", "Control"] as const;

export default function ProjectGroupSection({ data }: Props) {
  /* ── Compute per-group statistics ───────────────────────── */
  const groupStats = useMemo(() => {
    if (!data.length) return [];

    const buckets = new Map<string, Farmer[]>();
    for (const f of data) {
      if (!f.project) continue;
      const arr = buckets.get(f.project) || [];
      arr.push(f);
      buckets.set(f.project, arr);
    }

    return GROUP_ORDER.filter((g) => buckets.has(g)).map((group) => {
      const farmers = buckets.get(group)!;
      const n = farmers.length;

      const avgIncome = safeMean(farmers.map((f) => f.totalNetIncomeUsd));
      const aboveLIBPct = n ? (farmers.filter((f) => isAboveLIB(f.aboveLIB)).length / n) * 100 : 0;
      const adoptionPct = n
        ? (farmers.filter(
            (f) =>
              f.practiceAdoption != null &&
              f.practiceAdoption !== "" &&
              f.practiceAdoption !== "No crops" &&
              f.practiceAdoption !== "No answer" &&
              f.practiceAdoption !== "Zero GAP practiced"
          ).length / n) * 100
        : 0;
      const financialPct = n ? (farmers.filter((f) => f.useFinancialServices === 1).length / n) * 100 : 0;
      const femalePct = n ? (farmers.filter((f) => f.gender === "Female").length / n) * 100 : 0;

      return {
        group,
        short: (PROJECT_SHORT as Record<string, string>)[group] || group,
        color: (PROJECT_COLORS as Record<string, string>)[group] || "#17A2B8",
        count: n,
        pctOfTotal: (n / data.length) * 100,
        avgIncome,
        aboveLIBPct,
        adoptionPct,
        financialPct,
        femalePct,
      };
    });
  }, [data]);

  /* ── Multi-metric grouped bar chart data ───────────────── */
  const comparisonData = useMemo(() => {
    if (!groupStats.length) return [];
    const metrics = [
      { key: "aboveLIBPct", label: "Above LIB" },
      { key: "adoptionPct", label: "GAP Adoption" },
      { key: "financialPct", label: "Financial Svc" },
      { key: "femalePct", label: "Female %" },
    ] as const;

    return metrics.map((m) => {
      const row: Record<string, unknown> = { category: m.label };
      for (const g of groupStats) {
        row[g.group] = +(g[m.key] as number).toFixed(1);
      }
      return row;
    });
  }, [groupStats]);

  const groupedBarKeys = useMemo(
    () =>
      groupStats.map((g) => ({
        dataKey: g.group,
        color: g.color,
        label: g.short,
      })),
    [groupStats]
  );

  /* ── Table data for CSV export ──────────────────────────── */
  const tableData: TableRow[] = useMemo(() => {
    return groupStats.map((g) => ({
      "Project Group": g.group,
      Farmers: g.count,
      "% of Total": `${g.pctOfTotal.toFixed(1)}%`,
      "Avg Income (USD)": Math.round(g.avgIncome),
      "Above LIB %": +g.aboveLIBPct.toFixed(1),
      "GAP Adoption %": +g.adoptionPct.toFixed(1),
      "Financial Svc %": +g.financialPct.toFixed(1),
      "Female %": +g.femalePct.toFixed(1),
    }));
  }, [groupStats]);

  /* ── SubChart table data ────────────────────────────────── */
  const comparisonTableData: TableRow[] = useMemo(() => {
    if (!groupStats.length) return [];
    const rows: TableRow[] = [];
    const metrics = [
      { key: "aboveLIBPct", label: "Above LIB %" },
      { key: "adoptionPct", label: "GAP Adoption %" },
      { key: "financialPct", label: "Financial Svc %" },
      { key: "femalePct", label: "Female %" },
    ] as const;
    for (const m of metrics) {
      const row: TableRow = { Metric: m.label };
      for (const g of groupStats) {
        row[`${g.short} (%)`] = +(g[m.key] as number).toFixed(1);
      }
      rows.push(row);
    }
    return rows;
  }, [groupStats]);

  return (
    <Section
      id="analytics-seg"
      title="Project Groups"
      icon={<FlaskConical size={14} />}
      description="Distribution across treatment and control groups"
      expandable
      tableData={tableData}
    >
      {groupStats.length > 0 && (
        <>
          {/* ── Group Summary Cards ─── */}
          <div className="grid grid-cols-3 gap-2">
            {groupStats.map((g) => {
              const isControl = g.group === "Control";
              return (
                <div
                  key={g.group}
                  className="rounded-lg px-2.5 py-2 relative overflow-hidden"
                  style={{
                    background: "var(--card-bg-hover)",
                    border: isControl
                      ? "1px dashed var(--card-border)"
                      : `1px solid ${g.color}33`,
                    opacity: isControl ? 0.85 : 1,
                  }}
                >
                  {/* Color accent top bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: g.color }}
                  />
                  {/* Group label */}
                  <div className="flex items-center gap-1.5 mb-1.5 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: g.color }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: g.color }}
                    >
                      {g.short}
                    </span>
                    {isControl && (
                      <span className="text-[7px] text-[var(--text-tertiary)] font-medium uppercase tracking-wider">
                        ref
                      </span>
                    )}
                  </div>
                  {/* Metrics */}
                  <div className="space-y-1">
                    <div>
                      <div className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {formatNumber(g.count)}
                      </div>
                      <div className="text-[8px] text-[var(--text-tertiary)]">
                        farmers · {g.pctOfTotal.toFixed(0)}%
                      </div>
                    </div>
                    <div
                      className="w-full h-px"
                      style={{ background: "var(--card-border)" }}
                    />
                    <div className="flex justify-between items-baseline">
                      <span className="text-[8px] text-[var(--text-tertiary)]">
                        Avg income
                      </span>
                      <span className="text-[10px] font-bold font-mono text-[var(--text-primary)]">
                        {formatUSD(g.avgIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[8px] text-[var(--text-tertiary)]">
                        Above LIB
                      </span>
                      <span
                        className="text-[10px] font-bold font-mono"
                        style={{
                          color:
                            g.aboveLIBPct >= 30
                              ? "var(--color-accent)"
                              : g.aboveLIBPct >= 15
                                ? "var(--color-brand-gold)"
                                : "var(--text-secondary)",
                        }}
                      >
                        {g.aboveLIBPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[8px] text-[var(--text-tertiary)]">
                        GAP Adopt
                      </span>
                      <span className="text-[10px] font-bold font-mono text-[var(--text-secondary)]">
                        {g.adoptionPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Multi-metric Grouped Bar: Treatment vs Control comparison ─── */}
          {comparisonData.length > 0 && (
            <SubChart
              title="Key Metrics by Group (%)"
              tableData={comparisonTableData}
              expandedContent={
                <MiniGroupedBarChart
                  data={comparisonData}
                  keys={groupedBarKeys}
                  nameKey="category"
                  height={300}
                  tooltipTitle="Group Comparison (% of group)"
                  tooltipFormatter={(v) => `${v.toFixed(1)}%`}
                />
              }
            >
              <MiniGroupedBarChart
                data={comparisonData}
                keys={groupedBarKeys}
                nameKey="category"
                height={160}
                tooltipTitle="Group Comparison (% of group)"
                tooltipFormatter={(v) => `${v.toFixed(1)}%`}
              />
            </SubChart>
          )}

          <SectionActionLink href="/segments" label="Explore Project Groups in Detail" />
        </>
      )}
    </Section>
  );
}

// Legacy alias
export { ProjectGroupSection as SegmentationSection };
