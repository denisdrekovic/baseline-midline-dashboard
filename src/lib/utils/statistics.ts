export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sorted.length) return sorted[lower];
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]);
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/** Consistent check for whether a farmer is above the Living Income Benchmark.
 *  The data field may use "Yes"/"Above" (string) or 1 (number) depending on the data source.
 *  Also checks income_category === "At or above LIB" when available. */
export function isAboveLIB(aboveLIB: string | number | undefined | null): boolean {
  if (typeof aboveLIB === "number") return aboveLIB === 1;
  if (typeof aboveLIB === "string") return aboveLIB === "Yes" || aboveLIB === "Above" || aboveLIB === "At or above LIB";
  return false;
}
