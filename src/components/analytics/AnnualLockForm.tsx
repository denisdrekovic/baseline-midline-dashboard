"use client";

import { useMemo, useState } from "react";
import { Lock, Calculator, Download, AlertCircle, Check, RotateCcw } from "lucide-react";
import {
  buildAnnualLock,
  computeAnnualLock,
} from "@/lib/utils/libAnnualLock";
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
  control: "Control (Pathway 3 proxy)",
  t1Survey: "T1 Program Survey",
  t2Survey: "T2 Program Survey",
};

const FALLBACK_DEFAULTS: AnnualLockInputs = {
  lockedYear: new Date().getFullYear(),
  referenceCpi: 197,
  cohortPercentsAboveLib: { control: 0.0395, t1Survey: 0.1357, t2Survey: 0.65 },
  programPopulations: { t1Full: 23875, t2Full: 3040 },
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
      return latest ? latest.lockedYear + 1 : new Date().getFullYear();
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
    return { ...FALLBACK_DEFAULTS, lockedYear: targetYear };
  }, [initialYear, refreshKey]);

  const [inputs, setInputs] = useState<AnnualLockInputs>(startingInputs);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [existingLock, setExistingLock] = useState<AnnualLock | undefined>(() =>
    readLockForYear(startingInputs.lockedYear),
  );
  const [justLocked, setJustLocked] = useState(false);

  const isLocked = Boolean(existingLock) && !justLocked;

  const computed = useMemo(() => computeAnnualLock(anchor, inputs), [anchor, inputs]);

  function handleCalculate() {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Annual LIB Lock
          </h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Anchored to {anchor.studyLabel} · LIB(anchor) = {fmtUsd(anchor.anchorLibUsd)} / {fmtInr(anchor.anchorLibInr)} · CPI(anchor) = {anchor.anchorCpi}
          </p>
        </div>
        {isLocked && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-brand-light-green)] text-[var(--color-brand-green)] text-xs font-semibold">
            <Lock size={12} /> Locked {new Date(existingLock!.lockedAt).toLocaleDateString()}
          </div>
        )}
        {justLocked && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-brand-light-green)] text-[var(--color-brand-green)] text-xs font-semibold">
            <Check size={12} /> Just locked
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label={`Refresh Year`}
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
          label={`Reference CPI (August ${inputs.lockedYear}, India)`}
          unit="index"
          value={inputs.referenceCpi}
          step={0.1}
          locked={isLocked}
          onChange={(v) => setInputs((p) => ({ ...p, referenceCpi: v }))}
        />
      </div>

      <Section title="% at/above LIB — by cohort">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      </Section>

      <Section title="Full program population counts">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </Section>

      {!isLocked && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCalculate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-plum)] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            <Calculator size={14} /> Calculate
          </button>
          {previewVisible && (
            <button
              onClick={handleSubmitLock}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-green)] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              <Lock size={14} /> Submit &amp; Lock {inputs.lockedYear}
            </button>
          )}
        </div>
      )}

      {(previewVisible || isLocked) && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {isLocked ? "Locked values" : "Preview"} — {inputs.lockedYear}
            </h3>
            {isLocked && (
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--card-border)]"
                  title="Download this lock as JSON to commit to the repo"
                >
                  <Download size={11} /> Export JSON
                </button>
                <button
                  onClick={handleUnlock}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--card-border)]"
                  title="Delete this year's lock to re-enter values"
                >
                  <RotateCcw size={11} /> Unlock
                </button>
                <button
                  onClick={handleStartNextYear}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--color-brand-plum)] text-white"
                >
                  Start {inputs.lockedYear + 1} Lock
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Stat label={`LIB ${inputs.lockedYear} (USD)`} value={fmtUsd(computed.computedLibUsd)} highlight />
            <Stat label={`LIB ${inputs.lockedYear} (INR)`} value={fmtInr(computed.computedLibInr)} highlight />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat
              label="Control % at/above"
              value={fmtPct(inputs.cohortPercentsAboveLib.control)}
              sub={`(survey-based, not population-scaled)`}
            />
            <Stat
              label="T1 above (scaled)"
              value={fmtCount(computed.cohortHeadcountsAboveLib.t1Survey)}
              sub={`of ${fmtCount(inputs.programPopulations.t1Full)}`}
            />
            <Stat
              label="T2 above (scaled)"
              value={fmtCount(computed.cohortHeadcountsAboveLib.t2Survey)}
              sub={`of ${fmtCount(inputs.programPopulations.t2Full)}`}
            />
          </div>

          <div className="rounded-lg bg-[var(--color-brand-light-purple)] p-3">
            <div className="text-[11px] text-[var(--color-brand-deep-purple)] font-semibold uppercase tracking-wide mb-1">
              Program-wide
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[var(--color-brand-deep-purple)]">
                {fmtPct(computed.programWeightedPercentAboveLib)}
              </span>
              <span className="text-xs text-[var(--color-brand-deep-purple)]/70">
                ({fmtCount(computed.programTotalAboveLib)} / {fmtCount(computed.programTotalPopulation)} farmers at/above LIB)
              </span>
            </div>
          </div>

          {!isLocked && (
            <div className="flex items-start gap-2 text-[11px] text-[var(--text-tertiary)]">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {title}
      </h3>
      {children}
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
  return (
    <label className="block">
      <span className="block text-[11px] text-[var(--text-tertiary)] mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step}
          value={value}
          disabled={locked}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none disabled:opacity-60"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            color: "var(--text-primary)",
          }}
        />
        {unit && (
          <span className="text-[11px] text-[var(--text-tertiary)] w-14 shrink-0">{unit}</span>
        )}
      </div>
    </label>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg p-3 bg-[var(--card-bg)] border border-[var(--card-border)]">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </div>
      <div
        className={`mt-0.5 font-bold ${highlight ? "text-[var(--color-brand-green)] text-xl" : "text-[var(--text-primary)] text-lg"}`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}
