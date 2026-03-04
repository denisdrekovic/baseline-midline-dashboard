"use client";

import { FlaskConical } from "lucide-react";

const PROJECT_OPTIONS = [
  { value: "all", label: "All Groups", color: "var(--color-brand-gold)", textColor: "#1A0E2E" },
  { value: "T-1", label: "T1", color: "#007BFF", textColor: "#fff" },
  { value: "T-2", label: "T2", color: "#6F42C1", textColor: "#fff" },
  { value: "Control", label: "Control", color: "#FFB703", textColor: "#1A0E2E" },
] as const;

export type ProjectFilter = "all" | "T-1" | "T-2" | "Control";

interface Props {
  value: ProjectFilter;
  onChange: (v: ProjectFilter) => void;
  counts: Record<string, number>;
  totalCount: number;
}

export default function ProjectGroupToggle({ value, onChange, counts, totalCount }: Props) {
  return (
    <div role="radiogroup" aria-label="Project group filter">
      <div className="flex items-center gap-1.5 mb-2">
        <FlaskConical size={12} className="text-[var(--text-tertiary)]" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">
          Project Group
        </span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PROJECT_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          const count = opt.value === "all" ? totalCount : (counts[opt.value] || 0);
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value as ProjectFilter)}
              role="radio"
              aria-checked={isActive}
              aria-label={`${opt.label} (${count} farmers)`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: isActive ? opt.color : "var(--card-bg-hover)",
                color: isActive ? opt.textColor : "var(--text-secondary)",
                border: `1px solid ${isActive ? opt.color : "var(--card-border)"}`,
                boxShadow: isActive ? `0 2px 8px ${opt.color}33` : "none",
              }}
            >
              {opt.label}
              <span
                className="text-[10px] font-mono opacity-80"
                style={{ color: isActive ? (opt.textColor === "#1A0E2E" ? "rgba(26,14,46,0.7)" : "rgba(255,255,255,0.8)") : "var(--text-tertiary)" }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
