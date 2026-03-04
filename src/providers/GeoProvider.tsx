"use client";

import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from "react";
import { useData } from "./DataProvider";
import type { Farmer } from "@/lib/data/types";

export type GeoLevel = "all" | "district" | "block" | "village";

interface GeoSelection {
  level: GeoLevel;
  district: string | null;
  block: string | null;
  village: string | null;
}

interface GeoContextValue {
  selection: GeoSelection;
  drillDown: (level: GeoLevel, value: string) => void;
  drillUp: () => void;
  resetGeo: () => void;
  geoFiltered: Farmer[];
  /** Apply current geo + demographic filters to any farmer array (for cross-round filtering) */
  geoFilterRound: (farmers: Farmer[]) => Farmer[];
  breadcrumbs: { level: GeoLevel; label: string }[];
  availableDistricts: string[];
  availableBlocks: string[];
  availableVillages: string[];
  genders: string[];
  setGenders: (genders: string[]) => void;
  availableGenders: string[];
  projects: string[];
  setProjects: (projects: string[]) => void;
  allProjects: string[];
  castes: string[];
  setCastes: (castes: string[]) => void;
  availableCastes: string[];
  farmSizes: string[];
  setFarmSizes: (farmSizes: string[]) => void;
  availableFarmSizes: string[];
}

const ALL_PROJECT_TYPES = ["T-1", "T-2", "Control"];

const INITIAL: GeoSelection = {
  level: "all",
  district: null,
  block: null,
  village: null,
};

const GeoContext = createContext<GeoContextValue>({
  selection: INITIAL,
  drillDown: () => {},
  drillUp: () => {},
  resetGeo: () => {},
  geoFiltered: [],
  geoFilterRound: (f) => f,
  breadcrumbs: [],
  availableDistricts: [],
  availableBlocks: [],
  availableVillages: [],
  genders: [],
  setGenders: () => {},
  availableGenders: [],
  projects: ALL_PROJECT_TYPES,
  setProjects: () => {},
  allProjects: ALL_PROJECT_TYPES,
  castes: [],
  setCastes: () => {},
  availableCastes: [],
  farmSizes: [],
  setFarmSizes: () => {},
  availableFarmSizes: [],
});

export function GeoProvider({ children }: { children: ReactNode }) {
  const { farmers } = useData();
  const [selection, setSelection] = useState<GeoSelection>(INITIAL);
  const [genders, setGenders] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([...ALL_PROJECT_TYPES]);
  const [castes, setCastes] = useState<string[]>([]);
  const [farmSizes, setFarmSizes] = useState<string[]>([]);

  const geoFiltered = useMemo(() => {
    const allProjActive = projects.length === ALL_PROJECT_TYPES.length;
    return farmers.filter((f) => {
      if (selection.district && f.district !== selection.district) return false;
      if (selection.block && f.block !== selection.block) return false;
      if (selection.village && f.village !== selection.village) return false;
      if (genders.length && !genders.includes(f.gender)) return false;
      if (!allProjActive && !projects.includes(f.project)) return false;
      if (castes.length && !castes.includes(f.caste)) return false;
      if (farmSizes.length && !farmSizes.includes(f.farmSizeCategory)) return false;
      return true;
    });
  }, [farmers, selection, genders, projects, castes, farmSizes]);

  /** Apply current geo + demographic filters to any farmer array (cross-round) */
  const geoFilterRound = useCallback(
    (input: Farmer[]): Farmer[] => {
      const allProjActive = projects.length === ALL_PROJECT_TYPES.length;
      return input.filter((f) => {
        if (selection.district && f.district !== selection.district) return false;
        if (selection.block && f.block !== selection.block) return false;
        if (selection.village && f.village !== selection.village) return false;
        if (genders.length && !genders.includes(f.gender)) return false;
        if (!allProjActive && !projects.includes(f.project)) return false;
        if (castes.length && !castes.includes(f.caste)) return false;
        if (farmSizes.length && !farmSizes.includes(f.farmSizeCategory)) return false;
        return true;
      });
    },
    [selection, genders, projects, castes, farmSizes]
  );

  const drillDown = useCallback((level: GeoLevel, value: string) => {
    setSelection((prev) => {
      if (level === "district") {
        return { level: "district", district: value, block: null, village: null };
      }
      if (level === "block") {
        return { ...prev, level: "block", block: value, village: null };
      }
      if (level === "village") {
        return { ...prev, level: "village", village: value };
      }
      return prev;
    });
  }, []);

  const drillUp = useCallback(() => {
    setSelection((prev) => {
      if (prev.level === "village") {
        return { ...prev, level: "block", village: null };
      }
      if (prev.level === "block") {
        return { ...prev, level: "district", block: null };
      }
      if (prev.level === "district") {
        return INITIAL;
      }
      return INITIAL;
    });
  }, []);

  const resetGeo = useCallback(() => {
    setSelection(INITIAL);
    setGenders([]);
    setProjects([...ALL_PROJECT_TYPES]);
    setCastes([]);
    setFarmSizes([]);
  }, []);

  const breadcrumbs = useMemo(() => {
    const crumbs: { level: GeoLevel; label: string }[] = [
      { level: "all", label: "All Regions" },
    ];
    if (selection.district) {
      crumbs.push({ level: "district", label: selection.district });
    }
    if (selection.block) {
      crumbs.push({ level: "block", label: selection.block });
    }
    if (selection.village) {
      crumbs.push({ level: "village", label: selection.village });
    }
    return crumbs;
  }, [selection]);

  const availableDistricts = useMemo(
    () => [...new Set(farmers.map((f) => f.district))].filter(Boolean).sort(),
    [farmers]
  );

  const availableBlocks = useMemo(() => {
    const subset = selection.district
      ? farmers.filter((f) => f.district === selection.district)
      : farmers;
    return [...new Set(subset.map((f) => f.block))].filter(Boolean).sort();
  }, [farmers, selection.district]);

  const availableVillages = useMemo(() => {
    let subset = farmers;
    if (selection.district) subset = subset.filter((f) => f.district === selection.district);
    if (selection.block) subset = subset.filter((f) => f.block === selection.block);
    return [...new Set(subset.map((f) => f.village))].filter(Boolean).sort();
  }, [farmers, selection.district, selection.block]);

  const availableGenders = useMemo(
    () => [...new Set(farmers.map((f) => f.gender))].filter(Boolean).sort(),
    [farmers]
  );

  const availableCastes = useMemo(
    () => [...new Set(farmers.map((f) => f.caste))].filter(Boolean).sort(),
    [farmers]
  );

  const availableFarmSizes = useMemo(
    () => [...new Set(farmers.map((f) => f.farmSizeCategory))].filter(Boolean).sort(),
    [farmers]
  );

  const value = useMemo(
    () => ({
      selection,
      drillDown,
      drillUp,
      resetGeo,
      geoFiltered,
      geoFilterRound,
      breadcrumbs,
      availableDistricts,
      availableBlocks,
      availableVillages,
      genders,
      setGenders,
      availableGenders,
      projects,
      setProjects,
      allProjects: ALL_PROJECT_TYPES,
      castes,
      setCastes,
      availableCastes,
      farmSizes,
      setFarmSizes,
      availableFarmSizes,
    }),
    [selection, drillDown, drillUp, resetGeo, geoFiltered, geoFilterRound, breadcrumbs, availableDistricts, availableBlocks, availableVillages, genders, availableGenders, projects, castes, availableCastes, farmSizes, availableFarmSizes]
  );

  return (
    <GeoContext.Provider value={value}>
      {children}
    </GeoContext.Provider>
  );
}

export const useGeo = () => useContext(GeoContext);
