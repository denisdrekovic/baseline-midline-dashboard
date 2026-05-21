"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Lock, FileText } from "lucide-react";
import AnnualLockForm from "@/components/analytics/AnnualLockForm";
import BenchmarkAnchorPanel from "@/components/analytics/BenchmarkAnchorPanel";
import { readLocks } from "@/lib/utils/libProgramStorage";
import type { AnnualLock } from "@/lib/data/lib-program-types";

export default function LIBSetupPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-5xl mx-auto py-6 pb-24 space-y-5">
      <header className="space-y-3">
        <Link
          href="/lib-calculator"
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft size={11} /> Back to Calculator
        </Link>
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0, 161, 125, 0.12)" }}
          >
            <Lock size={16} style={{ color: "var(--color-brand-green)" }} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">
              LIB Calculator — Setup
            </h1>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-1 max-w-2xl leading-relaxed">
              Once a year, after Tanager delivers the updated CPI and cohort survey numbers, lock the values here.
              The Calculator projects forward from the latest lock.
            </p>
          </div>
        </div>
      </header>

      <BenchmarkAnchorPanel onAnchorChange={() => setRefreshKey((k) => k + 1)} />

      <div className="brand-card rounded-2xl p-5">
        <AnnualLockForm refreshKey={refreshKey} onLocked={() => setRefreshKey((k) => k + 1)} />
      </div>

      <LockHistory refreshKey={refreshKey} />
    </div>
  );
}

function LockHistory({ refreshKey }: { refreshKey: number }) {
  const [locks, setLocks] = useState<AnnualLock[]>([]);

  useEffect(() => {
    setLocks(readLocks());
  }, [refreshKey]);

  if (locks.length === 0) {
    return (
      <div className="brand-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(109, 106, 106, 0.1)" }}
        >
          <FileText size={14} className="text-[var(--text-tertiary)]" />
        </div>
        <div className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
          No years locked yet. Once you lock a year above, it&apos;ll appear here and the Calculator will rebase to it.
        </div>
      </div>
    );
  }

  return (
    <div className="brand-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(0, 161, 125, 0.12)" }}
        >
          <History size={12} style={{ color: "var(--color-brand-green)" }} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Lock history · {locks.length} {locks.length === 1 ? "year" : "years"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {locks.slice().reverse().map((l) => (
          <LockHistoryCard key={l.lockedYear} lock={l} />
        ))}
      </div>
    </div>
  );
}

function LockHistoryCard({ lock }: { lock: AnnualLock }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums font-mono">{lock.lockedYear}</span>
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
          {new Date(lock.lockedAt).toLocaleDateString()}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <Row label="LIB" value={`$${lock.computedLibUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} · ₹${lock.computedLibInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Row label="Program" value={`${(lock.programWeightedPercentAboveLib * 100).toFixed(2)}% at/above`} />
        <Row label="Non-Program" value={`${(lock.cohortPercentsAboveLib.control * 100).toFixed(2)}% at/above`} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-secondary)] font-mono tabular-nums text-right">{value}</span>
    </div>
  );
}
