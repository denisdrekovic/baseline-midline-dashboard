"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  TrendingUp,
  MapPin,
  BarChart3,
  Filter,
  FlaskConical,
  BrainCircuit,
  ArrowRight,
} from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import { mean, median, isAboveLIB } from "@/lib/utils/statistics";
import { formatUSD, formatNumber, formatPercent } from "@/lib/utils/formatters";
import type { Farmer } from "@/lib/data/types";

/* — Section components — */
import LivingIncomeSection from "./analytics/LivingIncomeSection";
import IncomeCompositionSection from "./analytics/IncomeCompositionSection";
import DemographicSection from "./analytics/DemographicSection";
import ProductionSection from "./analytics/ProductionSection";
import ProjectGroupSection from "./analytics/SegmentationSection";
import PerspectivesSection from "./analytics/PerspectivesSection";
import FinanceSection from "./analytics/FinanceSection";
import WomenEmpowermentSection from "./analytics/WomenEmpowermentSection";
import AgroforestrySection from "./analytics/AgroforestrySection";
import CarbonSection from "./analytics/CarbonSection";

/* ===================================================================
   SECTION NAVIGATION
   =================================================================== */

const SECTION_NAV = [
  { id: "analytics-demo", label: "Demo" },
  { id: "analytics-lib", label: "LI KPI" },
  { id: "analytics-income", label: "Income" },
  { id: "analytics-prod", label: "Production" },
  { id: "analytics-seg", label: "Groups" },
  { id: "analytics-persp", label: "Perspectives" },
  { id: "analytics-finance", label: "Finance" },
  { id: "analytics-women", label: "Women" },
  { id: "analytics-agro", label: "Agroforestry" },
  { id: "analytics-carbon", label: "CO₂" },
] as const;

/* ===================================================================
   PROJECT FILTER OPTIONS (T1 / T2 / Control)
   =================================================================== */

const PROJECT_OPTIONS = [
  { value: "all", label: "All Groups", color: "var(--color-brand-gold)" },
  { value: "T-1", label: "T1", color: "#007BFF" },
  { value: "T-2", label: "T2", color: "#6F42C1" },
  { value: "Control", label: "Control", color: "#FFB703" },
] as const;

type ProjectFilter = "all" | "T-1" | "T-2" | "Control";

/* ===================================================================
   MAIN PANEL
   =================================================================== */

interface AnalyticsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function AnalyticsPanel({ isOpen, onToggle }: AnalyticsPanelProps) {
  const { geoFiltered: allGeoFiltered, selection } = useGeo();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");

  /* ── Filter by project (T1/T2/Control) ─── */
  const data = useMemo(() => {
    if (projectFilter === "all") return allGeoFiltered;
    return allGeoFiltered.filter((f) => f.project === projectFilter);
  }, [allGeoFiltered, projectFilter]);

