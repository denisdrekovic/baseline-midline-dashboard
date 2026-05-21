"use client";

import { useMemo, useState } from "react";
import { Lock, Calculator, Download, AlertCircle, Check, RotateCcw, Percent, Users, TrendingUp, Layers, Activity } from "lucide-react";
import {
  buildAnnualLock,
  computeAnnualLock,
} from "@/lib/utils/libAnnualLock";
import { BASELINE_YEAR } from "@/lib/utils/libScenarioEngine";
import {
  downloadJson,
  readCurrentAnchor,
  readLatestLock,
  readLockForYear,
  writeLock,
  deleteLock,
} from "@/lib/utils/libProgramStorage";
import type {
  AnnualLock,
  AnnualLockInputs,
  CohortKey,
} from "@/lib/data/lib-program-types";

const COHORT_LABELS: Record<CohortKey, string> = {
  control: "Non-Program (supply shed)",
  t1Survey: "T1 Program Survey",
  t2Survey: "T2 Program Survey",
};

// First-time defaults — used only when no prior lock exists. Anchored at BASELINE_YEAR
// so Bilal backfills the foundation lock first; CPI and populations stay 0 so the user
// must enter real values rather than accepting stale numbers.
const FIRST_RUN_DEFAULTS: AnnualLockInputs = {
  lockedYear: BASELINE_YEAR,
  referenceCpi: 0,
  cohortPercentsAboveLib: { control: 0, t1Survey: 0, t2Survey: 0 },
  programPopulations: { t1Full: 0, t2Full: 0 },
};

