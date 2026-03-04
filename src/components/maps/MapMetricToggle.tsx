"use client";

import { useCallback } from "react";
import { useDashboardLayout, type MapMetric } from "@/providers/DashboardLayoutProvider";
import { Activity, DollarSign, TrendingUp, Users } from "lucide-react";

const METRICS: {
  key: MapMetric;
  label: string;
  icon: typeof Activity;
  activeColor: string;
  activeBg: string;
}[] = [
  {
    key: "lib",
    label: "LIB",
    icon: TrendingUp,
    activeColor: "#FFB703",
    activeBg: "rgba(255, 183, 3, 0.25)",
  },
  {
    key: "productivity",
    label: "Productivity",
    icon: Activity,
    activeColor: "#00A17D",
    activeBg: "rgba(0, 161, 125, 0.25)",
  },
  {
    key: "income",
    label: "Income",
    icon: DollarSign,
    activeColor: "#007BFF",
    activeBg: "rgba(0, 123, 255, 0.25)",
  },
  {
    key: "resources",
    label: "Resources",
    icon: Users,
    activeColor: "#6F42C1",
    activeBg: "rgba(111, 66, 193, 0.25)",
  },
];

export default function MapMetricToggle() {
  const { mapMetric, setMapMetric, viewMode } = useDashboardLayout();
  const isComparative = viewMode === "comparative";

  const activeIdx = METRICS.findIndex((m) => m.key === mapMetric);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let nextIdx = activeIdx;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIdx = (activeIdx + 1) % METRICS.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIdx = (activeIdx - 1 + METRICS.length) % METRICS.length;
      } else {
        return;
      }
      setMapMetric(METRICS[nextIdx].key);
      // Focus the newly active radio
      const container = e.currentTarget as HTMLElement;
      const buttons = container.querySelectorAll<HTMLElement>('[role="radio"]');
      buttons[nextIdx]?.focus();
    },
    [activeIdx, setMapMetric]
  );

  return (
    <div
      className="absolute top-[48px] right-2 sm:right-4 z-[1000] flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl"
      style={{
        background: "rgba(42, 16, 85, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(228, 213, 245, 0.15)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
      role="radiogroup"
      aria-label="Map metric selector"
      onKeyDown={handleKeyDown}
    >
      {METRICS.map(({ key, label, icon: Icon, activeColor, activeBg }, i) => {
        const isActive = mapMetric === key;
        return (
          <button
            key={key}
            tabIndex={isActive ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation(); // prevent map click-to-open-panel
              setMapMetric(key);
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer"
            style={{
              background: isActive ? activeBg : "transparent",
              color: isActive ? activeColor : "rgba(228, 213, 245, 0.6)",
              border: isActive
                ? `1px solid ${activeColor}40`
                : "1px solid transparent",
            }}
            role="radio"
            aria-checked={isActive}
            aria-label={`Show ${isComparative ? "change in " : ""}${label} on map`}
            title={`Show ${isComparative ? "change in " : ""}${label} on map`}
          >
            <Icon size={12} aria-hidden="true" />
            <span className="hidden sm:inline">{isComparative ? `Δ ${label}` : label}</span>
          </button>
        );
      })}
    </div>
  );
}
