"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Maximize2, Table2, BarChart3, Download } from "lucide-react";
import { GENDER_COLORS, CHART_THEME } from "@/lib/data/constants";
import { formatNumber } from "@/lib/utils/formatters";
import type { Farmer } from "@/lib/data/types";
import ChartExpandModal from "@/components/charts/ChartExpandModal";
import {
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import CustomTooltip from "@/components/charts/CustomTooltip";

/* ===================================================================
   HELPER FUNCTIONS
   =================================================================== */

/** Safe numeric mean — filters out non-finite values */
export function safeMean(arr: (number | null | undefined)[]): number {
  const valid = arr.filter(
    (v): v is number => typeof v === "number" && isFinite(v)
  );
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

/** Count farmers matching a predicate, return percentage */
export function pct(data: Farmer[], pred: (f: Farmer) => boolean): number {
  return data.length ? (data.filter(pred).length / data.length) * 100 : 0;
}

/** Gender-split percentage */
export function genderPct(
  data: Farmer[],
  gender: string,
  pred: (f: Farmer) => boolean
): number {
  const g = data.filter((f) => f.gender === gender);
  return g.length ? (g.filter(pred).length / g.length) * 100 : 0;
}

/* ===================================================================
   CSV DOWNLOAD UTILITY
   =================================================================== */

export interface TableRow {
  [key: string]: string | number | null | undefined;
}

function downloadCSV(rows: TableRow[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          return str.includes(",") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ===================================================================
   MINI TABLE COMPONENT — renders tabular view of chart data
   =================================================================== */

function MiniTable({ rows, title }: { rows: TableRow[]; title: string }) {
  if (!rows.length) return <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">No data</p>;
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Table View</span>
        <button
          onClick={() => downloadCSV(rows, title.replace(/\s+/g, "_").toLowerCase())}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
          style={{ color: "var(--color-accent)" }}
          aria-label="Download table data as CSV"
        >
          <Download size={10} aria-hidden="true" />
          CSV
        </button>
      </div>
      <table className="w-full text-[10px]" role="table" aria-label={`${title} data`}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: "1px solid var(--card-border)" }}
              className="hover:bg-[var(--card-bg-hover)] transition-colors"
            >
              {headers.map((h) => (
                <td key={h} className="px-2 py-1.5 font-mono text-[var(--text-secondary)]">
                  {row[h] != null ? String(row[h]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================================================================
   INTERACTIVE CHART COMPONENTS (Recharts-based with tooltips)
   =================================================================== */

/**
 * Stacked horizontal bar distribution chart — pure CSS, no Recharts.
 * Replaces MiniDonutChart for reliable rendering without clipping issues.
 * Interactive: hover over any bar segment to see a floating tooltip.
 * Legend is compact: just color dots and names.
 */
export function MiniDonutChart({
  data,
  centerValue,
  centerLabel,
  expanded = false,
}: {
  data: { name: string; value: number; color: string }[];
  /** @deprecated kept for API compat — ignored */
  height?: number;
  /** @deprecated kept for API compat — ignored */
  tooltipTitle?: string;
  centerValue?: string;
  centerLabel?: string;
  /** @deprecated kept for API compat — ignored */
  innerRadius?: number;
  /** @deprecated kept for API compat — ignored */
  outerRadius?: number;
  /** @deprecated kept for API compat — ignored */
  showLabels?: boolean;
  /** Render in expanded (modal) mode with bigger bars */
  expanded?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hovered, setHovered] = useState<number | null>(null);

  if (!total) return null;

  const barH = expanded ? 28 : 16;

  return (
    <div style={{ width: "100%" }}>
      {/* Optional summary value */}
      {centerValue && (
        <div className="flex items-baseline gap-1.5 mb-2">
          <span
            className="font-mono font-extrabold"
            style={{
              fontSize: expanded ? 22 : 16,
              color: "var(--text-primary)",
            }}
          >
            {centerValue}
          </span>
          {centerLabel && (
            <span
              className="text-[var(--text-tertiary)] font-medium"
              style={{ fontSize: expanded ? 12 : 10 }}
            >
              {centerLabel}
            </span>
          )}
        </div>
      )}

      {/* Stacked bar with hover tooltip */}
      <div className="relative">
        <div
          className="flex w-full overflow-hidden"
          style={{ height: barH, borderRadius: barH / 2 }}
        >
          {data.map((entry, i) => {
            const pctVal = (entry.value / total) * 100;
            if (pctVal === 0) return null;
            const isHovered = hovered === i;
            return (
              <div
                key={i}
                className="relative flex items-center justify-center cursor-pointer transition-opacity duration-150"
                style={{
                  width: `${pctVal}%`,
                  background: entry.color,
                  minWidth: pctVal > 0 ? 4 : 0,
                  opacity: hovered !== null && !isHovered ? 0.5 : 1,
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {expanded && pctVal > 14 && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm">
                    {pctVal.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating tooltip */}
        {hovered !== null && data[hovered] && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              bottom: barH + 6,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
              style={{
                background: "var(--color-surface-1)",
                border: "1px solid var(--card-border)",
                boxShadow: "var(--shadow-tooltip)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: data[hovered].color }}
                />
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {data[hovered].name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                  {data[hovered].value.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                  ({((data[hovered].value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact color legend — just dots and names */}
      <div className={`flex flex-wrap gap-x-3 gap-y-1 mt-2 ${expanded ? "" : ""}`}>
        {data.map((entry, i) => {
          const pctVal = (entry.value / total) * 100;
          if (pctVal === 0) return null;
          return (
            <div
              key={i}
              className="flex items-center gap-1 cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ opacity: hovered !== null && hovered !== i ? 0.45 : 1, transition: "opacity 0.15s" }}
            >
              <div
                className="shrink-0 rounded-full"
                style={{
                  width: expanded ? 8 : 6,
                  height: expanded ? 8 : 6,
                  background: entry.color,
                }}
              />
              <span
                style={{
                  fontSize: expanded ? 11 : 9,
                  color: "var(--text-tertiary)",
                }}
              >
                {entry.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact interactive bar chart for analytics panel.
 * Uses Recharts BarChart + CustomTooltip for hover interactivity.
 */
export function MiniBarChart({
  data,
  dataKey,
  nameKey,
  color = "#007BFF",
  height = 160,
  layout = "horizontal",
  tooltipTitle,
  tooltipFormatter,
  tooltipUnit,
  barRadius,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  color?: string;
  height?: number;
  layout?: "vertical" | "horizontal";
  tooltipTitle?: string;
  tooltipFormatter?: (v: number) => string;
  tooltipUnit?: string;
  barRadius?: number;
}) {
  const isVertical = layout === "vertical";
  const formatMap = tooltipFormatter
    ? { [dataKey]: tooltipFormatter }
    : undefined;

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={
          isVertical
            ? { top: 4, right: 8, left: 4, bottom: 4 }
            : { top: 4, right: 8, left: -10, bottom: 4 }
        }
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
              tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
              axisLine={{ stroke: CHART_THEME.axisStroke }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey={nameKey}
              tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
              axisLine={{ stroke: CHART_THEME.axisStroke }}
              tickLine={false}
              width={100}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={nameKey}
              tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
              axisLine={{ stroke: CHART_THEME.axisStroke }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
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
            />
          }
          cursor={{ fill: "var(--card-bg)" }}
        />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={
            isVertical
              ? [0, barRadius ?? 3, barRadius ?? 3, 0]
              : [barRadius ?? 3, barRadius ?? 3, 0, 0]
          }
          isAnimationActive
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Compact interactive bar chart with individual colored bars.
 * Each bar gets its own color — useful for category comparisons.
 * Includes interactive clickable legend to toggle bar visibility.
 */
export function MiniColorBarChart({
  data,
  height = 160,
  layout = "horizontal",
  tooltipTitle,
  tooltipFormatter,
  tooltipUnit,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  layout?: "vertical" | "horizontal";
  tooltipTitle?: string;
  tooltipFormatter?: (v: number) => string;
  tooltipUnit?: string;
}) {
  const isVertical = layout === "vertical";
  const formatMap = tooltipFormatter ? { value: tooltipFormatter } : undefined;
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(new Set());

  const toggleName = (name: string) => {
    setHiddenNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        if (data.length - next.size > 1) next.add(name);
      }
      return next;
    });
  };

  const filteredData = hiddenNames.size > 0
    ? data.filter((d) => !hiddenNames.has(d.name))
    : data;

  if (!data.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={filteredData}
          layout={layout}
          margin={
            isVertical
              ? { top: 4, right: 8, left: 4, bottom: 4 }
              : { top: 4, right: 8, left: -10, bottom: 4 }
          }
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
                tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
                width={70}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                axisLine={{ stroke: CHART_THEME.axisStroke }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
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
              />
            }
            cursor={{ fill: "var(--card-bg)" }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive>
            {filteredData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Interactive clickable legend */}
      {data.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-0.5">
          {data.map((entry) => {
            const isVisible = !hiddenNames.has(entry.name);
            return (
              <button
                key={entry.name}
                onClick={() => toggleName(entry.name)}
                className="flex items-center gap-1 text-[9px] transition-all cursor-pointer"
                style={{ opacity: isVisible ? 1 : 0.35 }}
                title={`Click to ${isVisible ? "hide" : "show"} ${entry.name}`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isVisible ? entry.color : "var(--text-tertiary)",
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
                <span
                  className={isVisible ? "" : "line-through"}
                  style={{ color: isVisible ? entry.color : "var(--text-tertiary)" }}
                >
                  {entry.name}
                </span>
              </button>
            );
          })}
          {hiddenNames.size > 0 && (
            <button
              onClick={() => setHiddenNames(new Set())}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
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

/**
 * Compact grouped bar chart for comparing categories (e.g., Male vs Female).
 * Includes interactive clickable legend to toggle series visibility.
 */
export function MiniGroupedBarChart({
  data,
  keys,
  nameKey,
  height = 160,
  tooltipTitle,
  tooltipFormatter,
  tooltipUnit,
}: {
  data: Record<string, unknown>[];
  keys: { dataKey: string; color: string; label: string }[];
  nameKey: string;
  height?: number;
  tooltipTitle?: string;
  tooltipFormatter?: (v: number) => string;
  tooltipUnit?: string;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (keys.length - next.size > 1) next.add(key);
      }
      return next;
    });
  };

  const visibleKeys = keys.filter((k) => !hiddenKeys.has(k.dataKey));

  const formatMap: Record<string, (v: number) => string> = {};
  if (tooltipFormatter) {
    for (const k of keys) formatMap[k.dataKey] = tooltipFormatter;
  }
  const labelMap: Record<string, string> = {};
  for (const k of keys) labelMap[k.dataKey] = k.label;

  if (!data.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -10, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridStroke}
          />
          <XAxis
            dataKey={nameKey}
            tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                title={tooltipTitle}
                formatMap={Object.keys(formatMap).length ? formatMap : undefined}
                labelMap={labelMap}
                unit={tooltipUnit}
              />
            }
            cursor={{ fill: "var(--card-bg)" }}
          />
          {visibleKeys.map((k) => (
            <Bar
              key={k.dataKey}
              dataKey={k.dataKey}
              fill={k.color}
              radius={[3, 3, 0, 0]}
              isAnimationActive
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Interactive clickable legend */}
      {keys.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-0.5">
          {keys.map((k) => {
            const isVisible = !hiddenKeys.has(k.dataKey);
            return (
              <button
                key={k.dataKey}
                onClick={() => toggleKey(k.dataKey)}
                className="flex items-center gap-1 text-[9px] transition-all cursor-pointer"
                style={{ opacity: isVisible ? 1 : 0.35 }}
                title={`Click to ${isVisible ? "hide" : "show"} ${k.label}`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isVisible ? k.color : "var(--text-tertiary)",
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
                <span
                  className={isVisible ? "" : "line-through"}
                  style={{ color: isVisible ? k.color : "var(--text-tertiary)" }}
                >
                  {k.label}
                </span>
              </button>
            );
          })}
          {hiddenKeys.size > 0 && (
            <button
              onClick={() => setHiddenKeys(new Set())}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
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

/**
 * Compact stacked bar chart for showing category breakdowns by group.
 * X-axis = categories, stacked bars colored by group keys.
 * Includes interactive clickable legend to toggle stack visibility.
 */
export function MiniStackedBarChart({
  data,
  keys,
  nameKey,
  height = 160,
  tooltipTitle,
  tooltipFormatter,
  tooltipUnit,
}: {
  data: Record<string, unknown>[];
  keys: { dataKey: string; color: string; label: string }[];
  nameKey: string;
  height?: number;
  tooltipTitle?: string;
  tooltipFormatter?: (v: number) => string;
  tooltipUnit?: string;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (keys.length - next.size > 1) next.add(key);
      }
      return next;
    });
  };

  const visibleKeys = keys.filter((k) => !hiddenKeys.has(k.dataKey));

  const formatMap: Record<string, (v: number) => string> = {};
  if (tooltipFormatter) {
    for (const k of keys) formatMap[k.dataKey] = tooltipFormatter;
  }
  const labelMap: Record<string, string> = {};
  for (const k of keys) labelMap[k.dataKey] = k.label;

  if (!data.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -10, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridStroke}
          />
          <XAxis
            dataKey={nameKey}
            tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                title={tooltipTitle}
                formatMap={Object.keys(formatMap).length ? formatMap : undefined}
                labelMap={labelMap}
                unit={tooltipUnit}
              />
            }
            cursor={{ fill: "var(--card-bg)" }}
          />
          {visibleKeys.map((k) => (
            <Bar
              key={k.dataKey}
              dataKey={k.dataKey}
              stackId="stack"
              fill={k.color}
              radius={[0, 0, 0, 0]}
              isAnimationActive
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Interactive clickable legend */}
      {keys.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-0.5">
          {keys.map((k) => {
            const isVisible = !hiddenKeys.has(k.dataKey);
            return (
              <button
                key={k.dataKey}
                onClick={() => toggleKey(k.dataKey)}
                className="flex items-center gap-1 text-[9px] transition-all cursor-pointer"
                style={{ opacity: isVisible ? 1 : 0.35 }}
                title={`Click to ${isVisible ? "hide" : "show"} ${k.label}`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isVisible ? k.color : "var(--text-tertiary)",
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
                <span
                  className={isVisible ? "" : "line-through"}
                  style={{ color: isVisible ? k.color : "var(--text-tertiary)" }}
                >
                  {k.label}
                </span>
              </button>
            );
          })}
          {hiddenKeys.size > 0 && (
            <button
              onClick={() => setHiddenKeys(new Set())}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
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

/* ===================================================================
   CROP TAB BAR — reusable crop selector for per-crop detail views
   =================================================================== */

export function CropTabBar({
  crops,
  selected,
  onSelect,
}: {
  crops: { key: string; name: string; color: string; count: number }[];
  selected: string | null;
  onSelect: (crop: string | null) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 pb-1" role="tablist" aria-label="Crop filter">
      {/* "All" overview tab */}
      <button
        onClick={() => onSelect(null)}
        role="tab"
        aria-selected={selected === null}
        aria-label="All crops"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-all shrink-0 whitespace-nowrap"
        style={{
          background: selected === null ? "var(--color-brand-gold)" : "var(--card-bg-hover)",
          color: selected === null ? "#1A0E2E" : "var(--text-secondary)",
          border: `1px solid ${selected === null ? "var(--color-brand-gold)" : "var(--card-border)"}`,
        }}
      >
        All
      </button>
      {crops.map((crop) => {
        const isActive = selected === crop.key;
        return (
          <button
            key={crop.key}
            onClick={() => onSelect(crop.key)}
            role="tab"
            aria-selected={isActive}
            aria-label={`${crop.name} (${crop.count} farmers)`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-all shrink-0 whitespace-nowrap"
            style={{
              background: isActive ? crop.color : "var(--card-bg-hover)",
              color: isActive ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${isActive ? crop.color : "var(--card-border)"}`,
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: isActive ? "#fff" : crop.color }}
              aria-hidden="true"
            />
            {crop.name}
            <span
              className="text-[9px] font-mono opacity-80"
              style={{ color: isActive ? "rgba(255,255,255,0.8)" : "var(--text-tertiary)" }}
            >
              {crop.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ===================================================================
   SIMPLE DISPLAY COMPONENTS (non-chart)
   =================================================================== */

export function StatRow({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-[var(--text-tertiary)]">{label}</span>
      <div className="text-right">
        <span
          className="text-[11px] font-bold font-mono"
          style={{ color: color || "var(--text-primary)" }}
        >
          {value}
        </span>
        {sub && (
          <span className="text-[9px] text-[var(--text-tertiary)] ml-1">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

export function GenderBar({
  male,
  female,
  total,
}: {
  male: number;
  female: number;
  total: number;
}) {
  const malePct = total ? (male / total) * 100 : 0;
  const femalePct = total ? (female / total) * 100 : 0;
  const [hovered, setHovered] = useState<"male" | "female" | null>(null);

  const segments: { key: "male" | "female"; label: string; count: number; pct: number; color: string }[] = [
    { key: "male", label: "Male", count: male, pct: malePct, color: GENDER_COLORS.Male },
    { key: "female", label: "Female", count: female, pct: femalePct, color: GENDER_COLORS.Female },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: GENDER_COLORS.Male }}
          />
          <span className="text-[10px] text-[var(--text-secondary)]">Male</span>
          <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
            {formatNumber(male)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
            {formatNumber(female)}
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">
            Female
          </span>
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: GENDER_COLORS.Female }}
          />
        </div>
      </div>
      <div className="relative">
        <div
          className="flex h-2.5 rounded-full overflow-hidden cursor-pointer"
          style={{ background: "var(--card-border)" }}
        >
          {segments.map((seg) => (
            <div
              key={seg.key}
              className="h-full transition-opacity duration-150"
              style={{
                width: `${seg.pct}%`,
                background: seg.color,
                opacity: hovered !== null && hovered !== seg.key ? 0.4 : 1,
              }}
              onMouseEnter={() => setHovered(seg.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </div>

        {/* Styled floating tooltip */}
        {hovered !== null && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              bottom: 16,
              left: hovered === "male" ? `${malePct / 2}%` : `${malePct + femalePct / 2}%`,
              transform: "translateX(-50%)",
            }}
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
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: segments.find((s) => s.key === hovered)!.color }}
                />
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {segments.find((s) => s.key === hovered)!.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                  {formatNumber(segments.find((s) => s.key === hovered)!.count)} farmers
                </span>
                <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                  ({segments.find((s) => s.key === hovered)!.pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] font-mono text-[var(--text-tertiary)]">
          {malePct.toFixed(1)}%
        </span>
        <span className="text-[9px] font-mono text-[var(--text-tertiary)]">
          {femalePct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/** Inline color legend row */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: item.color }}
          />
          <span className="text-[9px] text-[var(--text-tertiary)]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ===================================================================
   SECTION ACTION LINK — navigates to another tab/page
   =================================================================== */

export function SectionActionLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all group"
      style={{
        background: "rgba(0,204,204,0.06)",
        border: "1px solid rgba(0,204,204,0.18)",
        color: "#00CCCC",
      }}
    >
      {icon}
      <span>{label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    </Link>
  );
}

/* ===================================================================
   SECTION WRAPPER — Card with header, expand, chart/table toggle, CSV
   =================================================================== */

export function Section({
  id,
  title,
  icon,
  description,
  expandable,
  tableData,
  children,
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  description?: string;
  defaultOpen?: boolean;
  expandable?: boolean;
  summary?: string;
  /** Pass table data to enable chart ↔ table toggle + CSV download */
  tableData?: TableRow[];
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const handleDownload = useCallback(() => {
    if (tableData) downloadCSV(tableData, title.replace(/\s+/g, "_").toLowerCase());
  }, [tableData, title]);

  return (
    <div
      id={id}
      className="rounded-xl scroll-mt-16"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <h3
            className="text-[11px] font-bold uppercase tracking-wider m-0"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </h3>
          {description && (
            <p className="text-[9px] text-[var(--text-tertiary)] leading-tight truncate">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {/* Chart / Table toggle */}
          {tableData && tableData.length > 0 && (
            <>
              <button
                onClick={() => setShowTable(!showTable)}
                className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                aria-label={showTable ? "Show chart" : "Show table"}
                title={showTable ? "Chart view" : "Table view"}
              >
                {showTable ? (
                  <BarChart3 size={12} style={{ color: "var(--color-accent)" }} />
                ) : (
                  <Table2 size={12} style={{ color: "var(--text-tertiary)" }} />
                )}
              </button>
              <button
                onClick={handleDownload}
                className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                aria-label="Download CSV"
                title="Download as CSV"
              >
                <Download size={12} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </>
          )}
          {expandable && (
            <button
              onClick={() => setExpanded(true)}
              className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
              aria-label={`Expand ${title}`}
              title="Expand chart"
            >
              <Maximize2 size={12} style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-3">
        {showTable && tableData && tableData.length > 0 ? (
          <MiniTable rows={tableData} title={title} />
        ) : (
          children
        )}
      </div>

      {expandable && (
        <ChartExpandModal
          open={expanded}
          onClose={() => setExpanded(false)}
          title={title}
        >
          {children}
        </ChartExpandModal>
      )}
    </div>
  );
}

/* ===================================================================
   SUB-CHART CARD — wraps individual charts within a Section
   Provides visual separation, title, and individual expand capability.
   =================================================================== */

export function SubChart({
  title,
  children,
  expandedContent,
  tableData,
  legend,
  noPad,
}: {
  title: string;
  children: React.ReactNode;
  /** Optional separate content for the expanded modal (e.g. larger chart) */
  expandedContent?: React.ReactNode;
  /** Table rows shown in expanded view below the chart + enables inline table/CSV toggle */
  tableData?: TableRow[];
  /** Optional legend rendered below the chart */
  legend?: React.ReactNode;
  /** Disable inner padding (for charts that need edge-to-edge rendering) */
  noPad?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const handleDownload = useCallback(() => {
    if (tableData) downloadCSV(tableData, title.replace(/\s+/g, "_").toLowerCase());
  }, [tableData, title]);

  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--card-bg-hover)",
        border: "1px solid var(--card-border)",
      }}
    >
      {/* Sub-chart header */}
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
          {title}
        </span>
        <div className="flex items-center gap-0.5">
          {tableData && tableData.length > 0 && (
            <>
              <button
                onClick={() => setShowTable(!showTable)}
                className="p-1 rounded-md hover:bg-[var(--card-bg)] transition-colors"
                aria-label={showTable ? "Show chart" : "Show table"}
                title={showTable ? "Chart view" : "Table view"}
              >
                {showTable ? (
                  <BarChart3 size={10} style={{ color: "var(--color-accent)" }} />
                ) : (
                  <Table2 size={10} style={{ color: "var(--text-tertiary)" }} />
                )}
              </button>
              <button
                onClick={handleDownload}
                className="p-1 rounded-md hover:bg-[var(--card-bg)] transition-colors"
                aria-label="Download CSV"
                title="Download as CSV"
              >
                <Download size={10} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(true)}
            className="p-1 rounded-md hover:bg-[var(--card-bg)] transition-colors"
            aria-label={`Expand ${title}`}
            title={`Expand ${title}`}
          >
            <Maximize2 size={10} style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Chart content — min-w-0 prevents flex overflow */}
      <div className={`min-w-0 ${noPad ? "" : "px-2.5 pb-2.5"}`}>
        {showTable && tableData && tableData.length > 0 ? (
          <MiniTable rows={tableData} title={title} />
        ) : (
          <>
            {children}
            {legend && <div className="mt-1.5">{legend}</div>}
          </>
        )}
      </div>

      {/* Individual expand modal */}
      <ChartExpandModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title={title}
      >
        {expandedContent || children}
        {legend && <div className="mt-3">{legend}</div>}
        {tableData && tableData.length > 0 && (
          <div className="mt-4 border-t border-[var(--card-border)] pt-3">
            <MiniTable rows={tableData} title={title} />
          </div>
        )}
      </ChartExpandModal>
    </div>
  );
}
