"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingUp, Users, Star, Heart, Leaf, ChevronDown, ChevronUp } from "lucide-react";
import { Insight } from "@/lib/data/types";

const ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle,
  TrendingUp,
  Users,
  Star,
  Heart,
  Leaf,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "#8B5CF6",
  warning: "var(--color-brand-gold)",
  success: "var(--color-brand-green)",
};

interface InsightsPanelProps {
  insights: Insight[];
  action?: React.ReactNode;
  /** Show only this many insights initially; the rest behind a "Show more" toggle */
  maxVisible?: number;
  /** Use compact spacing (less padding per insight) */
  compact?: boolean;
}

export default function InsightsPanel({
  insights,
  action,
  maxVisible,
  compact = false,
}: InsightsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!insights.length) return null;

  const shouldCollapse = maxVisible != null && insights.length > maxVisible;
  const visible = shouldCollapse && !expanded ? insights.slice(0, maxVisible) : insights;
  const hiddenCount = insights.length - (maxVisible ?? insights.length);

  const itemPadding = compact ? "p-2" : "p-3";
  const itemGap = compact ? "gap-2" : "gap-3";
  const listGap = compact ? "space-y-2" : "space-y-3";

  return (
    <div className={listGap}>
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Star size={14} className="text-[var(--color-accent)]" />
        AI Insights
        {action && <span className="ml-auto">{action}</span>}
      </h3>
      {visible.map((insight, i) => {
        const Icon = ICON_MAP[insight.icon] || Star;
        const color = SEVERITY_COLORS[insight.severity];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className={`flex ${itemGap} ${itemPadding} rounded-xl`}
            role={insight.severity === "warning" ? "alert" : undefined}
            style={{
              background: `${color}08`,
              borderLeft: `3px solid ${color}`,
            }}
          >
            <Icon size={compact ? 14 : 16} style={{ color }} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className={`${compact ? "text-[11px]" : "text-xs"} font-semibold`} style={{ color }}>
                {insight.title}
              </p>
              <p className={`${compact ? "text-[11px]" : "text-xs"} text-[var(--text-secondary)] mt-0.5 leading-snug`}>
                {insight.body}
              </p>
            </div>
          </motion.div>
        );
      })}

      {/* Show more / Show less toggle */}
      {shouldCollapse && (
        <AnimatePresence>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[var(--card-bg-hover)] cursor-pointer"
            style={{ color: "var(--text-tertiary)" }}
          >
            {expanded ? (
              <>
                Show less <ChevronUp size={12} />
              </>
            ) : (
              <>
                Show {hiddenCount} more insight{hiddenCount > 1 ? "s" : ""} <ChevronDown size={12} />
              </>
            )}
          </motion.button>
        </AnimatePresence>
      )}
    </div>
  );
}
