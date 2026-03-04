"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { CHART_THEME } from "@/lib/data/constants";
import CustomTooltip from "./CustomTooltip";
import type {
  TooltipBenchmark,
  TooltipTrend,
  TooltipSeverity,
} from "./CustomTooltip";

/** Multi-series definition for grouped/stacked bars */
export interface BarSeries {
  key: string;
  label: string;
  color: string;
  /** Use a lighter opacity for "ghost" / secondary bars */
  opacity?: number;
  /** Stack ID — bars with same stackId stack on top of each other */
  stackId?: string;
}

interface BarChartComponentProps {
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  color?: string;
  /** Per-bar colors (one per data item). When provided, overrides `color`. */
  colors?: string[];
  /** Multi-series grouped/stacked bars — when provided, renders multiple <Bar> elements with interactive legend. Overrides dataKey/color/colors. */
  series?: BarSeries[];
  height?: number;
  layout?: "vertical" | "horizontal";
  /** Title shown in tooltip header */
  tooltipTitle?: string;
  /** Format function for tooltip values */
  tooltipFormatter?: (v: number) => string;
  /** Unit for tooltip values */
  tooltipUnit?: string;
  /** Benchmark comparison bar in tooltip */
  tooltipBenchmark?: TooltipBenchmark;
  /** Trend indicator in tooltip */
  tooltipTrend?: TooltipTrend;
  /** Severity badge in tooltip header */
  tooltipSeverity?: TooltipSeverity;
  /** Mini sparkline data in tooltip */
  tooltipSparklineData?: number[];
  /** Custom YAxis width for vertical layouts (default 100) */
  yAxisWidth?: number;
}

export default function BarChartComponent({
  data,
  dataKey,
  nameKey,
  color = "var(--color-accent)",
  colors,
  series,
  height = 250,
  layout = "horizontal",
  tooltipTitle,
  tooltipFormatter,
  tooltipUnit,
  tooltipBenchmark,
  tooltipTrend,
  tooltipSeverity,
  tooltipSparklineData,
  yAxisWidth = 100,
}: BarChartComponentProps) {
  const isVertical = layout === "vertical";
  const isMultiSeries = series && series.length > 0;

  // Interactive legend state — for per-bar colors (single series) or multi-series
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding all series
        const totalItems = isMultiSeries ? series!.length : data.length;
        if (totalItems - next.size > 1) next.add(key);
      }
      return next;
    });
  };

  // Filter data and colors when items are hidden (single-series per-bar colors mode)
  const { filteredData, filteredColors } = useMemo(() => {
    if (isMultiSeries || !colors || hiddenKeys.size === 0) {
      return { filteredData: data, filteredColors: colors };
    }
    const indices: number[] = [];
    const fd = data.filter((item, i) => {
      const name = String(item[nameKey] ?? "");
      if (hiddenKeys.has(name)) return false;
      indices.push(i);
      return true;
    });
    const fc = indices.map((i) => colors[i % colors.length]);
    return { filteredData: fd, filteredColors: fc };
  }, [data, colors, hiddenKeys, nameKey, isMultiSeries]);

  const formatMap = tooltipFormatter
    ? isMultiSeries
      ? Object.fromEntries(series!.map((s) => [s.key, tooltipFormatter]))
      : { [dataKey]: tooltipFormatter }
    : undefined;

  // Visible series for multi-series mode
  const visibleSeries = isMultiSeries
    ? series!.filter((s) => !hiddenKeys.has(s.key))
    : null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={isMultiSeries ? data : filteredData}
          layout={layout}
          margin={{ top: 5, right: 20, left: 10, bottom: 20 }}
          barGap={isMultiSeries ? 2 : undefined}
          barCategoryGap={isMultiSeries ? "25%" : undefined}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridStroke}
            horizontal={!isVertical}
            vertical={isVertical}
          />
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: CHART_THEME.tickFill, fontSize: CHART_THEME.fontSize }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey={nameKey}
                tick={{ fill: CHART_THEME.tickFill, fontSize: CHART_THEME.fontSize }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
                width={yAxisWidth}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                tick={{ fill: CHART_THEME.tickFill, fontSize: 11 }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: CHART_THEME.tickFill, fontSize: CHART_THEME.fontSize }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
              />
            </>
          )}
          <Tooltip
            content={
              <CustomTooltip
                title={tooltipTitle}
                formatMap={formatMap}
                unit={tooltipUnit}
                benchmark={tooltipBenchmark}
                trend={tooltipTrend}
                severity={tooltipSeverity}
                sparklineData={tooltipSparklineData}
              />
            }
            cursor={{ fill: "var(--card-bg)" }}
          />
          {isMultiSeries ? (
            /* Multi-series mode: one <Bar> per series */
            visibleSeries!.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                fillOpacity={s.opacity ?? 1}
                stackId={s.stackId}
                radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                isAnimationActive
              />
            ))
          ) : (
            /* Single-series mode */
            <Bar
              dataKey={dataKey}
              fill={filteredColors ? undefined : color}
              radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive
            >
              {filteredColors && filteredData.map((_, i) => (
                <Cell key={i} fill={filteredColors[i % filteredColors.length]} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* Interactive clickable legend — multi-series mode */}
      {isMultiSeries && series!.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 px-1"
          role="group"
          aria-label="Toggle series visibility"
        >
          {series!.map((s) => {
            const isVisible = !hiddenKeys.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggleKey(s.key)}
                className="flex items-center gap-1.5 text-[11px] transition-all cursor-pointer"
                style={{ opacity: isVisible ? 1 : 0.35 }}
                aria-pressed={isVisible}
                title={`Click to ${isVisible ? "hide" : "show"} ${s.label}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isVisible ? s.color : "var(--text-tertiary)",
                    opacity: isVisible ? (s.opacity ?? 1) : 0.3,
                  }}
                />
                <span
                  className={isVisible ? "" : "line-through"}
                  style={{ color: isVisible ? s.color : "var(--text-tertiary)" }}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
          {hiddenKeys.size > 0 && (
            <button
              onClick={() => setHiddenKeys(new Set())}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
              style={{ color: "var(--color-accent)" }}
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Interactive clickable legend — single-series per-bar colors mode */}
      {!isMultiSeries && colors && colors.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 px-1"
          role="group"
          aria-label="Toggle bar visibility"
        >
          {data.map((item, i) => {
            const name = String(item[nameKey] ?? "");
            const barColor = colors[i % colors.length];
            const isVisible = !hiddenKeys.has(name);
            return (
              <button
                key={name}
                onClick={() => toggleKey(name)}
                className="flex items-center gap-1.5 text-[11px] transition-all cursor-pointer"
                style={{ opacity: isVisible ? 1 : 0.35 }}
                aria-pressed={isVisible}
                title={`Click to ${isVisible ? "hide" : "show"} ${name}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isVisible ? barColor : "var(--text-tertiary)",
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
                <span
                  className={isVisible ? "" : "line-through"}
                  style={{ color: isVisible ? barColor : "var(--text-tertiary)" }}
                >
                  {name}
                </span>
              </button>
            );
          })}
          {hiddenKeys.size > 0 && (
            <button
              onClick={() => setHiddenKeys(new Set())}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
              style={{ color: "var(--color-accent)" }}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
