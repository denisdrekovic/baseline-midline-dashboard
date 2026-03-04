"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  BarChart3,
  Shield,
  Lightbulb,
  Target,
} from "lucide-react";
import type { Prediction } from "@/lib/utils/predictions";
import { formatUSD } from "@/lib/utils/formatters";

export const CATEGORY_CONFIG = {
  income: {
    icon: TrendingUp,
    color: "var(--color-accent)",
    label: "Income",
  },
  productivity: {
    icon: BarChart3,
    color: "#0DCAF0",
    label: "Productivity",
  },
  risk: {
    icon: Shield,
    color: "var(--color-negative)",
    label: "Risk",
  },
  opportunity: {
    icon: Lightbulb,
    color: "var(--color-brand-gold)",
    label: "Opportunity",
  },
};

const IMPACT_BADGE = {
  high: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "var(--color-negative)",
    label: "High Impact",
  },
  medium: {
    bg: "rgba(245, 158, 11, 0.15)",
    text: "var(--color-brand-gold)",
    label: "Medium Impact",
  },
  low: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "var(--color-accent)",
    label: "Low Impact",
  },
};

export default function PredictionCard({
  prediction,
  index,
}: {
  prediction: Prediction;
  index: number;
}) {
  const config = CATEGORY_CONFIG[prediction.category];
  const impact = IMPACT_BADGE[prediction.impact];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <div className="brand-card brand-card-hover h-full p-5 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${config.color}20` }}
            >
              <Icon size={16} style={{ color: config.color }} />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{prediction.title}</h4>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {config.label}
              </span>
            </div>
          </div>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: impact.bg, color: impact.text }}
          >
            {impact.label}
          </span>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 flex-1">
          {prediction.description}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${prediction.confidence}%`,
                  background: config.color,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
              {prediction.confidence}%
            </span>
          </div>
          {prediction.change != null && isFinite(prediction.change) && (
            <div className="flex items-center gap-1 ml-auto">
              {prediction.change > 0 ? (
                <TrendingUp size={12} style={{ color: "var(--color-accent)" }} />
              ) : (
                <TrendingDown size={12} style={{ color: "var(--color-negative)" }} />
              )}
              <span
                className="text-xs font-mono font-semibold"
                style={{
                  color:
                    prediction.change > 0
                      ? "var(--color-accent)"
                      : "var(--color-negative)",
                }}
              >
                {prediction.change > 0 ? "+" : ""}
                {prediction.change.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {prediction.currentValue != null &&
          prediction.predictedValue != null && (
            <div className="mt-3 pt-3 border-t border-[var(--card-border)] flex items-center justify-between text-xs">
              <div>
                <span className="text-[var(--text-tertiary)]">Current</span>
                <span className="font-mono font-semibold ml-2">
                  {formatUSD(prediction.currentValue)}
                </span>
              </div>
              <ChevronRight
                size={14}
                className="text-[var(--text-tertiary)]"
              />
              <div>
                <span className="text-[var(--text-tertiary)]">Projected</span>
                <span
                  className="font-mono font-semibold ml-2"
                  style={{ color: config.color }}
                >
                  {formatUSD(prediction.predictedValue)}
                </span>
              </div>
            </div>
          )}
      </div>
    </motion.div>
  );
}
