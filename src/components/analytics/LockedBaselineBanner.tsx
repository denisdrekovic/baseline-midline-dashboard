"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Settings2, AlertCircle } from "lucide-react";
import { readCurrentAnchor, readLatestLock } from "@/lib/utils/libProgramStorage";
import type { AnnualLock, BenchmarkAnchor } from "@/lib/data/lib-program-types";

export default function LockedBaselineBanner() {
  const [lock, setLock] = useState<AnnualLock | undefined>();
  const [anchor, setAnchor] = useState<BenchmarkAnchor | undefined>();

  useEffect(() => {
    setLock(readLatestLock());
    setAnchor(readCurrentAnchor());
  }, []);

  if (!anchor) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-xs">
      {lock ? (
        <>
          <Lock size={14} className="text-[var(--color-brand-green)] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)]">
              Locked baseline · {lock.lockedYear}
            </div>
            <div className="text-[var(--text-tertiary)] truncate">
              LIB ${lock.computedLibUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} /
              ₹{lock.computedLibInr.toLocaleString(undefined, { maximumFractionDigits: 0 })} ·
              Program {(lock.programWeightedPercentAboveLib * 100).toFixed(2)}% at/above ·
              Control {(lock.cohortPercentsAboveLib.control * 100).toFixed(2)}%
            </div>
          </div>
        </>
      ) : (
        <>
          <AlertCircle size={14} className="text-[var(--color-brand-gold)] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)]">
              No annual lock set
            </div>
            <div className="text-[var(--text-tertiary)] truncate">
              Anchor: {anchor.studyLabel} · ${anchor.anchorLibUsd.toLocaleString()} / ₹{anchor.anchorLibInr.toLocaleString()}
            </div>
          </div>
        </>
      )}
      <Link
        href="/lib-calculator/setup"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--card-border)] shrink-0"
        title="Open the annual lock setup"
      >
        <Settings2 size={11} /> Setup
      </Link>
    </div>
  );
}
