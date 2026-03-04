"use client";

import { useMemo } from "react";
import DrillDownMap from "@/components/maps/DrillDownMap";
import CollapsibleFilterBar from "@/components/dashboard/CollapsibleFilterBar";
import SectionTabs from "@/components/dashboard/SectionTabs";
import IncomeSection from "@/components/dashboard/IncomeSection";
import CropsSection from "@/components/dashboard/CropsSection";
import WomenSection from "@/components/dashboard/WomenSection";
import SustainabilitySection from "@/components/dashboard/SustainabilitySection";
import OverviewSection from "@/components/dashboard/OverviewSection";
import OverviewComparative from "@/components/dashboard/comparative/OverviewComparative";
import IncomeComparative from "@/components/dashboard/comparative/IncomeComparative";
import CropsComparative from "@/components/dashboard/comparative/CropsComparative";
import WomenComparative from "@/components/dashboard/comparative/WomenComparative";
import SustainabilityComparative from "@/components/dashboard/comparative/SustainabilityComparative";
import ComparativeChat from "@/components/dashboard/comparative/ComparativeChat";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { useDashboardLayout } from "@/providers/DashboardLayoutProvider";
import { formatNumber } from "@/lib/utils/formatters";
import { isAboveLIB } from "@/lib/utils/statistics";
import Link from "next/link";
import { MapPin, BarChart3, ChevronLeft, ChevronRight, BrainCircuit, ArrowRight, DollarSign, Wheat, Heart, Leaf, GitCompareArrows } from "lucide-react";

