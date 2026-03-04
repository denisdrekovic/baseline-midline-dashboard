"use client";

import { useState, useEffect, useMemo } from "react";
import { useGeo } from "@/providers/GeoProvider";
import { loadCropData } from "@/lib/data/loader";
import { CROPS, CROP_NAMES, CROP_COLORS } from "@/lib/data/constants";
import type { CropRecord } from "@/lib/data/types";

export interface CropDetailStat {
  crop: string;
  name: string;
  color: string;
  farmerCount: number;
  avgYield: number;
  avgAcre: number;
  avgIncome: number;
  avgExpenses: number;
  avgNetIncome: number;
  medianNetIncome: number;
  totalAcre: number;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function safeMean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Loads all crop data files and joins with geo-filtered farmer IDs
 * to produce per-crop statistics and per-farmer yield/acre for the current view.
 */
export function useCropStats(): {
  cropStats: CropDetailStat[];
  /** Map of farmerId → average yield per acre across all their crops */
  farmerYieldMap: Map<number, number>;
  /** Geo-filtered crop records per crop — only includes growers */
  cropRecords: Map<string, CropRecord[]>;
  loading: boolean;
} {
  const { geoFiltered } = useGeo();
  const [allCropRecords, setAllCropRecords] = useState<Map<string, CropRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load all crop files once on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all(
      CROPS.map(async (crop) => {
        const records = await loadCropData(crop);
        return [crop, records] as [string, CropRecord[]];
      })
    )
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, CropRecord[]>();
        for (const [crop, records] of results) {
          map.set(crop, records);
        }
        setAllCropRecords(map);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Build per-farmer yield/acre map from ALL crop records (not filtered)
  // This is keyed by farmer ID and gives the weighted avg yield/acre
  const farmerYieldMap = useMemo<Map<number, number>>(() => {
    if (allCropRecords.size === 0) return new Map();

    // Accumulate total yield and total acres per farmer across all crops
    const farmerTotals = new Map<number, { totalYield: number; totalAcre: number }>();

    for (const records of allCropRecords.values()) {
      for (const r of records) {
        // Skip records with missing/invalid values or non-growers (yield=0, acre=0)
        if (r.yield == null || r.acre == null || !isFinite(r.yield) || !isFinite(r.acre)) continue;
        if (r.yield <= 0 || r.acre <= 0) continue;
        const existing = farmerTotals.get(r.id);
        if (existing) {
          existing.totalYield += r.yield;
          existing.totalAcre += r.acre;
        } else {
          farmerTotals.set(r.id, { totalYield: r.yield, totalAcre: r.acre });
        }
      }
    }

    // Convert to yield/acre with sanity cap
    const result = new Map<number, number>();
    for (const [id, totals] of farmerTotals) {
      if (totals.totalAcre > 0) {
        const ypa = totals.totalYield / totals.totalAcre;
        if (isFinite(ypa) && ypa > 0) {
          result.set(id, Math.min(ypa, 20000)); // cap at 20,000 kg/ac
        }
      }
    }
    return result;
  }, [allCropRecords]);

  // Filter crop records by current geo-filtered farmer IDs
  const cropStats = useMemo<CropDetailStat[]>(() => {
    if (allCropRecords.size === 0) return [];

    const farmerIds = new Set(geoFiltered.map((f) => f.id));

    return CROPS.map((crop) => {
      const allRecords = allCropRecords.get(crop) || [];
      const filtered = allRecords.filter((r) => farmerIds.has(r.id));

      if (filtered.length === 0) {
        return {
          crop,
          name: CROP_NAMES[crop],
          color: CROP_COLORS[crop],
          farmerCount: 0,
          avgYield: 0,
          avgAcre: 0,
          avgIncome: 0,
          avgExpenses: 0,
          avgNetIncome: 0,
          medianNetIncome: 0,
          totalAcre: 0,
        };
      }

      const yields = filtered.map((r) => r.yield).filter((v) => v != null && isFinite(v));
      const acres = filtered.map((r) => r.acre).filter((v) => v != null && isFinite(v));
      const incomes = filtered.map((r) => r.income).filter((v) => v != null && isFinite(v));
      const expenses = filtered.map((r) => r.expenses).filter((v) => v != null && isFinite(v));
      const netIncomes = filtered.map((r) => r.netIncome).filter((v) => v != null && isFinite(v));

      return {
        crop,
        name: CROP_NAMES[crop],
        color: CROP_COLORS[crop],
        farmerCount: filtered.length,
        avgYield: safeMean(yields),
        avgAcre: safeMean(acres),
        avgIncome: safeMean(incomes),
        avgExpenses: safeMean(expenses),
        avgNetIncome: safeMean(netIncomes),
        medianNetIncome: median(netIncomes),
        totalAcre: acres.reduce((a, b) => a + b, 0),
      };
    }).filter((s) => s.farmerCount > 0);
  }, [allCropRecords, geoFiltered]);

  // Geo-filtered crop records per crop — only actual growers (acre > 0 or netIncome != 0)
  const cropRecords = useMemo<Map<string, CropRecord[]>>(() => {
    if (allCropRecords.size === 0) return new Map();
    const farmerIds = new Set(geoFiltered.map((f) => f.id));
    const result = new Map<string, CropRecord[]>();
    for (const crop of CROPS) {
      const all = allCropRecords.get(crop) || [];
      const filtered = all.filter(
        (r) => farmerIds.has(r.id) && (r.acre > 0 || r.netIncome !== 0)
      );
      if (filtered.length > 0) result.set(crop, filtered);
    }
    return result;
  }, [allCropRecords, geoFiltered]);

  return { cropStats, farmerYieldMap, cropRecords, loading };
}
