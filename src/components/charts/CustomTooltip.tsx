"use client";

/* ------------------------------------------------------------------ */
/*  Advanced Tooltip System                                           */
/*  Features: multi-section layout, trend indicators, mini sparklines,*/
/*  benchmark bars, severity badges, theme-aware, accessible          */
/* ------------------------------------------------------------------ */

import { MapPin } from "lucide-react";

// --- Public Types ---

export interface TooltipBenchmark {
  label: string;
  value: number;
  threshold: number;
}

export interface TooltipTrend {
  /** Percentage change (positive = up, negative = down) */
  value: number;
  /** e.g. "vs last month" */
  period?: string;
}

export type TooltipSeverity = "good" | "warning" | "critical";

// --- Internal Types ---

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

interface CustomTooltipProps {
  /* Recharts-injected */
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;

  /* Basic config */
  title?: string;
  labelMap?: Record<string, string>;
  formatMap?: Record<string, (v: number) => string>;
  defaultFormatter?: (v: number) => string;
  unit?: string;
  showShare?: boolean;

  /* Advanced features */
  benchmark?: TooltipBenchmark;
  trend?: TooltipTrend;
  severity?: TooltipSeverity;
  sparklineData?: number[];
  footnote?: string;

  /** Contextual info like active region or filter state */
  contextInfo?: string;
}

// --- Helpers ---

