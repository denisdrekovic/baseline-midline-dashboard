"use client";

import { useMemo } from "react";
import { AlertTriangle, GitCompareArrows } from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import { generateComparativeInsights } from "@/lib/utils/comparativeChatEngine";
import InsightCard from "./InsightCard";
import { formatNumber } from "@/lib/utils/formatters";

interface Props {
  baselineFarmers: Farmer[];
  midlineFarmers: Farmer[];
}

export default function ComparativeInsightsTab({ baselineFarmers, midlineFarmers }: Props) {
  const insights = useMemo(
    () => generateComparativeInsights(baselineFarmers, midlineFarmers),
    [baselineFarmers, midlineFarmers]
  );

  if (baselineFarmers.length < 10 || midlineFarmers.length < 10) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <AlertTriangle size={32} className="text-[var(--text-tertiary)] mb-3" />
        <h3 className="text-sm font-semibold mb-1">Insufficient Data</h3>
        <p className="text-xs text-[var(--text-tertiary)] max-w-md">
          Comparative insights require at least 10 farmers in each round.
          Broaden your geographic selection.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4">
      {/* Banner */}
      <div
        className="flex items-center gap-3 p-4 rounded-2xl mb-5"
        style={{
          background: "linear-gradient(135deg, rgba(255,183,3,0.12) 0%, rgba(111,66,193,0.08) 100%)",
          border: "1.5px solid rgba(255,183,3,0.25)",
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,183,3,0.15)" }}
        >
          <GitCompareArrows size={20} style={{ color: "#FFB703" }} />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Baseline → Midline Measured Changes
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real observed differences across{" "}
            <span className="font-mono font-bold" style={{ color: "var(--color-baseline)" }}>
              {formatNumber(baselineFarmers.length)}
            </span>{" "}
            baseline and{" "}
            <span className="font-mono font-bold" style={{ color: "var(--color-accent)" }}>
              {formatNumber(midlineFarmers.length)}
            </span>{" "}
            midline farmers — not predictions.
          </p>
        </div>
      </div>

      {/* Insight cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {insights.map((insight, i) => (
          <InsightCard key={insight.id} insight={insight} index={i} />
        ))}
      </div>
    </div>
  );
}
