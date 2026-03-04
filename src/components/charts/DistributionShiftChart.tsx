"use client";

/* ------------------------------------------------------------------ */
/*  DistributionShiftChart                                             */
/*  Overlaid kernel density estimation (KDE) curves showing how a      */
/*  continuous variable's distribution shifted between two rounds.      */
/*                                                                     */
/*  Features: smooth density curves, fill gradient, median markers,    */
/*  interactive hover, annotation badges, fully theme-aware.           */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CHART_THEME } from "@/lib/data/constants";

export interface DistributionSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface DistributionShiftChartProps {
  series: DistributionSeries[];
  height?: number;
  /** Label for the x-axis */
  xLabel?: string;
  /** Number of points in the density curve (higher = smoother, default 80) */
  resolution?: number;
  /** Bandwidth multiplier for KDE (default 1.0) */
  bandwidth?: number;
  /** Format function for x-axis values */
  xAxisFormatter?: (v: number) => string;
  /** Show median reference lines */
  showMedians?: boolean;
  /** Show shift annotation */
  showShiftAnnotation?: boolean;
}

/* ═══════ KDE computation ═══════ */

function gaussianKernel(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/** Silverman's rule of thumb for bandwidth */
function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const spread = Math.min(sd, iqr / 1.34);
  return 0.9 * spread * Math.pow(n, -0.2);
}

function computeKDE(
  values: number[],
  min: number,
  max: number,
  nPoints: number,
  bwMultiplier: number
): { x: number; density: number }[] {
  if (!values.length) return [];

  const bw = silvermanBandwidth(values) * bwMultiplier;
  if (bw <= 0) return [];

  const step = (max - min) / (nPoints - 1);
  const result: { x: number; density: number }[] = [];

  for (let i = 0; i < nPoints; i++) {
    const x = min + i * step;
    let sum = 0;
    for (const v of values) {
      sum += gaussianKernel((x - v) / bw);
    }
    result.push({ x, density: sum / (values.length * bw) });
  }

  return result;
}

