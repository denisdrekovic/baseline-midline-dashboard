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
  Globe,
  Settings2,
} from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import {
  type LIBScenarioParams,
  type ModeledCrop,
  type CropLever,
  type ModelYear,
  type ExtrapolationRate,
  type LeverMode,
  type CropTenureRamps,
  MODELED_CROPS,
  LEVER_CROPS,
  RABI_CROPS,
  getWheatAcreageChange,
  BASELINE_YEAR,
  MAX_T2_FARMERS,
  MIN_PROJECTION_YEARS,
  MAX_PROJECTION_YEARS,
  DEFAULT_SUPPLY_SHED_POPULATION,
  EXTRAPOLATION_RATES,
  DEFAULT_TENURE_CURVE,
  PROGRAM_T1_FARMERS,
  generateYears,
  generateDefaultT2Intake,
  generateDefaultT1Offboarding,
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
import { useLatestLockedAnchor } from "@/lib/utils/libProgramStorage";
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

function FixedValueInput({
  label,
  value,
  onChange,
  color,
  unit,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  color: string;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-tertiary)] w-8 shrink-0">{label}</span>
      <input
        type="number"
        step={10}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="—"
        className="flex-1 px-2 py-0.5 rounded text-[11px] font-mono outline-none"
        style={{ background: "var(--card-bg)", border: `1px solid ${value != null ? color : "var(--card-border)"}`, color: "var(--text-primary)" }}
      />
      <span className="text-[9px] text-[var(--text-tertiary)] w-10 shrink-0 text-right">{unit}</span>
    </div>
  );
}

