"use client";

import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Target, Sparkles } from "lucide-react";

export type AnalyticsTabId = "insights" | "chat";

interface AnalyticsTabsProps {
  active: AnalyticsTabId;
  onChange: (tab: AnalyticsTabId) => void;
}

const TABS: {
  id: AnalyticsTabId;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: "insights",
    label: "Insights",
    icon: <Target size={13} />,
    color: "var(--color-accent)",
  },
  {
    id: "chat",
    label: "AI Chat",
    icon: <Sparkles size={13} />,
    color: "#6F42C1",
  },
];

export default function AnalyticsTabs({
  active,
  onChange,
}: AnalyticsTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = TABS.findIndex((t) => t.id === active);
      let next = idx;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next = (idx + 1) % TABS.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        next = (idx - 1 + TABS.length) % TABS.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = TABS.length - 1;
      } else {
        return;
      }
      onChange(TABS[next].id);
      const buttons =
        tablistRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="tab"]'
        );
      buttons?.[next]?.focus();
    },
    [active, onChange]
  );

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="Analytics sections"
      onKeyDown={handleKeyDown}
      className="flex items-center gap-0.5 p-1 rounded-xl overflow-x-auto no-scrollbar"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`analytics-panel-${tab.id}`}
            id={`analytics-tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            style={{ color: isActive ? tab.color : "var(--text-tertiary)" }}
          >
            {isActive && (
              <motion.div
                layoutId="analytics-tab-active"
                className="absolute inset-0 rounded-lg"
                style={{
                  background: `${tab.color}10`,
                  border: `1px solid ${tab.color}30`,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.icon}</span>
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