function computeMedian(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ═══════ Component ═══════ */

export default function DistributionShiftChart({
  series,
  height = 260,
  xLabel,
  resolution = 80,
  bandwidth = 1.0,
  xAxisFormatter,
  showMedians = true,
  showShiftAnnotation = true,
}: DistributionShiftChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { chartData, medians, globalMin, globalMax, shiftInfo } = useMemo(() => {
    // Global range across all series
    const allVals = series.flatMap((s) => s.values);
    if (!allVals.length) {
      return {
        chartData: [],
        medians: [],
        globalMin: 0,
        globalMax: 1,
        shiftInfo: null,
      };
    }

    const sorted = [...allVals].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(sorted.length * 0.02)];
    const p95 = sorted[Math.floor(sorted.length * 0.98)];
    const range = p95 - p5;
    const gMin = p5 - range * 0.1;
    const gMax = p95 + range * 0.1;

    // Compute KDE for each series
    const kdes = series.map((s) =>
      computeKDE(s.values, gMin, gMax, resolution, bandwidth)
    );

    // Merge into single data array for Recharts
    const merged = [];
    for (let i = 0; i < resolution; i++) {
      const point: Record<string, number> = { x: kdes[0]?.[i]?.x ?? 0 };
      for (let j = 0; j < series.length; j++) {
        point[series[j].key] = kdes[j]?.[i]?.density ?? 0;
      }
      merged.push(point);
    }

    // Compute medians
    const meds = series.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      value: computeMedian(s.values),
    }));

    // Shift info (if 2 series)
    let shift = null;
    if (series.length === 2) {
      const med0 = meds[0].value;
      const med1 = meds[1].value;
      const diff = med1 - med0;
      const pctDiff = med0 !== 0 ? (diff / Math.abs(med0)) * 100 : 0;
      shift = {
        diff,
        pctDiff,
        direction: diff >= 0 ? ("right" as const) : ("left" as const),
      };
    }

    return {
      chartData: merged,
      medians: meds,
      globalMin: gMin,
      globalMax: gMax,
      shiftInfo: shift,
    };
  }, [series, resolution, bandwidth]);

  const defaultXFmt = (v: number) => {
    if (Math.abs(v) >= 10_000) return `$${(v / 1000).toFixed(0)}k`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1000).toFixed(1)}k`;
    return v.toFixed(0);
  };

  if (!chartData.length) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={`grad-${s.key}`}
                id={`distGrad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={s.color}
                  stopOpacity={hoveredKey === s.key ? 0.35 : 0.2}
                />
                <stop
                  offset="100%"
                  stopColor={s.color}
                  stopOpacity={0.02}
                />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_THEME.gridStroke}
            vertical={false}
          />

          <XAxis
            dataKey="x"
            type="number"
            domain={[globalMin, globalMax]}
            tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.axisStroke }}
            tickLine={false}
            tickFormatter={xAxisFormatter ?? defaultXFmt}
            label={
              xLabel
                ? {
                    value: xLabel,
                    position: "insideBottom",
                    offset: -20,
                    fill: "var(--text-tertiary)",
                    fontSize: 10,
                    fontFamily: "var(--font-sans)",
                  }
                : undefined
            }
          />

          <YAxis hide />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
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
                    className="text-[10px] font-semibold mb-1.5"
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Value: {(xAxisFormatter ?? defaultXFmt)(label as number)}
                  </div>
                  {payload.map((p, i) => {
                    const s = series.find((s) => s.key === p.dataKey);
                    if (!s) return null;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 py-0.5"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: s.color }}
                        />
                        <span
                          className="text-[11px] flex-1"
                          style={{ color: s.color }}
                        >
                          {s.label}
                        </span>
                        <span
                          className="text-[11px] font-mono font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {((p.value as number) * 100).toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />

          {/* Median reference lines — vertically stagger labels to avoid overlap */}
          {showMedians &&
            medians.map((m, idx) => {
              if (hiddenKeys.has(m.key)) return null;
              return (
                <ReferenceLine
                  key={`med-${m.key}`}
                  x={m.value}
                  stroke={m.color}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: `${m.label}: ${(xAxisFormatter ?? defaultXFmt)(m.value)}`,
                    position: idx === 0 ? "insideTopLeft" : "insideBottomRight",
                    fill: m.color,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                />
              );
            })}

          {/* Density area fills */}
          {series.map((s, i) => {
            if (hiddenKeys.has(s.key)) return null;
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={hoveredKey === s.key ? 2.5 : 2}
                fill={`url(#distGrad-${s.key})`}
                dot={false}
                isAnimationActive
                animationDuration={800 + i * 200}
                onMouseEnter={() => setHoveredKey(s.key)}
                onMouseLeave={() => setHoveredKey(null)}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      {/* Bottom bar: legend + shift annotation */}
      <div className="flex items-center justify-between flex-wrap gap-2 mt-2 px-1">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          {series.map((s) => {
            const isHidden = hiddenKeys.has(s.key);
            return (
              <button
                key={s.key}
                className="flex items-center gap-1.5 text-[11px] transition-opacity cursor-pointer"
                style={{
                  opacity: isHidden ? 0.3 : hoveredKey !== null && hoveredKey !== s.key ? 0.4 : 1,
                }}
                onClick={() => toggleKey(s.key)}
                onMouseEnter={() => setHoveredKey(s.key)}
                onMouseLeave={() => setHoveredKey(null)}
                title={isHidden ? `Show ${s.label}` : `Hide ${s.label}`}
              >
                <span
                  className="inline-block w-3 h-[3px] rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span style={{ color: s.color, textDecoration: isHidden ? "line-through" : "none" }}>{s.label}</span>
                <span className="text-[9px] text-[var(--text-tertiary)] font-mono">
                  n={s.values.length.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Shift annotation badge */}
        {showShiftAnnotation && shiftInfo && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{
              background:
                shiftInfo.direction === "right"
                  ? "rgba(0, 161, 125, 0.12)"
                  : "rgba(145, 13, 99, 0.12)",
              color: shiftInfo.direction === "right" ? "#00A17D" : "#910D63",
            }}
          >
            <span>
              {shiftInfo.direction === "right" ? "\u2192" : "\u2190"}
            </span>
            <span>
              Median shifted{" "}
              {shiftInfo.direction === "right" ? "+" : ""}
              {shiftInfo.pctDiff.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
