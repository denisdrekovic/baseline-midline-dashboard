"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART_THEME } from "@/lib/data/constants";
import CustomTooltip from "./CustomTooltip";
import type {
  TooltipBenchmark,
  TooltipTrend,
  TooltipSeverity,
} from "./CustomTooltip";

interface ScatterDataPoint {
  x: number;
  y: number;
  name?: string;
  color?: string;
}

interface ScatterPlotChartProps {
  data: ScatterDataPoint[];
  xLabel: string;
  yLabel: string;
  height?: number;
  /** Title shown in tooltip header */
  tooltipTitle?: string;
  tooltipBenchmark?: TooltipBenchmark;
  tooltipTrend?: TooltipTrend;
  tooltipSeverity?: TooltipSeverity;
  tooltipSparklineData?: number[];
  /** Disable Recharts' internal animation (use when data is animated externally) */
  disableAnimation?: boolean;
}

export default function ScatterPlotChart({
  data,
  xLabel,
  yLabel,
  height = 300,
  tooltipTitle,
  tooltipBenchmark,
  tooltipTrend,
  tooltipSeverity,
  tooltipSparklineData,
  disableAnimation = false,
}: ScatterPlotChartProps) {
  const defaultColor = "var(--color-accent)";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_THEME.gridStroke}
        />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          tick={{ fill: CHART_THEME.tickFill, fontSize: CHART_THEME.fontSize }}
          axisLine={{ stroke: CHART_THEME.axisStroke }}
          tickLine={false}
          label={{
            value: xLabel,
            position: "insideBottom",
            offset: -10,
            fill: CHART_THEME.tickFill,
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          tick={{ fill: CHART_THEME.tickFill, fontSize: CHART_THEME.fontSize }}
          axisLine={{ stroke: CHART_THEME.axisStroke }}
          tickLine={false}
          label={{
            value: yLabel,
            angle: -90,
            position: "insideLeft",
            offset: 0,
            fill: CHART_THEME.tickFill,
            fontSize: 12,
          }}
        />
        <Tooltip
          content={
            <CustomTooltip
              title={tooltipTitle || "Data Point"}
              labelMap={{ x: xLabel, y: yLabel }}
              benchmark={tooltipBenchmark}
              trend={tooltipTrend}
              severity={tooltipSeverity}
              sparklineData={tooltipSparklineData}
            />
          }
          cursor={{ strokeDasharray: "3 3" }}
        />
        <Scatter data={data} isAnimationActive={!disableAnimation}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color ?? defaultColor}
              fillOpacity={0.75}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