function smartFormat(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

const SEVERITY_STYLES: Record<
  TooltipSeverity,
  { color: string; label: string }
> = {
  good: { color: "var(--color-brand-green)", label: "Good" },
  warning: { color: "var(--color-brand-gold)", label: "Warning" },
  critical: { color: "var(--color-negative)", label: "Critical" },
};

// --- Mini Sparkline ---

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 72;
  const h = 24;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastX = w - pad;
  const lastY =
    h - pad - ((data[data.length - 1] - min) / range) * (h - pad * 2);

  return (
    <svg
      width={w}
      height={h}
      className="shrink-0"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}

// --- Benchmark Bar ---

function BenchmarkBar({ benchmark }: { benchmark: TooltipBenchmark }) {
  const pct = Math.min(
    100,
    Math.max(0, (benchmark.value / benchmark.threshold) * 100)
  );
  const isAbove = benchmark.value >= benchmark.threshold;
  const barColor = isAbove
    ? "var(--color-brand-green)"
    : "var(--color-brand-gold)";

  return (
    <div
      className="mt-2.5 pt-2.5"
      style={{ borderTop: "1px solid var(--card-border)" }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span
          className="text-[11px]"
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {benchmark.label}
        </span>
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: "var(--text-secondary)" }}
        >
          {smartFormat(benchmark.value)} / {smartFormat(benchmark.threshold)}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--card-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// --- Trend Indicator ---

function TrendIndicator({ trend }: { trend: TooltipTrend }) {
  const isPositive = trend.value >= 0;
  const color = isPositive
    ? "var(--color-brand-green)"
    : "var(--color-negative)";
  const arrow = isPositive ? "\u2191" : "\u2193";

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
      style={{ color }}
    >
      <span>{arrow}</span>
      <span>{Math.abs(trend.value).toFixed(1)}%</span>
      {trend.period && (
        <span
          className="font-normal ml-0.5"
          style={{ color: "var(--text-tertiary)" }}
        >
          {trend.period}
        </span>
      )}
    </span>
  );
}

// --- Main Tooltip ---

export default function CustomTooltip({
  active,
  payload,
  label,
  title,
  labelMap,
  formatMap,
  defaultFormatter,
  unit,
  showShare,
  benchmark,
  trend,
  severity,
  sparklineData,
  footnote,
  contextInfo,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const totalValue = showShare
    ? payload.reduce(
        (sum, e) => sum + (typeof e.value === "number" ? e.value : 0),
        0
      )
    : 0;

  const headerText = title || label || null;
  const primaryColor = payload[0]?.color || "var(--color-accent)";

  return (
    <div
      className="tooltip-enter rounded-xl min-w-[210px] max-w-[360px] overflow-hidden"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-tooltip)",
      }}
      role="tooltip"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* ---- Header + severity badge ---- */}
      {(headerText || severity) && (
        <div
          className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5"
          style={{
            borderBottom: "1px solid var(--card-border)",
            background:
              "linear-gradient(135deg, rgba(0, 161, 125, 0.05) 0%, rgba(145, 13, 99, 0.03) 100%)",
          }}
        >
          {headerText && (
            <p
              className="text-[13px] font-semibold tracking-tight"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              {headerText}
            </p>
          )}
          {severity && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{
                background: `color-mix(in srgb, ${SEVERITY_STYLES[severity].color} 15%, transparent)`,
                color: SEVERITY_STYLES[severity].color,
              }}
            >
              {SEVERITY_STYLES[severity].label}
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        {/* ---- Trend + sparkline row ---- */}
        {(trend || sparklineData) && (
          <div className="flex items-center justify-between gap-3 mb-2.5">
            {trend && <TrendIndicator trend={trend} />}
            {sparklineData && (
              <MiniSparkline data={sparklineData} color={primaryColor} />
            )}
          </div>
        )}

        {/* ---- Data rows ---- */}
        <div className="space-y-0">
          {payload.map((entry, index) => {
            // Resolve the display label for this entry:
            // 1. Check labelMap (explicit overrides) by dataKey and name
            // 2. Use the data item's "name" or "fullName" field (category label from the data)
            // 3. Use the Recharts-injected `label` (XAxis category) for single-series bar charts
            // 4. Fall back to the dataKey/entry name
            const dataItemName =
              (entry.payload?.fullName as string) ||
              (entry.payload?.name as string) ||
              null;
            const entryLabel =
              (labelMap && entry.dataKey && labelMap[entry.dataKey]) ||
              (labelMap && labelMap[entry.name]) ||
              dataItemName ||
              (payload.length === 1 && label ? String(label) : null) ||
              entry.name;

            const formatter =
              (formatMap && entry.dataKey && formatMap[entry.dataKey]) ||
              (formatMap && formatMap[entry.name]) ||
              defaultFormatter ||
              smartFormat;

            const formattedValue =
              entry.value == null ||
              (typeof entry.value === "number" && !isFinite(entry.value))
                ? "\u2014"
                : typeof entry.value === "number"
                ? formatter(entry.value)
                : String(entry.value);

            const share =
              showShare && totalValue > 0 && typeof entry.value === "number"
                ? ((entry.value / totalValue) * 100).toFixed(1)
                : null;

            return (
              <div key={index}>
                {/* Divider between rows when more than 2 entries */}
                {index > 0 && payload.length > 2 && (
                  <div
                    className="my-1.5"
                    style={{
                      borderTop: "1px solid var(--card-border)",
                      opacity: 0.5,
                    }}
                  />
                )}
                <div className="flex items-center gap-2.5 py-1">
                  {/* Color swatch - larger circle */}
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  {/* Label */}
                  <span
                    className="text-xs flex-1 truncate"
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {entryLabel}
                  </span>
                  {/* Value */}
                  <span
                    className="text-xs font-semibold tabular-nums whitespace-nowrap"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {formattedValue}
                    {unit ? ` ${unit}` : ""}
                  </span>
                  {/* Share badge */}
                  {share && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                      style={{
                        background: `color-mix(in srgb, ${entry.color} 15%, transparent)`,
                        color: entry.color,
                      }}
                    >
                      {share}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- Benchmark bar ---- */}
        {benchmark && <BenchmarkBar benchmark={benchmark} />}

        {/* ---- Footnote ---- */}
        {footnote && (
          <p
            className="text-[10px] mt-2.5 pt-2"
            style={{
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--card-border)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {footnote}
          </p>
        )}

        {/* ---- Context info (region/filter) ---- */}
        {contextInfo && (
          <p
            className="text-[10px] mt-2 pt-2 flex items-center gap-1"
            style={{
              color: "var(--text-tertiary)",
              borderTop: footnote ? undefined : "1px solid var(--card-border)",
              fontFamily: "var(--font-sans)",
            }}
          >
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{contextInfo}</span>
          </p>
        )}
      </div>
    </div>
  );
}
