"use client";

/* ------------------------------------------------------------------ */
/*  HeroKPIGauges                                                      */
/*  A clean, information-dense KPI dashboard header for M&E audiences. */
/*  Top tier: 4 headline metrics with before→after progress bars       */
/*  Bottom tier: remaining metrics in compact 2-col with delta badges  */
/*                                                                     */
/*  Design: sentiment-aware accent borders, baseline marker overlays,  */
/*  theme-aware, no gimmicky gauges.                                   */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { formatUSD, formatPercent } from "@/lib/utils/formatters";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface HeroKPI {
  metric: string;
  label: string;
  baseline: number;
  midline: number;
  change: number;
  pctChange: number;
  format: "percent" | "currency" | "number" | "index";
  higherIsBetter: boolean;
}

interface HeroKPIGaugesProps {
  kpis: HeroKPI[];
  /** How many metrics get the large card treatment (default 4) */
  heroCount?: number;
}

/* ── Helpers ── */
function fmtValue(v: number, fmt: string): string {
  switch (fmt) {
    case "currency": return formatUSD(v);
    case "percent": return formatPercent(v);
    default: return v.toFixed(2);
  }
}

function fmtPctChange(pct: number): string {
  if (Math.abs(pct) < 0.1) return "0%";
  const sign = pct > 0 ? "+" : "";
  if (Math.abs(pct) >= 100) return `${sign}${Math.round(pct)}%`;
  return `${sign}${pct.toFixed(1)}%`;
}

function sentiment(pctChange: number, higherIsBetter: boolean): "good" | "bad" | "neutral" {
  const effective = higherIsBetter ? pctChange : -pctChange;
  if (effective > 2) return "good";
  if (effective < -2) return "bad";
  return "neutral";
}

const SENTIMENT_STYLES = {
  good: { accent: "#00A17D", bg: "rgba(0, 161, 125, 0.06)", border: "rgba(0, 161, 125, 0.35)" },
  bad: { accent: "#910D63", bg: "rgba(145, 13, 99, 0.06)", border: "rgba(145, 13, 99, 0.35)" },
  neutral: { accent: "var(--text-tertiary)", bg: "rgba(128, 128, 128, 0.04)", border: "var(--card-border)" },
} as const;

/* ── Hero Card — clean number-forward design, no misleading bars ── */
function HeroCard({ kpi, isHovered, onHover, onLeave }: {
  kpi: HeroKPI;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const s = sentiment(kpi.pctChange, kpi.higherIsBetter);
  const styles = SENTIMENT_STYLES[s];

  return (
    <div
      className="brand-card px-3 py-2.5 flex flex-col gap-1 transition-all duration-200 cursor-default"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        borderLeft: `3px solid ${styles.border}`,
        background: isHovered ? styles.bg : undefined,
      }}
    >
      {/* Label */}
      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-heading)" }}>
        {kpi.label}
      </div>

      {/* Headline value + change badge */}
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-bold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
          {fmtValue(kpi.midline, kpi.format)}
        </span>
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
          style={{
            color: styles.accent,
            background: s === "neutral" ? "rgba(128,128,128,0.08)" : `${styles.accent}12`,
          }}
        >
          {s === "good" ? <TrendingUp size={11} /> : s === "bad" ? <TrendingDown size={11} /> : <Minus size={11} />}
          {fmtPctChange(kpi.pctChange)}
        </span>
      </div>

      {/* Baseline context */}
      <div className="text-[9px] text-[var(--text-quaternary)] mt-0.5">
        was <span className="font-mono text-[var(--text-tertiary)]">{fmtValue(kpi.baseline, kpi.format)}</span>
      </div>
    </div>
  );
}

/* ── Compact row for secondary metrics ── */
function CompactMetric({ kpi }: { kpi: HeroKPI }) {
  const s = sentiment(kpi.pctChange, kpi.higherIsBetter);
  const styles = SENTIMENT_STYLES[s];

  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded-md transition-colors hover:bg-[var(--card-bg-hover)]"
      style={{ borderLeft: `2px solid ${styles.border}` }}
    >
      <span className="text-[10px] text-[var(--text-secondary)] font-medium truncate mr-3 flex-1">
        {kpi.label}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold font-mono text-[var(--text-primary)]">
          {fmtValue(kpi.midline, kpi.format)}
        </span>
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
          style={{
            background: s === "neutral" ? "rgba(128,128,128,0.1)" : `${styles.accent}15`,
            color: styles.accent,
          }}
        >
          {s === "good" ? <TrendingUp size={9} /> : s === "bad" ? <TrendingDown size={9} /> : <Minus size={9} />}
          {fmtPctChange(kpi.pctChange)}
        </span>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function HeroKPIGauges({
  kpis,
  heroCount = 4,
}: HeroKPIGaugesProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const heroKPIs = kpis.slice(0, heroCount);
  const secondaryKPIs = kpis.slice(heroCount);

  // Filter out zero-change secondary metrics to reduce noise
  const visibleSecondary = secondaryKPIs.filter(
    (k) => Math.abs(k.pctChange) > 0.1 || Math.abs(k.change) > 0.001
  );
  const zeroCount = secondaryKPIs.length - visibleSecondary.length;

  return (
    <div className="space-y-2">
      {/* ── Top: Hero cards ── */}
      <div className="grid grid-cols-2 gap-2">
        {heroKPIs.map((kpi, i) => (
          <HeroCard
            key={kpi.metric}
            kpi={kpi}
            isHovered={hoveredIdx === i}
            onHover={() => setHoveredIdx(i)}
            onLeave={() => setHoveredIdx(null)}
          />
        ))}
      </div>

      {/* ── Bottom: Secondary metrics ── */}
      {visibleSecondary.length > 0 && (
        <div className="brand-card py-1.5 px-1 space-y-0">
          {visibleSecondary.map((kpi) => (
            <CompactMetric key={kpi.metric} kpi={kpi} />
          ))}
          {zeroCount > 0 && (
            <div className="text-[8px] text-[var(--text-quaternary)] px-2 pt-1 italic">
              {zeroCount} indicator{zeroCount > 1 ? "s" : ""} unchanged (0.0%)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
