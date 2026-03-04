"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { useDashboardLayout } from "@/providers/DashboardLayoutProvider";
import CollapsibleFilterBar from "@/components/dashboard/CollapsibleFilterBar";
import GeoBreadcrumb from "@/components/layout/GeoBreadcrumb";
import BentoGrid from "@/components/layout/BentoGrid";
import BentoCard from "@/components/layout/BentoCard";
import ChartContainer from "@/components/ui/ChartContainer";
import ScatterPlotChart from "@/components/charts/ScatterPlotChart";
import ProjectBadge from "@/components/ui/SegmentBadge";
import InsightsPanel from "@/components/ui/InsightsPanel";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import { PROJECT_COLORS, PROJECT_LABELS, PROJECT_SHORT } from "@/lib/data/constants";
import type { Farmer, ProjectGroup } from "@/lib/data/types";
import { formatUSD, formatNumber, formatPercent } from "@/lib/utils/formatters";
import { generateProjectGroupInsights } from "@/lib/utils/insights";
import { SectionActionLink } from "@/components/dashboard/analytics/shared";
import { useAuth } from "@/providers/AuthProvider";
import { Info, ChevronDown, ChevronUp, BrainCircuit, FlaskConical, Play, Pause, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ChartExpandModal from "@/components/charts/ChartExpandModal";
import ComparativeChat from "@/components/dashboard/comparative/ComparativeChat";
import { mean } from "@/lib/utils/statistics";

const PROJECT_ORDER: ProjectGroup[] = ["T-1", "T-2", "Control"];

/* ── Helpers ── */
function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export default function SegmentsPage() {
  const { aggregates, loading, getRound } = useData();
  const { geoFiltered: farmers, geoFilterRound } = useGeo();
  const { viewMode } = useDashboardLayout();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [insightsMethodOpen, setInsightsMethodOpen] = useState(false);

  // Toggle visibility for each project group on the scatter plot
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(PROJECT_ORDER)
  );

  const toggleGroup = (group: string) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        if (next.size > 1) next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  /* ── Round-aware data ── */
  const isComparative = viewMode === "comparative";

  const baselineFarmers = useMemo(
    () => geoFilterRound(getRound("baseline").farmers),
    [getRound, geoFilterRound]
  );
  const midlineFarmers = useMemo(
    () => geoFilterRound(getRound("midline").farmers),
    [getRound, geoFilterRound]
  );

  // Active round farmers (for single-round views)
  const activeFarmers = useMemo(() => {
    if (viewMode === "midline") return midlineFarmers;
    if (viewMode === "baseline") return baselineFarmers;
    return farmers; // fallback
  }, [viewMode, baselineFarmers, midlineFarmers, farmers]);

  /* ── Animation state for comparative mode ── */
  const [animProgress, setAnimProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  // Generation counter — increments on each replay to force a fresh animation
  const [animGen, setAnimGen] = useState(0);

  // Auto-play when entering comparative mode
  useEffect(() => {
    if (isComparative) {
      setAnimProgress(0);
      setAnimGen((g) => g + 1); // new generation
      const timer = setTimeout(() => setIsPlaying(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsPlaying(false);
      setAnimProgress(0);
    }
  }, [isComparative]);

  // Animation loop — keyed by [isPlaying, animGen] so replay always triggers fresh
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    // Always start from 0 on a fresh play/replay
    setAnimProgress(0);
    const startTime = performance.now();
    const duration = 2500; // 2.5 seconds

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      setAnimProgress(easeInOut(rawT));
      if (rawT < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  // animGen in deps ensures replay creates a new effect even if isPlaying was already true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, animGen]);

  const replay = useCallback(() => {
    setIsPlaying(false);
    setAnimProgress(0);
    // Bump generation so the effect re-fires even when isPlaying goes false→true
    setAnimGen((g) => g + 1);
    // Use setTimeout(0) to let React commit the false state before setting true
    setTimeout(() => setIsPlaying(true), 0);
  }, []);

  /* ── Matched farmers for animation (by ID) ── */
  const matchedFarmers = useMemo(() => {
    const bMap = new Map<number, Farmer>();
    for (const f of baselineFarmers) {
      if (f.resourcesIndex != null && f.productivityIndex != null) {
        bMap.set(f.id, f);
      }
    }
    return midlineFarmers
      .filter((f) => f.resourcesIndex != null && f.productivityIndex != null && bMap.has(f.id))
      .map((m) => {
        const b = bMap.get(m.id)!;
        return {
          id: m.id,
          project: m.project as string,
          name: isAdmin ? m.name : "Farmer",
          bx: b.resourcesIndex * 100,
          by: b.productivityIndex * 100,
          mx: m.resourcesIndex * 100,
          my: m.productivityIndex * 100,
          color: (PROJECT_COLORS as Record<string, string>)[m.project] || "#666",
        };
      });
  }, [baselineFarmers, midlineFarmers, isAdmin]);

  /* ── Scatter data ── */
  const scatterFiltered = useMemo(() => {
    return activeFarmers.filter(
      (f) =>
        f.project &&
        visibleGroups.has(f.project) &&
        f.resourcesIndex != null &&
        f.productivityIndex != null
    );
  }, [activeFarmers, visibleGroups]);

  const bubbleData = useMemo(() => {
    if (isComparative) {
      // Interpolated positions
      return matchedFarmers
        .filter((f) => visibleGroups.has(f.project))
        .map((f) => ({
          x: f.bx + (f.mx - f.bx) * animProgress,
          y: f.by + (f.my - f.by) * animProgress,
          name: f.name,
          color: f.color,
        }));
    }
    return scatterFiltered.map((f) => ({
      x: f.resourcesIndex * 100,
      y: f.productivityIndex * 100,
      name: isAdmin ? f.name : "Farmer",
      color: (PROJECT_COLORS as Record<string, string>)[f.project] || "#666",
    }));
  }, [isComparative, scatterFiltered, matchedFarmers, visibleGroups, animProgress, isAdmin]);

  const scatterTableData = useMemo(() => {
    if (isComparative) {
      return matchedFarmers
        .filter((f) => visibleGroups.has(f.project))
        .map((f) => ({
          "Project Group": f.project,
          Name: f.name,
          "Baseline Resources (%)": +f.bx.toFixed(1),
          "Baseline Productivity (%)": +f.by.toFixed(1),
          "Midline Resources (%)": +f.mx.toFixed(1),
          "Midline Productivity (%)": +f.my.toFixed(1),
        }));
    }
    return scatterFiltered.map((f) => ({
      "Project Group": f.project,
      Name: isAdmin ? f.name : "Farmer",
      "Resources Index (%)": +(f.resourcesIndex * 100).toFixed(1),
      "Productivity Index (%)": +(f.productivityIndex * 100).toFixed(1),
    }));
  }, [isComparative, scatterFiltered, matchedFarmers, visibleGroups, isAdmin]);

  /* ── Group details ── */
  const groupDetails = useMemo(() => {
    const source = activeFarmers;
    const groupMap = new Map<
      string,
      {
        count: number;
        incomes: number[];
        resources: number[];
        productivity: number[];
        empowerment: number[];
        aboveLIB: number;
        gapAdopted: number;
        fpcMembers: number;
      }
    >();
    for (const f of source) {
      if (!f.project) continue;
      if (!groupMap.has(f.project))
        groupMap.set(f.project, {
          count: 0,
          incomes: [],
          resources: [],
          productivity: [],
          empowerment: [],
          aboveLIB: 0,
          gapAdopted: 0,
          fpcMembers: 0,
        });
      const entry = groupMap.get(f.project)!;
      entry.count++;
      entry.incomes.push(f.totalNetIncomeUsd ?? 0);
      if (f.resourcesIndex != null) entry.resources.push(f.resourcesIndex);
      if (f.productivityIndex != null) entry.productivity.push(f.productivityIndex);
      if (f.womenEmpowerment != null) entry.empowerment.push(f.womenEmpowerment);
      if (f.aboveLIB === "Yes" || f.aboveLIB === 1) entry.aboveLIB++;
      if (
        f.practiceAdoption &&
        f.practiceAdoption !== "No crops" &&
        f.practiceAdoption !== "No answer" &&
        f.practiceAdoption !== "Zero GAP practiced"
      )
        entry.gapAdopted++;
      if (f.fpcMember === "Yes") entry.fpcMembers++;
    }
    return PROJECT_ORDER.filter((g) => groupMap.has(g)).map((group) => {
      const data = groupMap.get(group)!;
      return {
        group,
        count: data.count,
        avgIncome: mean(data.incomes),
        avgResources: mean(data.resources),
        avgProductivity: mean(data.productivity),
        avgEmpowerment: mean(data.empowerment),
        libPct: data.count ? (data.aboveLIB / data.count) * 100 : 0,
        gapPct: data.count ? (data.gapAdopted / data.count) * 100 : 0,
        fpcPct: data.count ? (data.fpcMembers / data.count) * 100 : 0,
      };
    });
  }, [activeFarmers]);

  /* ── Comparative group cards ── */
  const comparativeGroupDetails = useMemo(() => {
    if (!isComparative) return null;
    const calc = (source: Farmer[]) => {
      const groupMap = new Map<string, { count: number; incomes: number[]; aboveLIB: number; gapAdopted: number; avgRes: number[]; avgProd: number[] }>();
      for (const f of source) {
        if (!f.project) continue;
        if (!groupMap.has(f.project)) groupMap.set(f.project, { count: 0, incomes: [], aboveLIB: 0, gapAdopted: 0, avgRes: [], avgProd: [] });
        const e = groupMap.get(f.project)!;
        e.count++;
        e.incomes.push(f.totalNetIncomeUsd ?? 0);
        if (f.aboveLIB === "Yes" || f.aboveLIB === 1) e.aboveLIB++;
        if (f.practiceAdoption && f.practiceAdoption !== "No crops" && f.practiceAdoption !== "No answer" && f.practiceAdoption !== "Zero GAP practiced") e.gapAdopted++;
        if (f.resourcesIndex != null) e.avgRes.push(f.resourcesIndex);
        if (f.productivityIndex != null) e.avgProd.push(f.productivityIndex);
      }
      return PROJECT_ORDER.filter((g) => groupMap.has(g)).map((group) => {
        const d = groupMap.get(group)!;
        return {
          group,
          count: d.count,
          avgIncome: mean(d.incomes),
          libPct: d.count ? (d.aboveLIB / d.count) * 100 : 0,
          gapPct: d.count ? (d.gapAdopted / d.count) * 100 : 0,
          avgRes: mean(d.avgRes),
          avgProd: mean(d.avgProd),
        };
      });
    };
    return { baseline: calc(baselineFarmers), midline: calc(midlineFarmers) };
  }, [isComparative, baselineFarmers, midlineFarmers]);

  const insights = useMemo(() => generateProjectGroupInsights(activeFarmers), [activeFarmers]);

  if (loading || !aggregates) {
    return (
      <div className="space-y-4 py-4">
        <div className="skeleton h-80" />
        <BentoGrid cols={3}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </BentoGrid>
      </div>
    );
  }

  const roundLabel = viewMode === "midline" ? "Midline" : viewMode === "comparative" ? "Baseline → Midline" : "Baseline";

  return (
    <div className="flex">
      <div className="flex-1 min-w-0 space-y-4 pb-8">
      <GeoBreadcrumb />
      <CollapsibleFilterBar />

      {/* Scatter Plot */}
      <ChartContainer
        title="Project Group Distribution"
        subtitle={
          isComparative
            ? "Resources vs productivity — animated Baseline → Midline transition"
            : `Resources index vs productivity index (${roundLabel})`
        }
        tableData={scatterTableData}
      >
        <ScatterPlotChart
          data={bubbleData}
          xLabel="Resources Index (%)"
          yLabel="Productivity Index (%)"
          height={380}
          tooltipTitle="Farmer"
          disableAnimation={isComparative}
        />

        {/* Interactive color legend + animation controls */}
        <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Toggle project group visibility"
          >
            <FlaskConical size={12} className="text-[var(--text-tertiary)] shrink-0" />
            {PROJECT_ORDER.map((group) => {
              const isVisible = visibleGroups.has(group);
              const color = (PROJECT_COLORS as Record<string, string>)[group];
              return (
                <button
                  key={group}
                  onClick={() => toggleGroup(group)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                  style={{
                    background: isVisible ? `${color}20` : "var(--card-bg-hover)",
                    color: isVisible ? color : "var(--text-tertiary)",
                    border: `1px solid ${isVisible ? `${color}40` : "var(--card-border)"}`,
                    opacity: isVisible ? 1 : 0.5,
                  }}
                  aria-pressed={isVisible}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: isVisible ? color : "var(--text-tertiary)" }}
                  />
                  {(PROJECT_SHORT as Record<string, string>)[group] || group}
                </button>
              );
            })}
          </div>

          {/* Animation controls — comparative mode only */}
          {isComparative && (
            <div className="flex items-center gap-2">
              {/* Progress indicator */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-[var(--text-tertiary)]">
                  {animProgress < 0.05 ? "Baseline" : animProgress > 0.95 ? "Midline" : `${(animProgress * 100).toFixed(0)}%`}
                </span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${animProgress * 100}%`,
                      background: `linear-gradient(90deg, #007BFF, #00A17D)`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (animProgress >= 1) replay();
                  else setIsPlaying((p) => !p);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer"
                style={{
                  background: isPlaying ? "#910D6320" : "#00A17D20",
                  color: isPlaying ? "#910D63" : "#00A17D",
                  border: `1px solid ${isPlaying ? "#910D6340" : "#00A17D40"}`,
                }}
              >
                {isPlaying ? <Pause size={10} /> : animProgress >= 1 ? <RotateCcw size={10} /> : <Play size={10} />}
                {isPlaying ? "Pause" : animProgress >= 1 ? "Replay" : "Play"}
              </button>
            </div>
          )}
        </div>

        {/* Methodology toggle */}
        <button
          onClick={() => setMethodologyOpen((o) => !o)}
          className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--card-bg-hover)] cursor-pointer"
          style={{ color: "var(--text-tertiary)" }}
          aria-expanded={methodologyOpen}
          aria-controls="methodology-panel"
        >
          <Info size={12} />
          <span>Index Methodology</span>
          {methodologyOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        <AnimatePresence>
          {methodologyOpen && (
            <motion.div
              id="methodology-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="mt-2 p-3 rounded-xl text-[11px] leading-relaxed space-y-3"
                style={{
                  background: "var(--card-bg-hover)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  <span className="font-bold text-[var(--text-primary)]">Resources Index</span>
                  <p className="mt-0.5">
                    Additive composite score capturing a household&apos;s asset and service endowment.
                    Components include total cultivable acreage, access to financial services (credit,
                    savings, insurance), access to social safety nets, and FPC membership.
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[var(--text-primary)]">Productivity Index (0–100%)</span>
                  <p className="mt-0.5">
                    Normalized composite score (0–1, displayed as 0–100%) measuring farm output
                    efficiency. Components include crop yield per acre, GAP adoption rate, and net
                    income efficiency (net income per cultivated acre).
                  </p>
                </div>
                <div>
                  <span className="font-bold text-[var(--text-primary)]">Women Empowerment Score (0–8)</span>
                  <p className="mt-0.5">
                    Summative index of 8 binary survey items covering household decision-making,
                    financial autonomy, mobility, access to information, and economic participation.
                  </p>
                </div>
                <div
                  className="pt-2"
                  style={{ borderTop: "1px solid var(--card-border)" }}
                >
                  <span className="font-bold text-[var(--text-primary)]">Project Groups</span>
                  <p className="mt-0.5">
                    Farmers are classified into three mutually exclusive project groups:
                    <strong> T-1</strong> (Treatment 1 — Legacy Farmers),
                    <strong> T-2</strong> (Treatment 2 — New Intake), and
                    <strong> Control</strong> (Control Group — for contextualization and reference only).
                    {isComparative && " In comparative mode, dots animate from their baseline to midline positions."}
                  </p>
                </div>
                <p
                  className="text-[10px] pt-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Indices are pre-computed in the data pipeline from the reference dataset
                  (N = {formatNumber(activeFarmers.length)}).
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ChartContainer>

      {/* Project Group Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          Project Group Breakdown {isComparative && <span className="text-[10px] font-normal text-[var(--text-tertiary)]">(Baseline → Midline)</span>}
        </h3>

        {isComparative && comparativeGroupDetails ? (
          /* ── Comparative cards — show baseline vs midline side by side ── */
          <BentoGrid cols={3}>
            {comparativeGroupDetails.midline.map((mg, i) => {
              const bg = comparativeGroupDetails.baseline.find((b) => b.group === mg.group);
              const isControl = mg.group === "Control";
              const color = (PROJECT_COLORS as Record<string, string>)[mg.group];
              return (
                <BentoCard key={mg.group} delay={i * 0.05} className={isControl ? "relative" : ""}>
                  {isControl && (
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{ border: `1px dashed ${color}60`, background: `${color}06` }}
                    />
                  )}
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <ProjectBadge project={mg.group} size="md" />
                      {isControl && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Reference</span>
                      )}
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-tertiary)]">Farmers</span>
                        <span className="font-mono font-semibold">{formatNumber(mg.count)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-tertiary)]">Avg Income</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold">{formatUSD(mg.avgIncome)}</span>
                          {bg && <ChangeIndicator value={mg.avgIncome - bg.avgIncome} format="currency" size="sm" />}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-tertiary)]">Above LIB</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold" style={{ color }}>{mg.libPct.toFixed(1)}%</span>
                          {bg && <ChangeIndicator value={mg.libPct - bg.libPct} format="percent" size="sm" />}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-tertiary)]">GAP Adoption</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{mg.gapPct.toFixed(0)}%</span>
                          {bg && <ChangeIndicator value={mg.gapPct - bg.gapPct} format="percent" size="sm" />}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-tertiary)]">Avg Resources</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{formatPercent(mg.avgRes * 100)}</span>
                          {bg && <ChangeIndicator value={(mg.avgRes - bg.avgRes) * 100} format="percent" size="sm" />}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-tertiary)]">Avg Productivity</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{formatPercent(mg.avgProd * 100)}</span>
                          {bg && <ChangeIndicator value={(mg.avgProd - bg.avgProd) * 100} format="percent" size="sm" />}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-3 leading-relaxed">
                      {(PROJECT_LABELS as Record<string, string>)[mg.group] || mg.group}
                    </p>
                  </div>
                </BentoCard>
              );
            })}
          </BentoGrid>
        ) : (
          /* ── Single-round cards ── */
          <BentoGrid cols={3}>
            {groupDetails.map((pg, i) => {
              const isControl = pg.group === "Control";
              const color = (PROJECT_COLORS as Record<string, string>)[pg.group];
              return (
                <BentoCard
                  key={pg.group}
                  delay={i * 0.05}
                  className={isControl ? "relative" : ""}
                >
                  {isControl && (
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{ border: `1px dashed ${color}60`, background: `${color}06` }}
                    />
                  )}
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <ProjectBadge project={pg.group} size="md" />
                      {isControl && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Reference</span>
                      )}
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Farmers</span>
                        <span className="font-mono font-semibold">{formatNumber(pg.count)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Avg Income</span>
                        <span className="font-mono font-semibold">{formatUSD(pg.avgIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Above LIB</span>
                        <span className="font-mono font-semibold" style={{ color }}>{pg.libPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">GAP Adoption</span>
                        <span className="font-mono">{pg.gapPct.toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">FPC Members</span>
                        <span className="font-mono">{pg.fpcPct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-3 leading-relaxed">
                      {(PROJECT_LABELS as Record<string, string>)[pg.group] || pg.group}
                    </p>
                  </div>
                </BentoCard>
              );
            })}
          </BentoGrid>
        )}
      </div>

      {/* CTA + AI Insights — full-width below cards */}
      <div className="space-y-3">
        <SectionActionLink
          href="/analytics"
          label="Explore Groups in AI Analytics"
          icon={<BrainCircuit size={12} />}
        />

        {insights.length > 0 && (
          <BentoCard delay={0.1}>
            <InsightsPanel
              insights={insights}
              maxVisible={3}
              compact
              action={
                <button
                  onClick={() => setInsightsMethodOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:text-[var(--text-secondary)] cursor-pointer rounded-md px-1.5 py-0.5 hover:bg-[var(--card-bg-hover)]"
                  style={{ color: "var(--text-tertiary)" }}
                  title="How are these insights derived?"
                >
                  <Info size={11} />
                  <span>Methodology</span>
                </button>
              }
            />
          </BentoCard>
        )}

        {/* Methodology popup modal */}
        <ChartExpandModal
          open={insightsMethodOpen}
          onClose={() => setInsightsMethodOpen(false)}
          title="Insights Methodology"
        >
          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p>
              Insights are generated automatically from the farmer dataset
              (N&nbsp;=&nbsp;{formatNumber(activeFarmers.length)}) using rule-based statistical analysis — not a language model.
            </p>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-1">Methodology</h4>
              <p>
                Each insight compares project-group-level averages (income, GAP adoption, FPC membership,
                crop diversification) across T-1, T-2, and Control groups. The Control group serves as
                a reference baseline for contextualization — it is not included in actionable recommendations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-1">Thresholds</h4>
              <p>
                Income inequality uses P90/P10 ratio. Living Income Benchmark: $4,933.50/year household
                (~$830/year per capita). GAP adoption: ≥40% practice rate. FPC premium: within-group
                comparison of members vs non-members.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-1">Limitations</h4>
              <p>
                Observational cross-sectional data — associations do not imply causation. Group averages
                may mask within-group variation.
              </p>
            </div>
          </div>
        </ChartExpandModal>
      </div>

      </div>

      {/* ── Impact Chat — right side panel for comparative mode ── */}
      {viewMode === "comparative" && <ComparativeChat page="segments" />}
    </div>
  );
}
