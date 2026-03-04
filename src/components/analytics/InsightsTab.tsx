"use client";

import { AlertTriangle, SlidersHorizontal, ArrowRight, Zap } from "lucide-react";
import type { Prediction } from "@/lib/utils/predictions";
import PredictionCard from "./PredictionCard";

interface Props {
  predictions: Prediction[];
  onNavigateToSimulator?: () => void;
}

export default function InsightsTab({ predictions, onNavigateToSimulator }: Props) {
  if (predictions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <AlertTriangle
          size={32}
          className="text-[var(--text-tertiary)] mb-3"
        />
        <h3 className="text-sm font-semibold mb-1">Insufficient Data</h3>
        <p className="text-xs text-[var(--text-tertiary)] max-w-md">
          Predictions require at least 10 farmers. Broaden your geographic
          selection on the Overview page.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4">
      {/* Prominent Action Banner — navigate to Simulator */}
      {onNavigateToSimulator && (
        <div
          className="flex items-center justify-between p-5 rounded-2xl mb-5"
          style={{
            background: "linear-gradient(135deg, rgba(0,161,125,0.18) 0%, rgba(0,123,255,0.12) 100%)",
            border: "1.5px solid rgba(0,161,125,0.35)",
            boxShadow: "0 4px 20px rgba(0,161,125,0.15), 0 0 0 1px rgba(0,161,125,0.05)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 animate-pulse"
              style={{ background: "rgba(0,161,125,0.2)" }}
            >
              <Zap size={22} style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">
                Explore What-If Scenarios
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Adjust crop yields, prices, costs & acreage to project LIB attainment by 2030
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToSimulator}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shrink-0 ml-4 cursor-pointer hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "var(--color-accent)",
              color: "white",
              boxShadow: "0 6px 20px rgba(0,161,125,0.35), 0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <SlidersHorizontal size={16} />
            Open LIB Scenario Tool
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {predictions.map((pred, i) => (
          <PredictionCard key={pred.id} prediction={pred} index={i} />
        ))}
      </div>

      {/* Bottom CTA */}
      {onNavigateToSimulator && predictions.length > 3 && (
        <div className="mt-6 text-center">
          <button
            onClick={onNavigateToSimulator}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:gap-3"
            style={{ color: "var(--color-accent)", background: "rgba(0,161,125,0.08)", border: "1px solid rgba(0,161,125,0.15)" }}
          >
            Explore scenarios in the LIB Scenario Tool
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
