"use client";

/* ------------------------------------------------------------------
   CropIncomeBarCard
   Comparative area chart showing baseline → midline income per crop.
   Crops on X-axis, income on Y-axis, with two smooth overlapping
   area fills (like a distribution shift chart but for categorical data).
   ------------------------------------------------------------------ */

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Sprout, TrendingUp, TrendingDown } from "lucide-react";
import { formatUSD } from "@/lib/utils/formatters";
import { CHART_THEME } from "@/lib/data/constants";

export interface CropIncomeRow {
  crop: string;
  color: string;
  baseline: number;
  midline: number;
  bGrowers?: number;
  mGrowers?: number;
}

export interface ExtraRow {
  label: string;
  baseline: number;
  midline: number;
}

interface CropIncomeBarCardProps {
  rows: CropIncomeRow[];
  extras?: ExtraRow[];
  metric?: "avg" | "median";
}

export default function CropIncomeBarCard({
  rows,
  extras,
  metric = "avg",
}: CropIncomeBarCardProps) {
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  /* Build chart data: one point per crop */
  const chartData = useMemo(() => {
    return rows.map((row) => ({
      crop: row.crop,
      baseline: Math.max(0, row.baseline),
      midline: Math.max(0, row.midline),
      color: row.color,
      bGrowers: row.bGrowers ?? 0,
      mGrowers: row.mGrowers ?? 0,
    }));
  }, [rows]);

  /* Aggregate shift info */
  const shiftInfo = useMemo(() => {
    if (!rows.length) return null;
    const totalBaseline = rows.reduce((sum, r) => sum + r.baseline, 0);
    const totalMidline = rows.reduce((sum, r) => sum + r.midline, 0);
    const diff = totalMidline - totalBaseline;
    const pctDiff = totalBaseline > 0 ? (diff / totalBaseline) * 100 : 0;
    return { diff, pctDiff };
  }, [rows]);

  if (!rows.length) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sprout size={13} className="text-[var(--text-tertiary)]" />
        <span
          className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Crop Income Comparison
        </span>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--card-bg-hover)] text-[var(--text-quaternary)] font-mono">
          {metric === "avg" ? "avg/farmer" : "median/farmer"}
        </span>
      </div>

      {/* Area chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="cropGrad-baseline" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-baseline)"
                stopOpacity={hoveredSeries === "baseline" ? 0.35 : 0.2}
              />
              <stop offset="100%" stopColor="var(--color-baseline)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cropGrad-midline" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-midline)"
                stopOpacity={hoveredSeries === "midline" ? 0.45 : 0.3}
              />
              <stop offset="100%" stopColor="var(--color-midline)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridStroke}
            vertical={false}
          />

          <XAxis
            dataKey="crop"
            tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
          />

          <YAxis
            tick={{ fill: CHART_THEME.tickFill, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
            }
            width={48}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              const change = d.midline - d.baseline;
              const pctChg = d.baseline > 0 ? (change / d.baseline) * 100 : 0;
              const isPositive = change >= 0;

              return (
                <div
                  className="tooltip-enter rounded-xl overflow-hidden px-3.5 py-2.5"
                  style={{
                    background: "var(--color-surface-1)",
                    border: "1px solid var(--card-border)",
                    boxShadow: "var(--shadow-tooltip)",
                  }}
                >
                  <div
                    className="text-[11px] font-bold mb-2"
                    style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
                  >
                    {d.crop}
                  </div>

                  {/* Baseline */}
                  <div className="flex items-center gap-2 py-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: "var(--color-baseline)" }}
                    />
                    <span className="text-[10px] flex-1" style={{ color: "var(--color-baseline)" }}>Baseline</span>
                    <span className="text-[11px] font-mono font-semibold text-[var(--text-primary)]">
                      {formatUSD(d.baseline)}
                    </span>
                    {d.bGrowers > 0 && (
                      <span className="text-[8px] text-[var(--text-quaternary)] font-mono">n={d.bGrowers}</span>
                    )}
                  </div>

                  {/* Midline */}
                  <div className="flex items-center gap-2 py-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: "var(--color-midline)" }}
                    />
                    <span className="text-[10px] flex-1" style={{ color: "var(--color-midline)" }}>Midline</span>
                    <span className="text-[11px] font-mono font-bold" style={{ color: "var(--color-midline)" }}>
                      {formatUSD(d.midline)}
                    </span>
                    {d.mGrowers > 0 && (
                      <span className="text-[8px] text-[var(--text-quaternary)] font-mono">n={d.mGrowers}</span>
                    )}
                  </div>

                  {/* Change */}
                  <div
                    className="flex items-center gap-1.5 mt-1.5 pt-1.5"
                    style={{ borderTop: "1px solid var(--card-border)" }}
                  >
                    {isPositive ? (
                      <TrendingUp size={11} style={{ color: "var(--color-midline)" }} />
                    ) : (
                      <TrendingDown size={11} style={{ color: "var(--color-negative)" }} />
                    )}
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: isPositive ? "#00A17D" : "#910D63" }}
                    >
                      {isPositive ? "+" : ""}{formatUSD(change)} ({isPositive ? "+" : ""}{pctChg.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            }}
          />

          {/* Baseline area (muted) */}
          <Area
            type="monotone"
            dataKey="baseline"
            stroke="var(--color-baseline)"
            strokeWidth={hoveredSeries === "baseline" ? 2.5 : 1.5}
            fill="url(#cropGrad-baseline)"
            dot={{
              r: 3,
              fill: "var(--color-surface-1)",
              stroke: "var(--text-tertiary)",
              strokeWidth: 1.5,
            }}
            activeDot={{ r: 5, strokeWidth: 2 }}
            isAnimationActive
            animationDuration={800}
            onMouseEnter={() => setHoveredSeries("baseline")}
            onMouseLeave={() => setHoveredSeries(null)}
          />

          {/* Midline area (vibrant) */}
          <Area
            type="monotone"
            dataKey="midline"
            stroke="var(--color-midline)"
            strokeWidth={hoveredSeries === "midline" ? 2.5 : 2}
            fill="url(#cropGrad-midline)"
            dot={{
              r: 3,
              fill: "var(--color-surface-1)",
              stroke: "var(--color-accent)",
              strokeWidth: 1.5,
            }}
            activeDot={{ r: 5, strokeWidth: 2, fill: "var(--color-accent)" }}
            isAnimationActive
            animationDuration={1000}
            onMouseEnter={() => setHoveredSeries("midline")}
            onMouseLeave={() => setHoveredSeries(null)}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Bottom bar: legend + shift annotation */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <button
            className="flex items-center gap-1.5 text-[11px] transition-opacity cursor-default"
            style={{
              opacity: hoveredSeries !== null && hoveredSeries !== "baseline" ? 0.4 : 1,
            }}
            onMouseEnter={() => setHoveredSeries("baseline")}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            <span className="inline-block w-3 h-[3px] rounded-full" style={{ background: "var(--color-baseline)" }} />
            <span style={{ color: "var(--color-baseline)" }}>Baseline</span>
          </button>
          <button
            className="flex items-center gap-1.5 text-[11px] transition-opacity cursor-default"
            style={{
              opacity: hoveredSeries !== null && hoveredSeries !== "midline" ? 0.4 : 1,
            }}
            onMouseEnter={() => setHoveredSeries("midline")}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            <span className="inline-block w-3 h-[3px] rounded-full" style={{ background: "var(--color-midline)" }} />
            <span style={{ color: "var(--color-midline)" }}>Midline</span>
          </button>
        </div>

        {/* Aggregate shift badge */}
        {shiftInfo && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{
              background:
                shiftInfo.diff >= 0
                  ? "rgba(0, 161, 125, 0.12)"
                  : "rgba(145, 13, 99, 0.12)",
              color: shiftInfo.diff >= 0 ? "#00A17D" : "#910D63",
            }}
          >
            <span>{shiftInfo.diff >= 0 ? "↑" : "↓"}</span>
            <span>
              Avg crop income {shiftInfo.diff >= 0 ? "+" : ""}
              {shiftInfo.pctDiff.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Optional extras — styled income cards */}
      {extras && extras.length > 0 && (
        <div
          className="grid gap-3 pt-3"
          style={{
            borderTop: "1px solid var(--card-border)",
            gridTemplateColumns: `repeat(${extras.length}, 1fr)`,
          }}
        >
          {extras.map((item) => {
            const chg = item.midline - item.baseline;
            const pctChg = item.baseline > 0 ? (chg / item.baseline) * 100 : 0;
            const isPositive = chg >= 0;
            const accentColor = isPositive ? "#00A17D" : "#910D63";
            const maxVal = Math.max(item.baseline, item.midline, 1);

            return (
              <div
                key={item.label}
                className="rounded-xl px-3.5 py-3 space-y-2"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}03 100%)`,
                  border: `1px solid ${accentColor}18`,
                }}
              >
                {/* Label */}
                <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-tertiary)" }}>
                  {item.label}
                </div>

                {/* Values row */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                    {formatUSD(item.baseline)}
                  </span>
                  <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                    {formatUSD(item.midline)}
                  </span>
                </div>

                {/* Mini progress bars */}
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-bg-hover)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(item.baseline / maxVal) * 100}%`, background: "color-mix(in srgb, var(--color-baseline) 38%, transparent)" }}
                    />
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-bg-hover)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(item.midline / maxVal) * 100}%`, background: "var(--color-midline)" }}
                    />
                  </div>
                </div>

                {/* Change badge */}
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold"
                  style={{
                    background: `${accentColor}12`,
                    color: accentColor,
                  }}
                >
                  <span>{isPositive ? "↑" : "↓"}</span>
                  <span>
                    {isPositive ? "+" : ""}{formatUSD(chg)}
                    {item.baseline > 0 && ` (${isPositive ? "+" : ""}${pctChg.toFixed(0)}%)`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
