"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Easing ──────────────────────────────────────────────────────────────────

/** Ease-out cubic: matches AnimatedNumber component pattern */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseAnimatedDataOptions {
  /** Animation duration in ms (default: 800) */
  duration?: number;
  /** Per-field stagger delays in ms, e.g. { "T1 %": 0, "T2 %": 150, "Total %": 300 } */
  fieldDelays?: Record<string, number>;
  /** Set to false to skip animation (a11y / reduced motion). Returns targetData directly. */
  enabled?: boolean;
  /** Increment to force a re-animation from current display state to target */
  key?: number;
}

interface UseAnimatedDataResult<T> {
  /** Smoothly interpolated data to feed into charts */
  displayData: T[];
  /** True while animation is in progress */
  isAnimating: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract numeric values from an array of objects for fast comparison */
function numericFingerprint(data: Record<string, unknown>[]): number[] {
  const nums: number[] = [];
  for (const item of data) {
    for (const val of Object.values(item)) {
      if (typeof val === "number") nums.push(val);
    }
  }
  return nums;
}

/** Fast shallow comparison of two number arrays */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Interpolate a single data point */
function interpolateItem<T extends Record<string, unknown>>(
  start: T,
  target: T,
  fieldDelays: Record<string, number> | undefined,
  elapsed: number,
  duration: number,
): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    const tVal = target[key];
    const sVal = start[key];
    if (typeof tVal === "number" && typeof sVal === "number") {
      // Apply per-field delay if specified
      const delay = fieldDelays?.[key] ?? 0;
      const fieldElapsed = Math.max(0, elapsed - delay);
      const fieldProgress = Math.min(fieldElapsed / duration, 1);
      const eased = easeOutCubic(fieldProgress);
      result[key] = sVal + (tVal - sVal) * eased;
    }
    // Non-numeric fields (string labels etc.) use target value directly
  }
  return result as T;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Smoothly interpolates an array of data objects from their previous values
 * to new target values using requestAnimationFrame + ease-out cubic easing.
 *
 * Designed for driving Recharts with animated data transitions.
 * Non-numeric fields (labels, categories) pass through unchanged.
 * Supports per-field stagger delays for cascading line animations.
 *
 * Compatible with React 18 StrictMode (double-effect invocation).
 *
 * @example
 * const { displayData, isAnimating } = useAnimatedData(chartData, {
 *   duration: 800,
 *   fieldDelays: { "T1 %": 0, "T2 %": 150, "Total %": 300 },
 *   enabled: !prefersReducedMotion,
 *   key: animationKey,
 * });
 */
export function useAnimatedData<T extends Record<string, unknown>>(
  targetData: T[],
  options?: UseAnimatedDataOptions,
): UseAnimatedDataResult<T> {
  const {
    duration = 800,
    fieldDelays,
    enabled = true,
    key = 0,
  } = options ?? {};

  const [displayData, setDisplayData] = useState<T[]>(targetData);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs to track state across animation frames
  const displayRef = useRef<T[]>(targetData);
  const rafRef = useRef<number>(0);
  const prevFingerprintRef = useRef<number[]>(numericFingerprint(targetData as Record<string, unknown>[]));
  const prevKeyRef = useRef(key);

  // Refs for animation parameters — keeps startAnimation stable across renders
  // (fieldDelays is a new object literal each render, which would otherwise
  //  destabilise the useCallback → useEffect chain and cancel animations)
  const durationRef = useRef(duration);
  const fieldDelaysRef = useRef(fieldDelays);
  durationRef.current = duration;
  fieldDelaysRef.current = fieldDelays;

  // Compute max total animation time (duration + max field delay)
  const maxDelay = fieldDelays
    ? Math.max(0, ...Object.values(fieldDelays))
    : 0;
  const totalDuration = duration + maxDelay;
  const totalDurationRef = useRef(totalDuration);
  totalDurationRef.current = totalDuration;

  // Keep display ref in sync
  useEffect(() => {
    displayRef.current = displayData;
  }, [displayData]);

  // Stable animation starter — reads parameters from refs, so it never
  // changes identity and won't cause the trigger-effect to re-run spuriously.
  const startAnimation = useCallback(
    (from: T[], to: T[]) => {
      // Cancel any running animation
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      setIsAnimating(true);

      // Snapshot current animation parameters from refs
      const animDuration = durationRef.current;
      const animFieldDelays = fieldDelaysRef.current;
      const animTotalDuration = totalDurationRef.current;
      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const overallProgress = Math.min(elapsed / animTotalDuration, 1);

        if (overallProgress >= 1) {
          // Animation complete — snap to exact target
          setDisplayData(to);
          displayRef.current = to;
          setIsAnimating(false);
          return;
        }

        // Interpolate each item
        const interpolated = to.map((target, i) => {
          // For new items beyond the 'from' array, start from the last known item
          // This creates a "drawing forward" effect for progressively revealed data
          const start = from[i] ?? from[from.length - 1] ?? target;
          return interpolateItem(start, target, animFieldDelays, elapsed, animDuration);
        });

        setDisplayData(interpolated);
        displayRef.current = interpolated;
        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // Stable — all animation params read from refs
  );

  // Trigger animation when target data or key changes.
  //
  // IMPORTANT: The cleanup resets detection refs so that React 18 StrictMode's
  // double-effect invocation (mount → cleanup → re-mount) works correctly.
  // Without this, the first invocation updates refs, cleanup cancels RAF, and
  // the second invocation can't detect the change — killing the animation.
  useEffect(() => {
    if (!enabled) {
      // Reduced motion: snap immediately
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setDisplayData(targetData);
      displayRef.current = targetData;
      setIsAnimating(false);
      return;
    }

    const newFingerprint = numericFingerprint(targetData as Record<string, unknown>[]);
    const keyChanged = key !== prevKeyRef.current;
    const dataChanged = !arraysEqual(newFingerprint, prevFingerprintRef.current);

    if (dataChanged || keyChanged) {
      prevKeyRef.current = key;
      prevFingerprintRef.current = newFingerprint;
      // Animate from current display position to new target
      startAnimation([...displayRef.current], targetData);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Reset detection refs so StrictMode re-mount can re-detect changes.
      prevKeyRef.current = -Infinity;
      prevFingerprintRef.current = [];
    };
  }, [targetData, key, enabled, startAnimation]);

  // If not enabled, always return target directly
  if (!enabled) {
    return { displayData: targetData, isAnimating: false };
  }

  return { displayData, isAnimating };
}