function CropLeverGroup({
  crop,
  lever,
  onChange,
  isRabi,
  leverMode,
}: {
  crop: ModeledCrop;
  lever: CropLever;
  onChange: (field: keyof CropLever, value: number) => void;
  isRabi: boolean;
  leverMode: LeverMode;
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
      {leverMode === "percentage" ? (
        <>
          <LeverSlider label="Yield" value={lever.yieldChange} onChange={(v) => onChange("yieldChange", v)} color={color} min={-50} max={100} />
          <LeverSlider label="Price" value={lever.priceChange} onChange={(v) => onChange("priceChange", v)} color={color} min={-50} max={100} />
          <LeverSlider label="Cost" value={lever.costChange} onChange={(v) => onChange("costChange", v)} color={color} min={-50} max={100} invert />
          <LeverSlider label="Area" value={lever.acreageChange} onChange={(v) => onChange("acreageChange", v)} color={color} min={-50} max={100} />
        </>
      ) : (
        <>
          <FixedValueInput label="Yield" value={lever.yieldFixed} onChange={(v) => onChange("yieldFixed", v)} color={color} unit="kg/acre" />
          <FixedValueInput label="Price" value={lever.priceFixed} onChange={(v) => onChange("priceFixed", v)} color={color} unit="₹/kg" />
          <FixedValueInput label="Cost" value={lever.costFixed} onChange={(v) => onChange("costFixed", v)} color={color} unit="₹/acre" />
          <FixedValueInput label="Area" value={lever.acreageFixed} onChange={(v) => onChange("acreageFixed", v)} color={color} unit="acres" />
        </>
      )}
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

// ─── Tenure Ramp Modal ───────────────────────────────────────────────────────

function TenureRampModal({
  cropTenureRamps,
  onSave,
  onClose,
}: {
  cropTenureRamps?: CropTenureRamps;
  onSave: (ramps: CropTenureRamps) => void;
  onClose: () => void;
}) {
  const maxYears = 6;
  const years = Array.from({ length: maxYears + 1 }, (_, i) => i); // 0..6

  // Local state: deep copy of ramps or defaults
  const [ramps, setRamps] = useState<Record<ModeledCrop, Record<number, number>>>(() => {
    const result = {} as Record<ModeledCrop, Record<number, number>>;
    for (const crop of MODELED_CROPS) {
      result[crop] = { ...DEFAULT_TENURE_CURVE, ...(cropTenureRamps?.[crop] ?? {}) };
    }
    return result;
  });

  const updateValue = (crop: ModeledCrop, year: number, value: number) => {
    setRamps((prev) => ({
      ...prev,
      [crop]: { ...prev[crop], [year]: Math.max(0, Math.min(1, value)) },
    }));
  };

  const resetToDefault = () => {
    const result = {} as Record<ModeledCrop, Record<number, number>>;
    for (const crop of MODELED_CROPS) {
      result[crop] = { ...DEFAULT_TENURE_CURVE };
    }
    setRamps(result);
  };

  const handleSave = () => {
    // Only save crops that differ from default
    const diff: CropTenureRamps = {};
    for (const crop of MODELED_CROPS) {
      const isCustom = years.some((y) => ramps[crop][y] !== (DEFAULT_TENURE_CURVE[y] ?? 1));
      if (isCustom) diff[crop] = { ...ramps[crop] };
    }
    onSave(Object.keys(diff).length > 0 ? diff : undefined as unknown as CropTenureRamps);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--card-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">T2 Tenure Improvement Ramps</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetToDefault} className="text-[10px] px-2 py-1 rounded hover:bg-[var(--card-bg-hover)] text-[var(--text-secondary)]">
              <RotateCcw size={10} className="inline mr-1" />Reset to Default
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--card-bg-hover)]">
              <X size={16} className="text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <p className="text-[11px] text-[var(--text-secondary)] mb-4 leading-relaxed">
            Define how much of each crop&apos;s target improvement a T2 farmer realizes based on years in the program.
            Year 0 = just joined (0%), Year 5+ = full effect (100%). Each crop can have a different adoption curve.
          </p>

          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ background: "var(--card-bg)" }}>
                  <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Crop</th>
                  {years.map((y) => (
                    <th key={y} className="text-center py-2 px-3 text-[var(--text-tertiary)] font-semibold font-mono">
                      Yr {y}{y >= 5 ? "+" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODELED_CROPS.map((crop) => {
                  const color = CROP_COLORS[crop] || "#888";
                  return (
                    <tr key={crop} className="border-t border-[var(--card-border)]">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="font-medium text-[var(--text-primary)]">{CROP_NAMES[crop] || crop}</span>
                        </div>
                      </td>
                      {years.map((y) => {
                        const val = ramps[crop][y] ?? (y >= 5 ? 1 : 0);
                        const isDefault = val === (DEFAULT_TENURE_CURVE[y] ?? 1);
                        return (
                          <td key={y} className="py-1.5 px-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              value={Math.round(val * 100)}
                              onChange={(e) => updateValue(crop, y, Number(e.target.value) / 100)}
                              className="w-14 px-1.5 py-1 rounded text-center text-[11px] font-mono outline-none"
                              style={{
                                background: isDefault ? "var(--card-bg)" : `${color}15`,
                                border: `1px solid ${isDefault ? "var(--card-border)" : color}`,
                                color: "var(--text-primary)",
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Visual preview — mini bar chart for each crop */}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {MODELED_CROPS.map((crop) => {
              const color = CROP_COLORS[crop] || "#888";
              return (
                <div key={crop} className="text-center">
                  <span className="text-[9px] font-semibold" style={{ color }}>{CROP_NAMES[crop]}</span>
                  <div className="flex items-end justify-center gap-px mt-1 h-8">
                    {years.map((y) => {
                      const val = ramps[crop][y] ?? (y >= 5 ? 1 : 0);
                      return (
                        <div
                          key={y}
                          className="w-2 rounded-t-sm"
                          style={{ height: `${Math.max(2, val * 100)}%`, background: color, opacity: val > 0 ? 0.8 : 0.2 }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--card-border)" }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-[11px] font-semibold hover:bg-[var(--card-bg-hover)] text-[var(--text-secondary)]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Apply Ramps
          </button>
        </div>
      </motion.div>
    </motion.div>
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
  const [showTenureRamps, setShowTenureRamps] = useState(false);

  // Dynamic years derived from projectionYears
  const modelYears = useMemo(
    () => generateYears(params.projectionYears ?? 6),
    [params.projectionYears]
  );

  // Locked LIB anchor — when present, overrides LIB_2024/BASELINE_YEAR in the engine.
  // Sourced from the latest Annual Lock at /lib-calculator/setup.
  const lockedAnchor = useLatestLockedAnchor();

  // Merge the locked anchor into params so it flows through to the engine.
  const paramsWithLock = useMemo<LIBScenarioParams>(
    () => ({ ...params, lockedAnchor }),
    [params, lockedAnchor],
  );

  // Run the scenario
  const result = useMemo(() => runLIBScenario(data, paramsWithLock), [data, paramsWithLock]);

  // Callbacks
  const updateCropLever = useCallback((crop: ModeledCrop, field: keyof CropLever, value: number) => {
    setParams((prev) => ({ ...prev, crops: { ...prev.crops, [crop]: { ...prev.crops[crop], [field]: value } } }));
  }, []);

  const updateT2Intake = useCallback((year: number, value: number) => {
    setParams((prev) => ({ ...prev, t2YearlyIntake: { ...prev.t2YearlyIntake, [year]: value } }));
  }, []);

  const resetAll = useCallback(() => {
    const p = createDefaultParams(params.name, params.projectionYears ?? 6);
    setParams(p);
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
    const defaults = createDefaultParams("", params.projectionYears ?? 6);
    return JSON.stringify(params.crops) !== JSON.stringify(defaults.crops) ||
      params.otherOnFarmChange !== 0 ||
      params.offFarmChange !== 0 ||
      !params.includeT1Legacy ||
      JSON.stringify(params.t2YearlyIntake) !== JSON.stringify(defaults.t2YearlyIntake) ||
      params.supplyShEdPopulation !== DEFAULT_SUPPLY_SHED_POPULATION ||
      params.extrapolationRate !== 0.5 ||
      params.leverMode !== "percentage";
  }, [params]);

  const t2Total = useMemo(
    () => Object.values(params.t2YearlyIntake).reduce((a, b) => a + b, 0),
    [params.t2YearlyIntake]
  );

  // Wheat has no intervention levers — its acreage is derived from the Rabi land balance
  const wheatAcreageChange = useMemo(() => getWheatAcreageChange(params.crops), [params.crops]);

  // Chart data — full yearly results from model
  const trajectoryDataRaw = useMemo(
    () =>
      result.yearlyResults.map((yr) => ({
        year: yr.year.toString(),
        "T1 % Above LIB": Number(yr.t1PctAboveLIB.toFixed(1)),
        "T2 % Above LIB": Number(yr.t2PctAboveLIB.toFixed(1)),
        "Non-Program % Above LIB": Number(yr.nonProgramPctAboveLIB.toFixed(1)),
        "Supply Shed KPI": Number(yr.supplyShEdKPI.toFixed(1)),
        "LIB Benchmark": yr.lib,
        "T1 Avg Income": yr.t1AvgIncome,
        "T2 Avg Income": yr.t2AvgIncome,
        isReported: yr.isReported,
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
      "Non-Program % Above LIB": 100, "Supply Shed KPI": 200,
      "LIB Benchmark": 0,
    },
  });

  // Active result is always the summary (target year)
  const activeResult = result.summary;

  // T1 tile reflects Legacy when included — population, not just the active core
  const t1Tile = useMemo(() => {
    const inclLegacy = params.includeT1Legacy && activeResult.legacyTotalFarmers > 0;
    const total = activeResult.t1TotalFarmers + (inclLegacy ? activeResult.legacyTotalFarmers : 0);
    const above = activeResult.t1AboveLIB + (inclLegacy ? activeResult.legacyAboveLIB : 0);
    return {
      label: inclLegacy ? "T1 + Legacy Above LIB" : "T1 Above LIB",
      pct: total > 0 ? (above / total) * 100 : 0,
      sub: `${formatNumber(above)} of ${formatNumber(total)}`,
    };
  }, [activeResult, params.includeT1Legacy]);

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
    for (const crop of LEVER_CROPS) {
      const l = params.crops[crop];
      if (l.yieldChange !== 0) count++;
      if (l.priceChange !== 0) count++;
      if (l.costChange !== 0) count++;
      if (l.acreageChange !== 0) count++;
    }
    if (params.otherOnFarmChange !== 0) count++;
    if (params.offFarmChange !== 0) count++;
    if (!params.includeT1Legacy) count++;
    const defaults = createDefaultParams("", params.projectionYears ?? 6);
    if (JSON.stringify(params.t2YearlyIntake) !== JSON.stringify(defaults.t2YearlyIntake)) count++;
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
                  t1Offboarding: generateDefaultT1Offboarding(newYrs),
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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            {/* Supply Shed KPI — the headline number */}
            <KPICard
              label="Supply Shed KPI"
              numericValue={activeResult.supplyShEdKPI}
              formatter={formatPercent}
              subValue={`${formatNumber(activeResult.supplyShEdAboveLIB)} of ${formatNumber(activeResult.supplyShEdTotalFarmers)} HH`}
              icon={Globe}
              color="#2A1055"
              trend={activeResult.totalMovedAboveLIB > 0 ? { value: activeResult.totalMovedAboveLIB, formatter: (n) => `${formatNumber(n)} moved above`, prefix: "+", positive: true } : undefined}
            />
            <KPICard label="Avg Income" numericValue={activeResult.totalAvgIncome} formatter={formatUSD} subValue={`LIB: ${formatUSD(activeResult.lib)}`} icon={DollarSign} color="#007BFF" />
            <KPICard
              label={t1Tile.label}
              numericValue={t1Tile.pct}
              formatter={formatPercent}
              subValue={t1Tile.sub}
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
            <KPICard
              label="Non-Program"
              numericValue={activeResult.nonProgramPctAboveLIB}
              formatter={formatPercent}
              subValue={`${formatNumber(activeResult.nonProgramAboveLIB)} of ${formatNumber(activeResult.nonProgramTotalFarmers)}`}
              icon={Globe}
              color="#FFB703"
            />
            <KPICard label="Avg LIB Gap" numericValue={activeResult.totalAvgLIBGap} formatter={formatUSD} subValue="Among below-LIB HH" icon={BarChart3} color="#FB8500" />
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
                        <th className="text-right py-2 px-3 font-semibold" style={{ color: "#FFB703" }}>Non-Prog</th>
                        <th className="text-right py-2 px-3 font-semibold" style={{ color: "#2A1055" }}>Supply Shed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Total Farmers", t1: formatNumber(activeResult.t1TotalFarmers), legacy: formatNumber(activeResult.legacyTotalFarmers), t2: formatNumber(activeResult.t2TotalFarmers), nonProg: formatNumber(activeResult.nonProgramTotalFarmers), shed: formatNumber(activeResult.supplyShEdTotalFarmers) },
                        { label: "% Above LIB", t1: formatPercent(activeResult.t1PctAboveLIB), legacy: formatPercent(activeResult.legacyPctAboveLIB), t2: formatPercent(activeResult.t2PctAboveLIB), nonProg: formatPercent(activeResult.nonProgramPctAboveLIB), shed: formatPercent(activeResult.supplyShEdKPI) },
                        { label: "# Above LIB", t1: formatNumber(activeResult.t1AboveLIB), legacy: formatNumber(activeResult.legacyAboveLIB), t2: formatNumber(activeResult.t2AboveLIB), nonProg: formatNumber(activeResult.nonProgramAboveLIB), shed: formatNumber(activeResult.supplyShEdAboveLIB) },
                        { label: "Moved Above LIB", t1: `+${formatNumber(activeResult.t1MovedAboveLIB)}`, legacy: "\u2014", t2: `+${formatNumber(activeResult.t2MovedAboveLIB)}`, nonProg: "\u2014", shed: `+${formatNumber(activeResult.totalMovedAboveLIB)}` },
                        { label: "Avg Income", t1: formatUSD(activeResult.t1AvgIncome), legacy: formatUSD(activeResult.legacyAvgIncome), t2: formatUSD(activeResult.t2AvgIncome), nonProg: formatUSD(activeResult.nonProgramAvgIncome), shed: formatUSD(activeResult.totalAvgIncome) },
                        { label: "Median Income", t1: formatUSD(activeResult.t1MedianIncome), legacy: "\u2014", t2: formatUSD(activeResult.t2MedianIncome), nonProg: "\u2014", shed: "\u2014" },
                        { label: "Avg LIB Gap", t1: formatUSD(activeResult.t1AvgLIBGap), legacy: "\u2014", t2: formatUSD(activeResult.t2AvgLIBGap), nonProg: "\u2014", shed: formatUSD(activeResult.totalAvgLIBGap) },
                      ].map((row, i) => (
                        <tr key={i} className="border-t border-[var(--card-border)]">
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-medium">{row.label}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.t1}</td>
                          {params.includeT1Legacy && <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.legacy}</td>}
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.t2}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono">{row.nonProg}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-primary)] font-mono font-bold">{row.shed}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-[var(--card-border)]" style={{ background: "var(--card-bg)" }}>
                        <td className="py-2 px-3 text-[var(--text-tertiary)] font-medium">LIB Benchmark</td>
                        <td colSpan={params.includeT1Legacy ? 6 : 5} className="py-2 px-3 text-right text-[var(--text-primary)] font-mono font-bold">{formatUSD(activeResult.lib)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── LIB Trajectory Chart — with reported/projected distinction ── */
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trajectoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis
                        dataKey="year"
                        tick={(props: Record<string, unknown>) => {
                          const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                          const yr = Number(payload.value);
                          const isRep = params.reportedYears?.includes(yr);
                          return (
                            <text x={x as number} y={(y as number) + 12} textAnchor="middle" fontSize={10} fill={isRep ? "var(--text-primary)" : "var(--text-tertiary)"} fontWeight={isRep ? 700 : 400}>
                              {payload.value}{isRep ? "" : "*"}
                            </text>
                          );
                        }}
                      />
                      <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine x={chartRefYear.toString()} stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
                      <Line type="monotone" dataKey="T1 % Above LIB" stroke="#007BFF" strokeWidth={1.5} dot={{ r: 2, fill: "#007BFF" }} name="T1 % Above LIB" isAnimationActive={false} />
                      <Line type="monotone" dataKey="T2 % Above LIB" stroke="#6F42C1" strokeWidth={1.5} dot={{ r: 2, fill: "#6F42C1" }} name="T2 % Above LIB" isAnimationActive={false} />
                      <Line type="monotone" dataKey="Non-Program % Above LIB" stroke="#FFB703" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2, fill: "#FFB703" }} name="Non-Program % Above LIB" isAnimationActive={false} />
                      <Line
                        type="monotone"
                        dataKey="Supply Shed KPI"
                        stroke="#2A1055"
                        strokeWidth={2.5}
                        name="Supply Shed KPI"
                        isAnimationActive={false}
                        dot={(props: Record<string, unknown>) => {
                          const { cx, cy, payload, stroke } = props as { cx: number; cy: number; payload: { year: string; isReported?: boolean }; stroke: string };
                          const isTarget = payload?.year === chartRefYear.toString();
                          const isRep = payload?.isReported;
                          return (
                            <g key={`dot-${payload?.year}`}>
                              {isTarget && (
                                <circle cx={cx} cy={cy} r={8} fill="#2A1055" opacity={0.2}>
                                  <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                                </circle>
                              )}
                              {isRep ? (
                                <circle cx={cx} cy={cy} r={isTarget ? 5 : 3} fill={stroke || "#2A1055"} />
                              ) : (
                                <circle cx={cx} cy={cy} r={isTarget ? 5 : 3} fill="var(--color-surface-1)" stroke={stroke || "#2A1055"} strokeWidth={2} />
                              )}
                            </g>
                          );
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-1 flex-wrap">
                    {[
                      { label: "Supply Shed KPI", color: "#2A1055" },
                      { label: "T1", color: "#007BFF" },
                      { label: "T2", color: "#6F42C1" },
                      { label: "Non-Program", color: "#FFB703", dashed: true },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1">
                        <div className="w-2.5 h-0.5 rounded" style={{ background: l.color, ...(l.dashed ? { backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 2px, var(--color-surface-1) 2px, var(--color-surface-1) 4px)" } : {}) }} />
                        <span className="text-[9px] text-[var(--text-tertiary)]">{l.label}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                      <div className="w-2 h-2 rounded-full bg-[#2A1055]" />
                      <span className="text-[8px] text-[var(--text-tertiary)]">Reported</span>
                      <div className="w-2 h-2 rounded-full border-2 border-[#2A1055]" style={{ background: "var(--color-surface-1)" }} />
                      <span className="text-[8px] text-[var(--text-tertiary)]">Projected</span>
                    </div>
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
                      {LEVER_CROPS.map((crop) => (
                        <CropLeverGroup
                          key={crop}
                          crop={crop}
                          lever={params.crops[crop]}
                          onChange={(field, value) => updateCropLever(crop, field, value)}
                          isRabi={RABI_CROPS.includes(crop)}
                          leverMode={params.leverMode ?? "percentage"}
                        />
                      ))}
                      {/* Wheat — no intervention levers; acreage balances Rabi land */}
                      <div className="space-y-1 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: CROP_COLORS.wheat || "#888" }} />
                          <span className="text-[11px] font-semibold text-[var(--text-primary)]">{CROP_NAMES.wheat || "Wheat"}</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--card-bg-hover)] text-[var(--text-tertiary)]">
                            Rabi · auto
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-tertiary)] flex-1">Area (Rabi land balance)</span>
                          <span
                            className="text-[10px] font-mono font-bold w-10 text-right shrink-0"
                            style={{
                              color: wheatAcreageChange > 0
                                ? "var(--color-accent)"
                                : wheatAcreageChange < 0
                                  ? "var(--color-negative)"
                                  : "var(--text-tertiary)",
                            }}
                          >
                            {wheatAcreageChange > 0 ? "+" : ""}{wheatAcreageChange}%
                          </span>
                        </div>
                        <p className="text-[9px] text-[var(--text-tertiary)]">
                          No wheat interventions — area adjusts when Potato or Mustard area changes
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tenure Ramp Button */}
                  <button
                    onClick={() => setShowTenureRamps(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                    style={{
                      background: params.cropTenureRamps ? "rgba(0,161,125,0.1)" : "var(--card-bg)",
                      border: `1px solid ${params.cropTenureRamps ? "rgba(0,161,125,0.3)" : "var(--card-border)"}`,
                      color: params.cropTenureRamps ? "var(--color-accent)" : "var(--text-secondary)",
                    }}
                  >
                    <TrendingUp size={10} />
                    {params.cropTenureRamps ? "Custom T2 Ramps Active" : "Customize T2 Tenure Ramps"}
                  </button>

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
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 ml-10">Non-modeled crops, livestock & small activities</p>
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

                  {/* Supply Shed Settings */}
                  <div>
                    <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                      <Globe size={10} />
                      Supply Shed KPI
                    </h3>
                    <div className="space-y-3">
                      {/* Supply shed population */}
                      <div>
                        <label className="text-[10px] text-[var(--text-secondary)] font-medium">Total Supply Shed Population</label>
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          value={params.supplyShEdPopulation ?? DEFAULT_SUPPLY_SHED_POPULATION}
                          onChange={(e) => setParams((p) => ({ ...p, supplyShEdPopulation: Math.max(1000, Number(e.target.value)) }))}
                          className="w-full mt-1 px-2 py-1 rounded-lg text-[11px] font-mono text-[var(--text-primary)] outline-none"
                          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
                        />
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">KPI denominator — total estimated farmers in supply shed</p>
                      </div>
                      {/* Extrapolation rate */}
                      <div>
                        <label className="text-[10px] text-[var(--text-secondary)] font-medium">Extrapolation Rate</label>
                        <div className="flex gap-1 mt-1">
                          {EXTRAPOLATION_RATES.map((rate) => (
                            <button
                              key={rate}
                              onClick={() => setParams((p) => ({ ...p, extrapolationRate: rate }))}
                              className="flex-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                              style={{
                                background: params.extrapolationRate === rate ? "rgba(42,16,85,0.15)" : "var(--card-bg)",
                                border: `1px solid ${params.extrapolationRate === rate ? "#2A1055" : "var(--card-border)"}`,
                                color: params.extrapolationRate === rate ? "#2A1055" : "var(--text-tertiary)",
                              }}
                            >
                              {(rate * 100).toFixed(0)}%
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">How much of the supply shed the data credibly represents</p>
                      </div>
                      {/* Lever mode toggle */}
                      <div>
                        <label className="text-[10px] text-[var(--text-secondary)] font-medium">Lever Input Mode</label>
                        <div className="flex gap-1 mt-1">
                          {([["percentage", "%"] , ["fixed", "₹"]] as const).map(([mode, label]) => {
                            const isDisabled = mode === "fixed";
                            return (
                              <button
                                key={mode}
                                disabled={isDisabled}
                                onClick={() => !isDisabled && setParams((p) => ({ ...p, leverMode: mode as LeverMode }))}
                                className="flex-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                                title={isDisabled ? "Target values arrive with the driver-based update" : undefined}
                                style={{
                                  background: params.leverMode === mode ? "rgba(0,161,125,0.15)" : "var(--card-bg)",
                                  border: `1px solid ${params.leverMode === mode ? "var(--color-accent)" : "var(--card-border)"}`,
                                  color: params.leverMode === mode ? "var(--color-accent)" : "var(--text-tertiary)",
                                  opacity: isDisabled ? 0.45 : 1,
                                  cursor: isDisabled ? "not-allowed" : "pointer",
                                }}
                              >
                                {label} {mode === "percentage" ? "Change" : "Value"}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">
                          Enter changes as % from baseline. ₹ target values arrive with the driver-based update.
                        </p>
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
                      {/* T1 program total — fixed anchor */}
                      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <div>
                          <span className="text-[11px] font-medium text-[var(--text-primary)]">T1 Program Farmers</span>
                          <p className="text-[9px] text-[var(--text-tertiary)]">Fixed program total — offboarding moves farmers to Legacy within it</p>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">{formatNumber(PROGRAM_T1_FARMERS)}</span>
                      </div>

                      {/* T1 Legacy toggle — enables the offboarding plan */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={params.includeT1Legacy}
                          onChange={(e) => setParams((p) => ({ ...p, includeT1Legacy: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
                        />
                        <div>
                          <span className="text-[11px] font-medium text-[var(--text-primary)]">Include T1 Legacy</span>
                          <p className="text-[9px] text-[var(--text-tertiary)]">Enables the offboarding plan — offboarded T1 farmers become Legacy (inflation-only growth)</p>
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

                      {/* T1 Offboarding Schedule */}
                      {params.includeT1Legacy && (
                        <div>
                          <div className="mb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-[var(--text-primary)]">T1 Offboarding / Year</span>
                              <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                                {formatNumber(Object.values(params.t1Offboarding ?? {}).reduce((a, b) => a + b, 0))} total
                              </span>
                            </div>
                            <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5">
                              How many T1 farmers move to Legacy status each year (gradual offboarding)
                            </p>
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
                                  max={PROGRAM_T1_FARMERS}
                                  step={100}
                                  value={params.t1Offboarding?.[year] ?? 0}
                                  onChange={(e) => setParams((p) => ({
                                    ...p,
                                    t1Offboarding: { ...(p.t1Offboarding ?? {}), [year]: Math.max(0, Number(e.target.value)) },
                                  }))}
                                  className="w-full px-2 py-1 rounded-lg text-[11px] font-mono text-[var(--text-primary)] outline-none"
                                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}

      {/* ── Tenure Ramp Modal ── */}
      <AnimatePresence>
        {showTenureRamps && (
          <TenureRampModal
            cropTenureRamps={params.cropTenureRamps}
            onSave={(ramps) => {
              setParams((p) => ({ ...p, cropTenureRamps: ramps || undefined }));
              setShowTenureRamps(false);
            }}
            onClose={() => setShowTenureRamps(false)}
          />
        )}
      </AnimatePresence>

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
                  This tool calculates the <strong className="text-[var(--text-primary)]">Mint Segment Living Income KPI</strong> across the full supply shed —
                  23,875 T1 program farmers (a fixed total; the offboarding plan moves farmers to Legacy status within it), up to 10,000 T2 farmers,
                  and the non-program supply shed population (modeled from control group data). The KPI = % of total supply shed at or above the inflation-adjusted LIB.
                  Reported years show actual calculated KPIs; projected years run scenarios forward from the most recent reported year.
                  The LIB inflates by CPI only, matching the Annual Lock basis per Mars KPI guidance.
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
                    <strong className="text-[var(--text-secondary)]">Farmer groups:</strong> The T1 program totals 23,875 farmers — a fixed anchor.
                    Active T1 farmers receive full lever effects; the offboarding plan (Include T1 Legacy) moves farmers to Legacy status, where income
                    retains its baseline level and inflates with the LIB rate but receives no program lever effects. T2 farmers join in annual cohorts
                    and follow the tenure curve above. All projections are scaled from the survey samples to program population sizes.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Rabi land balance:</strong> Potato, wheat, and mustard compete for the same
                    Rabi-season land. Wheat has no intervention levers — when potato or mustard acreage changes, wheat&apos;s acreage absorbs the
                    land balance (baseline Rabi shares: potato 40%, wheat 36%, mustard 24%).
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Cost model:</strong> Per-crop cost ratios are derived from the baseline crop
                    data as cost/revenue = 1 − net income/income: mint 52%, rice 58%, potato 42%, wheat 51%, mustard 54%. Ratios are pooled across
                    farmer groups until group-tagged crop data lands. The cost lever adjusts each crop&apos;s own cost base.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Off-farm income:</strong> Income from wages, remittances, and non-agricultural
                    activities moves with the Off-Farm lever (scaled by tenure for T2); with the lever at 0 it inflates with the baseline rate.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">KPI composition effect:</strong> The T2 baseline survey sample is substantially
                    better-off than T1 or Control (67% vs 11% vs 4% above LIB in 2024). Enrolling T2 cohorts therefore raises the Supply Shed KPI
                    even with no income gains — year-over-year KPI movement reflects enrollment composition as well as income change.
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
