"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { CHART_THEME } from "@/lib/data/constants";
import CustomTooltip from "./CustomTooltip";
import type {
  TooltipBenchmark,
  TooltipTrend,
  TooltipSeverity,
} from "./CustomTooltip";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** Dashed line for benchmarks/references */
  dashed?: boolean;
}

interface LineChartComponentProps {
  data: Record<string, unknown>[];
  series: LineSeries[];
  xKey: string;
  height?: number;
  /** Title shown in the tooltip header */
  tooltipTitle?: string;
  /** Format map for tooltip values */
  formatMap?: Record<string, (v: number) => string>;
  /** Unit for tooltip values */
  unit?: string;
  /** Optional reference lines */
  referenceLines?: { y: number; label: string; color: string }[];
  /** Benchmark comparison bar in tooltip */
  tooltipBenchmark?: TooltipBenchmark;
  /** Trend indicator in tooltip */
  tooltipTrend?: TooltipTrend;
  /** Severity badge in tooltip header */
  tooltipSeverity?: TooltipSeverity;
  /** Mini sparkline data in tooltip */
  tooltipSparklineData?: number[];
}

export default function LineChartComponent({
  data,
  series,
  xKey,
  height = 280,
  tooltipTitle,
  formatMap,
  unit,
  referenceLines,
  tooltipBenchmark,
  tooltipTrend,
  tooltipSeverity,
  tooltipSparklineData,
}: LineChartComponentProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const visibleSeries = useMemo(
    () => series.filter((s) => !hiddenKeys.has(s.key)),
    [series, hiddenKeys]
  );

  const toggleSeries = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showAll = () => setHiddenKeys(new Set());
  const hideAll = () => setHiddenKeys(new Set(series.map((s) => s.key)));

  const labelMap = Object.fromEntries(series.map((s) => [s.key, s.label]));

  return (
    <div className="relative">
      {/* Dropdown filter button - top-right corner */}
      <div className="absolute top-0 right-0 z-10">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] hover:border-[var(--card-border-hover)] bg-[var(--card-bg)] text-[var(--text-secondary)] transition-colors"
        >
          <Eye size={11} />
          <span>Series ({visibleSeries.length}/{series.length})</span>
          <ChevronDown
            size={10}
            className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dropdownOpen && (
          <div
            className="absolute right-0 mt-1 w-52 rounded-xl border border-[var(--card-border)] bg-[var(--color-surface-1)] shadow-xl z-20 py-1.5 overflow-hidden"
          >
            {/* Quick actions */}
            <div className="flex gap-1 px-3 py-1.5 border-b border-[var(--card-border)]">
              <button
                onClick={showAll}
                className="text-[10px] px-2 py-1 rounded bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] text-[var(--text-secondary)] transition-colors"
              >
                Show all
              </button>
              <button
                onClick={hideAll}
                className="text-[10px] px-2 py-1 rounded bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] text-[var(--text-secondary)] transition-colors"
              >
                Hide all
              </button>
            </div>
            {series.map((s) => {
              const isVisible = !hiddenKeys.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSeries(s.key)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-[var(--card-bg-hover)] transition-colors text-left"
                >
                  <span
                    className="w-3 h-3 rounded-sm shrink-0 border"
                    style={{
                      backgroundColor: isVisible ? s.color : "transparent",
                      borderColor: s.color,
                    }}
                  />
                  <span
                    className={`text-[11px] flex-1 truncate ${
                      isVisible
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-tertiary)] line-through"
                    }`}
                  >
                    {s.label}
                  </span>
                  {isVisible ? (
                    <Eye size={11} className="text-[var(--text-tertiary)]" />
                  ) : (
                    <EyeOff size={11} className="text-[var(--text-tertiary)]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="pt-1">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_THEME.gridStroke}
            />
            <XAxis
              dataKey={xKey}
              tick={{ fill: CHART_THEME.tickFill, fontSize: 11 }}
              axisLine={{ stroke: CHART_THEME.axisStroke }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHART_THEME.tickFill, fontSize: 11 }}
              axisLine={{ stroke: CHART_THEME.axisStroke }}
              tickLine={false}
              width={55}
            />
            <Tooltip
              content={
                <CustomTooltip
                  title={tooltipTitle}
                  labelMap={labelMap}
                  formatMap={formatMap}
                  unit={unit}
                  benchmark={tooltipBenchmark}
                  trend={tooltipTrend}
                  severity={tooltipSeverity}
                  sparklineData={tooltipSparklineData}
                />
              }
            />

            {/* Reference lines (benchmarks) */}
            {referenceLines?.map((rl, i) => (
              <ReferenceLine
                key={`ref-${i}`}
                y={rl.y}
                stroke={rl.color}
                strokeDasharray="6 4"
                label={{
                  value: rl.label,
                  position: "insideTopRight",
                  fill: rl.color,
                  fontSize: 10,
                }}
              />
            ))}

            {/* Data lines */}
            {visibleSeries.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                dot={{ r: 3.5, fill: s.color, stroke: "var(--color-surface-0)", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: s.color, stroke: "var(--text-primary)", strokeWidth: 2 }}
                isAnimationActive
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Clickable legend icons below chart */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
        {series.map((s) => {
          const isVisible = !hiddenKeys.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`flex items-center gap-1.5 text-[11px] transition-all ${
                isVisible
                  ? "opacity-100"
                  : "opacity-40 line-through"
              }`}
              title={`Click to ${isVisible ? "hide" : "show"} ${s.label}`}
            >
              <span
                className="inline-block w-3 h-[3px] rounded-full shrink-0"
                style={{
                  backgroundColor: s.color,
                  opacity: isVisible ? 1 : 0.3,
                }}
              />
              <span
                className="text-[var(--text-secondary)]"
                style={{ color: isVisible ? s.color : undefined }}
              >
                {s.label}
              </span>
            </button>
          );
        })}
        {hiddenKeys.size > 0 && (
          <button
            onClick={showAll}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
            style={{ color: "var(--color-accent)" }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-[9]"
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}
