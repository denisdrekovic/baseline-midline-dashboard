"use client";

/* ------------------------------------------------------------------ */
/*  CropMetricMatrix                                                    */
/*  Interactive heatmap grid: rows = metrics, columns = crops.          */
/*  Cell colour encodes direction + magnitude of baseline→midline       */
/*  change. Hover dims other cells and reveals a tooltip with full      */
/*  before/after values.                                                */
/*                                                                      */
/*  Replaces the boring "All Crop Metrics" table with something         */
/*  scannable and visually stimulating.                                  */
/* ------------------------------------------------------------------ */

import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface CropMetricRow {
  crop: string;
  cropColor: string;
  metrics: {
    key: string;
    label: string;
    baseline: number;
    midline: number;
    change: number;
    pctChange: number | null;
    format: "currency" | "number" | "weight" | "area";
    higherIsBetter: boolean;
  }[];
}

interface CropMetricMatrixProps {
  rows: CropMetricRow[];
}

/* ── Helpers ── */
function fmtCell(v: number, format: string): string {
  switch (format) {
    case "currency":
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
      return `$${Math.round(v)}`;
    case "weight":
      if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
      return `${Math.round(v)}`;
    case "area":
      return v.toFixed(2);
    default:
      return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
  }
}

function fmtFull(v: number, format: string): string {
  switch (format) {
    case "currency":
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case "weight":
      return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
    case "area":
      return `${v.toFixed(2)} ac`;
    default:
      return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
  }
}

function heatColor(
  pctChange: number | null,
  higherIsBetter: boolean,
  maxAbsPct: number
): { bg: string; text: string } {
  if (pctChange === null || Math.abs(pctChange) < 0.5) {
    return { bg: "rgba(128, 128, 128, 0.06)", text: "var(--text-tertiary)" };
  }

  const effective = higherIsBetter ? pctChange : -pctChange;
  const intensity = Math.min(Math.abs(pctChange) / Math.max(maxAbsPct, 1), 1);
  const alpha = Math.min(intensity * 0.5 + 0.08, 0.55);

  if (effective > 0) {
    return {
      bg: `rgba(0, 161, 125, ${alpha})`,
      text: alpha > 0.3 ? "#fff" : "#00A17D",
    };
  }
  return {
    bg: `rgba(145, 13, 99, ${alpha})`,
    text: alpha > 0.3 ? "#fff" : "#910D63",
  };
}

