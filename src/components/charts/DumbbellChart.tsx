"use client";

import { useMemo, useState, useCallback, useRef } from "react";

interface DumbbellRow {
  label: string;
  baseline: number;
  midline: number;
  color: string;
}

interface DumbbellChartProps {
  rows: DumbbellRow[];
  formatter?: (v: number) => string;
  height?: number;
}

export default function DumbbellChart({
  rows,
  formatter = (v) => v.toFixed(1),
  height,
}: DumbbellChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<"baseline" | "midline">>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const showBaseline = !hiddenSeries.has("baseline");
  const showMidline = !hiddenSeries.has("midline");

  const toggleSeries = (key: "baseline" | "midline") => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding both
        if (next.size < 1) next.add(key);
      }
      return next;
    });
  };

  const { min, range } = useMemo(() => {
    const allVals = rows.flatMap((r) => {
      const vals: number[] = [];
      if (showBaseline) vals.push(r.baseline);
      if (showMidline) vals.push(r.midline);
      if (!vals.length) vals.push(r.baseline, r.midline);
      return vals;
    });
    const mn = Math.min(...allVals);
    const mx = Math.max(...allVals);
    const padding = (mx - mn) * 0.15 || 1;
    return { min: mn - padding, max: mx + padding, range: mx - mn + padding * 2 };
  }, [rows, showBaseline, showMidline]);

  const toX = useCallback((v: number) => ((v - min) / range) * 100, [min, range]);

  const rowHeight = 44;
  const chartHeight = height ?? rows.length * rowHeight + 24;

  return (
    <div ref={containerRef} className="w-full">
      {/* Chart rows */}
      <div className="flex flex-col gap-1 justify-center" style={{ minHeight: chartHeight }}>
        {rows.map((row, idx) => {
          const bx = toX(row.baseline);
          const mx = toX(row.midline);
          const leftX = Math.min(bx, mx);
          const rightX = Math.max(bx, mx);
          const isIncrease = row.midline >= row.baseline;
          const isHovered = hoveredIdx === idx;
          const isFaded = hoveredIdx !== null && hoveredIdx !== idx;

          return (
            <div
              key={row.label}
              className="flex items-center gap-2 rounded-md px-1 -mx-1 cursor-default"
              style={{
                opacity: isFaded ? 0.35 : 1,
                transition: "opacity 0.15s ease, background 0.15s ease",
                background: isHovered ? "var(--card-bg-hover, rgba(255,255,255,0.04))" : "transparent",
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Label */}
              <div
                className="w-16 shrink-0 text-[10px] font-semibold text-right truncate"
                style={{
                  color: isHovered ? row.color : "var(--text-secondary)",
                  transition: "color 0.15s ease",
                }}
                title={row.label}
              >
                {row.label}
              </div>
              {/* Track */}
              <div className="flex-1 relative h-6">
                {/* Background track */}
                <div
                  className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
                  style={{ background: "var(--card-border)" }}
                />
                {/* Connecting line */}
                {showBaseline && showMidline && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${leftX}%`,
                      width: `${rightX - leftX}%`,
                      height: isHovered ? 3 : 2,
                      background: isHovered ? `${row.color}80` : `${row.color}40`,
                      transition: "height 0.15s ease, background 0.15s ease",
                    }}
                  />
                )}
                {/* Baseline dot */}
                {showBaseline && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-2"
                    style={{
                      left: `${bx}%`,
                      width: isHovered ? 12 : 10,
                      height: isHovered ? 12 : 10,
                      borderColor: row.color,
                      background: "var(--card-bg)",
                      transition: "all 0.15s ease",
                      boxShadow: isHovered ? `0 0 8px ${row.color}50` : "none",
                    }}
                  />
                )}
                {/* Midline dot */}
                {showMidline && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      left: `${mx}%`,
                      width: isHovered ? 14 : 12,
                      height: isHovered ? 14 : 12,
                      background: row.color,
                      boxShadow: isHovered
                        ? `0 0 12px ${row.color}60, 0 0 4px ${row.color}40`
                        : `0 0 6px ${row.color}40`,
                      transition: "all 0.15s ease",
                    }}
                  />
                )}

                {/* Hover tooltip — floating above the track */}
                {isHovered && (
                  <div
                    className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <div
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono shadow-lg"
                      style={{
                        background: "var(--card-bg)",
                        border: `1px solid ${row.color}40`,
                        boxShadow: `0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px ${row.color}15`,
                      }}
                    >
                      <span style={{ color: row.color, fontWeight: 700 }}>{row.label}</span>
                      <span className="text-[var(--text-tertiary)] mx-1.5">|</span>
                      <span className="text-[var(--text-tertiary)]">B:</span>
                      <span className="text-[var(--text-primary)] ml-0.5 font-semibold">{formatter(row.baseline)}</span>
                      <span className="text-[var(--text-tertiary)] mx-1">→</span>
                      <span className="text-[var(--text-tertiary)]">M:</span>
                      <span className="text-[var(--text-primary)] ml-0.5 font-bold">{formatter(row.midline)}</span>
                      <span className="ml-1.5" style={{ color: isIncrease ? "#00A17D" : "#910D63", fontWeight: 700 }}>
                        {isIncrease ? "+" : ""}
                        {((row.midline - row.baseline) / (Math.abs(row.baseline) || 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* Value labels */}
              <div className="w-24 shrink-0 flex items-center gap-1">
                {showBaseline && (
                  <span
                    className="text-[9px] font-mono"
                    style={{
                      color: row.color,
                      opacity: isHovered ? 0.7 : 0.5,
                      transition: "opacity 0.15s ease",
                    }}
                  >
                    {formatter(row.baseline)}
                  </span>
                )}
                {showBaseline && showMidline && (
                  <span className="text-[9px] text-[var(--text-tertiary)]">&rarr;</span>
                )}
                {showMidline && (
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{ color: row.color }}
                  >
                    {formatter(row.midline)}
                  </span>
                )}
                {showBaseline && showMidline && (
                  <span
                    className="text-[8px] font-mono"
                    style={{ color: isIncrease ? "#00A17D" : "#910D63" }}
                  >
                    {isIncrease ? "+" : ""}
                    {((row.midline - row.baseline) / (Math.abs(row.baseline) || 1) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Legend — inside the component, below chart rows */}
      <div
        className="flex items-center gap-3 mt-2 px-1"
        role="group"
        aria-label="Toggle baseline/midline visibility"
      >
        <button
          onClick={() => toggleSeries("baseline")}
          className="flex items-center gap-1.5 text-[11px] transition-all cursor-pointer"
          style={{ opacity: showBaseline ? 1 : 0.35 }}
          aria-pressed={showBaseline}
          title={`Click to ${showBaseline ? "hide" : "show"} Baseline`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
            style={{
              borderColor: showBaseline ? "var(--text-secondary)" : "var(--text-tertiary)",
              background: "var(--card-bg)",
              opacity: showBaseline ? 1 : 0.3,
            }}
          />
          <span
            className={showBaseline ? "" : "line-through"}
            style={{ color: showBaseline ? "var(--text-secondary)" : "var(--text-tertiary)" }}
          >
            Baseline
          </span>
        </button>
        <button
          onClick={() => toggleSeries("midline")}
          className="flex items-center gap-1.5 text-[11px] transition-all cursor-pointer"
          style={{ opacity: showMidline ? 1 : 0.35 }}
          aria-pressed={showMidline}
          title={`Click to ${showMidline ? "hide" : "show"} Midline`}
        >
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{
              background: showMidline ? "var(--text-secondary)" : "var(--text-tertiary)",
              opacity: showMidline ? 1 : 0.3,
            }}
          />
          <span
            className={showMidline ? "" : "line-through"}
            style={{ color: showMidline ? "var(--text-secondary)" : "var(--text-tertiary)" }}
          >
            Midline
          </span>
        </button>
        {hiddenSeries.size > 0 && (
          <button
            onClick={() => setHiddenSeries(new Set())}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
            style={{ color: "var(--color-accent)" }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
