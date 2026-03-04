"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, TrendingUp, TrendingDown, ArrowRight, Maximize2, ChevronDown, SlidersHorizontal, Info, X, ExternalLink } from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import { MiniGroupedBarChart, ChartLegend } from "@/components/dashboard/analytics/shared";
import ChartExpandModal from "@/components/charts/ChartExpandModal";
import { runScenario, METHODOLOGY, ScenarioParams } from "@/lib/utils/scenarioEngine";
import { CROP_COLORS, CROP_NAMES, CROPS, LIB_COLORS } from "@/lib/data/constants";
import { formatUSD } from "@/lib/utils/formatters";

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  color,
  unit = "%",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  color: string;
  unit?: string;
}) {
  /* Position of the zero mark and current thumb as percentages of the track */
  const range = max - min;
  const zeroPct = ((0 - min) / range) * 100;
  const valPct = ((value - min) / range) * 100;

  /* Build a gradient that colours the track between the zero mark and the thumb */
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

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: value > 0 ? "var(--color-accent)" : value < 0 ? "var(--color-negative)" : "var(--text-tertiary)" }}
        >
          {value > 0 ? "+" : ""}{value}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="scenario-slider w-full"
          style={{ color, background: trackBg }}
        />
        {/* Zero-point marker tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-[10px] rounded-full pointer-events-none"
          style={{
            left: `${zeroPct}%`,
            background: "rgba(255,255,255,0.35)",
          }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  current,
  projected,
  formatter,
  invert = false,
}: {
  label: string;
  current: number;
  projected: number;
  formatter: (n: number) => string;
  invert?: boolean;
}) {
  const diff = projected - current;
  const isPositive = invert ? diff < 0 : diff > 0;
  const isNeutral = Math.abs(diff) < 0.01;

  return (
    <div className="brand-card p-2 rounded-xl">
      <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-mono text-[var(--text-secondary)]">
          {formatter(current)}
        </span>
        <ArrowRight size={9} className="text-[var(--text-tertiary)] shrink-0" />
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: isNeutral ? "var(--text-primary)" : isPositive ? "var(--color-accent)" : "var(--color-negative)" }}
        >
          {formatter(projected)}
        </span>
      </div>
      {!isNeutral && (
        <div className="flex items-center gap-1 mt-0.5">
          {isPositive ? (
            <TrendingUp size={9} className="text-[var(--color-accent)]" />
          ) : (
            <TrendingDown size={9} className="text-[var(--color-negative)]" />
          )}
          <span
            className="text-[9px] font-mono font-bold"
            style={{ color: isPositive ? "var(--color-accent)" : "var(--color-negative)" }}
          >
            {diff > 0 ? "+" : ""}{formatter(diff)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ScenarioSliderPanel() {
  const { geoFiltered: data } = useGeo();

  // Slider state
  const [cropPrices, setCropPrices] = useState<Record<string, number>>(
    Object.fromEntries(CROPS.map((c) => [c, 0]))
  );
  const [yieldChanges, setYieldChanges] = useState<Record<string, number>>(
    Object.fromEntries(CROPS.map((c) => [c, 0]))
  );
  const [acreageChange, setAcreageChange] = useState(0);
  const [financialAccessChange, setFinancialAccessChange] = useState(0);
  const [trainingChange, setTrainingChange] = useState(0);
  const [safetyNetChange, setSafetyNetChange] = useState(0);
  const [offFarmChange, setOffFarmChange] = useState(0);

  // Panel open state — open by default so users can see what parameters they can adjust
  const [slidersOpen, setSlidersOpen] = useState(true);

  const params: ScenarioParams = useMemo(() => ({
    cropPrices,
    yieldChanges,
    acreageChange,
    financialAccessChange,
    trainingChange,
    safetyNetChange,
    offFarmChange,
  }), [cropPrices, yieldChanges, acreageChange, financialAccessChange, trainingChange, safetyNetChange, offFarmChange]);

  const result = useMemo(() => runScenario(data, params), [data, params]);

  const updateCropPrice = useCallback((crop: string, value: number) => {
    setCropPrices((prev) => ({ ...prev, [crop]: value }));
  }, []);

  const updateYieldChange = useCallback((crop: string, value: number) => {
    setYieldChanges((prev) => ({ ...prev, [crop]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setCropPrices(Object.fromEntries(CROPS.map((c) => [c, 0])));
    setYieldChanges(Object.fromEntries(CROPS.map((c) => [c, 0])));
    setAcreageChange(0);
    setFinancialAccessChange(0);
    setTrainingChange(0);
    setSafetyNetChange(0);
    setOffFarmChange(0);
  }, []);

  const hasChanges = Object.values(cropPrices).some((v) => v !== 0) ||
    Object.values(yieldChanges).some((v) => v !== 0) ||
    acreageChange !== 0 ||
    financialAccessChange !== 0 || trainingChange !== 0 ||
    safetyNetChange !== 0 || offFarmChange !== 0;

  // Summary chips for collapsed state
  const activeChanges = useMemo(() => {
    const parts: { label: string; value: string; color: string }[] = [];
    for (const [crop, val] of Object.entries(cropPrices)) {
      if (val !== 0) parts.push({ label: `${CROP_NAMES[crop]} price`, value: `${val > 0 ? "+" : ""}${val}%`, color: CROP_COLORS[crop] });
    }
    for (const [crop, val] of Object.entries(yieldChanges)) {
      if (val !== 0) parts.push({ label: `${CROP_NAMES[crop]} yield`, value: `${val > 0 ? "+" : ""}${val}%`, color: CROP_COLORS[crop] });
    }
    if (acreageChange !== 0) parts.push({ label: "Acreage", value: `${acreageChange > 0 ? "+" : ""}${acreageChange}%`, color: "#6F42C1" });
    if (financialAccessChange !== 0) parts.push({ label: "Finance", value: `${financialAccessChange > 0 ? "+" : ""}${financialAccessChange}%`, color: "#007BFF" });
    if (trainingChange !== 0) parts.push({ label: "Training", value: `${trainingChange > 0 ? "+" : ""}${trainingChange}%`, color: "#00CCCC" });
    if (safetyNetChange !== 0) parts.push({ label: "Safety Net", value: `${safetyNetChange > 0 ? "+" : ""}${safetyNetChange}%`, color: "#FFB703" });
    if (offFarmChange !== 0) parts.push({ label: "Off-Farm", value: `${offFarmChange > 0 ? "+" : ""}${offFarmChange}%`, color: "#219EBC" });
    return parts;
  }, [cropPrices, yieldChanges, acreageChange, financialAccessChange, trainingChange, safetyNetChange, offFarmChange]);

  const [expandedChart, setExpandedChart] = useState<"income" | "lib" | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const incomeUp = result.projectedAvgIncome >= result.currentAvgIncome;
  const projectedColor = incomeUp ? "#00A17D" : "#910D63";

  const incomeChartData = useMemo(() => [
    { metric: "Average", current: result.currentAvgIncome, projected: result.projectedAvgIncome },
    { metric: "Median", current: result.currentMedianIncome, projected: result.projectedMedianIncome },
  ], [result.currentAvgIncome, result.projectedAvgIncome, result.currentMedianIncome, result.projectedMedianIncome]);

  const incomeChartKeys = useMemo(() => [
    { dataKey: "current", color: "#17A2B8", label: "Current" },
    { dataKey: "projected", color: projectedColor, label: "Projected" },
  ], [projectedColor]);

  const libChartData = useMemo(() => [
    { scenario: "Current", above: result.currentAboveLIB, below: result.currentBelowLIB },
    { scenario: "Projected", above: result.projectedAboveLIB, below: result.projectedBelowLIB },
  ], [result.currentAboveLIB, result.currentBelowLIB, result.projectedAboveLIB, result.projectedBelowLIB]);

  const libChartKeys = useMemo(() => [
    { dataKey: "above", color: LIB_COLORS.above, label: "Above LIB" },
    { dataKey: "below", color: LIB_COLORS.below, label: "Below LIB" },
  ], []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar"
    >
      {/* ── Collapsible Slider Panel ── */}
      <div className="shrink-0 mb-2">
        {/* Toggle bar */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSlidersOpen(!slidersOpen)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSlidersOpen(!slidersOpen); } }}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all cursor-pointer select-none"
          style={{
            background: hasChanges
              ? "linear-gradient(135deg, rgba(0,161,125,0.12) 0%, rgba(0,123,255,0.08) 100%)"
              : "var(--card-bg)",
            border: `1px solid ${hasChanges ? "rgba(0,161,125,0.25)" : "var(--card-border)"}`,
          }}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} style={{ color: hasChanges ? "var(--color-accent)" : "var(--text-tertiary)" }} />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {slidersOpen ? "Scenario Parameters" : "Adjust Parameters"}
            </span>
            {/* Methodology info button — sits in the header, opens modal */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowMethodology(true); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
              title="View methodology & sources"
            >
              <Info size={11} className="text-[var(--text-tertiary)]" />
              <span className="text-[9px] text-[var(--text-tertiary)] underline underline-offset-2">Methodology</span>
            </button>
            {/* Active changes chips (shown when collapsed) */}
            {!slidersOpen && activeChanges.length > 0 && (
              <div className="flex items-center gap-1 ml-2 flex-wrap">
                {activeChanges.slice(0, 5).map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                    style={{ background: `${c.color}18`, color: c.color }}
                  >
                    {c.label} {c.value}
                  </span>
                ))}
                {activeChanges.length > 5 && (
                  <span className="text-[9px] text-[var(--text-tertiary)]">
                    +{activeChanges.length - 5} more
                  </span>
                )}
              </div>
            )}
            {!slidersOpen && activeChanges.length === 0 && (
              <span className="text-[10px] text-[var(--text-tertiary)] ml-1">Click to set scenario</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={(e) => { e.stopPropagation(); resetAll(); }}
                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer px-2 py-0.5 rounded hover:bg-[var(--card-bg-hover)] transition-colors"
              >
                <RotateCcw size={10} />
                Reset
              </button>
            )}
            <motion.div
              animate={{ rotate: slidersOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
            </motion.div>
          </div>
        </div>

        {/* Slider groups — collapsible */}
        <AnimatePresence>
          {slidersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="rounded-xl pt-2 pb-1 px-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-0">
                  {/* Crop Prices */}
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--card-border)] pb-1 mb-0.5">
                      Crop Prices
                    </h4>
                    {CROPS.map((crop) => (
                      <SliderRow
                        key={crop}
                        label={CROP_NAMES[crop]}
                        value={cropPrices[crop]}
                        onChange={(v) => updateCropPrice(crop, v)}
                        min={-50}
                        max={100}
                        step={5}
                        color={CROP_COLORS[crop]}
                      />
                    ))}
                  </div>

                  {/* Crop Yields — per-crop yield sliders */}
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--card-border)] pb-1 mb-0.5">
                      Crop Yields
                    </h4>
                    {CROPS.map((crop) => (
                      <SliderRow
                        key={`yield-${crop}`}
                        label={CROP_NAMES[crop]}
                        value={yieldChanges[crop]}
                        onChange={(v) => updateYieldChange(crop, v)}
                        min={-50}
                        max={100}
                        step={5}
                        color={CROP_COLORS[crop]}
                      />
                    ))}
                  </div>

                  {/* Livelihood & Land Factors */}
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--card-border)] pb-1 mb-0.5">
                      Livelihood & Land
                    </h4>
                    <SliderRow label="Acreage" value={acreageChange} onChange={setAcreageChange} min={-50} max={100} step={5} color="#6F42C1" />
                    <SliderRow label="Finance" value={financialAccessChange} onChange={setFinancialAccessChange} min={-50} max={100} step={5} color="#007BFF" />
                    <SliderRow label="Training" value={trainingChange} onChange={setTrainingChange} min={-50} max={100} step={5} color="#00CCCC" />
                    <SliderRow label="Safety Net" value={safetyNetChange} onChange={setSafetyNetChange} min={-50} max={100} step={5} color="#FFB703" />
                    <SliderRow label="Off-Farm" value={offFarmChange} onChange={setOffFarmChange} min={-50} max={100} step={5} color="#219EBC" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Results Section — always visible ── */}
      <div className="space-y-2">
        {/* Key metrics — single row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
          <MetricCard
            label="Average Income"
            current={result.currentAvgIncome}
            projected={result.projectedAvgIncome}
            formatter={(n) => formatUSD(n)}
          />
          <MetricCard
            label="Median Income"
            current={result.currentMedianIncome}
            projected={result.projectedMedianIncome}
            formatter={(n) => formatUSD(n)}
          />
          <MetricCard
            label="Above Living Income"
            current={result.currentAboveLIB}
            projected={result.projectedAboveLIB}
            formatter={(n) => Math.round(n).toLocaleString()}
          />
          <MetricCard
            label="Below Living Income"
            current={result.currentBelowLIB}
            projected={result.projectedBelowLIB}
            formatter={(n) => Math.round(n).toLocaleString()}
            invert
          />
        </div>

        {/* Charts — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* Income Projection Chart */}
          <div className="brand-card p-2 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Income Projection
              </h4>
              <button
                onClick={() => setExpandedChart("income")}
                className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                title="Expand chart"
              >
                <Maximize2 size={12} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>
            <MiniGroupedBarChart
              data={incomeChartData}
              keys={incomeChartKeys}
              nameKey="metric"
              height={130}
              tooltipTitle="Income Projection"
              tooltipFormatter={(v) => formatUSD(v)}
            />
            <ChartLegend items={[
              { label: "Current", color: "#17A2B8" },
              { label: "Projected", color: projectedColor },
            ]} />
          </div>

          {/* Living Income Benchmark Chart */}
          <div className="brand-card p-2 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Living Income Benchmark
              </h4>
              <button
                onClick={() => setExpandedChart("lib")}
                className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                title="Expand chart"
              >
                <Maximize2 size={12} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>
            <MiniGroupedBarChart
              data={libChartData}
              keys={libChartKeys}
              nameKey="scenario"
              height={130}
              tooltipTitle="Living Income Status"
              tooltipFormatter={(v) => Math.round(v).toLocaleString()}
              tooltipUnit="farmers"
            />
            <ChartLegend items={[
              { label: "Above LIB", color: LIB_COLORS.above },
              { label: "Below LIB", color: LIB_COLORS.below },
            ]} />
          </div>
        </div>

        {/* Impact Breakdown — compact (only when changes are active) */}
        {hasChanges && result.breakdown.length > 0 && (
          <div className="brand-card p-2 rounded-xl">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              Impact Breakdown
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
              {result.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-[var(--card-border)] last:border-0">
                  <span className="text-[11px] text-[var(--text-secondary)]">{item.label}</span>
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{ color: item.changePercent > 0 ? "var(--color-accent)" : item.changePercent < 0 ? "var(--color-negative)" : "var(--text-tertiary)" }}
                  >
                    {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

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
              className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
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
                  className="p-1.5 rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors"
                >
                  <X size={16} className="text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  All effects are <strong className="text-[var(--text-primary)]">additive</strong> from baseline — no compounding between parameters.
                  Intervention elasticities are conservative estimates derived from peer-reviewed RCTs
                  and scaled below observed correlations to account for selection bias.
                </p>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "var(--card-bg)" }}>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Parameter</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Elasticity</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Max Effect</th>
                        <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {METHODOLOGY.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--card-border)]">
                          <td className="py-2 px-3 text-[var(--text-primary)] font-medium">{row.parameter}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-mono">{row.elasticity}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)] font-mono">{row.maxEffect}</td>
                          <td className="py-2 px-3">
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
                    <strong className="text-[var(--text-secondary)]">Targeting:</strong> Intervention effects are stronger for farmers
                    who currently lack access. For example, training expansion benefits untrained farmers (×1.0) more
                    than already-trained farmers (×0.25).
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Negative incomes:</strong> Farmers with negative net income
                    use absolute income as the base so interventions improve (not worsen) their projected outcome.
                  </p>
                  <p>
                    <strong className="text-[var(--text-secondary)]">Crop share:</strong> Yield effects are applied to each farmer's
                    actual crop income rather than a fixed percentage, computed from individual crop-level data.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded Chart Modals ── */}
      <ChartExpandModal
        open={expandedChart === "income"}
        onClose={() => setExpandedChart(null)}
        title="Income Projection"
      >
        <MiniGroupedBarChart
          data={incomeChartData}
          keys={incomeChartKeys}
          nameKey="metric"
          height={400}
          tooltipTitle="Income Projection"
          tooltipFormatter={(v) => formatUSD(v)}
        />
        <ChartLegend items={[
          { label: "Current", color: "#17A2B8" },
          { label: "Projected", color: projectedColor },
        ]} />
      </ChartExpandModal>

      <ChartExpandModal
        open={expandedChart === "lib"}
        onClose={() => setExpandedChart(null)}
        title="Living Income Benchmark"
      >
        <MiniGroupedBarChart
          data={libChartData}
          keys={libChartKeys}
          nameKey="scenario"
          height={400}
          tooltipTitle="Living Income Status"
          tooltipFormatter={(v) => Math.round(v).toLocaleString()}
          tooltipUnit="farmers"
        />
        <ChartLegend items={[
          { label: "Above LIB", color: LIB_COLORS.above },
          { label: "Below LIB", color: LIB_COLORS.below },
        ]} />
      </ChartExpandModal>

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
        }
        .scenario-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          border: 2px solid rgba(255,255,255,0.5);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .scenario-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          border: 2px solid rgba(255,255,255,0.5);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
      ` }} />
    </motion.div>
  );
}
