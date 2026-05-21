export type CohortKey = "control" | "t1Survey" | "t2Survey";

export interface BenchmarkAnchor {
  id: string;
  studyDate: string;
  studyLabel: string;
  anchorCpi: number;
  anchorLibUsd: number;
  anchorLibInr: number;
  referenceMonth: number;
  country: string;
  currency: string;
  supersededByAnchorId: string | null;
  notes?: string;
}

export interface BenchmarkAnchorsFile {
  currentAnchorId: string;
  anchors: BenchmarkAnchor[];
}

export interface AnnualLockInputs {
  lockedYear: number;
  referenceCpi: number;
  cohortPercentsAboveLib: Record<CohortKey, number>;
  programPopulations: {
    t1Full: number;
    t2Full: number;
  };
}

export interface AnnualLockComputed {
  computedLibUsd: number;
  computedLibInr: number;
  cohortHeadcountsAboveLib: Record<CohortKey, number>;
  programWeightedPercentAboveLib: number;
  programTotalAboveLib: number;
  programTotalPopulation: number;
}

export interface AnnualLock extends AnnualLockInputs, AnnualLockComputed {
  anchorId: string;
  lockedAt: string;
  lockedBy?: string;
}
