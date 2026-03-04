"use client";

/* ------------------------------------------------------------------ */
/*  ParallelTrendsChart                                                */
/*  Diff-in-Diff visual: treatment & control lines across baseline     */
/*  and midline, with an optional counterfactual (dashed) projection.  */
/*                                                                     */
/*  Built on Recharts for consistency with existing charts.            */
/*  Features: animated entrance, counterfactual line, intervention     */
/*  marker, annotated treatment effect gap, theme-aware.               */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { CHART_THEME } from "@/lib/data/constants";
import CustomTooltip from "./CustomTooltip";

export interface ParallelTrendsGroup {
  key: string;
  label: string;
  color: string;
  baseline: number;
  midline: number;
  /** If true, the counterfactual (dashed) line is drawn from baseline
   *  to show where the group would be without intervention */
  showCounterfactual?: boolean;
}

interface ParallelTrendsChartProps {
  groups: ParallelTrendsGroup[];
  /** Control group key — used for counterfactual calculation */
  controlKey?: string;
  height?: number;
  /** Label for the x-axis points */
  xLabels?: [string, string];
  /** Format function for y-axis values */
  yAxisFormatter?: (v: number) => string;
  /** Unit for tooltip */
  tooltipUnit?: string;
  /** Title for tooltip */
  tooltipTitle?: string;
}

export default function ParallelTrendsChart({
  groups,
  controlKey = "Control",
  height = 300,
  xLabels = ["Baseline", "Midline"],
  yAxisFormatter,
  tooltipUnit,
  tooltipTitle = "Trend Comparison",
}: ParallelTrendsChartProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const controlGroup = groups.find((g) => g.key === controlKey);
  const controlChange = controlGroup
    ? controlGroup.midline - controlGroup.baseline
    : 0;

  // Build data points: Baseline and Midline columns
  const { data, series, counterfactualSeries, annotations } = useMemo(() => {
    const baselinePoint: Record<string, unknown> = { round: xLabels[0] };
    const midlinePoint: Record<string, unknown> = { round: xLabels[1] };
    const cfMidlinePoint: Record<string, unknown> = { round: xLabels[1] };

    const seriesArr: { key: string; label: string; color: string }[] = [];
    const cfSeriesArr: { key: string; label: string; color: string }[] = [];
    const annots: {
      group: string;
      color: string;
      treatmentEffect: number;
      midlineY: number;
      counterfactualY: number;
    }[] = [];

    for (const g of groups) {
      baselinePoint[g.key] = g.baseline;
      midlinePoint[g.key] = g.midline;
      seriesArr.push({ key: g.key, label: g.label, color: g.color });

      // Projected: where treatment would be if it followed control group's trend (no intervention)
      if (g.showCounterfactual && g.key !== controlKey) {
        const cfKey = `${g.key}_cf`;
        const cfValue = g.baseline + controlChange;
        baselinePoint[cfKey] = g.baseline;
        cfMidlinePoint[cfKey] = cfValue;
        cfSeriesArr.push({
          key: cfKey,
          label: `${g.label} (projected, no treatment)`,
          color: g.color,
        });

        annots.push({
          group: g.key,
          color: g.color,
          treatmentEffect: g.midline - cfValue,
          midlineY: g.midline,
          counterfactualY: cfValue,
        });
      }
    }

    // Merge the two points; counterfactual only has baseline + midline
    const d = [
      baselinePoint,
      { ...midlinePoint, ...cfMidlinePoint },
    ];

    return {
      data: d,
      series: seriesArr,
      counterfactualSeries: cfSeriesArr,
      annotations: annots,
    };
  }, [groups, controlKey, controlChange, xLabels]);

  const labelMap = Object.fromEntries([
    ...series.map((s) => [s.key, s.label]),
    ...counterfactualSeries.map((s) => [s.key, s.label]),
  ]);

  const defaultYFmt = (v: number) => {
    if (Math.abs(v) >= 10_000) return `$${(v / 1000).toFixed(0)}k`;
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return v.toFixed(1);
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 80, left: 15, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridStroke}
          />
          <XAxis
            dataKey="round"
            tick={{
              fill: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-heading)",
            }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
            padding={{ left: 30, right: 30 }}
          />
          <YAxis
            tick={{ fill: CHART_THEME.tickFill, fontSize: 11 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
            width={60}
            tickFormatter={yAxisFormatter ?? defaultYFmt}
          />

          <Tooltip
            content={
              <CustomTooltip
                title={tooltipTitle}
                labelMap={labelMap}
                unit={tooltipUnit}
              />
            }
          />

          {/* Intervention marker — subtle vertical band between the two points */}
          <ReferenceArea
            x1={xLabels[0]}
            x2={xLabels[1]}
            fill="var(--color-accent)"
            fillOpacity={0.03}
          />

          {/* Counterfactual (dashed) lines */}
          {counterfactualSeries.map((s) => {
            const parentKey = s.key.replace(/_cf$/, "");
            if (hiddenKeys.has(parentKey)) return null;
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.4}
                dot={false}
                isAnimationActive
                animationDuration={800}
              />
            );
          })}

          {/* Actual group lines */}
          {series.map((s) => {
            if (hiddenKeys.has(s.key)) return null;
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{
                  r: 5,
                  fill: s.color,
                  stroke: "var(--color-surface-1)",
                  strokeWidth: 2.5,
                }}
                activeDot={{
                  r: 7,
                  fill: s.color,
                  stroke: "var(--text-primary)",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={600}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Treatment effect annotations */}
      {annotations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {annotations.map((a) => {
            const isPositive = a.treatmentEffect >= 0;
            return (
              <div
                key={a.group}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${a.color} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${a.color} 20%, transparent)`,
                }}
              >
                <div
                  className="w-1 h-6 rounded-full"
                  style={{ background: a.color }}
                />
                <div>
                  <div
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: a.color, fontFamily: "var(--font-heading)" }}
                  >
                    Net Treatment Effect
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-sm font-bold font-mono"
                      style={{
                        color: isPositive ? "#00A17D" : "#910D63",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {isPositive ? "+" : ""}
                      {(yAxisFormatter ?? defaultYFmt)(a.treatmentEffect)}
                    </span>
                    <span className="text-[9px] text-[var(--text-tertiary)]">
                      vs control trend
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive legend — click to toggle */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 px-1">
        {series.map((s) => {
          const isHidden = hiddenKeys.has(s.key);
          return (
            <button
              key={s.key}
              className="flex items-center gap-1.5 transition-opacity cursor-pointer"
              style={{ opacity: isHidden ? 0.3 : 1 }}
              onClick={() => toggleKey(s.key)}
              title={isHidden ? `Show ${s.label}` : `Hide ${s.label}`}
            >
              <span
                className="inline-block w-3 h-[3px] rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span
                className="text-[11px]"
                style={{ color: s.color, textDecoration: isHidden ? "line-through" : "none" }}
              >
                {s.label}
              </span>
            </button>
          );
        })}
        {counterfactualSeries.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-[3px] rounded-full opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, var(--text-tertiary) 0, var(--text-tertiary) 3px, transparent 3px, transparent 6px)",
              }}
            />
            <span className="text-[11px] text-[var(--text-tertiary)]">
              Projected (no treatment)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
