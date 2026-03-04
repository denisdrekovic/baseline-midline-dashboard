"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Target,
  FlaskConical,
  Wheat,
  Heart,
  Leaf,
  AlertTriangle,
  Users,
} from "lucide-react";
import type { ComparativeInsight, InsightSignificance, InsightDirection } from "@/lib/utils/comparativeChatEngine";

/* ── Icon mapping ── */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  DollarSign,
  Target,
  FlaskConical,
  Wheat,
  Heart,
  Leaf,
  AlertTriangle,
  Users,
};

/* ── Category colors ── */
const CATEGORY_COLOR: Record<string, string> = {
  Income: "var(--color-accent)",
  "Living Income": "#007BFF",
  Impact: "#6F42C1",
  Crops: "#FB8500",
  Gender: "#E91E8F",
  Practices: "#0DCAF0",
  Risk: "var(--color-negative)",
  Cooperatives: "var(--color-brand-gold)",
};

/* ── Significance badges ── */
const SIG_CONFIG: Record<InsightSignificance, { bg: string; text: string; label: string }> = {
  high: { bg: "rgba(0,161,125,0.12)", text: "var(--color-accent)", label: "High confidence" },
  moderate: { bg: "rgba(255,183,3,0.12)", text: "var(--color-brand-gold)", label: "Moderate" },
  low: { bg: "rgba(239,68,68,0.12)", text: "var(--color-negative)", label: "Low sample" },
};

/* ── Direction icons ── */
function DirectionIcon({ direction }: { direction: InsightDirection }) {
  if (direction === "positive")
    return <TrendingUp size={14} style={{ color: "var(--color-accent)" }} />;
  if (direction === "negative")
    return <TrendingDown size={14} style={{ color: "var(--color-negative)" }} />;
  return <Minus size={14} style={{ color: "var(--text-tertiary)" }} />;
}

function changeColor(direction: InsightDirection): string {
  if (direction === "positive") return "var(--color-accent)";
  if (direction === "negative") return "var(--color-negative)";
  return "var(--text-secondary)";
}

export default function InsightCard({
  insight,
  index,
}: {
  insight: ComparativeInsight;
  index: number;
}) {
  const Icon = ICON_MAP[insight.categoryIcon] ?? Target;
  const color = CATEGORY_COLOR[insight.category] ?? "var(--color-accent)";
  const sig = SIG_CONFIG[insight.significance];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
    >
      <div className="brand-card brand-card-hover h-full p-5 flex flex-col">
        {/* Header row: icon + title + significance badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}18` }}
            >
              <Icon size={17} style={{ color }} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {insight.title}
              </h4>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {insight.category}
              </span>
            </div>
          </div>
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
            style={{ background: sig.bg, color: sig.text }}
          >
            {sig.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 flex-1">
          {insight.description}
        </p>

        {/* Baseline → Midline values with change badge */}
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-baseline) 6%, transparent) 0%, color-mix(in srgb, var(--color-midline) 6%, transparent) 100%)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-[9px] font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: "var(--color-baseline)" }}
              >
                Baseline
              </div>
              <div
                className="text-sm font-bold font-mono"
                style={{ color: "var(--color-baseline)" }}
              >
                {insight.baselineValue}
              </div>
            </div>

            {/* Change badge */}
            <div className="flex flex-col items-center gap-0.5 px-2">
              <DirectionIcon direction={insight.direction} />
              <span
                className="text-[11px] font-bold font-mono"
                style={{ color: changeColor(insight.direction) }}
              >
                {insight.change}
              </span>
            </div>

            <div className="text-right">
              <div
                className="text-[9px] font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: "var(--color-midline)" }}
              >
                Midline
              </div>
              <div
                className="text-sm font-bold font-mono"
                style={{ color: "var(--color-accent)" }}
              >
                {insight.midlineValue}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: sample size + detail */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            n = {insight.sampleSize.toLocaleString()}
          </span>
          {insight.detail && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {insight.detail}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
