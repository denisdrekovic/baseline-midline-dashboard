"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, RotateCcw, Lock } from "lucide-react";
import {
  clearAnchorOverride,
  readCurrentAnchor,
  readDefaultAnchorsFile,
  writeAnchorOverride,
} from "@/lib/utils/libProgramStorage";
import type { BenchmarkAnchor } from "@/lib/data/lib-program-types";

export default function BenchmarkAnchorPanel({
  onAnchorChange,
}: {
  onAnchorChange?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  const anchor = useMemo(() => readCurrentAnchor(), [tick]);
  const file = useMemo(() => readDefaultAnchorsFile(), []);
  const fileAnchor = file.anchors.find((a) => a.id === file.currentAnchorId)!;
  const isOverridden = anchor.id === fileAnchor.id
    ? anchor.anchorCpi !== fileAnchor.anchorCpi
      || anchor.anchorLibUsd !== fileAnchor.anchorLibUsd
      || anchor.anchorLibInr !== fileAnchor.anchorLibInr
    : true;

  const [draft, setDraft] = useState<BenchmarkAnchor>(anchor);
  const [editing, setEditing] = useState(false);

  function startEditing() {
    setDraft(anchor);
    setEditing(true);
  }

  function saveOverride() {
    if (!window.confirm(
      "Replacing the anchor will rebase all future Annual Locks against the new LIB value and CPI. This should only be done after a new Living Income Benchmark study completes. Continue?"
    )) return;
    writeAnchorOverride(draft);
    setEditing(false);
    setTick((t) => t + 1);
    onAnchorChange?.();
  }

  function resetToFile() {
    if (!window.confirm("Revert to the Oct 2022 anchor from benchmark-anchors.json?")) return;
    clearAnchorOverride();
    setEditing(false);
    setTick((t) => t + 1);
    onAnchorChange?.();
  }

  return (
    <div className="brand-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[var(--card-bg-hover)] transition"
      >
        <div
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(42, 16, 85, 0.08)" }}
        >
          <Lock size={13} style={{ color: "var(--color-brand-deep-purple)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Benchmark Anchor
            </span>
            {isOverridden && (
              <span
                className="text-[8px] uppercase tracking-wider font-semibold px-1.5 py-px rounded"
                style={{ background: "var(--color-brand-light-gold)", color: "var(--color-brand-gold)" }}
              >
                Override
              </span>
            )}
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)] mt-0.5 truncate">
            {anchor.studyLabel}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono tabular-nums">
            ${anchor.anchorLibUsd.toLocaleString()} · ₹{anchor.anchorLibInr.toLocaleString()} · CPI {anchor.anchorCpi} · Aug
          </div>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronDown size={14} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--card-border)] p-4 space-y-4">
          <div className="flex items-start gap-2 text-[11px] text-[var(--text-tertiary)] bg-[var(--color-brand-light-purple)]/30 rounded-lg p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-brand-gold)]" />
            <span>
              The Benchmark Anchor is the baseline LIB value and CPI from a primary Living Income study. It changes only when a new benchmark study completes (next planned: 2026). All Annual Locks inflate from this anchor.
            </span>
          </div>

          {!editing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <ReadField label="Study" value={anchor.studyLabel} />
              <ReadField label="Study date" value={anchor.studyDate} />
              <ReadField label="Country" value={anchor.country} />
              <ReadField label="LIB (USD)" value={`$${anchor.anchorLibUsd.toLocaleString()}`} />
              <ReadField label="LIB (INR)" value={`₹${anchor.anchorLibInr.toLocaleString()}`} />
              <ReadField label="Anchor CPI" value={String(anchor.anchorCpi)} />
              <ReadField label="Reference month" value={monthName(anchor.referenceMonth)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <EditField label="Study label" value={draft.studyLabel} onChange={(v) => setDraft({ ...draft, studyLabel: v })} />
              <EditField label="Study date (YYYY-MM)" value={draft.studyDate} onChange={(v) => setDraft({ ...draft, studyDate: v })} />
              <EditNum label="LIB (USD)" value={draft.anchorLibUsd} onChange={(v) => setDraft({ ...draft, anchorLibUsd: v })} />
              <EditNum label="LIB (INR)" value={draft.anchorLibInr} onChange={(v) => setDraft({ ...draft, anchorLibInr: v })} />
              <EditNum label="Anchor CPI" value={draft.anchorCpi} step={0.1} onChange={(v) => setDraft({ ...draft, anchorCpi: v })} />
              <EditNum label="Reference month (1-12)" value={draft.referenceMonth} step={1} onChange={(v) => setDraft({ ...draft, referenceMonth: Math.min(12, Math.max(1, Math.round(v))) })} />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--card-border)]">
            {!editing ? (
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--color-brand-plum)] text-white hover:opacity-90"
              >
                Replace anchor (new LIB study)
              </button>
            ) : (
              <>
                <button
                  onClick={saveOverride}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--color-brand-green)] text-white"
                >
                  Save new anchor
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[var(--text-secondary)] border border-[var(--card-border)]"
                >
                  Cancel
                </button>
              </>
            )}
            {isOverridden && !editing && (
              <button
                onClick={resetToFile}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-[var(--card-border)]"
              >
                <RotateCcw size={11} /> Revert to file default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function monthName(m: number) {
  return ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m] || `Month ${m}`;
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="text-sm text-[var(--text-primary)] mt-0.5">{value}</div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[var(--text-tertiary)] mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition focus:ring-2 focus:ring-[var(--color-brand-plum)]/30 focus:border-[var(--color-brand-plum)]"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
      />
    </label>
  );
}

function EditNum({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[var(--text-tertiary)] mb-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="no-spin w-full px-3 py-2 rounded-lg text-sm font-mono outline-none transition focus:ring-2 focus:ring-[var(--color-brand-plum)]/30 focus:border-[var(--color-brand-plum)]"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
      />
    </label>
  );
}
