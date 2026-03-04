"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from "recharts";
import CustomTooltip from "./CustomTooltip";
import type {
  TooltipBenchmark,
  TooltipTrend,
  TooltipSeverity,
} from "./CustomTooltip";

interface DonutDataItem {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDataItem[];
  height?: number;
  /** Title shown in tooltip header */
  tooltipTitle?: string;
  /** Benchmark comparison bar in tooltip */
  tooltipBenchmark?: TooltipBenchmark;
  /** Trend indicator in tooltip */
  tooltipTrend?: TooltipTrend;
  /** Severity badge in tooltip header */
  tooltipSeverity?: TooltipSeverity;
  /** Mini sparkline data in tooltip */
  tooltipSparklineData?: number[];
}

function CenterLabel({
  viewBox,
  total,
}: {
  viewBox?: { cx?: number; cy?: number };
  total: number;
}) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="var(--text-primary)"
        fontSize={22}
        fontWeight={700}
      >
        {total.toLocaleString()}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fill="var(--text-tertiary)"
        fontSize={11}
      >
        Total
      </text>
    </g>
  );
}

export default function DonutChart({
  data,
  height = 250,
  tooltipTitle,
  tooltipBenchmark,
  tooltipTrend,
  tooltipSeverity,
  tooltipSparklineData,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="value"
          nameKey="name"
          isAnimationActive
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
          ))}
          <Label
            position="center"
            content={({ viewBox }) => (
              <CenterLabel
                viewBox={viewBox as { cx?: number; cy?: number }}
                total={total}
              />
            )}
          />
        </Pie>
        <Tooltip
          content={
            <CustomTooltip
              title={tooltipTitle || "Distribution"}
              showShare
              defaultFormatter={(v) => v.toLocaleString()}
              unit="farmers"
              benchmark={tooltipBenchmark}
              trend={tooltipTrend}
              severity={tooltipSeverity}
              sparklineData={tooltipSparklineData}
            />
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
