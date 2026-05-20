import type {
  AnnualLock,
  AnnualLockComputed,
  AnnualLockInputs,
  BenchmarkAnchor,
  BenchmarkAnchorsFile,
} from "@/lib/data/lib-program-types";

export function inflateLib(
  anchorLibUsd: number,
  anchorLibInr: number,
  anchorCpi: number,
  refreshCpi: number,
): { usd: number; inr: number } {
  const factor = refreshCpi / anchorCpi;
  return {
    usd: anchorLibUsd * factor,
    inr: anchorLibInr * factor,
  };
}

export function computeAnnualLock(
  anchor: BenchmarkAnchor,
  inputs: AnnualLockInputs,
): AnnualLockComputed {
  const { usd, inr } = inflateLib(
    anchor.anchorLibUsd,
    anchor.anchorLibInr,
    anchor.anchorCpi,
    inputs.referenceCpi,
  );

  const { t1Full, t2Full } = inputs.programPopulations;
  const { control, t1Survey, t2Survey } = inputs.cohortPercentsAboveLib;

  const t1Above = t1Full * t1Survey;
  const t2Above = t2Full * t2Survey;
  const programTotalPopulation = t1Full + t2Full;
  const programTotalAboveLib = t1Above + t2Above;
  const programWeightedPercentAboveLib =
    programTotalPopulation > 0 ? programTotalAboveLib / programTotalPopulation : 0;

  return {
    computedLibUsd: usd,
    computedLibInr: inr,
    cohortHeadcountsAboveLib: {
      control: 0,
      t1Survey: t1Above,
      t2Survey: t2Above,
    },
    programWeightedPercentAboveLib,
    programTotalAboveLib,
    programTotalPopulation,
  };
}

export function buildAnnualLock(
  anchor: BenchmarkAnchor,
  inputs: AnnualLockInputs,
  lockedBy?: string,
): AnnualLock {
  const computed = computeAnnualLock(anchor, inputs);
  return {
    ...inputs,
    ...computed,
    anchorId: anchor.id,
    lockedAt: new Date().toISOString(),
    lockedBy,
  };
}

export function getCurrentAnchor(file: BenchmarkAnchorsFile): BenchmarkAnchor {
  const current = file.anchors.find((a) => a.id === file.currentAnchorId);
  if (!current) {
    throw new Error(
      `Current anchor id "${file.currentAnchorId}" not found in benchmark-anchors.json`,
    );
  }
  return current;
}

export function getAnchorById(
  file: BenchmarkAnchorsFile,
  id: string,
): BenchmarkAnchor | undefined {
  return file.anchors.find((a) => a.id === id);
}