function pctToDisplay(v: number) {
  return (v * 100).toFixed(2);
}
function displayToPct(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : 0;
}
function fmtUsd(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtInr(v: number) {
  return `₹${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(v: number) {
  return `${(v * 100).toFixed(2)}%`;
}
function fmtCount(v: number) {
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function AnnualLockForm({
  initialYear,
  onLocked,
  refreshKey,
}: {
  initialYear?: number;
  onLocked?: (lock: AnnualLock) => void;
  refreshKey?: number;
}) {
  const anchor = useMemo(() => readCurrentAnchor(), [refreshKey]);

  const startingInputs = useMemo<AnnualLockInputs>(() => {
    const targetYear = initialYear ?? (() => {
      const latest = readLatestLock();
      return latest ? latest.lockedYear + 1 : BASELINE_YEAR;
    })();
    const existing = readLockForYear(targetYear);
    if (existing) {
      return {
        lockedYear: existing.lockedYear,
        referenceCpi: existing.referenceCpi,
        cohortPercentsAboveLib: existing.cohortPercentsAboveLib,
        programPopulations: existing.programPopulations,
      };
    }
    const prior = readLatestLock();
    if (prior) {
      return {
        lockedYear: targetYear,
        referenceCpi: prior.referenceCpi,
        cohortPercentsAboveLib: prior.cohortPercentsAboveLib,
        programPopulations: prior.programPopulations,
      };
    }
    return { ...FIRST_RUN_DEFAULTS, lockedYear: targetYear };
  }, [initialYear, refreshKey]);

  const [inputs, setInputs] = useState<AnnualLockInputs>(startingInputs);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [existingLock, setExistingLock] = useState<AnnualLock | undefined>(() =>
    readLockForYear(startingInputs.lockedYear),
  );
  const [justLocked, setJustLocked] = useState(false);

  const isLocked = Boolean(existingLock) && !justLocked;

  const computed = useMemo(() => computeAnnualLock(anchor, inputs), [anchor, inputs]);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!Number.isFinite(inputs.referenceCpi) || inputs.referenceCpi <= 0) {
      errs.push("Reference CPI must be greater than 0.");
    }
    const { t1Full, t2Full } = inputs.programPopulations;
    if (t1Full + t2Full <= 0) {
      errs.push("At least one of T1 or T2 full population must be greater than 0.");
    }
    if (inputs.lockedYear < 2000 || inputs.lockedYear > 2100) {
      errs.push("Refresh Year is out of range.");
    }
    return errs;
  }, [inputs]);

  const canPreview = validationErrors.length === 0;

  function handleCalculate() {
    if (!canPreview) return;
    setPreviewVisible(true);
  }

  function handleSubmitLock() {
    const lock = buildAnnualLock(anchor, inputs);
    writeLock(lock);
    setExistingLock(lock);
    setJustLocked(true);
    onLocked?.(lock);
  }

  function handleUnlock() {
    if (!existingLock) return;
    if (!window.confirm(
      `Unlock ${existingLock.lockedYear}? You'll be able to edit and re-lock the values.`,
    )) return;
    deleteLock(existingLock.lockedYear);
    setExistingLock(undefined);
    setJustLocked(false);
    setPreviewVisible(false);
  }

  function handleStartNextYear() {
    const next = inputs.lockedYear + 1;
    setInputs({ ...inputs, lockedYear: next });
    setExistingLock(readLockForYear(next));
    setJustLocked(false);
    setPreviewVisible(false);
  }

  function handleExport() {
    if (!existingLock) return;
    downloadJson(existingLock, `lib-annual-lock-${existingLock.lockedYear}.json`);
  }

  const setCohort = (key: CohortKey, value: number) =>
    setInputs((p) => ({
      ...p,
      cohortPercentsAboveLib: { ...p.cohortPercentsAboveLib, [key]: value },
    }));

  return (
    <div className="space-y-5">
      {/* Header: section title + anchor caption + lock badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(145, 13, 99, 0.12)" }}
          >
            <Activity size={13} style={{ color: "var(--color-brand-plum)" }} />
          </div>
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Annual Lock
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Anchored to {anchor.studyLabel} · {fmtUsd(anchor.anchorLibUsd)} / {fmtInr(anchor.anchorLibInr)} · CPI {anchor.anchorCpi}
            </p>
          </div>
        </div>
        {isLocked && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-brand-light-green)] text-[var(--color-brand-green)] text-[10px] font-semibold shrink-0">
            <Lock size={10} /> Locked {new Date(existingLock!.lockedAt).toLocaleDateString()}
          </div>
        )}
        {justLocked && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-brand-light-green)] text-[var(--color-brand-green)] text-[10px] font-semibold shrink-0">
            <Check size={10} /> Just locked
          </div>
        )}
      </div>

      {/* Year + CPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field
          label="Refresh Year"
          unit=""
          value={inputs.lockedYear}
          step={1}
          locked={isLocked}
          onChange={(v) => {
            setInputs((p) => ({ ...p, lockedYear: Math.round(v) }));
            setExistingLock(readLockForYear(Math.round(v)));
            setJustLocked(false);
            setPreviewVisible(false);
          }}
        />
        <Field
          label={`Reference CPI · Aug ${inputs.lockedYear}, India`}
          unit="index"
          value={inputs.referenceCpi}
          step={0.1}
          locked={isLocked}
          onChange={(v) => setInputs((p) => ({ ...p, referenceCpi: v }))}
        />
      </div>

      <SectionHeader icon={Percent} title="% at/above LIB — by cohort" color="#007BFF" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 -mt-1">
        {(Object.keys(COHORT_LABELS) as CohortKey[]).map((k) => (
          <Field
            key={k}
            label={COHORT_LABELS[k]}
            unit="%"
            value={Number(pctToDisplay(inputs.cohortPercentsAboveLib[k]))}
            step={0.01}
            locked={isLocked}
            onChange={(v) => setCohort(k, displayToPct(String(v)))}
          />
        ))}
      </div>

      <SectionHeader icon={Users} title="Full program population counts" color="#FFB703" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 -mt-1">
        <Field
          label="T1 full program population"
          unit="farmers"
          value={inputs.programPopulations.t1Full}
          step={1}
          locked={isLocked}
          onChange={(v) =>
            setInputs((p) => ({
              ...p,
              programPopulations: { ...p.programPopulations, t1Full: Math.max(0, Math.round(v)) },
            }))
          }
        />
        <Field
          label="T2 full program population"
          unit="farmers"
          value={inputs.programPopulations.t2Full}
          step={1}
          locked={isLocked}
          onChange={(v) =>
            setInputs((p) => ({
              ...p,
              programPopulations: { ...p.programPopulations, t2Full: Math.max(0, Math.round(v)) },
            }))
          }
        />
      </div>

      {!isLocked && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCalculate}
              disabled={!canPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-plum)] text-white text-[12px] font-semibold transition hover:shadow-[0_6px_20px_rgba(145,13,99,0.25)] hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              title={canPreview ? "Preview the calculated LIB and % at/above" : "Fill in the inputs above first"}
            >
              <Calculator size={13} /> Preview Calculation
            </button>
            {previewVisible && (
              <button
                onClick={handleSubmitLock}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-green)] text-white text-[12px] font-semibold transition hover:shadow-[0_6px_20px_rgba(0,161,125,0.25)] hover:-translate-y-px"
              >
                <Lock size={13} /> Submit &amp; Lock {inputs.lockedYear}
              </button>
            )}
            <span className="text-[10px] text-[var(--text-tertiary)] ml-1">
              Preview doesn&apos;t save. Submit &amp; Lock commits the year.
            </span>
          </div>
          {validationErrors.length > 0 && (
            <div
              className="flex items-start gap-2 rounded-lg p-2.5 mt-1"
              style={{ background: "rgba(255, 192, 0, 0.08)", border: "1px solid rgba(255, 192, 0, 0.25)" }}
            >
              <AlertCircle size={12} className="mt-0.5 shrink-0 text-[var(--color-brand-gold)]" />
              <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5">
                {validationErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {(previewVisible || isLocked) && (
        <div className="brand-card rounded-xl p-4 space-y-3 mt-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0, 161, 125, 0.12)" }}
              >
                <TrendingUp size={12} style={{ color: "var(--color-brand-green)" }} />
              </div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isLocked ? "Locked values" : "Preview"} · {inputs.lockedYear}
              </h3>
            </div>
            {isLocked && (
              <div className="flex gap-1.5">
                <IconButton onClick={handleExport} icon={Download} label="Export JSON" />
                <IconButton onClick={handleUnlock} icon={RotateCcw} label="Unlock" />
                <button
                  onClick={handleStartNextYear}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[var(--color-brand-plum)] text-white hover:shadow-md transition"
                >
                  Start {inputs.lockedYear + 1} Lock
                </button>
              </div>
            )}
          </div>

          {/* Headline LIB stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatCard
              icon={Layers}
              color="var(--color-brand-green)"
              label={`LIB ${inputs.lockedYear} · USD`}
              value={fmtUsd(computed.computedLibUsd)}
            />
            <StatCard
              icon={Layers}
              color="var(--color-brand-green)"
              label={`LIB ${inputs.lockedYear} · INR`}
              value={fmtInr(computed.computedLibInr)}
            />
          </div>

          {/* Per-cohort stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard
              icon={Percent}
              color="#FFB703"
              label="Non-Program % at/above"
              value={fmtPct(inputs.cohortPercentsAboveLib.control)}
              sub="survey-based, not scaled"
            />
            <StatCard
              icon={Users}
              color="#007BFF"
              label="T1 above (scaled)"
              value={fmtCount(computed.cohortHeadcountsAboveLib.t1Survey)}
              sub={`of ${fmtCount(inputs.programPopulations.t1Full)}`}
            />
            <StatCard
              icon={Users}
              color="#6F42C1"
              label="T2 above (scaled)"
              value={fmtCount(computed.cohortHeadcountsAboveLib.t2Survey)}
              sub={`of ${fmtCount(inputs.programPopulations.t2Full)}`}
            />
          </div>

          {/* Program-wide hero */}
          <div
            className="rounded-xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(42, 16, 85, 0.92) 0%, rgba(145, 13, 99, 0.92) 100%)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mb-1">
                  Program-wide · at/above LIB
                </div>
                <div className="text-3xl font-bold text-white font-mono">
                  {fmtPct(computed.programWeightedPercentAboveLib)}
                </div>
              </div>
              <div className="text-[11px] text-white/80 text-right">
                <div>{fmtCount(computed.programTotalAboveLib)} / {fmtCount(computed.programTotalPopulation)}</div>
                <div className="text-white/55 text-[10px]">farmers at/above LIB</div>
              </div>
            </div>
          </div>

          {!isLocked && (
            <div className="flex items-start gap-2 text-[10px] text-[var(--text-tertiary)] leading-relaxed pt-1">
              <AlertCircle size={11} className="mt-0.5 shrink-0" />
              <span>
                Review the numbers. Submit &amp; Lock to commit them as {inputs.lockedYear}&apos;s baseline. The
                projection model will start from these values going forward.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center"
        style={{ background: `${color}1f` }}
      >
        <Icon size={10} style={{ color }} />
      </div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {title}
      </h3>
    </div>
  );
}

function IconButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition"
    >
      <Icon size={10} /> {label}
    </button>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${color}1f` }}>
          <Icon size={10} style={{ color }} />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
          {label}
        </span>
      </div>
      <div className="text-[15px] font-bold font-mono text-[var(--text-primary)] tabular-nums">
        {value}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function Field({
  label,
  unit,
  value,
  step,
  locked,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  locked: boolean;
  onChange: (v: number) => void;
}) {
  const isPlaceholder = value === 0;
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">{label}</span>
      <div className="relative flex items-center">
        <input
          type="number"
          step={step}
          value={value}
          disabled={locked}
          onFocus={(e) => { if (e.target.value === "0") e.target.select(); }}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`no-spin w-full px-3 py-2 rounded-lg text-[13px] font-mono outline-none disabled:opacity-60 transition focus:ring-2 focus:ring-[var(--color-brand-plum)]/25 focus:border-[var(--color-brand-plum)] ${isPlaceholder ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"} ${unit ? "pr-12" : ""}`}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        />
        {unit && (
          <span className="absolute right-3 text-[10px] text-[var(--text-tertiary)] pointer-events-none uppercase tracking-wider">{unit}</span>
        )}
      </div>
    </label>
  );
}
