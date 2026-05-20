import {
  buildAnnualLock,
  computeAnnualLock,
  getCurrentAnchor,
  inflateLib,
} from "../src/lib/utils/libAnnualLock";
import anchorsFile from "../src/data/lib-program/benchmark-anchors.json";
import type { BenchmarkAnchorsFile } from "../src/lib/data/lib-program-types";
import { getLIBForYear, LIB_2024, BASELINE_YEAR } from "../src/lib/utils/libScenarioEngine";

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

console.log("\n=== Engine override: getLIBForYear honors locked anchor ===");

// No lock: falls back to original LIB_2024
const libNoLock2024 = getLIBForYear(2024);
assertClose(libNoLock2024, LIB_2024, "no-lock LIB(2024) returns LIB_2024 constant");

// With lock at 2025 = $5,439.39: engine should return exactly that for year=2025
const lockedAnchor = { year: 2025, lib: 5439.388795 };
const libWithLock2025 = getLIBForYear(2025, undefined, lockedAnchor);
assertClose(libWithLock2025, 5439.388795, "with-lock LIB(2025) = locked value exactly");

// Year before lock: deflates from the locked value
const libWithLock2024 = getLIBForYear(2024, undefined, lockedAnchor);
// Should be lock / (1 + default blended inflation)
console.log(`        info: with-lock LIB(2024) deflated = $${libWithLock2024.toFixed(2)} (was $${LIB_2024} without lock)`);
if (libWithLock2024 <= LIB_2024) {
  console.error("FAIL  with-lock LIB(2024) should be > old LIB_2024 since locked 2025 is higher");
  process.exitCode = 1;
} else {
  console.log("PASS  with-lock LIB(2024) > LIB_2024 (locked anchor pulled 2024 up)");
}

// Year after lock: inflates from the locked value
const libWithLock2026 = getLIBForYear(2026, undefined, lockedAnchor);
if (libWithLock2026 <= 5439.388795) {
  console.error("FAIL  with-lock LIB(2026) should be > locked LIB(2025)");
  process.exitCode = 1;
} else {
  console.log(`PASS  with-lock LIB(2026) = $${libWithLock2026.toFixed(2)} (inflated forward from lock)`);
}

// Sanity: BASELINE_YEAR constant unchanged
if (BASELINE_YEAR !== 2024) {
  console.error("FAIL  BASELINE_YEAR drifted");
  process.exitCode = 1;
}

console.log();
if (process.exitCode) {
  console.error("Some checks failed.");
} else {
  console.log("All checks passed.");
}
