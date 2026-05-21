"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import AnnualLockForm from "@/components/analytics/AnnualLockForm";
import BenchmarkAnchorPanel from "@/components/analytics/BenchmarkAnchorPanel";
import { readLocks } from "@/lib/utils/libProgramStorage";

export default function LIBSetupPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/lib-calculator"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-2"
          >
            <ArrowLeft size={12} /> Back to Calculator
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            LIB Calculator — Setup
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-2xl">
            Set the year&apos;s locked Living Income Benchmark and % of farmers at/above it. The Calculator uses
            the latest lock as its projection baseline.
          </p>
        </div>
      </div>

      <BenchmarkAnchorPanel onAnchorChange={() => setRefreshKey((k) => k + 1)} />

      <div className="brand-card rounded-2xl p-6">
        <AnnualLockForm refreshKey={refreshKey} onLocked={() => setRefreshKey((k) => k + 1)} />
      </div>

      <LockHistory refreshKey={refreshKey} />
    </div>
  );
}

function LockHistory({ refreshKey }: { refreshKey: number }) {
  const locks = (() => {
    if (typeof window === "undefined") return [];
    return readLocks();
  })();
  void refreshKey;

  if (locks.length === 0) {
    return (
      <div className="text-xs text-[var(--text-tertiary)] italic px-2">
        No years locked yet. Lock the first year above to begin.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--card-border)] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
        <History size={12} /> Lock history
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {locks.slice().reverse().map((l) => (
          <div key={l.lockedYear} className="rounded-lg p-3 bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-[var(--text-primary)]">{l.lockedYear}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {new Date(l.lockedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
              <div>LIB: ${l.computedLibUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ₹{l.computedLibInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div>Program: {(l.programWeightedPercentAboveLib * 100).toFixed(2)}% at/above</div>
              <div>Control: {(l.cohortPercentsAboveLib.control * 100).toFixed(2)}% at/above</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
