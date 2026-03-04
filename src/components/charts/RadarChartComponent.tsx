"use client";

import { useState, useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_THEME } from "@/lib/data/constants";
import CustomTooltip from "./CustomTooltip";
import type {
  TooltipBenchmark,
  TooltipTrend,
  TooltipSeverity,
} from "./CustomTooltip";

interface RadarDataItem {
  subject: string;
  [key: string]: number | string;
}

interface RadarDataKey {
  key: string;
  color: string;
  label?: string;
}

interface RadarChartComponentProps {
  data: RadarDataItem[];
  dataKeys: RadarDataKey[];
  height?: number;
  /** Title shown in tooltip header */
  tooltipTitle?: string;
  tooltipBenchmark?: TooltipBenchmark;
  tooltipTrend?: TooltipTrend;
  tooltipSeverity?: TooltipSeverity;
  tooltipSparklineData?: number[];
}

export default function RadarChartComponent({
  data,
  dataKeys,
  height = 300,
  tooltipTitle,
  tooltipBenchmark,
  tooltipTrend,
  tooltipSeverity,
  tooltipSparklineData,
}: RadarChartComponentProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding all
        if (dataKeys.length - next.size > 1) next.add(key);
      }
      return next;
    });
  };

  const visibleKeys = useMemo(
    () => dataKeys.filter((dk) => !hiddenKeys.has(dk.key)),
    [dataKeys, hiddenKeys]
  );

  const labelMap = Object.fromEntries(
    dataKeys.map((dk) => [dk.key, dk.label || dk.key])
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="var(--card-border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: CHART_THEME.tickFill, fontSize: CHART_THEME.fontSize }}
          />
          {visibleKeys.map((dk) => (
            <Radar
              key={dk.key}
              name={dk.label || dk.key}
              dataKey={dk.key}
              stroke={dk.color}
              fill={dk.color}
              fillOpacity={0.3}
              isAnimationActive
            />
          ))}
          <Tooltip
            content={
              <CustomTooltip
                title={tooltipTitle || "Comparison"}
                labelMap={labelMap}
                defaultFormatter={(v) => `${v.toFixed(0)}%`}
                benchmark={tooltipBenchmark}
                trend={tooltipTrend}
                severity={tooltipSeverity}
                sparklineData={tooltipSparklineData}
              />
            }
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Interactive clickable legend */}
      {dataKeys.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 px-1 justify-center"
          role="group"
          aria-label="Toggle radar series visibility"
        >
          {dataKeys.map((dk) => {
            const isVisible = !hiddenKeys.has(dk.key);
            return (
              <button
                key={dk.key}
                onClick={() => toggleKey(dk.key)}
                className="flex items-center gap-1.5 text-[11px] transition-all cursor-pointer"
                style={{ opacity: isVisible ? 1 : 0.35 }}
                aria-pressed={isVisible}
                title={`Click to ${isVisible ? "hide" : "show"} ${dk.label || dk.key}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isVisible ? dk.color : "var(--text-tertiary)",
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
                <span
                  className={isVisible ? "" : "line-through"}
                  style={{ color: isVisible ? dk.color : "var(--text-tertiary)" }}
                >
                  {dk.label || dk.key}
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