  /* ── Project group counts ─── */
  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = { "T-1": 0, "T-2": 0, Control: 0 };
    for (const f of allGeoFiltered) {
      if (f.project in counts) counts[f.project]++;
    }
    return counts;
  }, [allGeoFiltered]);

  /* ── KPI summary metrics ─── */
  const kpis = useMemo(() => {
    if (!data.length) return null;
    const aboveLIBCount = data.filter((f) => isAboveLIB(f.aboveLIB)).length;
    const libPct = (aboveLIBCount / data.length) * 100;
    const incomes = data.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
    const medianIncome = incomes.length ? median(incomes) : 0;
    const femalePct = data.length
      ? (data.filter((f) => f.gender === "Female").length / data.length) * 100
      : 0;
    // Adoption rate (exclude "Zero GAP practiced" — those have no GAP adoption)
    const adopted = data.filter(
      (f) =>
        f.practiceAdoption != null &&
        f.practiceAdoption !== "" &&
        f.practiceAdoption !== "No crops" &&
        f.practiceAdoption !== "No answer" &&
        f.practiceAdoption !== "Zero GAP practiced"
    );
    const adoptionPct = (adopted.length / data.length) * 100;

    return { libPct, medianIncome, femalePct, adoptionPct };
  }, [data]);

  /* ── Section jump navigation ─── */
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const elTop = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: elTop - 100, behavior: "smooth" });
    }
  }, []);

  /* ── Scroll spy: track which section is currently visible ─── */
  const [activeSection, setActiveSection] = useState<string>(SECTION_NAV[0].id);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const sectionIds = SECTION_NAV.map((n) => n.id);
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible section (topmost)
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      {
        root: container,
        rootMargin: "-20% 0px -60% 0px", // bias toward "top third" of the viewport
        threshold: 0,
      }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [isOpen, data]); // re-attach when panel opens or data changes

  /* ── Location label ─── */
  const locationLabel = selection.village || selection.block || selection.district || "All Regions";

  return (
    <>
      {/* ── Open tab (visible when panel is closed) ─── */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute top-1/2 -translate-y-1/2 left-0 z-[1001] flex items-center gap-1.5 rounded-r-lg transition-all group"
          style={{
            background: "var(--color-brand-gold)",
            boxShadow: "2px 0 16px rgba(0,0,0,0.3)",
            padding: "0 10px 0 8px",
            height: "48px",
          }}
          aria-label="Open analytics panel"
        >
          <BarChart3 size={16} className="text-white" />
          <span className="text-xs font-bold text-white tracking-wide uppercase hidden sm:inline">
            Analytics
          </span>
          <ChevronRight size={14} className="text-white/80" />
        </button>
      )}

      {/* ── Slide-out panel ─── */}
      <div
        className="absolute left-0 top-0 bottom-0 z-[1000] w-[520px] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          background: "var(--color-surface-0)",
          borderRight: "1px solid var(--card-border)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
            {/* ── Panel Header ─── */}
            <div className="shrink-0 px-3 pt-3 pb-2 space-y-1.5" style={{ borderBottom: "1px solid var(--card-border)" }}>
              {/* Title row + close button */}
              <div className="flex items-start justify-between">
                <div>
                  <h2
                    className="text-sm font-bold uppercase tracking-wide flex items-center gap-1.5"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
                  >
                    <BarChart3 size={14} className="text-[var(--color-brand-gold)]" />
                    Analytics
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin size={10} className="text-[var(--text-tertiary)]" />
                    <span className="text-[10px] text-[var(--text-tertiary)]">{locationLabel}</span>
                    <span className="text-[var(--text-tertiary)] text-[10px]">&middot;</span>
                    <span className="text-[10px] font-mono font-semibold text-[var(--color-brand-gold)]">
                      {formatNumber(data.length)}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">farmers</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggle}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                    style={{
                      background: "var(--color-brand-gold)",
                      boxShadow: "0 2px 8px rgba(255,183,3,0.3)",
                    }}
                    aria-label="Close analytics panel"
                    title="Close panel"
                  >
                    <ChevronLeft size={16} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Project Filter (T1 / T2 / Control) */}
              <div className="flex items-center gap-1.5">
                <FlaskConical size={10} className="text-[var(--text-tertiary)] shrink-0" />
                <div className="flex gap-1">
                  {PROJECT_OPTIONS.map((opt) => {
                    const isActive = projectFilter === opt.value;
                    const count =
                      opt.value === "all"
                        ? allGeoFiltered.length
                        : projectCounts[opt.value] || 0;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setProjectFilter(opt.value as ProjectFilter)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all"
                        style={{
                          background: isActive ? opt.color : "var(--card-bg-hover)",
                          color: isActive ? "#fff" : "var(--text-secondary)",
                          border: `1px solid ${isActive ? opt.color : "var(--card-border)"}`,
                          boxShadow: isActive ? `0 1px 4px ${opt.color}33` : "none",
                        }}
                      >
                        {opt.label}
                        <span
                          className="text-[8px] font-mono opacity-80"
                          style={{ color: isActive ? "rgba(255,255,255,0.8)" : "var(--text-tertiary)" }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KPI Strip — click to scroll to relevant section */}
              {kpis && (
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Above LI", value: `${kpis.libPct.toFixed(1)}%`, color: "var(--color-brand-gold)", section: "analytics-lib" },
                    { label: "Med Income", value: formatUSD(kpis.medianIncome), color: "var(--color-accent)", section: "analytics-income" },
                    { label: "Female Farmers", value: `${kpis.femalePct.toFixed(0)}%`, color: "#8ECAE6", section: "analytics-women" },
                    { label: "Adoption", value: `${kpis.adoptionPct.toFixed(0)}%`, color: "#6F42C1", section: "analytics-agro" },
                  ].map((kpi) => (
                    <button
                      key={kpi.label}
                      onClick={() => scrollToSection(kpi.section)}
                      className="text-center py-1 rounded-md cursor-pointer transition-all hover:scale-[1.04] hover:shadow-sm"
                      style={{ background: "var(--card-bg-hover)" }}
                    >
                      <div className="text-xs font-bold font-mono" style={{ color: kpi.color }}>
                        {kpi.value}
                      </div>
                      <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)]">{kpi.label}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* AI Insights CTA */}
              <Link
                href="/analytics"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all group hover:shadow-md"
                style={{
                  background: "linear-gradient(135deg, rgba(0,161,125,0.1) 0%, rgba(0,123,255,0.08) 100%)",
                  border: "1px solid rgba(0,161,125,0.2)",
                }}
              >
                <BrainCircuit size={14} style={{ color: "#00A17D" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[var(--text-primary)]">AI Predictions & Insights</div>
                  <div className="text-[9px] text-[var(--text-tertiary)]">Explore scenarios, forecasts & chat</div>
                </div>
                <ArrowRight size={12} className="text-[var(--text-tertiary)] group-hover:text-[#00A17D] transition-colors shrink-0" />
              </Link>

              {/* Jump Navigation — active section highlighted */}
              <div className="flex gap-0.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {SECTION_NAV.map((nav) => {
                  const isActive = activeSection === nav.id;
                  return (
                    <button
                      key={nav.id}
                      onClick={() => scrollToSection(nav.id)}
                      className={`text-[9px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-md transition-all shrink-0 ${
                        isActive
                          ? "bg-[var(--color-brand-gold)] text-white shadow-sm"
                          : "hover:bg-[var(--card-bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {nav.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Scrollable sections ─── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
              <div className="p-3 space-y-3">
                {!data.length ? (
                  <div className="text-center py-16 text-[var(--text-tertiary)]">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No data for current selection</p>
                    {projectFilter !== "all" && (
                      <button
                        onClick={() => setProjectFilter("all")}
                        className="text-xs text-[var(--color-brand-gold)] mt-2 underline"
                      >
                        Clear project filter
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <DemographicSection data={data} />
                    <LivingIncomeSection data={data} />
                    <IncomeCompositionSection data={data} />
                    <ProductionSection data={data} />
                    <ProjectGroupSection data={data} />
                    <PerspectivesSection data={data} />
                    <FinanceSection data={data} />
                    <WomenEmpowermentSection data={data} />
                    <AgroforestrySection data={data} />
                    <CarbonSection data={data} />
                  </>
                )}
              </div>
            </div>
      </div>
    </>
  );
}
