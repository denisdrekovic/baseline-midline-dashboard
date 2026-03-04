"use client";

import type { DIDResult } from "@/lib/utils/comparison";
import { significanceStars } from "@/lib/utils/comparison";
import { formatUSD, formatPercent } from "@/lib/utils/formatters";
import { PROJECT_COLORS } from "@/lib/data/constants";
import type { ProjectGroup } from "@/lib/data/types";

interface DIDCardProps {
  result: DIDResult;
}

function fmtVal(value: number, format: string): string {
  switch (format) {
    case "currency":
      return formatUSD(value);
    case "percent":
      return formatPercent(value);
    default:
      return value.toFixed(2);
  }
}

function fmtChange(value: number, format: string): string {
  const sign = value >= 0 ? "+" : "";
  switch (format) {
    case "currency":
      return `${sign}${formatUSD(value)}`;
    case "percent":
      return `${sign}${value.toFixed(1)}pp`;
    default:
      return `${sign}${value.toFixed(2)}`;
  }
}

function inferFormat(metricId: string): string {
  if (metricId.includes("Income") || metricId === "medianIncome" || metricId === "avgIncome") return "currency";
  if (metricId.includes("Pct") || metricId === "libPct" || metricId === "offFarmDep") return "percent";
  return "index";
}

export default function DIDCard({ result }: DIDCardProps) {
  const format = inferFormat(result.metric);
  const stars = significanceStars(result.pValue);
  const groupColor = PROJECT_COLORS[result.treatmentGroup as ProjectGroup] || "#007BFF";
  const isPositiveEffect = result.treatmentEffect > 0;

  return (
    <div
      className="brand-card p-3 space-y-2"
      style={{ borderLeft: `3px solid ${groupColor}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {result.label}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: `${groupColor}20`,
            color: groupColor,
          }}
        >
          {result.treatmentGroup}
        </span>
      </div>

      {/* Treatment vs Control changes */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">
            Treatment
          </div>
          <div className="text-xs font-mono font-bold text-[var(--text-primary)]">
            {fmtChange(result.treatmentChange, format)}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">
            Control
          </div>
          <div className="text-xs font-mono font-bold text-[var(--text-primary)]">
            {fmtChange(result.controlChange, format)}
          </div>
        </div>
      </div>

      {/* Net Effect */}
      <div
        className="flex items-center justify-between px-2 py-1.5 rounded-lg"
        style={{
          background: isPositiveEffect
            ? "rgba(0, 161, 125, 0.08)"
            : "rgba(145, 13, 99, 0.08)",
        }}
      >
        <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">
          Net Effect
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-bold font-mono"
            style={{
              color: isPositiveEffect ? "#00A17D" : "#910D63",
            }}
          >
            {fmtChange(result.treatmentEffect, format)}
          </span>
          {stars && stars !== "ns" && (
            <span className="text-amber-400 text-xs font-bold">{stars}</span>
          )}
        </div>
      </div>
    </div>
  );
}
