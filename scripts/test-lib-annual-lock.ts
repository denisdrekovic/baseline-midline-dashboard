import {
  buildAnnualLock,
  computeAnnualLock,
  getCurrentAnchor,
  inflateLib,
} from "../src/lib/utils/libAnnualLock";
import anchorsFile from "../src/data/lib-program/benchmark-anchors.json";
import type { BenchmarkAnchorsFile } from "../src/lib/data/lib-program-types";

const EPSILON = 0.01;

function assertClose(actual: number, expected: number, label: string) {
  const diff = Math.abs(actual - expected);
  if (diff > EPSILON) {
    console.error(
      `FAIL  ${label}\n        expected ≈ ${expected}\n        got      = ${actual}\n        diff     = ${diff}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`PASS  ${label}  (= ${actual.toFixed(4)})`);
  }
}

const file = anchorsFile as BenchmarkAnchorsFile;
const anchor = getCurrentAnchor(file);

console.log("\n=== Anchor sanity ===");
assertClose(anchor.anchorLibUsd, 4980, "anchor LIB USD");
assertClose(anchor.anchorLibInr, 415000, "anchor LIB INR");
assertClose(anchor.anchorCpi, 176.7, "anchor CPI");

console.log("\n=== 2024 LIB inflation (matches workbook row 6) ===");
const lib2024 = inflateLib(anchor.anchorLibUsd, anchor.anchorLibInr, anchor.anchorCpi, 193);
assertClose(lib2024.usd, 5439.388795, "LIB 2024 USD");
assertClose(lib2024.inr, 453282.3995, "LIB 2024 INR");

console.log("\n=== 2025 Annual Lock (matches workbook row 14) ===");
const computed2025 = computeAnnualLock(anchor, {
  lockedYear: 2025,
  referenceCpi: 197,
  cohortPercentsAboveLib: {
    control: 0.0395,
    t1Survey: 0.1357,
    t2Survey: 0.65,
  },
  programPopulations: {
    t1Full: 23875,
    t2Full: 3040,
  },
});
assertClose(computed2025.cohortHeadcountsAboveLib.t1Survey, 3239.8375, "T1 headcount above LIB");
assertClose(computed2025.cohortHeadcountsAboveLib.t2Survey, 1976, "T2 headcount above LIB");
assertClose(computed2025.programTotalAboveLib, 5215.8375, "Program total above LIB");
assertClose(computed2025.programTotalPopulation, 26915, "Program total population");
assertClose(
  computed2025.programWeightedPercentAboveLib,
  0.1937892439,
  "Program weighted % above LIB",
);

console.log("\n=== buildAnnualLock shape ===");
const lock = buildAnnualLock(anchor, {
  lockedYear: 2025,
  referenceCpi: 197,
  cohortPercentsAboveLib: { control: 0.0395, t1Survey: 0.1357, t2Survey: 0.65 },
  programPopulations: { t1Full: 23875, t2Full: 3040 },
}, "Test");
if (lock.anchorId !== anchor.id) {
  console.error("FAIL  lock.anchorId mismatch");
  process.exitCode = 1;
} else {
  console.log("PASS  lock.anchorId set");
}
if (!lock.lockedAt) {
  console.error("FAIL  lock.lockedAt missing");
  process.exitCode = 1;
} else {
  console.log(`PASS  lock.lockedAt = ${lock.lockedAt}`);
}

console.log();
if (process.exitCode) {
  console.error("Some checks failed.");
} else {
  console.log("All checks passed.");
}
