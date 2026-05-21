"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Lock, FileText, ListChecks } from "lucide-react";
import AnnualLockForm from "@/components/analytics/AnnualLockForm";
import BenchmarkAnchorPanel from "@/components/analytics/BenchmarkAnchorPanel";
import { readLocks } from "@/lib/utils/libProgramStorage";
import type { AnnualLock } from "@/lib/data/lib-program-types";

export default function LIBSetupPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-5xl mx-auto py-6 pb-24 space-y-6">
      <header className="space-y-3">
        <Link
          href="/lib-calculator"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft size={12} /> Back to Calculator
        </Link>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-[var(--color-brand-light-green)] flex items-center justify-center">
            <Lock size={20} className="text-[var(--color-brand-green)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              LIB Calculator — Setup
            </h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-2xl leading-relaxed">
              Once a year, after Tanager delivers the updated CPI and cohort survey numbers, lock the values here.
              The Calculator projects forward from the latest lock.
            </p>
          </div>
        </div>
      </header>

      <BenchmarkAnchorPanel onAnchorChange={() => setRefreshKey((k) => k + 1)} />

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-[var(--card-border)] flex items-center gap-2">
          <ListChecks size={14} className="text-[var(--color-brand-plum)]" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-brand-plum)]">
            Annual Lock
          </span>
        </div>
        <div className="p-6">
          <AnnualLockForm refreshKey={refreshKey} onLocked={() => setRefreshKey((k) => k + 1)} />
        </div>
      </section>

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
      <div className="rounded-2xl border border-dashed border-[var(--card-border)] px-6 py-5 flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--card-bg)] flex items-center justify-center">
          <FileText size={14} className="text-[var(--text-tertiary)]" />
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          No years locked yet. Once you lock a year above, it&apos;ll appear here and the Calculator will rebase to it.
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--card-border)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--card-border)] flex items-center gap-2 bg-[var(--card-bg)]/30">
        <History size={12} className="text-[var(--text-tertiary)]" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">
          Lock history · {locks.length} {locks.length === 1 ? "year" : "years"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        {locks.slice().reverse().map((l) => (
          <div key={l.lockedYear} className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{l.lockedYear}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {new Date(l.lockedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <Row label="LIB (USD)" value={`$${l.computedLibUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <Row label="LIB (INR)" value={`₹${l.computedLibInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <Row label="Program" value={`${(l.programWeightedPercentAboveLib * 100).toFixed(2)}% at/above`} />
              <Row label="Control" value={`${(l.cohortPercentsAboveLib.control * 100).toFixed(2)}% at/above`} />
            </div>
          </div>
        ))}
      </div>
    </section>
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
