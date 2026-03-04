"use client";

import { useMemo } from "react";
import { Users, Zap, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { isAboveLIB, median } from "@/lib/utils/statistics";
import { formatUSD, formatNumber } from "@/lib/utils/formatters";
import type { Farmer } from "@/lib/data/types";

/* — Mini analytics section components — */
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

/* ═══════════════════════════════════════
   Executive Summary — Top-level Insights
   ═══════════════════════════════════════ */

function ExecutiveSummary({ data }: { data: Farmer[] }) {
  const summary = useMemo(() => {
    if (!data.length) return null;

    // Core metrics
    const aboveLIB = data.filter((f) => isAboveLIB(f.aboveLIB));
    const libPct = (aboveLIB.length / data.length) * 100;
    const incomes = data.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
    const medianIncome = incomes.length ? median(incomes) : 0;
    const female = data.filter((f) => f.gender === "Female");
    const femalePct = data.length ? (female.length / data.length) * 100 : 0;
    const femaleAboveLIB = female.filter((f) => isAboveLIB(f.aboveLIB));
    const femaleLIBPct = female.length ? (femaleAboveLIB.length / female.length) * 100 : 0;
    const male = data.filter((f) => f.gender === "Male");
    const maleLIBPct = male.length ? (male.filter((f) => isAboveLIB(f.aboveLIB)).length / male.length) * 100 : 0;
    const genderGap = Math.abs(maleLIBPct - femaleLIBPct);

    // Off-farm dependency
    const offFarmDeps = data.map((f) => f.offFarmDependency).filter((v): v is number => v != null && isFinite(v));
    const avgOffFarmDep = offFarmDeps.length ? offFarmDeps.reduce((a, b) => a + b, 0) / offFarmDeps.length : 0;

    // Daily per capita
    const dailyIncomes = data.map((f) => f.netIncomeDailyIndividual).filter((v): v is number => v != null && isFinite(v));
    const avgDailyPC = dailyIncomes.length ? dailyIncomes.reduce((a, b) => a + b, 0) / dailyIncomes.length : 0;

    // Generate priority findings
    const findings: { icon: "warning" | "insight" | "positive"; text: string }[] = [];

    if (libPct < 50) {
      findings.push({
        icon: "warning",
        text: `Only ${libPct.toFixed(0)}% of farmers meet the Living Income Benchmark — ${formatNumber(data.length - aboveLIB.length)} households need targeted support to bridge the gap.`,
      });
    } else {
      findings.push({
        icon: "positive",
        text: `${libPct.toFixed(0)}% of farmers meet the Living Income Benchmark — a strong baseline, but ${formatNumber(data.length - aboveLIB.length)} households still fall short.`,
      });
    }

    if (genderGap > 10) {
      findings.push({
        icon: "warning",
        text: `${genderGap.toFixed(0)} percentage point gender gap in LIB attainment (Male: ${maleLIBPct.toFixed(0)}%, Female: ${femaleLIBPct.toFixed(0)}%) — women-focused interventions needed.`,
      });
    }

    if (avgDailyPC > 0 && avgDailyPC < 2.15) {
      findings.push({
        icon: "warning",
        text: `Average daily per-capita income is $${avgDailyPC.toFixed(2)} — below the $2.15 extreme poverty threshold.`,
      });
    }

    if (avgOffFarmDep > 40) {
      findings.push({
        icon: "insight",
        text: `${avgOffFarmDep.toFixed(0)}% of income comes from off-farm sources, indicating high dependency on non-agricultural livelihoods.`,
      });
    }

    // Ensure at least 3 findings — add contextual fillers for small or uniform groups
    if (findings.length < 3 && femalePct > 0) {
      findings.push({
        icon: "insight",
        text: `The cohort is ${femalePct.toFixed(0)}% female (${formatNumber(female.length)} women, ${formatNumber(male.length)} men) with a median household income of ${formatUSD(medianIncome)}.`,
      });
    }
    if (findings.length < 3 && avgOffFarmDep > 0) {
      findings.push({
        icon: avgOffFarmDep > 25 ? "warning" : "positive",
        text: `Off-farm sources contribute ${avgOffFarmDep.toFixed(0)}% of total income on average across ${formatNumber(data.length)} households.`,
      });
    }
    if (findings.length < 3) {
      findings.push({
        icon: "insight",
        text: `Sample includes ${formatNumber(data.length)} farming households with a median net annual income of ${formatUSD(medianIncome)}.`,
      });
    }

    return {
      libPct,
      medianIncome,
      femalePct,
      total: data.length,
      findings: findings.slice(0, 3), // Top 3 findings
    };
  }, [data]);

  if (!summary) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(0,161,125,0.06) 0%, rgba(0,123,255,0.04) 100%)",
        border: "1px solid rgba(0,161,125,0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(0,161,125,0.1)" }}>
        <Zap size={12} style={{ color: "#FFB703" }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          Key Findings
        </span>
      </div>

      {/* Quick Metric Row */}
      <div className="grid grid-cols-3 gap-px mx-3 mt-2">
        <div className="text-center py-1.5">
          <div className="text-lg font-bold font-mono leading-none" style={{ color: summary.libPct >= 50 ? "#00A17D" : "#FFB703" }}>
            {summary.libPct.toFixed(1)}%
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)] mt-1 whitespace-nowrap">
            HH Above LIB
          </div>
        </div>
        <div className="text-center py-1.5" style={{ borderLeft: "1px solid var(--card-border)", borderRight: "1px solid var(--card-border)" }}>
          <div className="text-lg font-bold font-mono leading-none" style={{ color: "var(--text-primary)" }}>
            {formatUSD(summary.medianIncome)}
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)] mt-1 whitespace-nowrap">
            Median Net Income
          </div>
        </div>
        <div className="text-center py-1.5">
          <div className="text-lg font-bold font-mono leading-none" style={{ color: "#8ECAE6" }}>
            {summary.femalePct.toFixed(0)}%
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)] mt-1 whitespace-nowrap">
            of Cohort Female
          </div>
        </div>
      </div>

      {/* Findings */}
      <div className="px-3 py-2 space-y-1.5">
        {summary.findings.map((finding, i) => (
          <div key={i} className="flex items-start gap-2">
            {finding.icon === "warning" ? (
              <AlertTriangle size={10} className="shrink-0 mt-0.5" style={{ color: "#FFB703" }} />
            ) : finding.icon === "positive" ? (
              <TrendingUp size={10} className="shrink-0 mt-0.5" style={{ color: "#00A17D" }} />
            ) : (
              <Lightbulb size={10} className="shrink-0 mt-0.5" style={{ color: "#007BFF" }} />
            )}
            <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {finding.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   OVERVIEW SECTION
   ═══════════════════════════════════════ */

export default function OverviewSection({ data }: { data: Farmer[] }) {
  return (
    <div className="space-y-3">
      {/* ── Analytics Sections ── */}
      {!data.length ? (
        <div className="text-center py-16 text-[var(--text-tertiary)]">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No data for current selection</p>
        </div>
      ) : (
        <>
          {/* Executive Summary — key findings at a glance */}
          <ExecutiveSummary data={data} />

          {/* Core Metric */}
          <LivingIncomeSection data={data} />

          {/* Context: Who are these farmers? */}
          <DemographicSection data={data} />

          {/* Income & Production */}
          <IncomeCompositionSection data={data} />
          <ProductionSection data={data} />

          {/* Actionable Levers */}
          <FinanceSection data={data} />
          <ProjectGroupSection data={data} />

          {/* Cross-cutting Themes */}
          <WomenEmpowermentSection data={data} />
          <PerspectivesSection data={data} />
          <AgroforestrySection data={data} />
          <CarbonSection data={data} />
        </>
      )}
    </div>
  );
}