export default function CropMetricMatrix({ rows }: CropMetricMatrixProps) {
  const [hoveredCrop, setHoveredCrop] = useState<string | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [tooltipCell, setTooltipCell] = useState<{
    crop: string;
    metric: string;
    baseline: number;
    midline: number;
    change: number;
    pctChange: number | null;
    format: string;
    rect: DOMRect;
  } | null>(null);

  // Gather all unique metric keys (preserving order from first crop)
  const metricKeys = useMemo(() => {
    const seen = new Set<string>();
    const keys: { key: string; label: string }[] = [];
    for (const row of rows) {
      for (const m of row.metrics) {
        if (!seen.has(m.key)) {
          seen.add(m.key);
          keys.push({ key: m.key, label: m.label });
        }
      }
    }
    return keys;
  }, [rows]);

  // Max absolute % change for colour normalisation
  const maxAbsPct = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const m of row.metrics) {
        if (m.pctChange !== null) max = Math.max(max, Math.abs(m.pctChange));
      }
    }
    return max;
  }, [rows]);

  return (
    <div className="space-y-2">
      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `140px repeat(${rows.length}, 1fr)`,
          }}
        >
          {/* Header row — crop names */}
          <div /> {/* Empty corner */}
          {rows.map((crop) => (
            <div
              key={crop.crop}
              className="text-center py-1.5 px-1 transition-opacity duration-150"
              style={{
                opacity: hoveredCrop && hoveredCrop !== crop.crop ? 0.35 : 1,
              }}
              onMouseEnter={() => setHoveredCrop(crop.crop)}
              onMouseLeave={() => setHoveredCrop(null)}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: crop.cropColor, fontFamily: "var(--font-heading)" }}
              >
                {crop.crop}
              </div>
            </div>
          ))}

          {/* Data rows — one per metric */}
          {metricKeys.map((mk) => (
            <React.Fragment key={mk.key}>
              {/* Row label */}
              <div
                className="flex items-center text-[9px] font-medium text-[var(--text-secondary)] pr-2 py-1 transition-opacity duration-150"
                style={{
                  opacity: hoveredMetric && hoveredMetric !== mk.key ? 0.35 : 1,
                }}
                onMouseEnter={() => setHoveredMetric(mk.key)}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                {mk.label}
              </div>

              {/* Cells — one per crop */}
              {rows.map((crop) => {
                const metric = crop.metrics.find((m) => m.key === mk.key);
                if (!metric) {
                  return (
                    <div
                      key={`${crop.crop}-${mk.key}`}
                      className="rounded-md flex items-center justify-center text-[8px] text-[var(--text-quaternary)] italic py-2"
                      style={{ background: "rgba(128,128,128,0.04)" }}
                    >
                      —
                    </div>
                  );
                }

                const colors = heatColor(metric.pctChange, metric.higherIsBetter, maxAbsPct);
                const isDimmed =
                  (hoveredCrop && hoveredCrop !== crop.crop) ||
                  (hoveredMetric && hoveredMetric !== mk.key);
                const isHighlighted =
                  hoveredCrop === crop.crop || hoveredMetric === mk.key;

                return (
                  <div
                    key={`${crop.crop}-${mk.key}`}
                    className="rounded-md flex flex-col items-center justify-center py-1.5 px-1 cursor-default transition-all duration-150 relative"
                    style={{
                      background: colors.bg,
                      opacity: isDimmed ? 0.3 : 1,
                      outline: isHighlighted
                        ? `1.5px solid ${crop.cropColor}40`
                        : "1px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      setHoveredCrop(crop.crop);
                      setHoveredMetric(mk.key);
                      setTooltipCell({
                        crop: crop.crop,
                        metric: mk.label,
                        baseline: metric.baseline,
                        midline: metric.midline,
                        change: metric.change,
                        pctChange: metric.pctChange,
                        format: metric.format,
                        rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredCrop(null);
                      setHoveredMetric(null);
                      setTooltipCell(null);
                    }}
                  >
                    {/* Value */}
                    <span
                      className="text-[11px] font-bold font-mono leading-tight"
                      style={{ color: colors.text }}
                    >
                      {fmtCell(metric.midline, metric.format)}
                    </span>
                    {/* Change badge */}
                    <span
                      className="inline-flex items-center gap-0.5 text-[8px] font-bold leading-tight mt-0.5"
                      style={{ color: colors.text, opacity: 0.85 }}
                    >
                      {metric.pctChange !== null && metric.pctChange > 1 ? (
                        <TrendingUp size={8} />
                      ) : metric.pctChange !== null && metric.pctChange < -1 ? (
                        <TrendingDown size={8} />
                      ) : (
                        <Minus size={8} />
                      )}
                      {metric.pctChange !== null
                        ? `${metric.pctChange > 0 ? "+" : ""}${
                            Math.abs(metric.pctChange) >= 100
                              ? Math.round(metric.pctChange)
                              : metric.pctChange.toFixed(1)
                          }%`
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipCell && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipCell.rect.left + tooltipCell.rect.width / 2,
            top: tooltipCell.rect.top - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            className="rounded-lg px-3 py-2 text-[10px] space-y-1 shadow-lg"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
              {tooltipCell.crop} — {tooltipCell.metric}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
              <span className="text-[var(--text-tertiary)]">Baseline</span>
              <span className="text-right text-[var(--text-primary)]">
                {fmtFull(tooltipCell.baseline, tooltipCell.format)}
              </span>
              <span className="text-[var(--text-tertiary)]">Midline</span>
              <span className="text-right font-bold text-[var(--text-primary)]">
                {fmtFull(tooltipCell.midline, tooltipCell.format)}
              </span>
              <span className="text-[var(--text-tertiary)]">Change</span>
              <span
                className="text-right font-bold"
                style={{
                  color:
                    tooltipCell.change > 0
                      ? "#00A17D"
                      : tooltipCell.change < 0
                      ? "#910D63"
                      : "var(--text-tertiary)",
                }}
              >
                {tooltipCell.change > 0 ? "+" : ""}
                {fmtFull(tooltipCell.change, tooltipCell.format)}
                {tooltipCell.pctChange !== null &&
                  ` (${tooltipCell.pctChange > 0 ? "+" : ""}${tooltipCell.pctChange.toFixed(1)}%)`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Colour scale legend */}
      <div className="flex items-center justify-center gap-3 text-[8px] text-[var(--text-quaternary)]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(145, 13, 99, 0.4)" }} />
          Declined
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(128, 128, 128, 0.08)" }} />
          Stable
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(0, 161, 125, 0.4)" }} />
          Improved
        </div>
        <span className="ml-1 italic">intensity = magnitude</span>
      </div>
    </div>
  );
}
