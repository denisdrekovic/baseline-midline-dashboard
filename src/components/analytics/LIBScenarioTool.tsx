"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  SlidersHorizontal,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Users,
  Target,
  DollarSign,
  BarChart3,
  Layers,
  X,
  GitCompare,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Table2,
  Info,
  ExternalLink,
  Save,
  FolderOpen,
  Check,
} from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import {
  type LIBScenarioParams,
  type ModeledCrop,
  type CropLever,
  type ModelYear,
  MODELED_CROPS,
  RABI_CROPS,
  BASELINE_YEAR,
  MAX_T2_FARMERS,
  MIN_PROJECTION_YEARS,
  MAX_PROJECTION_YEARS,
  generateYears,
  generateDefaultT2Intake,
  createDefaultParams,
  runLIBScenario,
  loadSavedScenarios,
  saveScenario,
  deleteSavedScenario,
  getPresetScenarios,
  downloadScenarioExcel,
  parseScenarioFile,
  LIB_METHODOLOGY,
} from "@/lib/utils/libScenarioEngine";
import { useAnimatedData } from "@/hooks/useAnimatedData";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import ComparisonPanel from "@/components/analytics/ComparisonPanel";
import { CROP_COLORS, CROP_NAMES } from "@/lib/data/constants";
import { formatUSD, formatNumber, formatPercent } from "@/lib/utils/formatters";
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
  Cell,
  ReferenceLine,
} from "recharts";

// ─── Sub-components ───────────────────────────────────────────────────────────

function CropLeverGroup({
  crop,
  lever,
  onChange,
  isRabi,
}: {
  crop: ModeledCrop;
  lever: CropLever;
  onChange: (field: keyof CropLever, value: number) => void;
  isRabi: boolean;
}) {
  const color = CROP_COLORS[crop] || "#888";
  const name = CROP_NAMES[crop] || crop;

  return (
    <div className="space-y-1 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-semibold text-[var(--text-primary)]">{name}</span>
        {isRabi && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--card-bg-hover)] text-[var(--text-tertiary)]">
            Rabi
          </span>
        )}
      </div>
      <LeverSlider label="Yield" value={lever.yieldChange} onChange={(v) => onChange("yieldChange", v)} color={color} min={-50} max={100} />
      <LeverSlider label="Price" value={lever.priceChange} onChange={(v) => onChange("priceChange", v)} color={color} min={-50} max={100} />
      <LeverSlider label="Cost" value={lever.costChange} onChange={(v) => onChange("costChange", v)} color={color} min={-50} max={100} invert />
      <LeverSlider label="Area" value={lever.acreageChange} onChange={(v) => onChange("acreageChange", v)} color={color} min={-50} max={100} />
    </div>
  );
}

