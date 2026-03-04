"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useDashboardLayout, type ViewMode } from "@/providers/DashboardLayoutProvider";

/* ── Page titles ── */
const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/farmers": "Farmer Explorer",
  "/segments": "Project Groups",
  "/lib-calculator": "LIB Calculator",
  "/analytics": "AI Analytics & Predictions",
};

/* ── View mode colors (match sidebar) ── */
const VIEW_MODE_COLORS: Record<ViewMode, string> = {
  baseline: "#007BFF",
  midline: "#00A17D",
  comparative: "#FFB703",
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  baseline: "Baseline",
  midline: "Midline",
  comparative: "Comparative",
};

/* ── Section breadcrumb labels ── */
const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  income: "Income",
  crops: "Crops",
  women: "Women",
  sustainability: "Sustainability",
};

export default function Header() {
  const pathname = usePathname();
  const { viewMode, activeSection } = useDashboardLayout();
  const title = PAGE_TITLES[pathname] || "Dashboard";

  const isDashboard = pathname === "/";
  const isLIBCalc = pathname === "/lib-calculator";

  /* Breadcrumb — show section name on Dashboard when not overview */
  const sectionLabel =
    isDashboard && activeSection !== "overview"
      ? SECTION_LABELS[activeSection] ?? null
      : null;

  /* Active round color + label for the context badge */
  const roundColor = VIEW_MODE_COLORS[viewMode];
  const roundLabel = VIEW_MODE_LABELS[viewMode];

  return (
    <header className="flex items-center justify-between py-2 px-1" role="banner">
      <div className="flex items-center gap-3">
        {/* Page title + breadcrumb */}
        <div className="flex items-center gap-1.5">
          <h1
            className="text-sm font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-title)" }}
          >
            {title}
          </h1>
          {sectionLabel && (
            <>
              <ChevronRight size={11} className="text-[var(--text-quaternary)]" />
              <span
                className="text-sm font-semibold text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {sectionLabel}
              </span>
            </>
          )}
        </div>

        {/* Data-round context badge (not shown on LIB Calculator) */}
        {!isLIBCalc && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
            style={{
              background: `${roundColor}10`,
              border: `1px solid ${roundColor}25`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: roundColor }}
            />
            <span
              className="text-[10px] font-bold tracking-wide"
              style={{ color: roundColor }}
            >
              {roundLabel}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