export default function DashboardPage() {
  const { loading } = useData();
  const { geoFiltered, selection } = useGeo();
  const { panelOpen, togglePanel, panelWidth, viewMode, activeSection, setActiveSection } = useDashboardLayout();

  const locationLabel =
    selection.village || selection.block || selection.district || "All Regions";

  /* Quick KPI summary — computed on filtered data */
  const kpis = useMemo(() => {
    if (!geoFiltered.length) return null;
    const aboveLIB = geoFiltered.filter((f) => isAboveLIB(f.aboveLIB)).length;
    const libPct = (aboveLIB / geoFiltered.length) * 100;
    const incomes = geoFiltered
      .filter((f) => f.totalNetIncomeUsd != null)
      .map((f) => f.totalNetIncomeUsd!);
    const medianIncome = incomes.length
      ? (() => {
          const s = [...incomes].sort((a, b) => a - b);
          const m = Math.floor(s.length / 2);
          return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
        })()
      : 0;
    const femalePct =
      (geoFiltered.filter((f) => f.gender === "Female").length /
        geoFiltered.length) *
      100;
    return { libPct, medianIncome, femalePct, total: geoFiltered.length };
  }, [geoFiltered]);

  if (loading) {
    return (
      <div className="space-y-3 py-4" role="status" aria-busy="true">
        <span className="sr-only">Loading dashboard data</span>
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-[70vh] rounded-xl" />
      </div>
    );
  }

  return (
    <div
      className="-mx-4 md:-mx-6 flex flex-col"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {/* ── Filter Bar — full width, above map ── */}
      <div className="px-4 md:px-6 pt-2 pb-2 shrink-0 relative z-[1100]">
        <CollapsibleFilterBar />
      </div>

      {/* ── Main content: left panel + map ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 relative">

        {/* ── Collapsed panel indicator strip — shows when panel is closed ── */}
        {!panelOpen && (
          <div
            className="hidden md:flex shrink-0 flex-col items-center cursor-pointer order-1 transition-all hover:bg-[var(--card-bg-hover)]"
            onClick={togglePanel}
            style={{
              width: 42,
              background: "var(--card-bg)",
              borderRight: "1px solid var(--card-border)",
              paddingTop: 12,
              paddingBottom: 12,
            }}
            role="button"
            tabIndex={0}
            aria-label="Open analytics panel"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(); } }}
          >
            {/* Top: Icon + label */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <BarChart3 size={14} className="text-[var(--color-brand-gold)] shrink-0" />
              <span
                className="text-[8px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)] select-none"
                style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
              >
                Analytics
              </span>
            </div>

            {/* Center: Section tab icons — vertically centered */}
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
              {[
                { id: "overview", icon: <BarChart3 size={13} />, label: "Overview" },
                { id: "income", icon: <DollarSign size={13} />, label: "Income" },
                { id: "crops", icon: <Wheat size={13} />, label: "Crops" },
                { id: "women", icon: <Heart size={13} />, label: "Women" },
                { id: "sustainability", icon: <Leaf size={13} />, label: "Sustain." },
              ].map((tab) => (
                <div
                  key={tab.id}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{
                    color: activeSection === tab.id ? "var(--color-brand-gold)" : "var(--text-tertiary)",
                    background: activeSection === tab.id ? "rgba(255, 192, 0, 0.12)" : "transparent",
                  }}
                  title={tab.label}
                >
                  {tab.icon}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Left Analytics Panel — collapsible, floating card style ── */}
        <div
          role="region"
          aria-label="Analytics panel"
          className="shrink-0 flex flex-col overflow-hidden order-2 md:order-1 transition-[width,margin,opacity] duration-300 ease-in-out"
          style={{
            width: panelOpen ? `${panelWidth}px` : "0px",
            margin: panelOpen ? "8px 0 8px 0" : "0",
            borderRadius: panelOpen ? "0 16px 16px 0" : "0",
            borderTop: panelOpen ? "1px solid var(--card-border)" : "none",
            borderRight: panelOpen ? "1px solid var(--card-border)" : "none",
            borderBottom: panelOpen ? "1px solid var(--card-border)" : "none",
            background: panelOpen ? "var(--card-bg)" : "transparent",
            boxShadow: panelOpen ? "4px 0 24px rgba(0,0,0,0.15)" : "none",
          }}
        >
          {/* Panel Header — FREEZE PANE (sticky) */}
          <div
            className="shrink-0 px-4 pt-3 pb-2 space-y-2"
            style={{ borderBottom: "1px solid var(--card-border)" }}
          >
            {/* Title row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {viewMode === "comparative" ? (
                  <GitCompareArrows size={16} style={{ color: "#FFB703" }} />
                ) : (
                  <BarChart3
                    size={16}
                    className="text-[var(--color-brand-gold)]"
                  />
                )}
                <h2
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  {viewMode === "comparative" ? "Comparative" : "Analytics"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-[var(--text-tertiary)]" />
                <span className="text-xs text-[var(--text-tertiary)]">
                  {locationLabel}
                </span>
                <span className="text-[var(--text-tertiary)] text-xs">
                  &middot;
                </span>
                <span className="text-xs font-mono font-bold text-[var(--color-brand-gold)]">
                  {formatNumber(geoFiltered.length)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  farmers
                </span>
              </div>
            </div>

            {/* KPI mini strip + AI Insights CTA */}
            {kpis && viewMode !== "comparative" && (
              <div className="flex items-center gap-3 px-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)]" />
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                      {kpis.libPct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">above LIB</span>
                  </div>
                  <div className="w-px h-3" style={{ background: "var(--card-border)" }} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                      ${Math.round(kpis.medianIncome).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">median income</span>
                  </div>
                  <div className="w-px h-3" style={{ background: "var(--card-border)" }} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                      {kpis.femalePct.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">of cohort female</span>
                  </div>
                </div>
                <div className="w-px h-3" style={{ background: "var(--card-border)" }} />
                <Link
                  href="/analytics"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all hover:shadow-md shrink-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,161,125,0.12) 0%, rgba(0,123,255,0.08) 100%)",
                    border: "1px solid rgba(0,161,125,0.25)",
                  }}
                >
                  <BrainCircuit size={12} style={{ color: "#00A17D" }} />
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">AI Insights</span>
                  <ArrowRight size={10} className="text-[var(--text-tertiary)]" />
                </Link>
              </div>
            )}

            {/* Section Tabs */}
            <SectionTabs active={activeSection} onChange={setActiveSection} />
          </div>

          {/* ── Scrollable Section Content ── */}
          <div className="flex-1 overflow-y-auto p-4">
            <div
              role="tabpanel"
              id={`section-panel-${activeSection}`}
              aria-labelledby={`section-tab-${activeSection}`}
            >
              {viewMode === "comparative" ? (
                <>
                  {activeSection === "overview" && <OverviewComparative data={geoFiltered} />}
                  {activeSection === "income" && <IncomeComparative data={geoFiltered} />}
                  {activeSection === "crops" && <CropsComparative data={geoFiltered} />}
                  {activeSection === "women" && <WomenComparative data={geoFiltered} />}
                  {activeSection === "sustainability" && <SustainabilityComparative data={geoFiltered} />}
                </>
              ) : (
                <>
                  {activeSection === "overview" && <OverviewSection data={geoFiltered} />}
                  {activeSection === "income" && <IncomeSection data={geoFiltered} />}
                  {activeSection === "crops" && <CropsSection data={geoFiltered} />}
                  {activeSection === "women" && <WomenSection data={geoFiltered} />}
                  {activeSection === "sustainability" && <SustainabilitySection data={geoFiltered} />}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Panel toggle — floating circle at panel/map boundary ── */}
        <button
          onClick={(e) => { e.stopPropagation(); togglePanel(); }}
          className="hidden md:flex items-center justify-center rounded-full transition-all duration-300 ease-in-out hover:scale-110 absolute z-[1100]"
          style={{
            top: "50%",
            left: panelOpen ? panelWidth - 12 : 30,
            transform: "translateY(-50%)",
            width: 24,
            height: 24,
            background: "white",
            border: "2px solid rgba(228, 213, 245, 0.3)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            color: "var(--color-brand-deep-purple)",
          }}
          aria-label={panelOpen ? "Collapse analytics panel" : "Expand analytics panel"}
          title={panelOpen ? "Collapse panel" : "Expand panel"}
        >
          {panelOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* ── Map — fills remaining space, click to open panel when closed ── */}
        <div
          className="shrink-0 md:shrink md:flex-1 h-[300px] md:h-full relative overflow-hidden order-1 md:order-3"
        >
          <DrillDownMap height="100%" />

          {/* Panel re-opens via the chevron toggle or collapsed indicator strip */}
        </div>

        {/* ── Impact Chat — right side panel for comparative mode ── */}
        {viewMode === "comparative" && (
          <ComparativeChat page="dashboard" section={activeSection} />
        )}
      </div>
    </div>
  );
}