function LeverSlider({
  label,
  value,
  onChange,
  color,
  min,
  max,
  invert = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  min: number;
  max: number;
  invert?: boolean;
}) {
  const range = max - min;
  const zeroPct = ((0 - min) / range) * 100;
  const valPct = ((value - min) / range) * 100;

  const trackBg =
    value === 0
      ? "var(--card-border-hover)"
      : value > 0
        ? `linear-gradient(to right,
            var(--card-border-hover) 0%,
            var(--card-border-hover) ${zeroPct}%,
            ${color} ${zeroPct}%,
            ${color} ${valPct}%,
            var(--card-border-hover) ${valPct}%,
            var(--card-border-hover) 100%)`
        : `linear-gradient(to right,
            var(--card-border-hover) 0%,
            var(--card-border-hover) ${valPct}%,
            ${color} ${valPct}%,
            ${color} ${zeroPct}%,
            var(--card-border-hover) ${zeroPct}%,
            var(--card-border-hover) 100%)`;

  const displayPositive = invert ? value < 0 : value > 0;
  const displayNegative = invert ? value > 0 : value < 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-tertiary)] w-8 shrink-0">{label}</span>
      <div className="flex-1 relative">
        {/* Zero-point marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-3 pointer-events-none"
          style={{ left: `${zeroPct}%`, background: "var(--text-tertiary)", opacity: 0.35, zIndex: 0 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="scenario-slider w-full"
          style={{ color, background: trackBg }}
        />
      </div>
      <span
        className="text-[10px] font-mono font-bold w-10 text-right shrink-0"
        style={{
          color: displayPositive
            ? "var(--color-accent)"
            : displayNegative
              ? "var(--color-negative)"
              : "var(--text-tertiary)",
        }}
      >
        {value > 0 ? "+" : ""}{value}%
      </span>
    </div>
  );
}

function KPICard({
  label,
  numericValue,
  formatter,
  subValue,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  numericValue: number;
  formatter: (n: number) => string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; positive: boolean; formatter: (n: number) => string; prefix?: string };
}) {
  return (
    <div className="brand-card p-3 rounded-xl">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon size={12} style={{ color }} />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
        <AnimatedNumber value={numericValue} formatter={formatter} duration={800} />
      </div>
      {subValue && (
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{subValue}</div>
      )}
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          {trend.positive ? (
            <TrendingUp size={10} className="text-[var(--color-accent)]" />
          ) : (
            <TrendingDown size={10} className="text-[var(--color-negative)]" />
          )}
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: trend.positive ? "var(--color-accent)" : "var(--color-negative)" }}
          >
            {trend.prefix}<AnimatedNumber value={trend.value} formatter={trend.formatter} duration={800} />
          </span>
        </div>
      )}
    </div>
  );
}

function YearSlider({
  value,
  years,
  onChange,
}: {
  value: ModelYear;
  years: number[];
  onChange: (y: ModelYear) => void;
}) {
  const min = years[0];
  const max = years[years.length - 1];
  return (
    <div className="flex items-center gap-1.5 min-w-[120px]">
      <span className="text-[9px] font-mono text-[var(--text-tertiary)] tabular-nums">{min}</span>
      <div className="relative flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as ModelYear)}
          className="w-full h-1 rounded-full appearance-none cursor-pointer accent-[var(--color-accent)]"
          style={{ background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${((value - min) / (max - min)) * 100}%, var(--card-border) ${((value - min) / (max - min)) * 100}%, var(--card-border) 100%)` }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] tabular-nums">{value}</span>
    </div>
  );
}

// ─── Scenarios Panel (Recent + Upload + Compare) ─────────────────────────────

function ScenarioRow({
  scenario,
  isSelected,
  onToggle,
  onLoad,
  onDelete,
  isPreset,
  description,
}: {
  scenario: LIBScenarioParams;
  isSelected: boolean;
  onToggle: () => void;
  onLoad: () => void;
  onDelete?: () => void;
  isPreset?: boolean;
  description?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
      style={{
        background: isSelected ? "rgba(0,161,125,0.1)" : "transparent",
        border: `1px solid ${isSelected ? "rgba(0,161,125,0.3)" : "var(--card-border)"}`,
      }}
    >
      <input type="checkbox" checked={isSelected} onChange={onToggle} className="w-3 h-3 rounded accent-[var(--color-accent)]" />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
          {scenario.name}
          {isPreset && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[rgba(0,161,125,0.15)] text-[var(--color-accent)] font-semibold shrink-0">
              PRESET
            </span>
          )}
        </span>
        {description && <p className="text-[9px] text-[var(--text-tertiary)] truncate">{description}</p>}
      </div>
      <button onClick={onLoad} className="text-[9px] px-1.5 py-0.5 rounded text-[var(--color-accent)] hover:bg-[var(--card-bg-hover)] shrink-0">Load</button>
      {onDelete && (
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

const PRESET_DESCRIPTIONS: Record<string, string> = {
  "Business as Usual": "No lever changes — current trajectory",
  "T2 Intensification": "Ramp up T2 intake + moderate crop improvements",
  "T1 Diversification": "Shift T1 to higher-value crops + legacy inclusion",
};

function ScenariosPanel({
  onLoad,
  onCompare,
  onClose,
}: {
  onLoad: (s: LIBScenarioParams) => void;
  onCompare: (scenarios: LIBScenarioParams[]) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(() => loadSavedScenarios());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = useMemo(() => getPresetScenarios(), []);

  // Build a combined lookup so the compare button can resolve names → params
  const allScenarios = useMemo(() => {
    const map = new Map<string, LIBScenarioParams>();
    for (const s of presets) map.set(s.name, s);
    for (const s of saved) map.set(s.name, s);
    return map;
  }, [presets, saved]);

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      if (!data) return;
      const result = parseScenarioFile(data);
      if ("error" in result) {
        setUploadError(result.error);
      } else {
        onLoad(result);
        saveScenario(result);
        setSaved(loadSavedScenarios());
      }
    };
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="brand-card rounded-xl p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Scenarios
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--card-bg-hover)]">
          <X size={12} className="text-[var(--text-tertiary)]" />
        </button>
      </div>

      {/* Preset Scenarios */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Strategy Presets</span>
        <p className="text-[9px] text-[var(--text-tertiary)] leading-relaxed">
          Pre-configured strategies to explore. Load one and adjust levers, or select 2+ to compare.
        </p>
        <div className="space-y-1">
          {presets.map((s) => (
            <ScenarioRow
              key={s.name}
              scenario={s}
              isSelected={selected.has(s.name)}
              onToggle={() => toggleSelect(s.name)}
              onLoad={() => onLoad(s)}
              isPreset
              description={PRESET_DESCRIPTIONS[s.name]}
            />
          ))}
        </div>
      </div>

      {/* Saved scenarios from localStorage */}
      <div className="space-y-1.5" style={{ borderTop: "1px solid var(--card-border)", paddingTop: "8px" }}>
        <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
          Your Saved Scenarios ({saved.length}/5)
        </span>
        {saved.length === 0 ? (
          <p className="text-[9px] text-[var(--text-tertiary)] py-1 leading-relaxed">
            No saved scenarios yet. Use the <strong>Save</strong> button in the header to save your current configuration.
          </p>
        ) : (
          <div className="space-y-1">
            {saved.map((s) => (
              <ScenarioRow
                key={s.name}
                scenario={s}
                isSelected={selected.has(s.name)}
                onToggle={() => toggleSelect(s.name)}
                onLoad={() => onLoad(s)}
                onDelete={() => { setSaved(deleteSavedScenario(s.name)); setSelected((prev) => { const next = new Set(prev); next.delete(s.name); return next; }); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Import from file */}
      <div className="space-y-1.5" style={{ borderTop: "1px solid var(--card-border)", paddingTop: "8px" }}>
        <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Import from File</span>
        <p className="text-[9px] text-[var(--text-tertiary)] leading-relaxed">
          Re-import a scenario previously exported from this tool. Useful for sharing scenarios between team members.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--card-bg-hover)]"
            style={{ border: "1px solid var(--card-border)" }}
          >
            <Upload size={12} className="text-[var(--color-accent)]" />
            <span className="text-[var(--text-primary)]">Choose Excel file (.xlsx)</span>
          </button>
        </div>
        {uploadError && (
          <p className="text-[10px] text-[var(--color-negative)]">{uploadError}</p>
        )}
      </div>

      {/* Compare button */}
      {selected.size >= 2 && (
        <button
          onClick={() => {
            const toCompare = Array.from(selected)
              .map((name) => allScenarios.get(name))
              .filter(Boolean) as LIBScenarioParams[];
            if (toCompare.length >= 2) onCompare(toCompare);
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-white transition-all hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, var(--color-accent) 0%, #008f6a 100%)" }}
        >
          <GitCompare size={12} />
          Compare {selected.size} Scenarios
        </button>
      )}
    </motion.div>
  );
}

// ─── Custom Tooltip for Charts ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg text-[11px]"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--card-border)" }}
    >
      <div className="font-semibold text-[var(--text-primary)] mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--text-secondary)]">{p.name}:</span>
          <span className="font-mono font-bold text-[var(--text-primary)]">
            {typeof p.value === "number" && p.name.includes("%")
              ? formatPercent(p.value)
              : typeof p.value === "number" && (p.name.includes("Income") || p.name.includes("LIB") || p.name.includes("Gap"))
                ? formatUSD(p.value)
                : formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ScenarioMode = "builder" | "comparison";

export default function LIBScenarioTool() {
  const { geoFiltered: data } = useGeo();
  const prefersReducedMotion = useReducedMotion();

  // State
  const [mode, setMode] = useState<ScenarioMode>("builder");
  const [params, setParams] = useState<LIBScenarioParams>(() => createDefaultParams("Business as Usual"));
  const [showScenariosPanel, setShowScenariosPanel] = useState(false);
  const [comparisonScenarios, setComparisonScenarios] = useState<LIBScenarioParams[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [showDetailTable, setShowDetailTable] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  // Dynamic years derived from projectionYears
  const modelYears = useMemo(
    () => generateYears(params.projectionYears ?? 6),
    [params.projectionYears]
  );

  // Run the scenario
  const result = useMemo(() => runLIBScenario(data, params), [data, params]);

  // Callbacks
  const updateCropLever = useCallback((crop: ModeledCrop, field: keyof CropLever, value: number) => {
    setParams((prev) => ({ ...prev, crops: { ...prev.crops, [crop]: { ...prev.crops[crop], [field]: value } } }));
  }, []);

  const updateT2Intake = useCallback((year: number, value: number) => {
    setParams((prev) => ({ ...prev, t2YearlyIntake: { ...prev.t2YearlyIntake, [year]: value } }));
  }, []);

  const resetAll = useCallback(() => {
    setParams(createDefaultParams(params.name, params.projectionYears ?? 6));
  }, [params.name, params.projectionYears]);

  const handleSave = useCallback(() => {
    let toSave = params;
    // Auto-name if still default
    if (!params.name.trim() || params.name === "Business as Usual") {
      const ts = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      toSave = { ...params, name: `Scenario ${ts}` };
      setParams(toSave);
    }
    saveScenario(toSave);
    setSaveFeedback("Saved!");
    setTimeout(() => setSaveFeedback(null), 2000);
  }, [params]);

  const handleDownload = useCallback(() => {
    let toExport = params;
    // Auto-name if still default
    if (!params.name.trim() || params.name === "Business as Usual") {
      const ts = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      toExport = { ...params, name: `Scenario ${ts}` };
      setParams(toExport);
    }
    downloadScenarioExcel(toExport, result);
    setDownloadFeedback("Exported!");
    setTimeout(() => setDownloadFeedback(null), 2000);
  }, [params, result]);

  const handleLoad = useCallback((s: LIBScenarioParams) => {
    setParams(s);
    setShowScenariosPanel(false);
  }, []);

  const hasChanges = useMemo(() => {
    const defaults = createDefaultParams();
    return JSON.stringify(params.crops) !== JSON.stringify(defaults.crops) ||
      params.otherOnFarmChange !== 0 ||
      params.livestockChange !== 0 ||
      params.offFarmChange !== 0 ||
      params.includeT1Legacy !== false ||
      JSON.stringify(params.t2YearlyIntake) !== JSON.stringify(generateDefaultT2Intake(params.projectionYears ?? 6));
  }, [params]);

  const t2Total = useMemo(
    () => Object.values(params.t2YearlyIntake).reduce((a, b) => a + b, 0),
    [params.t2YearlyIntake]
  );

  // Chart data — full yearly results from model
  const trajectoryDataRaw = useMemo(
    () =>
      result.yearlyResults.map((yr) => ({
        year: yr.year.toString(),
        "T1 % Above LIB": Number(yr.t1PctAboveLIB.toFixed(1)),
        "T2 % Above LIB": Number(yr.t2PctAboveLIB.toFixed(1)),
        "Total % Above LIB": Number(yr.totalPctAboveLIB.toFixed(1)),
        "LIB Benchmark": yr.lib,
        "T1 Avg Income": yr.t1AvgIncome,
        "T2 Avg Income": yr.t2AvgIncome,
      })),
    [result]
  );

  // Animated trajectory data — lines morph smoothly on lever changes
  const { displayData: trajectoryData } = useAnimatedData(trajectoryDataRaw, {
    duration: 900,
    enabled: !prefersReducedMotion,
    fieldDelays: {
      "T1 % Above LIB": 0,     "T1 Avg Income": 0,
      "T2 % Above LIB": 100,   "T2 Avg Income": 100,
      "Total % Above LIB": 200, "LIB Benchmark": 0,
    },
  });

  // Active result is always the summary (target year)
  const activeResult = result.summary;

  // Chart reference year for the highlight marker
  const chartRefYear = params.targetYear;

  const cropBarDataRaw = useMemo(
    () =>
      result.cropContributions
        .filter((c) => c.growerCount > 0)
        .map((c) => ({
          crop: CROP_NAMES[c.crop] || c.crop,
          Baseline: Math.round(c.baselineIncome),
          Projected: Math.round(c.projectedIncome),
          color: CROP_COLORS[c.crop] || "#888",
        })),
    [result]
  );

  // Animated bar data — bars grow/shrink smoothly on lever changes
  const { displayData: cropBarData } = useAnimatedData(cropBarDataRaw, {
    duration: 900,
    enabled: !prefersReducedMotion,
  });

  // Count active lever changes for the badge
  const activeLeverCount = useMemo(() => {
    let count = 0;
    for (const crop of MODELED_CROPS) {
      const l = params.crops[crop];
      if (l.yieldChange !== 0) count++;
      if (l.priceChange !== 0) count++;
      if (l.costChange !== 0) count++;
      if (l.acreageChange !== 0) count++;
    }
    if (params.otherOnFarmChange !== 0) count++;
    if (params.livestockChange !== 0) count++;
    if (params.offFarmChange !== 0) count++;
    if (params.includeT1Legacy) count++;
    if (JSON.stringify(params.t2YearlyIntake) !== JSON.stringify(generateDefaultT2Intake(params.projectionYears ?? 6))) count++;
    return count;
  }, [params]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header bar ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 flex-wrap gap-y-1 gap-x-2" style={{ borderBottom: "1px solid var(--card-border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-md"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            {(["builder", "comparison"] as const).map((m) => {
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="relative px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
                  style={{
                    color: isActive ? (m === "builder" ? "var(--color-accent)" : "#457B9D") : "var(--text-tertiary)",
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="scenario-mode-toggle"
                      className="absolute inset-0 rounded"
                      style={{
                        background: m === "builder" ? "rgba(0,161,125,0.1)" : "rgba(69,123,157,0.1)",
                        border: `1px solid ${m === "builder" ? "rgba(0,161,125,0.3)" : "rgba(69,123,157,0.3)"}`,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    {m === "builder" ? <SlidersHorizontal size={10} /> : <GitCompare size={10} />}
                    {m === "builder" ? "Build" : "Compare"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* scenario name is prompted on save / download — no persistent input */}

          {/* Projection horizon + year slider */}
          <div className="flex items-center gap-1.5">
            <select
              value={params.projectionYears ?? 6}
              onChange={(e) => {
                const newYrs = Number(e.target.value);
                const newModelYears = generateYears(newYrs);
                const newTarget = newModelYears[newModelYears.length - 1];
                setParams((p) => ({
                  ...p,
                  projectionYears: newYrs,
                  targetYear: newTarget,
                  t2YearlyIntake: generateDefaultT2Intake(newYrs),
                }));
              }}
              className="px-1 py-0.5 rounded text-[9px] font-mono font-bold outline-none cursor-pointer"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                color: "var(--text-secondary)",
              }}
            >
              {Array.from({ length: MAX_PROJECTION_YEARS - MIN_PROJECTION_YEARS + 1 }, (_, i) => MIN_PROJECTION_YEARS + i).map((n) => (
                <option key={n} value={n}>
                  {n}yr → {BASELINE_YEAR + n}
                </option>
              ))}
            </select>
            <YearSlider
              value={params.targetYear}
              years={modelYears}
              onChange={(y) => setParams((p) => ({ ...p, targetYear: y }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {mode === "builder" && (
            <>
              {(saveFeedback || downloadFeedback) && (
                <span className="text-[9px] text-[var(--color-accent)] font-semibold animate-pulse flex items-center gap-1 mr-1">
                  <Check size={10} />
                  {saveFeedback || downloadFeedback}
                </span>
              )}
              <button
                onClick={handleSave}
                className="p-1.5 rounded-md hover:bg-[rgba(0,161,125,0.12)] transition-colors text-[var(--text-tertiary)] hover:text-[#00A17D]"
                title="Save to browser (for later comparison)"
              >
                <Save size={14} />
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-md hover:bg-[rgba(0,123,255,0.12)] transition-colors text-[var(--text-tertiary)] hover:text-[#007BFF]"
                title="Download as Excel spreadsheet"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => setShowScenariosPanel(!showScenariosPanel)}
                className="p-1.5 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                title="Load / manage scenarios"
              >
                <FolderOpen size={14} />
              </button>
              {hasChanges && (
                <button
                  onClick={resetAll}
                  className="p-1.5 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  title="Reset to defaults"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <div className="w-px h-3.5 bg-[var(--card-border)] mx-0.5" />
            </>
          )}
          <button
            onClick={() => setShowMethodology(true)}
            className="p-1.5 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            title="Methodology & sources"
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* ── Builder mode: Scenarios panel dropdown ── */}
      <AnimatePresence>
        {mode === "builder" && showScenariosPanel && (
          <div className="shrink-0 px-4 pt-2">
            <ScenariosPanel
              onLoad={handleLoad}
              onCompare={(scenarios) => { setComparisonScenarios(scenarios); setMode("comparison"); setShowScenariosPanel(false); }}
              onClose={() => setShowScenariosPanel(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Comparison mode ── */}
      {mode === "comparison" && (
        <ComparisonPanel
          farmers={data}
          initialScenarios={comparisonScenarios.length >= 2 ? comparisonScenarios : getPresetScenarios(params.projectionYears ?? 6)}
          targetYear={params.targetYear}
          projectionYears={params.projectionYears ?? 6}
          onBack={() => setMode("builder")}
        />
      )}

      {/* ── Builder mode: Two-column layout: Content + Lever Sidebar ── */}
      {mode === "builder" && (
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── Main content area (scrollable) ── */}
        <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar p-4 space-y-3">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <KPICard
              label="Above LIB"
              numericValue={activeResult.totalPctAboveLIB}
              formatter={formatPercent}
              subValue={`${formatNumber(activeResult.totalAboveLIB)} of ${formatNumber(activeResult.totalFarmers)} HH`}
              icon={Target}
              color="#00A17D"
              trend={activeResult.totalMovedAboveLIB > 0 ? { value: activeResult.totalMovedAboveLIB, formatter: (n) => `${formatNumber(n)} moved above`, prefix: "+", positive: true } : undefined}
            />
            <KPICard label="Avg Income" numericValue={activeResult.totalAvgIncome} formatter={formatUSD} subValue={`LIB: ${formatUSD(activeResult.lib)}`} icon={DollarSign} color="#007BFF" />
            <KPICard label="Avg LIB Gap" numericValue={activeResult.totalAvgLIBGap} formatter={formatUSD} subValue="Among below-LIB HH" icon={BarChart3} color="#FB8500" />
            <KPICard
              label="T1 Above LIB"
              numericValue={activeResult.t1PctAboveLIB}
              formatter={formatPercent}
              subValue={`${formatNumber(activeResult.t1AboveLIB)} of ${formatNumber(activeResult.t1TotalFarmers)}`}
              icon={Users}
              color="#007BFF"
            />
            <KPICard
              label="T2 Above LIB"
              numericValue={activeResult.t2PctAboveLIB}
              formatter={formatPercent}
              subValue={`${formatNumber(activeResult.t2AboveLIB)} of ${formatNumber(activeResult.t2TotalFarmers)}`}
              icon={Layers}
              color="#6F42C1"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* LIB Trajectory — with table toggle for Detailed Results */}
            <div className="brand-card p-3 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {showDetailTable ? `Detailed Results by Group (${chartRefYear})` : `% Households Above LIB (${modelYears[0]}–${modelYears[modelYears.length - 1]})`}
                </h4>
                <button
                  onClick={() => setShowDetailTable(!showDetailTable)}
                  className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                  title={showDetailTable ? "Show chart" : "Show detailed table"}
                >
                  {showDetailTable ? (
                    <BarChart3 size={12} style={{ color: "var(--color-accent)" }} />
                  ) : (
                    <Table2 size={12} style={{ color: "var(--text-tertiary)" }} />
                  )}
                </button>
              </div>

              {showDetailTable ? (
                /* ── Detailed Results Table (inline, toggled) ── */
                <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "var(--card-bg)" }}>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Metric</th>
                        <th className="text-right py-2 px-3 font-semibold" style={{ color: "#007BFF" }}>T1</th>
                        {params.includeT1Legacy && <th className="text-right py-2 px-3 font-semibold" style={{ color: "#E67E22" }}>Legacy</th>}
                        <th className="text-right py-2 px-3 font-semibold" style={{ color: "#6F42C1" }}>T2</th>
                        <th className="text-right py-2 px-3 font-semibold" style={{ color: "#00A17D" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Total Farmers", t1: formatNumber(activeResult.t1TotalFarmers), legacy: formatNumber(activeResult.legacyTotalFarmers), t2: formatNumber(activeResult.t2TotalFarmers), total: formatNumber(activeResult.totalFarmers) },
                        { label: "% Above LIB", t1: formatPercent(activeResult.t1PctAboveLIB), legacy: formatPercent(activeResult.legacyPctAboveLIB), t2: formatPercent(activeResult.t2PctAboveLIB), total: formatPercent(activeResult.totalPctAboveLIB) },
                        { label: "# Above LIB", t1: formatNumber(activeResult.t1AboveLIB), legacy: formatNumber(activeResult.legacyAboveLIB), t2: formatNumber(activeResult.t2AboveLIB), total: formatNumber(activeResult.totalAboveLIB) },
                        { label: "Moved Above LIB", t1: `+${formatNumber(activeResult.t1MovedAboveLIB)}`, legacy: "\u2014", t2: `+${formatNumber(activeResult.t2MovedAboveLIB)}`, total: `+${formatNumber(activeResult.totalMovedAboveLIB)}` },
                        { label: "Avg Income", t1: formatUSD(activeResult.t1AvgIncome), legacy: formatUSD(activeResult.legacyAvgIncome), t2: formatUSD(activeResult.t2AvgIncome), total: formatUSD(activeResult.totalAvgIncome) },
                        { label: "Median Income", t1: formatUSD(activeResult.t1MedianIncome), legacy: "\u2014", t2: formatUSD(activeResult.t2MedianIncome), total: "\u2014" },
                        { label: "Avg LIB Gap", t1: formatUSD(activeResult.t1AvgLIBGap), legacy: "\u2014", t2: formatUSD(activeResult.t2AvgLIBGap), total: formatUSD(activeResult.totalAvgLIBGap) },
                      ].map((row, i) => (
                        <tr key={i} className="border-t border-[var(--card-border)]">
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-medium">{row.label}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.t1}</td>
                          {params.includeT1Legacy && <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.legacy}</td>}
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.t2}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono font-bold">{row.total}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-[var(--card-border)]" style={{ background: "var(--card-bg)" }}>
                        <td className="py-2 px-3 text-[var(--text-tertiary)] font-medium">LIB Benchmark</td>
                        <td colSpan={params.includeT1Legacy ? 4 : 3} className="py-2 px-3 text-right text-[var(--text-primary)] font-mono font-bold">{formatUSD(activeResult.lib)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── LIB Trajectory Chart ── */
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trajectoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis dataKey="year" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine x={chartRefYear.toString()} stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
                      <Line type="monotone" dataKey="T1 % Above LIB" stroke="#007BFF" strokeWidth={2} dot={{ r: 3, fill: "#007BFF" }} name="T1 % Above LIB" isAnimationActive={false} />
                      <Line type="monotone" dataKey="T2 % Above LIB" stroke="#6F42C1" strokeWidth={2} dot={{ r: 3, fill: "#6F42C1" }} name="T2 % Above LIB" isAnimationActive={false} />
                      <Line
                        type="monotone"
                        dataKey="Total % Above LIB"
                        stroke="#00A17D"
                        strokeWidth={2.5}
                        name="Total % Above LIB"
                        isAnimationActive={false}
                        dot={(props: Record<string, unknown>) => {
                          const { cx, cy, payload, stroke } = props as { cx: number; cy: number; payload: { year: string }; stroke: string };
                          const isTarget = payload?.year === chartRefYear.toString();
                          return (
                            <g key={`dot-${payload?.year}`}>
                              {isTarget && (
                                <circle cx={cx} cy={cy} r={8} fill="#00A17D" opacity={0.2}>
                                  <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                                </circle>
                              )}
                              <circle cx={cx} cy={cy} r={isTarget ? 5 : 3} fill={stroke || "#00A17D"} />
                            </g>
                          );
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-1">
                    {[{ label: "T1", color: "#007BFF" }, { label: "T2", color: "#6F42C1" }, { label: "Total", color: "#00A17D" }].map((l) => (
                      <div key={l.label} className="flex items-center gap-1">
                        <div className="w-2.5 h-0.5 rounded" style={{ background: l.color }} />
                        <span className="text-[9px] text-[var(--text-tertiary)]">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Income Trajectory */}
            <div className="brand-card p-3 rounded-xl">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                Average Income vs LIB Benchmark
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trajectoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="year" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine x={chartRefYear.toString()} stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
                  <Line type="monotone" dataKey="LIB Benchmark" stroke="#FB8500" strokeWidth={2} strokeDasharray="6 3" dot={false} name="LIB Benchmark" isAnimationActive={false} />
                  <Line type="monotone" dataKey="T1 Avg Income" stroke="#007BFF" strokeWidth={2} dot={{ r: 3, fill: "#007BFF" }} name="T1 Avg Income" isAnimationActive={false} />
                  <Line type="monotone" dataKey="T2 Avg Income" stroke="#6F42C1" strokeWidth={2} dot={{ r: 3, fill: "#6F42C1" }} name="T2 Avg Income" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-1">
                {[{ label: "T1 Income", color: "#007BFF" }, { label: "T2 Income", color: "#6F42C1" }, { label: "LIB", color: "#FB8500" }].map((l) => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2.5 h-0.5 rounded" style={{ background: l.color }} />
                    <span className="text-[9px] text-[var(--text-tertiary)]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Crop Income Breakdown */}
          {cropBarData.length > 0 && (
            <div className="brand-card p-3 rounded-xl">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                Crop Income Contribution (T1 Farmers, Full Tenure)
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={cropBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis type="number" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="crop" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} width={60} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Baseline" fill="#17A2B8" barSize={8} radius={[0, 2, 2, 0]} name="Baseline Income" isAnimationActive={false} />
                    <Bar dataKey="Projected" barSize={8} radius={[0, 2, 2, 0]} name="Projected Income" isAnimationActive={false}>
                      {cropBarData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-1">
                  {result.cropContributions.filter((c) => c.growerCount > 0).map((c) => (
                    <div key={c.crop} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ border: "1px solid var(--card-border)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: CROP_COLORS[c.crop] || "#888" }} />
                        <span className="text-[11px] font-medium text-[var(--text-primary)]">{CROP_NAMES[c.crop] || c.crop}</span>
                        <span className="text-[9px] text-[var(--text-tertiary)]">({formatNumber(c.growerCount)} growers)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{formatUSD(c.baselineIncome)}</span>
                        <ArrowRight size={9} className="text-[var(--text-tertiary)]" />
                        <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{formatUSD(c.projectedIncome)}</span>
                        <span
                          className="text-[9px] font-mono font-bold"
                          style={{ color: c.changePercent > 0 ? "var(--color-accent)" : c.changePercent < 0 ? "var(--color-negative)" : "var(--text-tertiary)" }}
                        >
                          {c.changePercent > 0 ? "+" : ""}{c.changePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar: Lever Panel (persistent, toggle open/close) ── */}
        <div
          className="shrink-0 flex h-full"
          style={{ borderLeft: "1px solid var(--card-border)" }}
        >
          {/* Toggle tab (always visible) */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="shrink-0 w-9 flex flex-col items-center justify-center gap-2 transition-all"
            style={{
              background: panelOpen
                ? "var(--card-bg)"
                : "linear-gradient(180deg, var(--color-brand-light-green, #D4F0E7) 0%, var(--color-brand-light-purple, #E4D5F5) 100%)",
              borderLeft: panelOpen ? "none" : "2px solid var(--color-accent, #00A17D)",
            }}
            title={panelOpen ? "Close levers panel" : "Open levers panel"}
          >
            <div className="relative">
              <SlidersHorizontal size={14} style={{ color: panelOpen ? "var(--color-accent)" : "var(--color-brand-deep-purple, #2A1055)" }} />
              {!panelOpen && activeLeverCount > 0 && (
                <span
                  className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center text-white"
                  style={{ background: "var(--color-accent, #00A17D)" }}
                >
                  {activeLeverCount}
                </span>
              )}
            </div>
            {panelOpen ? (
              <ChevronRightIcon size={12} className="text-[var(--text-tertiary)]" />
            ) : (
              <ChevronLeft size={12} style={{ color: "var(--color-brand-deep-purple, #2A1055)" }} />
            )}
            <span
              className="text-[8px] font-bold uppercase tracking-widest"
              style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                color: panelOpen ? "var(--text-tertiary)" : "var(--color-brand-deep-purple, #2A1055)",
              }}
            >
              Levers
            </span>
          </button>

          {/* Expandable lever content */}
          <AnimatePresence initial={false}>
            {panelOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden flex flex-col h-full"
                style={{ background: "var(--color-surface-1)" }}
              >
                {/* Panel header */}
                <div className="shrink-0 flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={13} className="text-[var(--color-accent)]" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">Scenario Levers</span>
                  </div>
                  {hasChanges && (
                    <button
                      onClick={resetAll}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold hover:bg-[var(--card-bg-hover)] transition-colors text-[var(--text-secondary)]"
                    >
                      <RotateCcw size={9} />
                      Reset
                    </button>
                  )}
                </div>

                {/* Panel body — single scrollable area */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-3 space-y-4">
                  {/* Crop Levers */}
                  <div>
                    <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                      <BarChart3 size={10} />
                      Crop Levers
                    </h3>
                    <div className="space-y-2">
                      {MODELED_CROPS.map((crop) => (
                        <CropLeverGroup
                          key={crop}
                          crop={crop}
                          lever={params.crops[crop]}
                          onChange={(field, value) => updateCropLever(crop, field, value)}
                          isRabi={RABI_CROPS.includes(crop)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Other Income */}
                  <div>
                    <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                      <DollarSign size={10} />
                      Other Income
                    </h3>
                    <div className="space-y-3 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <div>
                        <LeverSlider
                          label="Other On-Farm"
                          value={params.otherOnFarmChange}
                          onChange={(v) => setParams((p) => ({ ...p, otherOnFarmChange: v }))}
                          color="#00CCCC"
                          min={-50}
                          max={100}
                        />
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 ml-10">Non-modeled crops & small activities</p>
                      </div>
                      <div>
                        <LeverSlider
                          label="Livestock"
                          value={params.livestockChange}
                          onChange={(v) => setParams((p) => ({ ...p, livestockChange: v }))}
                          color="#FFB703"
                          min={-50}
                          max={100}
                        />
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 ml-10">Livestock income (separate from crops)</p>
                      </div>
                      <div>
                        <LeverSlider
                          label="Off-Farm"
                          value={params.offFarmChange}
                          onChange={(v) => setParams((p) => ({ ...p, offFarmChange: v }))}
                          color="#8B5CF6"
                          min={-50}
                          max={100}
                        />
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 ml-10">Wages, remittances, non-ag activities</p>
                      </div>
                    </div>
                  </div>

                  {/* Cohorts & Coverage */}
                  <div>
                    <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                      <Users size={10} />
                      Cohorts & Coverage
                    </h3>
                    <div className="space-y-3">
                      {/* T1 Legacy toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={params.includeT1Legacy}
                          onChange={(e) => setParams((p) => ({ ...p, includeT1Legacy: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
                        />
                        <div>
                          <span className="text-[11px] font-medium text-[var(--text-primary)]">Include T1 Legacy</span>
                          <p className="text-[9px] text-[var(--text-tertiary)]">8,000 offboarded farmers (inflation-only growth)</p>
                        </div>
                      </label>

                      {/* T2 Yearly Intake */}
                      <div>
                        <div className="mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-primary)]">T2 New Farmers / Year</span>
                            <span
                              className="text-[10px] font-mono font-bold"
                              style={{ color: t2Total > MAX_T2_FARMERS ? "var(--color-negative)" : "var(--text-secondary)" }}
                            >
                              {formatNumber(t2Total)} total
                            </span>
                          </div>
                          <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">
                            How many new T2 farmers join each year (max {formatNumber(MAX_T2_FARMERS)} total across all years)
                          </p>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, (t2Total / MAX_T2_FARMERS) * 100)}%`,
                                background: t2Total > MAX_T2_FARMERS
                                  ? "var(--color-negative)"
                                  : t2Total > MAX_T2_FARMERS * 0.8
                                    ? "#E9C46A"
                                    : "var(--color-accent)",
                              }}
                            />
                          </div>
                        </div>
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${Math.min(modelYears.length - 1, 3)}, minmax(0, 1fr))`,
                          }}
                        >
                          {modelYears.filter((y) => y > BASELINE_YEAR).map((year) => (
                            <div key={year} className="space-y-0.5">
                              <label className="text-[9px] text-[var(--text-tertiary)] font-mono">{year}</label>
                              <input
                                type="number"
                                min={0}
                                max={MAX_T2_FARMERS}
                                step={100}
                                value={params.t2YearlyIntake[year] ?? 0}
                                onChange={(e) => updateT2Intake(year, Math.max(0, Number(e.target.value)))}
                                className="w-full px-2 py-1 rounded-lg text-[11px] font-mono text-[var(--text-primary)] outline-none"
                                style={{
                                  background: "var(--card-bg)",
                                  border: `1px solid ${t2Total > MAX_T2_FARMERS && (params.t2YearlyIntake[year] ?? 0) > 0 ? "rgba(145,13,99,0.4)" : "var(--card-border)"}`,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        {t2Total > MAX_T2_FARMERS && (
                          <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg text-[9px] font-medium" style={{ background: "rgba(145,13,99,0.08)", border: "1px solid rgba(145,13,99,0.2)", color: "var(--color-negative)" }}>
                            <span>⚠</span>
                            <span>Total exceeds {formatNumber(MAX_T2_FARMERS)} — reduce by {formatNumber(t2Total - MAX_T2_FARMERS)} farmers. Excess will be capped in projections.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}

      {/* ── Methodology Modal ── */}
      <AnimatePresence>
        {showMethodology && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowMethodology(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "var(--color-surface-1)", border: "1px solid var(--card-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-[var(--color-accent)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Methodology & Sources</h3>
                </div>
                <button
                  onClick={() => setShowMethodology(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors cursor-pointer"
                >
                  <X size={16} className="text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  This tool projects household income across the <strong className="text-[var(--text-primary)]">entire Shubh Samriddhi program</strong> — 8,500 T1 Core farmers,
                  8,000 Legacy farmers (optional, inflation-only), and up to 10,000 T2 farmers — using the T1 and T2 baseline survey distributions as the foundation.
                  Crop-level levers (yield, price, cost, acreage) are applied to T1 Core and T2 farmers. Legacy farmers retain baseline income
                  inflating year-over-year. T2 farmers realize improvements gradually via a tenure curve.
                </p>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "var(--card-bg)" }}>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold whitespace-nowrap">Parameter</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold whitespace-nowrap">Elasticity</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold whitespace-nowrap">Max Effect</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Mechanism</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LIB_METHODOLOGY.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--card-border)]">
                          <td className="py-2 px-3 text-[var(--text-primary)] font-medium whitespace-nowrap align-top">{row.parameter}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-mono align-top whitespace-nowrap">{row.elasticity}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-mono align-top whitespace-nowrap">{row.maxEffect}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)] align-top">
                            {row.mechanism}
                          </td>
                          <td className="py-2 px-3 align-top whitespace-nowrap">
                            {row.sourceUrl ? (
                              <a
                                href={row.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                              >
                                {row.source}
                                <ExternalLink size={9} />
                              </a>
                            ) : (
                              <span className="text-[var(--text-tertiary)]">{row.source}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footnotes */}
                <div className="space-y-2 text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                  <p>
                    <strong className="text-[var(--text-secondary)]">Farmer groups:</strong> 8,500 T1 Core farmers receive full lever effects.
                    8,000 Legacy farmers (optional, offboarded from active program) retain their baseline income level, inflating with
                    the LIB rate year-over-year but receiving no program lever effects. T2 farmers join in annual cohorts and follow the tenure curve above.
                    All projections are scaled from the T1 baseline survey sample to actual program population sizes.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Rabi land balance:</strong> Potato, wheat, and mustard compete for the same
                    Rabi-season land. Expanding one crop&apos;s acreage is linked to the others in the UI to reflect this constraint.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Cost model:</strong> Baseline costs are estimated at 40% of revenue for each crop.
                    This is a simplification — actual cost ratios vary by crop and region. The cost lever adjusts this estimate.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Off-farm income:</strong> Income from wages, remittances, and non-agricultural
                    activities is held constant across all scenarios (not affected by levers).
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slider styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .scenario-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: var(--card-border-hover);
          outline: none;
          cursor: pointer;
          position: relative;
          z-index: 1;
        }
        .scenario-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          border: 2px solid #fff;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          position: relative;
          z-index: 20;
        }
        .scenario-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          border: 2px solid #fff;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
      ` }} />
    </div>
  );
}
