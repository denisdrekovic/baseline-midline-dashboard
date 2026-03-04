"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, ChevronUp, ChevronDown, X, RotateCcw } from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import FilterBar from "@/components/dashboard/FilterBar";
import { formatNumber } from "@/lib/utils/formatters";

interface CollapsibleFilterBarProps {
  defaultOpen?: boolean;
}

export default function CollapsibleFilterBar({ defaultOpen = false }: CollapsibleFilterBarProps) {
  const {
    geoFiltered,
    selection,
    projects,
    allProjects,
    genders,
    castes,
    farmSizes,
    resetGeo,
    setGenders,
    setProjects,
    setCastes,
    setFarmSizes,
  } = useGeo();
  const [filtersOpen, setFiltersOpen] = useState(defaultOpen);
  const [animating, setAnimating] = useState(false);

  const hasActiveFilters =
    selection.level !== "all" ||
    projects.length < allProjects.length ||
    genders.length > 0 ||
    castes.length > 0 ||
    farmSizes.length > 0;

  /* Build a list of active filter chips for the collapsed summary */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (selection.district) {
      chips.push({
        key: "geo",
        label: selection.village
          ? selection.village
          : selection.block
          ? selection.block
          : selection.district,
        onRemove: () => resetGeo(),
      });
    }

    if (projects.length < allProjects.length) {
      chips.push({
        key: "projects",
        label: projects.join(", "),
        onRemove: () => setProjects([...allProjects]),
      });
    }

    if (genders.length > 0) {
      chips.push({
        key: "genders",
        label: genders.join(", "),
        onRemove: () => setGenders([]),
      });
    }

    if (castes.length > 0) {
      chips.push({
        key: "castes",
        label: castes.join(", "),
        onRemove: () => setCastes([]),
      });
    }

    if (farmSizes.length > 0) {
      chips.push({
        key: "farmSizes",
        label: farmSizes.join(", "),
        onRemove: () => setFarmSizes([]),
      });
    }

    return chips;
  }, [selection, projects, allProjects, genders, castes, farmSizes, resetGeo, setProjects, setGenders, setCastes, setFarmSizes]);

  return (
    <div className="brand-card rounded-xl">
      {/* Single-row header with inline filter chips */}
      <div
        onClick={() => setFiltersOpen(!filtersOpen)}
        className="w-full flex items-center px-4 py-2 hover:bg-[var(--card-bg-hover)] transition-colors cursor-pointer gap-2"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFiltersOpen(!filtersOpen); } }}
      >
        {/* Left: icon + label + count */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={14} className="text-[var(--color-brand-gold)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Filters
          </span>
          {hasActiveFilters && !filtersOpen && activeChips.length === 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(255,192,0,0.15)] text-[var(--color-brand-gold)]">
              Active
            </span>
          )}
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {formatNumber(geoFiltered.length)} farmers
          </span>
        </div>

        {/* Center: inline active filter chips — only when collapsed */}
        {!filtersOpen && hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end mr-1 overflow-x-auto no-scrollbar">
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 text-[10px] font-medium pl-2 pr-1 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                style={{
                  background: "rgba(255,183,3,0.10)",
                  color: "var(--color-brand-gold)",
                  border: "1px solid rgba(255,183,3,0.20)",
                }}
              >
                {chip.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    chip.onRemove();
                  }}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-[rgba(255,183,3,0.25)] transition-colors"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X size={8} />
                </button>
              </span>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetGeo();
              }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors hover:bg-[rgba(239,68,68,0.12)] shrink-0"
              style={{
                color: "var(--color-negative, #EF4444)",
                border: "1px solid rgba(239,68,68,0.20)",
              }}
              aria-label="Reset all filters"
            >
              <RotateCcw size={8} />
              Reset
            </button>
          </div>
        )}

        {/* Right: expand/collapse */}
        <div className="flex items-center gap-1 text-[var(--text-tertiary)] shrink-0">
          <span className="text-[10px]">{filtersOpen ? "Collapse" : "Expand"}</span>
          {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* ── Expanded filter panel ── */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onAnimationStart={() => setAnimating(true)}
            onAnimationComplete={() => setAnimating(false)}
            style={{ overflow: animating ? "hidden" : "visible" }}
          >
            <div className="px-0 pb-1">
              <FilterBar />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
