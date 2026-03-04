"use client";

/* ------------------------------------------------------------------ */
/*  MetricHeatmap                                                      */
/*  Replaces the flat "Traffic Light Grid" table with a colour-        */
/*  intensity heatmap where cell background encodes direction AND      */
/*  magnitude of change. Instantly scannable at a glance.              */
/*                                                                     */
/*  Design: CSS-variable-aware, hover interactions, accessible          */
/* ------------------------------------------------------------------ */

import { useState, useMemo } from "react";
import type { ProjectGroup } from "@/lib/data/types";
import { PROJECT_COLORS } from "@/lib/data/constants";

export interface HeatmapCell {
  metricId: string;
  label: string;
  group: ProjectGroup;
  baselineValue: number;
  midlineValue: number;
  absoluteChange: number;
  percentChange: number;
  format: "percent" | "currency" | "number" | "index";
  higherIsBetter: boolean;
}

interface MetricHeatmapProps {
  cells: HeatmapCell[];
  groups?: ProjectGroup[];
}

/* ── Color interpolation for heatmap cells ── */
function heatColor(
  pctChange: number,
  higherIsBetter: boolean,
  intensity: number // 0-1 normalised magnitude
): { bg: string; text: string } {
  const effectiveChange = higherIsBetter ? pctChange : -pctChange;
  const alpha = Math.min(intensity * 0.55 + 0.08, 0.6); // 0.08–0.6 range

  if (effectiveChange > 1) {
    return {
      bg: `rgba(0, 161, 125, ${alpha})`,   // green
      text: alpha > 0.35 ? "#fff" : "#00A17D",
    };
  }
  if (effectiveChange < -1) {
    return {
      bg: `rgba(145, 13, 99, ${alpha})`,    // plum
      text: alpha > 0.35 ? "#fff" : "#910D63",
    };
  }
  return {
    bg: "rgba(128, 128, 128, 0.08)",        // neutral
    text: "var(--text-tertiary)",
  };
}

function fmtChange(value: number, format: string): string {
  const sign = value >= 0 ? "+" : "";
  switch (format) {
    case "percent":
      return `${sign}${value.toFixed(1)}pp`;
    case "currency":
      return `${sign}$${Math.abs(value) >= 1000 ? (value / 1000).toFixed(1) + "k" : Math.round(value)}`;
    case "index":
      return `${sign}${value.toFixed(2)}`;
    default:
      return `${sign}${value.toFixed(1)}`;
  }
}

export default function MetricHeatmap({
  cells,
  groups = ["T-1", "T-2", "Control"],
}: MetricHeatmapProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<ProjectGroup | null>(null);

  // Organise cells into rows × groups
  const { metrics, cellMap, maxAbsPct } = useMemo(() => {
    const metricOrder: string[] = [];
    const metricLabels: Record<string, string> = {};
    const map = new Map<string, HeatmapCell>();

    for (const c of cells) {
      if (!metricOrder.includes(c.metricId)) {
        metricOrder.push(c.metricId);
        metricLabels[c.metricId] = c.label;
      }
      map.set(`${c.metricId}:${c.group}`, c);
    }

    // Max absolute pct change for normalisation
    const maxAbs = Math.max(
      ...cells.map((c) => Math.abs(c.percentChange)),
      1
    );

    return {
      metrics: metricOrder.map((id) => ({ id, label: metricLabels[id] })),
      cellMap: map,
      maxAbsPct: maxAbs,
    };
  }, [cells]);

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        role="table"
        aria-label="Metric change heatmap — colour intensity shows magnitude"
      >
        <thead>
          <tr>
            <th className="text-left px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-[var(--text-quaternary)]">
              Metric
            </th>
            {groups.map((g) => (
              <th
                key={g}
                className="text-center px-2 py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-opacity"
                style={{
                  color: PROJECT_COLORS[g],
                  opacity: hoveredGroup && hoveredGroup !== g ? 0.35 : 1,
                }}
                onMouseEnter={() => setHoveredGroup(g)}
                onMouseLeave={() => setHoveredGroup(null)}
              >
                <div className="flex items-center justify-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: PROJECT_COLORS[g] }}
                  />
                  {g}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, rowIdx) => {
            const isRowHovered = hoveredRow === m.id;
            return (
              <tr
                key={m.id}
                onMouseEnter={() => setHoveredRow(m.id)}
                onMouseLeave={() => setHoveredRow(null)}
                className="transition-all duration-150"
                style={{
                  opacity:
                    hoveredRow !== null && !isRowHovered ? 0.45 : 1,
                }}
              >
                <td
                  className="px-2 py-1.5 text-[10px] font-medium text-[var(--text-secondary)] whitespace-nowrap"
                  style={{
                    fontWeight: isRowHovered ? 700 : 500,
                    borderLeft: isRowHovered
                      ? "2px solid var(--color-brand-gold)"
                      : "2px solid transparent",
                  }}
                >
                  {m.label}
                </td>
                {groups.map((g) => {
                  const cell = cellMap.get(`${m.id}:${g}`);
                  if (!cell) {
                    return (
                      <td key={g} className="text-center px-2 py-1.5 text-[10px] text-[var(--text-quaternary)]">
                        —
                      </td>
                    );
                  }

                  const intensity = Math.abs(cell.percentChange) / maxAbsPct;
                  const { bg, text } = heatColor(
                    cell.percentChange,
                    cell.higherIsBetter,
                    intensity
                  );

                  const isDimmed =
                    hoveredGroup !== null && hoveredGroup !== g;

                  return (
                    <td
                      key={g}
                      className="text-center px-1.5 py-1"
                      style={{ opacity: isDimmed ? 0.3 : 1 }}
                    >
                      <div
                        className="rounded-md px-2 py-1.5 transition-all duration-200"
                        style={{
                          background: bg,
                          transform: isRowHovered ? "scale(1.04)" : "scale(1)",
                        }}
                      >
                        <div
                          className="text-[10px] font-bold font-mono leading-tight"
                          style={{ color: text }}
                        >
                          {fmtChange(cell.absoluteChange, cell.format)}
                        </div>
                        <div
                          className="text-[8px] font-mono leading-tight"
                          style={{ color: text, opacity: 0.7 }}
                        >
                          {cell.percentChange > 0 ? "+" : ""}
                          {cell.percentChange.toFixed(1)}%
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Colour scale legend */}
      <div className="flex items-center justify-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--card-border)" }}>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(145, 13, 99, 0.45)" }} />
          <span className="text-[8px] text-[var(--text-quaternary)]">Decline</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(128, 128, 128, 0.1)", border: "1px solid var(--card-border)" }} />
          <span className="text-[8px] text-[var(--text-quaternary)]">No change</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(0, 161, 125, 0.45)" }} />
          <span className="text-[8px] text-[var(--text-quaternary)]">Improvement</span>
        </div>
        <span className="text-[8px] text-[var(--text-quaternary)] italic ml-2">
          Intensity = magnitude of change
        </span>
      </div>
    </div>
  );
}
