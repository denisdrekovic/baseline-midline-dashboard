"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CHART_THEME } from "@/lib/data/constants";
import CustomTooltip from "./CustomTooltip";

/* ------------------------------------------------------------------ */
/*  WaterfallChart                                                     */
/*  Visualises cumulative income components (or gaps) as a waterfall.  */
/*  Each bar floats above the previous running total.  "Total" bars    */
/*  always start from zero.                                            */
/* ------------------------------------------------------------------ */

interface WaterfallItem {
  name: string;
  value: number;
  color: string;
  /** When true the bar is drawn from the x-axis (running total reset) */
  isTotal?: boolean;
}

interface WaterfallChartProps {
  items: WaterfallItem[];
  height?: number;
  tooltipTitle?: string;
  tooltipFormatter?: (v: number) => string;
  referenceLine?: { value: number; label: string; color: string };
  /** Custom Y-axis tick formatter. Defaults to auto-scaled "$Xk" or "$X". */
  yAxisFormatter?: (v: number) => string;
}

/* ---------- internal row after computing stacking offsets ---------- */
interface WaterfallRow {
  name: string;
  /** Transparent spacer height (the "invisible base") */
  base: number;
  /** Visible bar height */
  value: number;
  /** Original signed value for tooltip display */
  rawValue: number;
  color: string;
  isTotal: boolean;
}

/* ---------- Tooltip wrapper ----------
   CustomTooltip expects `defaultFormatter?: (v: number) => string`.
   Recharts sends both the invisible `base` bar and the visible `value`
   bar in the payload.  This thin wrapper:
     1. Filters out the `base` entry
     2. Replaces `value` with the original signed `rawValue`
   so CustomTooltip shows meaningful numbers.                          */

function WaterfallTooltipContent({
  active,
  payload,
  label,
  tooltipTitle,
  tooltipFormatter,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  tooltipTitle: string;
  tooltipFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Keep only the visible "value" bar, replace its numeric value with rawValue
  const filtered = payload
    .filter((entry) => entry.dataKey === "value")
    .map((entry) => {
      const raw = (entry.payload?.rawValue as number) ?? entry.value;
      return {
        ...entry,
        value: raw,
        // Use the row name (from the data) rather than the generic dataKey
        name: (entry.payload?.name as string) ?? entry.name,
      };
    });

  if (filtered.length === 0) return null;

  const defaultFmt = tooltipFormatter ?? ((v: number) => `$${Math.abs(v).toLocaleString()}`);

  return (
    <CustomTooltip
      active
      payload={filtered}
      label={label}
      title={tooltipTitle}
      defaultFormatter={defaultFmt}
    />
  );
}

/* ---------- Main component ---------- */

export default function WaterfallChart({
  items,
  height = 200,
  tooltipTitle = "Income Waterfall",
  tooltipFormatter,
  referenceLine,
  yAxisFormatter,
}: WaterfallChartProps) {
  if (!items.length) return null;

  // Build stacked data: each bar has a transparent "base" and a visible
  // "value" portion so it floats at the correct y-position.
  let running = 0;
  const data: WaterfallRow[] = items.map((item) => {
    if (item.isTotal) {
      const row: WaterfallRow = {
        name: item.name,
        base: 0,
        value: Math.abs(item.value),
        rawValue: item.value,
        color: item.color,
        isTotal: true,
      };
      running = item.value;
      return row;
    }

    const base = item.value >= 0 ? running : running + item.value;
    const row: WaterfallRow = {
      name: item.name,
      base: Math.max(0, base),
      value: Math.abs(item.value),
      rawValue: item.value,
      color: item.color,
      isTotal: false,
    };
    running += item.value;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 30, left: -10, bottom: 4 }}
        barCategoryGap="20%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_THEME.gridStroke}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={false}
          axisLine={{ stroke: CHART_THEME.axisStroke }}
          tickLine={false}
          height={6}
        />
        <YAxis
          tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
          axisLine={{ stroke: CHART_THEME.axisStroke }}
          tickLine={false}
          tickFormatter={yAxisFormatter ?? ((v) => {
            const abs = Math.abs(v);
            if (abs >= 10000) return `$${(v / 1000).toFixed(0)}k`;
            if (abs >= 1000) return `$${(v / 1000).toFixed(1)}k`;
            return `$${Math.round(v)}`;
          })}
        />

        {referenceLine && (
          <ReferenceLine
            y={referenceLine.value}
            stroke={referenceLine.color}
            strokeDasharray="6 3"
            strokeWidth={2}
            label={{
              value: referenceLine.label,
              position: "right",
              fill: referenceLine.color,
              fontSize: 10,
              fontWeight: 700,
            }}
          />
        )}

        <Tooltip
          content={
            <WaterfallTooltipContent
              tooltipTitle={tooltipTitle}
              tooltipFormatter={tooltipFormatter}
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />

        {/* Invisible base bar (spacer) */}
        <Bar
          dataKey="base"
          stackId="stack"
          fill="transparent"
          isAnimationActive={false}
        />

        {/* Visible value bar */}
        <Bar
          dataKey="value"
          stackId="stack"
          radius={[3, 3, 0, 0]}
          isAnimationActive
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
