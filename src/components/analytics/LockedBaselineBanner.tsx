"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, SlidersHorizontal } from "lucide-react";
import { readCurrentAnchor, readLatestLock } from "@/lib/utils/libProgramStorage";
import type { AnnualLock, BenchmarkAnchor } from "@/lib/data/lib-program-types";

export default function LockedBaselineBanner() {
  const [lock, setLock] = useState<AnnualLock | undefined>();
  const [anchor, setAnchor] = useState<BenchmarkAnchor | undefined>();

  useEffect(() => {
    setLock(readLatestLock());
    setAnchor(readCurrentAnchor());
    const refresh = () => {
      setLock(readLatestLock());
      setAnchor(readCurrentAnchor());
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!anchor) return null;

  if (!lock) {
    return (
      <Link
        href="/lib-calculator/setup"
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] transition"
        title="Set the year's annual LIB lock"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] group-hover:bg-[var(--color-brand-gold)] transition" />
        <span>No annual lock</span>
        <span className="text-[var(--text-tertiary)]/60">·</span>
        <span className="inline-flex items-center gap-1 text-[var(--color-brand-plum)] font-semibold">
          <SlidersHorizontal size={11} /> Set lock
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/lib-calculator/setup"
      className="group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[var(--color-brand-light-green)]/60 hover:bg-[var(--color-brand-light-green)] border border-[var(--color-brand-green)]/20 transition"
      title="View or update the annual lock"
    >
      <Lock size={12} className="text-[var(--color-brand-green)]" />
      <span className="text-[11px] font-semibold text-[var(--color-brand-green)] tabular-nums">
        {lock.lockedYear}
      </span>
      <span className="text-[var(--color-brand-green)]/40">·</span>
      <span className="text-[11px] text-[var(--color-brand-green)] tabular-nums">
        LIB ${Math.round(lock.computedLibUsd).toLocaleString()}
      </span>
      <span className="text-[var(--color-brand-green)]/40">·</span>
      <span className="text-[11px] text-[var(--color-brand-green)] tabular-nums">
        {(lock.programWeightedPercentAboveLib * 100).toFixed(1)}% at/above
      </span>
    </Link>
  );
}
