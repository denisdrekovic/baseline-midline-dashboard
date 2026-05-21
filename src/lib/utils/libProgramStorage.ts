"use client";

import { useEffect, useState } from "react";
import type {
  AnnualLock,
  BenchmarkAnchor,
  BenchmarkAnchorsFile,
} from "@/lib/data/lib-program-types";
import anchorsFile from "@/data/lib-program/benchmark-anchors.json";

const LOCKS_KEY = "lib-program:annual-locks";
const ANCHOR_OVERRIDE_KEY = "lib-program:anchor-override";

export function readDefaultAnchorsFile(): BenchmarkAnchorsFile {
  return anchorsFile as BenchmarkAnchorsFile;
}

export function readCurrentAnchor(): BenchmarkAnchor {
  if (typeof window !== "undefined") {
    const override = window.localStorage.getItem(ANCHOR_OVERRIDE_KEY);
    if (override) {
      try {
        return JSON.parse(override) as BenchmarkAnchor;
      } catch {
        // fall through to file
      }
    }
  }
  const file = readDefaultAnchorsFile();
  const current = file.anchors.find((a) => a.id === file.currentAnchorId);
  if (!current) {
    throw new Error("benchmark-anchors.json: currentAnchorId not found");
  }
  return current;
}

export function writeAnchorOverride(anchor: BenchmarkAnchor): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANCHOR_OVERRIDE_KEY, JSON.stringify(anchor));
}

export function clearAnchorOverride(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ANCHOR_OVERRIDE_KEY);
}

export function readLocks(): AnnualLock[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AnnualLock[];
  } catch {
    return [];
  }
}

export function readLockForYear(year: number): AnnualLock | undefined {
  return readLocks().find((l) => l.lockedYear === year);
}

export function readLatestLock(): AnnualLock | undefined {
  const locks = readLocks();
  if (locks.length === 0) return undefined;
  return locks.reduce((latest, l) => (l.lockedYear > latest.lockedYear ? l : latest));
}

export function writeLock(lock: AnnualLock): void {
  if (typeof window === "undefined") return;
  const locks = readLocks().filter((l) => l.lockedYear !== lock.lockedYear);
  locks.push(lock);
  locks.sort((a, b) => a.lockedYear - b.lockedYear);
  window.localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
}

export function deleteLock(year: number): void {
  if (typeof window === "undefined") return;
  const locks = readLocks().filter((l) => l.lockedYear !== year);
  window.localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
}

export function useLatestLockedAnchor(): { year: number; lib: number } | undefined {
  const [state, setState] = useState<{ year: number; lib: number } | undefined>();

  useEffect(() => {
    const refresh = () => {
      const latest = readLatestLock();
      if (latest) setState({ year: latest.lockedYear, lib: latest.computedLibUsd });
      else setState(undefined);
    };
    refresh();
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCKS_KEY) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return state;
}

export function downloadJson(data: unknown, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
