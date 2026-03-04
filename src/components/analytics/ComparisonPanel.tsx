"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  DollarSign,
  BarChart3,
  Users,
  Layers,
  TrendingUp,
  TrendingDown,
  Play,
  Download,
  Upload,
  Trash2,
  ChevronLeft,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Award,
  AlertTriangle,
  Lightbulb,
  ArrowLeftRight,
  Sparkles,
  GitCompare,
} from "lucide-react";
import {
  type LIBScenarioParams,
  type LIBScenarioResult,
  type YearlyResult,
  type ModelYear,
  runLIBScenario,
  getPresetScenarios,
  loadSavedScenarios,
  deleteSavedScenario,
  saveScenario,
  parseScenarioFile,
  generateYears,
  downloadComparisonExcel,
} from "@/lib/utils/libScenarioEngine";
import {
  generateComparisonInsights,
  type ComparisonInsights,
  type ComparisonInsight,
} from "@/lib/utils/comparisonInsights";
import { useAnimatedData } from "@/hooks/useAnimatedData";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { CROP_NAMES } from "@/lib/data/constants";
import { formatUSD, formatNumber, formatPercent } from "@/lib/utils/formatters";
import { assignColors, BAU_COLOR, BAU_DASH, lighten } from "@/lib/utils/comparisonColors";
import type { Farmer } from "@/lib/data/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComparisonPanelProps {
  farmers: Farmer[];
  initialScenarios: LIBScenarioParams[];
  targetYear: ModelYear;
  projectionYears: number;
  onBack: () => void;
}

interface ScenarioWithResult {
  params: LIBScenarioParams;
  result: LIBScenarioResult;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SCENARIOS = 5;

const PRESET_DESCRIPTIONS: Record<string, string> = {
  "Business as Usual": "No lever changes \u2014 current trajectory",
  "T2 Intensification": "Ramp up T2 intake + moderate crop improvements",
  "T1 Diversification": "Shift T1 to higher-value crops + legacy inclusion",
};

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  winner: Award,
  delta: ArrowLeftRight,
  risk: AlertTriangle,
  recommendation: Lightbulb,
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "var(--color-accent)",
  medium: "#E9C46A",
  low: "var(--text-tertiary)",
};

// ─── Custom Tooltip for Overlay Charts ────────────────────────────────────────

function ComparisonTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const totalEntries = payload.filter(
    (p) => p.dataKey.endsWith("_Total") || p.dataKey === "LIB Benchmark"
  );
  const entries = totalEntries.length > 0 ? totalEntries : payload;

  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg text-[11px] max-w-xs"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--card-border)" }}
    >
      <div className="font-semibold text-[var(--text-primary)] mb-1">{label}</div>
      {entries.map((p, i) => {
        const scenarioName = p.dataKey.replace(/_Total$|_T1$|_T2$/, "");
        const displayName = p.dataKey === "LIB Benchmark" ? "LIB Benchmark" : scenarioName;
        const isPercent = p.name?.includes("%");
        const isIncome = p.name?.includes("Income") || p.name?.includes("LIB") || p.name?.includes("Gap");
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-[var(--text-secondary)] truncate">{displayName}:</span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {isPercent ? formatPercent(p.value) : isIncome ? formatUSD(p.value) : formatNumber(p.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Delta KPI Card ───────────────────────────────────────────────────────────

function DeltaKPICard({
  label,
  icon: Icon,
  bauValue,
  scenarios,
  formatter,
  colorMap,
}: {
  label: string;
  icon: React.ElementType;
  bauValue: number;
  scenarios: { name: string; value: number }[];
  formatter: (n: number) => string;
  colorMap: Map<string, string>;
}) {
  return (
    <div className="brand-card p-3 rounded-xl">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(136,136,136,0.15)" }}>
          <Icon size={12} style={{ color: BAU_COLOR }} />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] text-[var(--text-tertiary)]">BAU:</span>
        <span className="text-xs font-mono font-bold text-[var(--text-secondary)]">{formatter(bauValue)}</span>
      </div>
      <div className="space-y-0.5">
        {scenarios.filter((s) => s.name !== "Business as Usual").map((s) => {
          const delta = s.value - bauValue;
          const isPositive = delta > 0;
          const color = colorMap.get(s.name) || "#888";
          return (
            <div key={s.name} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">
                <AnimatedNumber value={s.value} formatter={formatter} duration={800} />
              </span>
              <span
                className="text-[9px] font-mono font-bold flex items-center gap-0.5"
                style={{ color: isPositive ? "var(--color-accent)" : delta < 0 ? "var(--color-negative)" : "var(--text-tertiary)" }}
              >
                {isPositive ? <TrendingUp size={8} /> : delta < 0 ? <TrendingDown size={8} /> : null}
                {delta > 0 ? "+" : ""}{formatter(delta)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scenario Row (checkbox-based, for sidebar) ──────────────────────────────

function ComparisonScenarioRow({
  scenario,
  isSelected,
  onToggle,
  onDelete,
  isPreset,
  description,
  disabled,
}: {
  scenario: LIBScenarioParams;
  isSelected: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  isPreset?: boolean;
  description?: string;
  disabled?: boolean;
}) {
  const isBAU = scenario.name === "Business as Usual";
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${disabled ? "opacity-60" : ""}`}
      style={{
        background: isSelected ? "rgba(0,161,125,0.1)" : "transparent",
        border: `1px solid ${isSelected ? "rgba(0,161,125,0.3)" : "var(--card-border)"}`,
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={disabled || isBAU}
        className="w-3 h-3 rounded accent-[var(--color-accent)]"
      />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
          {scenario.name}
          {isPreset && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[rgba(0,161,125,0.15)] text-[var(--color-accent)] font-semibold shrink-0">
              PRESET
            </span>
          )}
          {isBAU && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[rgba(136,136,136,0.2)] text-[var(--text-tertiary)] font-semibold shrink-0">
              BASELINE
            </span>
          )}
        </span>
        {description && <p className="text-[9px] text-[var(--text-tertiary)] truncate">{description}</p>}
      </div>
      {onDelete && !disabled && (
        <button
          onClick={onDelete}
          className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--color-negative)] hover:bg-[var(--card-bg-hover)] shrink-0"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: ComparisonInsight }) {
  const Icon = INSIGHT_ICONS[insight.category] || Lightbulb;
  const accentColor = SEVERITY_COLORS[insight.severity] || "var(--text-tertiary)";

  return (
    <div className="rounded-lg p-2.5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-start gap-2">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${accentColor}20` }}
        >
          <Icon size={10} style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-[var(--text-primary)] leading-tight">{insight.title}</p>
          <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Insights Panel ───────────────────────────────────────────────────────────

function InsightsPanel({ insights }: { insights: ComparisonInsights | null }) {
  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles size={20} className="text-[var(--text-tertiary)] mb-2" />
        <p className="text-[11px] text-[var(--text-tertiary)]">Run a comparison to see AI insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="rounded-lg p-2.5" style={{ background: "rgba(0,161,125,0.06)", border: "1px solid rgba(0,161,125,0.15)" }}>
        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{insights.summary}</p>
      </div>

      {/* Best Performer */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">Best Performer</p>
        <InsightCard insight={insights.bestPerformer} />
      </div>

      {/* Key Deltas */}
      {insights.keyDeltas.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">Key Changes</p>
          <div className="space-y-1.5">
            {insights.keyDeltas.map((d) => <InsightCard key={d.id} insight={d} />)}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {insights.riskFactors.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">Risk Factors</p>
          <div className="space-y-1.5">
            {insights.riskFactors.map((r) => <InsightCard key={r.id} insight={r} />)}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">Recommendations</p>
          <div className="space-y-1.5">
            {insights.recommendations.map((r) => <InsightCard key={r.id} insight={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComparisonPanel({
  farmers,
  initialScenarios,
  targetYear,
  projectionYears,
  onBack,
}: ComparisonPanelProps) {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => {
    const names = new Set(initialScenarios.map((s) => s.name));
    names.add("Business as Usual"); // always selected
    return names;
  });
  const [savedScenarios, setSavedScenarios] = useState(() => loadSavedScenarios());
  const [hasRun, setHasRun] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"select" | "insights">("select");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSectionRef = useRef<HTMLDivElement>(null);

  // ─── Derived scenario lists ─────────────────────────────────────────────────
  const presets = useMemo(() => getPresetScenarios(projectionYears), [projectionYears]);
  const presetNames = useMemo(() => new Set(presets.map((s) => s.name)), [presets]);

  // Saved scenarios that are NOT presets (to avoid duplicate rows)
  const nonPresetSaved = useMemo(
    () => savedScenarios.filter((s) => !presetNames.has(s.name)),
    [savedScenarios, presetNames]
  );

  const allScenarios = useMemo(() => {
    const map = new Map<string, LIBScenarioParams>();
    for (const s of presets) map.set(s.name, s);
    for (const s of savedScenarios) map.set(s.name, s);
    // Also include initial scenarios that might not be saved yet
    for (const s of initialScenarios) map.set(s.name, s);
    return map;
  }, [presets, savedScenarios, initialScenarios]);

  const selectedScenarios = useMemo(() => {
    const list: LIBScenarioParams[] = [];
    // BAU first
    const bau = allScenarios.get("Business as Usual");
    if (bau) list.push(bau);
    for (const name of selectedNames) {
      if (name === "Business as Usual") continue;
      const s = allScenarios.get(name);
      if (s) list.push(s);
    }
    return list;
  }, [selectedNames, allScenarios]);

  // Color assignment
  const colorMap = useMemo(
    () => assignColors(selectedScenarios.map((s) => s.name)),
    [selectedScenarios]
  );

  // ─── Scenario engine computation (deferred until Run) ───────────────────────
  const scenarioResults: ScenarioWithResult[] = useMemo(
    () => {
      if (!hasRun) return [];
      return selectedScenarios.map((s) => ({
        params: s,
        result: runLIBScenario(farmers, { ...s, targetYear }),
      }));
    },
    [hasRun, selectedScenarios, farmers, targetYear]
  );

  // ─── AI Insights ────────────────────────────────────────────────────────────
  const comparisonInsights: ComparisonInsights | null = useMemo(
    () => (scenarioResults.length >= 2 ? generateComparisonInsights(scenarioResults) : null),
    [scenarioResults]
  );

  // Auto-switch to insights tab after running
  useEffect(() => {
    if (hasRun && comparisonInsights) {
      setSidebarTab("insights");
    }
  }, [hasRun, comparisonInsights]);

  // ─── Chart data ─────────────────────────────────────────────────────────────
  const modelYears = useMemo(() => generateYears(projectionYears), [projectionYears]);

  const bauResult = useMemo(
    () => scenarioResults.find((s) => s.params.name === "Business as Usual"),
    [scenarioResults]
  );

  const pctAboveLIBData = useMemo(() => {
    return modelYears.map((year, yi) => {
      const point: Record<string, unknown> = { year: year.toString() };
      for (const sr of scenarioResults) {
        const yr = sr.result.yearlyResults[yi] ?? sr.result.yearlyResults.at(-1);
        if (!yr) continue;
        const prefix = sr.params.name;
        point[`${prefix}_Total`] = Number(yr.totalPctAboveLIB.toFixed(1));
        point[`${prefix}_T1`] = Number(yr.t1PctAboveLIB.toFixed(1));
        point[`${prefix}_T2`] = Number(yr.t2PctAboveLIB.toFixed(1));
      }
      return point;
    });
  }, [modelYears, scenarioResults]);

  const { displayData: pctAboveLIBAnimated } = useAnimatedData(pctAboveLIBData, { duration: 800, enabled: true });

  const incomeData = useMemo(() => {
    return modelYears.map((year, yi) => {
      const point: Record<string, unknown> = { year: year.toString() };
      for (const sr of scenarioResults) {
        const yr = sr.result.yearlyResults[yi] ?? sr.result.yearlyResults.at(-1);
        if (!yr) continue;
        const prefix = sr.params.name;
        point[`${prefix}_T1`] = yr.t1AvgIncome;
        point[`${prefix}_T2`] = yr.t2AvgIncome;
      }
      const firstYr = scenarioResults[0]?.result.yearlyResults[yi];
      if (firstYr) point["LIB Benchmark"] = firstYr.lib;
      return point;
    });
  }, [modelYears, scenarioResults]);

  const { displayData: incomeAnimated } = useAnimatedData(incomeData, { duration: 800, enabled: true });

  const cropBarData = useMemo(() => {
    const reference = bauResult ?? scenarioResults[0];
    if (!reference) return [];
    const crops = reference.result.cropContributions.filter((c) => c.growerCount > 0);
    return crops.map((crop) => {
      const point: Record<string, unknown> = { crop: CROP_NAMES[crop.crop] || crop.crop };
      for (const sr of scenarioResults) {
        const match = sr.result.cropContributions.find((c) => c.crop === crop.crop);
        point[sr.params.name] = match ? Math.round(match.projectedIncome) : 0;
      }
      return point;
    });
  }, [scenarioResults, bauResult]);

  // ─── KPI values ─────────────────────────────────────────────────────────────
  const bauSummary = bauResult?.result.summary;
  const kpiScenarios = useMemo(
    () => scenarioResults.map((sr) => ({
      name: sr.params.name,
      pctAboveLIB: sr.result.summary.totalPctAboveLIB,
      avgIncome: sr.result.summary.totalAvgIncome,
      avgLIBGap: sr.result.summary.totalAvgLIBGap,
      t1PctAboveLIB: sr.result.summary.t1PctAboveLIB,
      t2PctAboveLIB: sr.result.summary.t2PctAboveLIB,
    })),
    [scenarioResults]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const toggleScenario = useCallback((name: string) => {
    if (name === "Business as Usual") return;
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < MAX_SCENARIOS) next.add(name);
      return next;
    });
    setHasRun(false);
  }, []);

  const handleDeleteSaved = useCallback((name: string) => {
    setSavedScenarios(deleteSavedScenario(name));
    setSelectedNames((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    setHasRun(false);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      if (!data) return;
      const result = parseScenarioFile(data);
      if ("error" in result) {
        setUploadError(result.error);
      } else {
        // Auto-rename if the name conflicts with a preset or existing saved scenario
        let finalName = result.name;
        const existingNames = new Set([
          ...presets.map((p) => p.name),
          ...savedScenarios.map((s) => s.name),
        ]);
        if (existingNames.has(finalName)) {
          let suffix = 2;
          while (existingNames.has(`${result.name} (${suffix})`)) suffix++;
          finalName = `${result.name} (${suffix})`;
        }
        const scenario = { ...result, name: finalName };

        saveScenario(scenario);
        const updated = loadSavedScenarios();
        setSavedScenarios(updated);
        setSelectedNames((prev) => {
          const next = new Set(prev);
          if (next.size < MAX_SCENARIOS) next.add(finalName);
          return next;
        });
        setHasRun(false);
        setUploadSuccess(`"${finalName}" imported`);
        setTimeout(() => setUploadSuccess(null), 4000);
        // Scroll saved section into view
        setTimeout(() => savedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read file. Please try again.");
    };
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [presets, savedScenarios]);

  const handleDownload = useCallback(() => {
    if (scenarioResults.length < 2) return;
    downloadComparisonExcel(scenarioResults, comparisonInsights ?? undefined);
    setDownloadFeedback("Downloaded!");
    setTimeout(() => setDownloadFeedback(null), 2000);
  }, [scenarioResults, comparisonInsights]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center gap-2">
          <GitCompare size={14} className="text-[#457B9D]" />
          <span className="text-xs font-bold text-[var(--text-primary)]">Scenario Comparison</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {selectedNames.size} selected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasRun && (
            <>
              {downloadFeedback ? (
                <span className="text-[10px] text-[var(--color-accent)] font-semibold flex items-center gap-1">
                  <Check size={10} /> {downloadFeedback}
                </span>
              ) : (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[var(--text-primary)] hover:bg-[var(--card-bg-hover)] transition-colors"
                  style={{ border: "1px solid var(--card-border)" }}
                >
                  <Download size={10} className="text-[var(--color-accent)]" />
                  Export
                </button>
              )}
            </>
          )}
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)] transition-colors"
          >
            <ChevronLeft size={10} />
            Builder
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="shrink-0 flex flex-col h-full overflow-hidden lg:w-[300px] w-full lg:max-h-full max-h-[340px]"
              style={{ borderRight: "1px solid var(--card-border)", background: "var(--color-surface-1)" }}
            >
              {/* Sidebar tab switcher */}
              <div className="shrink-0 flex items-center gap-0.5 p-1.5 mx-3 mt-2 rounded-lg" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                {(["select", "insights"] as const).map((tab) => {
                  const isActive = sidebarTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      disabled={tab === "insights" && !hasRun}
                      className="relative flex-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors disabled:opacity-40"
                      style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)" }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-tab"
                          className="absolute inset-0 rounded-md"
                          style={{ background: "var(--card-bg-hover)", border: "1px solid var(--card-border)" }}
                          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1">
                        {tab === "select" ? "Select" : (
                          <>
                            <Sparkles size={9} /> AI Insights
                            {hasRun && comparisonInsights && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sidebar content */}
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-2 space-y-3">
                {sidebarTab === "select" ? (
                  <>
                    {/* Quick hint */}
                    <p className="text-[9px] text-[var(--text-tertiary)] leading-relaxed">
                      Check the scenarios you want to compare, then press Run.
                    </p>

                    {/* Presets */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Strategy Presets</span>
                      <div className="space-y-1">
                        {presets.map((s) => (
                          <ComparisonScenarioRow
                            key={s.name}
                            scenario={s}
                            isSelected={selectedNames.has(s.name)}
                            onToggle={() => toggleScenario(s.name)}
                            isPreset
                            description={PRESET_DESCRIPTIONS[s.name]}
                            disabled={hasRun}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Saved & Uploaded */}
                    <div ref={savedSectionRef} className="space-y-1.5" style={{ borderTop: "1px solid var(--card-border)", paddingTop: "8px" }}>
                      <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                        Your Scenarios{nonPresetSaved.length > 0 ? ` (${nonPresetSaved.length})` : ""}
                      </span>
                      {nonPresetSaved.length === 0 ? (
                        <p className="text-[9px] text-[var(--text-tertiary)] py-1 leading-relaxed">
                          No custom scenarios yet. Save one from the Builder or upload a file below.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {nonPresetSaved.map((s) => (
                            <ComparisonScenarioRow
                              key={s.name}
                              scenario={s}
                              isSelected={selectedNames.has(s.name)}
                              onToggle={() => toggleScenario(s.name)}
                              onDelete={() => handleDeleteSaved(s.name)}
                              disabled={hasRun}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Upload */}
                    <div className="space-y-1.5" style={{ borderTop: "1px solid var(--card-border)", paddingTop: "8px" }}>
                      <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Upload Scenario</span>
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.json" onChange={handleFileUpload} className="hidden" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={hasRun}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--card-bg-hover)] disabled:opacity-40"
                        style={{ border: "1px dashed var(--card-border)", background: "var(--card-bg)" }}
                      >
                        <Upload size={12} className="text-[var(--color-accent)]" />
                        <span className="text-[var(--text-primary)]">Upload .xlsx file</span>
                      </button>
                      <p className="text-[9px] text-[var(--text-tertiary)] leading-relaxed">
                        Upload a scenario exported from the Builder. It will appear above and auto-select.
                      </p>
                      {uploadSuccess && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: "rgba(0,161,125,0.1)", border: "1px solid rgba(0,161,125,0.25)", color: "var(--color-accent)" }}>
                          <Check size={10} />
                          {uploadSuccess}
                        </div>
                      )}
                      {uploadError && (
                        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium" style={{ background: "rgba(145,13,99,0.08)", border: "1px solid rgba(145,13,99,0.25)", color: "var(--color-negative)" }}>
                          <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <InsightsPanel insights={comparisonInsights} />
                )}
              </div>

              {/* Bottom action */}
              <div className="shrink-0 px-3 py-2" style={{ borderTop: "1px solid var(--card-border)" }}>
                {hasRun ? (
                  <button
                    onClick={() => { setHasRun(false); setSidebarTab("select"); }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--card-bg-hover)]"
                    style={{ border: "1px solid var(--card-border)" }}
                  >
                    Edit Selection
                  </button>
                ) : (
                  <button
                    onClick={() => setHasRun(true)}
                    disabled={selectedNames.size < 2}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg"
                    style={{ background: selectedNames.size >= 2 ? "linear-gradient(135deg, var(--color-accent) 0%, #008f6a 100%)" : "var(--card-bg)" }}
                  >
                    <Play size={12} />
                    Run Comparison ({selectedNames.size})
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex shrink-0 w-6 flex-col items-center justify-center gap-2 transition-colors hover:bg-[var(--card-bg-hover)]"
          style={{ borderRight: "1px solid var(--card-border)" }}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={12} className="text-[var(--text-tertiary)]" /> : <PanelLeftClose size={12} className="text-[var(--text-tertiary)]" />}
        </button>

        {/* Main Content */}
        <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar p-4 space-y-4">
          {!hasRun ? (
            /* Pre-run empty state */
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(0,161,125,0.1)", border: "1px solid rgba(0,161,125,0.2)" }}
              >
                <GitCompare size={24} className="text-[var(--color-accent)]" />
              </div>
              <div className="text-center space-y-2 max-w-xs">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Compare Scenarios</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: "rgba(0,161,125,0.15)", color: "var(--color-accent)" }}>1</span>
                    Check scenarios in the sidebar (or upload your own)
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: "rgba(0,161,125,0.15)", color: "var(--color-accent)" }}>2</span>
                    Press &quot;Run Comparison&quot; at the bottom of the sidebar
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: "rgba(0,161,125,0.15)", color: "var(--color-accent)" }}>3</span>
                    See charts, AI insights, and export the comparison
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] pt-1">
                  {selectedNames.size} scenario{selectedNames.size !== 1 ? "s" : ""} selected
                  {selectedNames.size < 2 && " — select at least 2 to compare"}
                </p>
              </div>
            </div>
          ) : (
            /* Results */
            <>
              {/* Delta KPI Cards */}
              {bauSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <DeltaKPICard label="Above LIB" icon={Target} bauValue={bauSummary.totalPctAboveLIB} scenarios={kpiScenarios.map((s) => ({ name: s.name, value: s.pctAboveLIB }))} formatter={formatPercent} colorMap={colorMap} />
                  <DeltaKPICard label="Avg Income" icon={DollarSign} bauValue={bauSummary.totalAvgIncome} scenarios={kpiScenarios.map((s) => ({ name: s.name, value: s.avgIncome }))} formatter={formatUSD} colorMap={colorMap} />
                  <DeltaKPICard label="Avg LIB Gap" icon={BarChart3} bauValue={bauSummary.totalAvgLIBGap} scenarios={kpiScenarios.map((s) => ({ name: s.name, value: s.avgLIBGap }))} formatter={formatUSD} colorMap={colorMap} />
                  <DeltaKPICard label="T1 Above LIB" icon={Users} bauValue={bauSummary.t1PctAboveLIB} scenarios={kpiScenarios.map((s) => ({ name: s.name, value: s.t1PctAboveLIB }))} formatter={formatPercent} colorMap={colorMap} />
                  <DeltaKPICard label="T2 Above LIB" icon={Layers} bauValue={bauSummary.t2PctAboveLIB} scenarios={kpiScenarios.map((s) => ({ name: s.name, value: s.t2PctAboveLIB }))} formatter={formatPercent} colorMap={colorMap} />
                </div>
              )}

              {/* Overlay Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Chart 1: % Households Above LIB */}
                <div className="brand-card p-3 rounded-xl">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    % Households Above LIB ({modelYears[0]}\u2013{modelYears[modelYears.length - 1]})
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={pctAboveLIBAnimated}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis dataKey="year" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<ComparisonTooltip />} />
                      {scenarioResults.map((sr) => {
                        const color = colorMap.get(sr.params.name) || "#888";
                        const isBAU = sr.params.name === "Business as Usual";
                        return (
                          <Line key={`${sr.params.name}_Total`} type="monotone" dataKey={`${sr.params.name}_Total`} stroke={color} strokeWidth={isBAU ? 1.5 : 2.5} strokeDasharray={isBAU ? BAU_DASH : undefined} dot={{ r: isBAU ? 2 : 3, fill: color }} name={`${sr.params.name} Total %`} isAnimationActive={false} />
                        );
                      })}
                      {scenarioResults.map((sr) => {
                        const color = colorMap.get(sr.params.name) || "#888";
                        const isBAU = sr.params.name === "Business as Usual";
                        return [
                          <Line key={`${sr.params.name}_T1`} type="monotone" dataKey={`${sr.params.name}_T1`} stroke={lighten(color, 0.5)} strokeWidth={isBAU ? 1 : 1.5} strokeDasharray={isBAU ? BAU_DASH : "3 2"} dot={false} name={`${sr.params.name} T1 %`} isAnimationActive={false} />,
                          <Line key={`${sr.params.name}_T2`} type="monotone" dataKey={`${sr.params.name}_T2`} stroke={lighten(color, 0.5)} strokeWidth={isBAU ? 1 : 1.5} strokeDasharray={isBAU ? BAU_DASH : "3 2"} dot={false} name={`${sr.params.name} T2 %`} isAnimationActive={false} />,
                        ];
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
                    {scenarioResults.map((sr) => {
                      const color = colorMap.get(sr.params.name) || "#888";
                      const isBAU = sr.params.name === "Business as Usual";
                      return (
                        <div key={sr.params.name} className="flex items-center gap-1">
                          <div className="h-0.5 rounded" style={{ width: 12, background: color, borderTop: isBAU ? `2px dashed ${color}` : "none", height: isBAU ? 0 : 2 }} />
                          <span className="text-[9px] text-[var(--text-tertiary)]">{sr.params.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chart 2: Average Income vs LIB */}
                <div className="brand-card p-3 rounded-xl">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Average Income vs LIB Benchmark</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={incomeAnimated}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis dataKey="year" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                      <Tooltip content={<ComparisonTooltip />} />
                      <Line type="monotone" dataKey="LIB Benchmark" stroke="#FB8500" strokeWidth={2} strokeDasharray="6 3" dot={false} name="LIB Benchmark" isAnimationActive={false} />
                      {scenarioResults.map((sr) => {
                        const color = colorMap.get(sr.params.name) || "#888";
                        const isBAU = sr.params.name === "Business as Usual";
                        return (
                          <Line key={`${sr.params.name}_T1_inc`} type="monotone" dataKey={`${sr.params.name}_T1`} stroke={color} strokeWidth={isBAU ? 1.5 : 2} strokeDasharray={isBAU ? BAU_DASH : undefined} dot={{ r: isBAU ? 2 : 3, fill: color }} name={`${sr.params.name} T1 Income`} isAnimationActive={false} />
                        );
                      })}
                      {scenarioResults.map((sr) => {
                        const color = colorMap.get(sr.params.name) || "#888";
                        const isBAU = sr.params.name === "Business as Usual";
                        return (
                          <Line key={`${sr.params.name}_T2_inc`} type="monotone" dataKey={`${sr.params.name}_T2`} stroke={lighten(color, 0.6)} strokeWidth={isBAU ? 1 : 1.5} strokeDasharray={isBAU ? BAU_DASH : "3 2"} dot={false} name={`${sr.params.name} T2 Income`} isAnimationActive={false} />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
                    {scenarioResults.map((sr) => {
                      const color = colorMap.get(sr.params.name) || "#888";
                      const isBAU = sr.params.name === "Business as Usual";
                      return (
                        <div key={sr.params.name} className="flex items-center gap-1">
                          <div className="h-0.5 rounded" style={{ width: 12, background: color, borderTop: isBAU ? `2px dashed ${color}` : "none", height: isBAU ? 0 : 2 }} />
                          <span className="text-[9px] text-[var(--text-tertiary)]">{sr.params.name}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1">
                      <div className="h-0.5 rounded" style={{ width: 12, borderTop: "2px dashed #FB8500", height: 0 }} />
                      <span className="text-[9px] text-[var(--text-tertiary)]">LIB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 3: Crop Income Grouped Bar */}
              {cropBarData.length > 0 && (
                <div className="brand-card p-3 rounded-xl">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Projected Crop Income by Scenario (T1 Farmers, Full Tenure)
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={cropBarData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis type="number" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="crop" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} width={60} />
                      <Tooltip content={<ComparisonTooltip />} />
                      {scenarioResults.map((sr) => {
                        const color = colorMap.get(sr.params.name) || "#888";
                        return (
                          <Bar key={sr.params.name} dataKey={sr.params.name} fill={color} barSize={Math.max(4, 16 / scenarioResults.length)} radius={[0, 2, 2, 0]} name={sr.params.name} isAnimationActive={false} />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
                    {scenarioResults.map((sr) => {
                      const color = colorMap.get(sr.params.name) || "#888";
                      return (
                        <div key={sr.params.name} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                          <span className="text-[9px] text-[var(--text-tertiary)]">{sr.params.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comparison Metrics Table */}
              <div className="brand-card p-3 rounded-xl">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Comparison Table \u2014 Target Year {targetYear}
                </h4>
                <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "var(--card-bg)" }}>
                        <th className="text-left py-2.5 px-3 text-[var(--text-tertiary)] font-semibold">Metric</th>
                        {scenarioResults.map((sr) => {
                          const color = colorMap.get(sr.params.name) || "#888";
                          const isBAU = sr.params.name === "Business as Usual";
                          return (
                            <th key={sr.params.name} className="text-right py-2.5 px-3 font-semibold" style={{ color, borderBottom: `2px solid ${color}` }}>
                              {sr.params.name}
                              {isBAU && <span className="ml-1 text-[8px] text-[var(--text-tertiary)]">(baseline)</span>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Total Farmers", fmt: (r: YearlyResult) => formatNumber(r.totalFarmers), val: (r: YearlyResult) => r.totalFarmers },
                        { label: "% Above LIB", fmt: (r: YearlyResult) => formatPercent(r.totalPctAboveLIB), val: (r: YearlyResult) => r.totalPctAboveLIB },
                        { label: "# Above LIB", fmt: (r: YearlyResult) => formatNumber(r.totalAboveLIB), val: (r: YearlyResult) => r.totalAboveLIB },
                        { label: "Moved Above LIB", fmt: (r: YearlyResult) => `+${formatNumber(r.totalMovedAboveLIB)}`, val: (r: YearlyResult) => r.totalMovedAboveLIB },
                        { label: "Avg Income", fmt: (r: YearlyResult) => formatUSD(r.totalAvgIncome), val: (r: YearlyResult) => r.totalAvgIncome },
                        { label: "Avg LIB Gap", fmt: (r: YearlyResult) => formatUSD(r.totalAvgLIBGap), val: (r: YearlyResult) => r.totalAvgLIBGap },
                        { label: "T1 % Above LIB", fmt: (r: YearlyResult) => formatPercent(r.t1PctAboveLIB), val: (r: YearlyResult) => r.t1PctAboveLIB },
                        { label: "T2 % Above LIB", fmt: (r: YearlyResult) => formatPercent(r.t2PctAboveLIB), val: (r: YearlyResult) => r.t2PctAboveLIB },
                        { label: "T2 Farmers", fmt: (r: YearlyResult) => formatNumber(r.t2TotalFarmers), val: (r: YearlyResult) => r.t2TotalFarmers },
                        { label: "LIB Benchmark", fmt: (r: YearlyResult) => formatUSD(r.lib), val: (r: YearlyResult) => r.lib },
                      ].map((row, ri) => (
                        <tr key={ri} className="border-t border-[var(--card-border)]">
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-medium">{row.label}</td>
                          {scenarioResults.map((sr) => {
                            const isBAU = sr.params.name === "Business as Usual";
                            const val = row.val(sr.result.summary);
                            const bauVal = bauSummary ? row.val(bauSummary) : val;
                            const delta = val - bauVal;
                            const showDelta = !isBAU && Math.abs(delta) > 0.01 && row.label !== "LIB Benchmark" && row.label !== "Total Farmers";
                            return (
                              <td key={sr.params.name} className="py-2 px-3 text-right font-mono">
                                <span className={isBAU ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)] font-bold"}>
                                  {row.fmt(sr.result.summary)}
                                </span>
                                {showDelta && (
                                  <span
                                    className="ml-1 text-[9px] font-bold"
                                    style={{
                                      color: delta > 0
                                        ? row.label === "Avg LIB Gap" ? "var(--color-negative)" : "var(--color-accent)"
                                        : row.label === "Avg LIB Gap" ? "var(--color-accent)" : "var(--color-negative)",
                                    }}
                                  >
                                    ({delta > 0 ? "+" : ""}
                                    {row.label.includes("%") ? delta.toFixed(1) + "pp" : row.label.includes("Income") || row.label.includes("Gap") ? formatUSD(delta) : formatNumber(delta)})
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
