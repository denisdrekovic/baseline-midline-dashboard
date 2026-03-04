"use client";

/* ------------------------------------------------------------------ */
/*  SlopeChart                                                         */
/*  Visualises change between two time points (e.g. baseline→midline) */
/*  for multiple metrics simultaneously. The angle of each line        */
/*  encodes direction and magnitude at a glance.                       */
/*                                                                     */
/*  Design: custom SVG, theme-aware, animated, accessible              */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";

export interface SlopeRow {
  label: string;
  /** Value at the starting point (e.g. baseline) */
  start: number;
  /** Value at the ending point (e.g. midline) */
  end: number;
  /** Hex colour */
  color: string;
  /** Optional format function for display values */
  formatter?: (v: number) => string;
}

interface SlopeChartProps {
  rows: SlopeRow[];
  /** Left column label */
  startLabel?: string;
  /** Right column label */
  endLabel?: string;
  height?: number;
  /** If true, highlight rows with biggest positive change */
  highlightTopN?: number;
}

const defaultFmt = (v: number): string => {
  if (Math.abs(v) >= 10_000) return `$${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(1);
};

export default function SlopeChart({
  rows,
  startLabel = "Baseline",
  endLabel = "Midline",
  height,
  highlightTopN,
}: SlopeChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());

  const toggleIndex = (idx: number) => {
    setHiddenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Use rank-based positioning: each metric gets a fixed vertical slot.
  // Within each slot, a small vertical offset encodes direction of change,
  // while the slope angle between left and right encodes magnitude.
  const { rowPositions } = useMemo(() => {
    const n = rows.length;

    // Rank by absolute change for highlight logic
    const sorted = rows
      .map((r, i) => ({ idx: i, change: r.end - r.start }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const topIndices = new Set(
      highlightTopN
        ? sorted.slice(0, highlightTopN).map((s) => s.idx)
        : rows.map((_, i) => i)
    );

    // Evenly space rows; add a small vertical shift to encode
    // the direction and relative magnitude of change within the slot
    const slotSize = 100 / Math.max(n, 1);
    const maxPctChange = Math.max(
      ...rows.map((r) =>
        r.start !== 0
          ? Math.abs((r.end - r.start) / Math.abs(r.start))
          : 0
      ),
      0.01
    );

    const positions = rows.map((r, i) => {
      const baseY = slotSize * (i + 0.5); // centre of slot
      // Shift by up to ±30% of slot size based on change magnitude
      const pctChange =
        r.start !== 0
          ? (r.end - r.start) / Math.abs(r.start)
          : 0;
      const normShift = (pctChange / maxPctChange) * slotSize * 0.3;

      return {
        startY: baseY + normShift * 0.5,   // start slightly high if increasing
        endY: baseY - normShift * 0.5,     // end slightly low if increasing (slope goes up)
        isHighlighted: topIndices.has(i),
      };
    });

    return { rowPositions: positions };
  }, [rows, highlightTopN]);

  const svgHeight = height ?? Math.max(240, rows.length * 36 + 40);
  const marginLeft = 120;
  const marginRight = 120;
  const lineArea = 300;
  const totalWidth = marginLeft + lineArea + marginRight;

  return (
    <div className="w-full overflow-x-auto">
      {/* Column headers */}
      <div
        className="flex items-center mb-1 px-1"
        style={{ maxWidth: totalWidth }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
          style={{ width: marginLeft, fontFamily: "var(--font-heading)" }}
        >
          {startLabel}
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] text-right"
          style={{ width: marginRight, fontFamily: "var(--font-heading)" }}
        >
          {endLabel}
        </span>
      </div>

      {/* SVG slope lines */}
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        role="img"
        aria-label="Slope chart showing changes between rounds"
      >
        {/* Left and right axis lines */}
        <line
          x1={marginLeft}
          y1={8}
          x2={marginLeft}
          y2={svgHeight - 8}
          stroke="var(--card-border)"
          strokeWidth={1}
        />
        <line
          x1={marginLeft + lineArea}
          y1={8}
          x2={marginLeft + lineArea}
          y2={svgHeight - 8}
          stroke="var(--card-border)"
          strokeWidth={1}
        />

        {rows.map((row, i) => {
          if (hiddenIndices.has(i)) return null;
          const pos = rowPositions[i];
          const fmt = row.formatter || defaultFmt;
          const isHovered = hoveredIdx === i;
          const isDimmed =
            hoveredIdx !== null && hoveredIdx !== i;
          const isHighlighted = pos.isHighlighted;
          const opacity = isDimmed ? 0.15 : isHighlighted ? 1 : 0.65;
          const strokeW = isHovered ? 2.5 : isHighlighted ? 2 : 1.5;

          // Map normalised Y to SVG pixel Y
          const y1 = 12 + (pos.startY / 100) * (svgHeight - 24);
          const y2 = 12 + (pos.endY / 100) * (svgHeight - 24);

          const isIncrease = row.end >= row.start;
          const pctChange =
            row.start !== 0
              ? (((row.end - row.start) / Math.abs(row.start)) * 100).toFixed(0)
              : "N/A";

          return (
            <g
              key={row.label}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                opacity,
                transition: "opacity 0.2s ease",
                cursor: "pointer",
              }}
            >
              {/* Connecting line */}
              <line
                x1={marginLeft + 4}
                y1={y1}
                x2={marginLeft + lineArea - 4}
                y2={y2}
                stroke={row.color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                style={{
                  filter: isHovered
                    ? `drop-shadow(0 0 6px ${row.color}60)`
                    : undefined,
                  transition: "stroke-width 0.2s ease, filter 0.2s ease",
                }}
              />

              {/* Left dot (start) */}
              <circle
                cx={marginLeft}
                cy={y1}
                r={isHovered ? 5 : 3.5}
                fill="var(--color-surface-1)"
                stroke={row.color}
                strokeWidth={2}
                style={{ transition: "r 0.2s ease" }}
              />

              {/* Right dot (end) */}
              <circle
                cx={marginLeft + lineArea}
                cy={y2}
                r={isHovered ? 5.5 : 4}
                fill={row.color}
                style={{
                  filter: isHovered
                    ? `drop-shadow(0 0 4px ${row.color}50)`
                    : undefined,
                  transition: "r 0.2s ease, filter 0.2s ease",
                }}
              />

              {/* Left label + value */}
              <text
                x={marginLeft - 8}
                y={y1}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--text-secondary)"
                fontSize={isHovered ? 11 : 10}
                fontFamily="var(--font-sans)"
                style={{ transition: "font-size 0.2s ease" }}
              >
                <tspan fontWeight={600}>{row.label}</tspan>
                <tspan dx={6} fill="var(--text-tertiary)" fontSize={9}>
                  {fmt(row.start)}
                </tspan>
              </text>

              {/* Right value + change */}
              <text
                x={marginLeft + lineArea + 8}
                y={y2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={isHovered ? 11 : 10}
                fontFamily="var(--font-sans)"
                style={{ transition: "font-size 0.2s ease" }}
              >
                <tspan fill={row.color} fontWeight={700}>
                  {fmt(row.end)}
                </tspan>
                <tspan
                  dx={5}
                  fontSize={9}
                  fontWeight={600}
                  fill={isIncrease ? "#00A17D" : "#910D63"}
                >
                  {isIncrease ? "+" : ""}
                  {pctChange}%
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend — click to toggle metrics */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1">
        {rows.map((row, i) => {
          const isHidden = hiddenIndices.has(i);
          return (
            <button
              key={row.label}
              className="flex items-center gap-1 transition-opacity cursor-pointer"
              style={{ opacity: isHidden ? 0.3 : 1 }}
              onClick={() => toggleIndex(i)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              title={isHidden ? `Show ${row.label}` : `Hide ${row.label}`}
            >
              <span
                className="inline-block w-2.5 h-[3px] rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span
                className="text-[9px] font-medium"
                style={{ color: row.color, textDecoration: isHidden ? "line-through" : "none" }}
              >
                {row.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
