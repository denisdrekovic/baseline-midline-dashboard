"use client";

import { useMemo, useState, useEffect } from "react";
import type { Farmer, CropRecord, ProjectGroup } from "@/lib/data/types";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { formatUSD, formatNumber } from "@/lib/utils/formatters";
import { CROP_COLORS, CROP_NAMES, CROPS } from "@/lib/data/constants";
import { loadCropData } from "@/lib/data/loader";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import DumbbellChart from "@/components/charts/DumbbellChart";
import ChartContainer from "@/components/ui/ChartContainer";
import RadarChartComponent from "@/components/charts/RadarChartComponent";
import BarChartComponent from "@/components/charts/BarChartComponent";
import CropMetricMatrix from "@/components/charts/CropMetricMatrix";
import CropIncomeBarCard from "@/components/charts/CropIncomeBarCard";
import MethodNote from "@/components/ui/MethodNote";

interface CropsComparativeProps {
  data: Farmer[];
  projectFilter?: string;
}

const ALL_GROUPS: ProjectGroup[] = ["T-1", "T-2", "Control"];
const TREATMENT_GROUPS: ProjectGroup[] = ["T-1", "T-2"];
const GROUP_COLORS: Record<string, string> = {
  "T-1": "#007BFF",
  "T-2": "#6F42C1",
  Control: "#FFB703",
};

/* ── helpers ── */
function safeMean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function safeMedian(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getCropNetIncome(farmers: Farmer[], crop: string): number[] {
  const key = `${crop}NetIncome` as keyof Farmer;
  return farmers
    .map((f) => f[key] as number)
    .filter((v) => v != null && isFinite(v) && v !== 0);
}

function getCropGrowers(farmers: Farmer[], crop: string): number {
  return getCropNetIncome(farmers, crop).length;
}

function getCropAvgIncome(farmers: Farmer[], crop: string): number {
  const vals = getCropNetIncome(farmers, crop);
  return safeMean(vals);
}

function getCropMedianIncome(farmers: Farmer[], crop: string): number {
  const vals = getCropNetIncome(farmers, crop);
  return safeMedian(vals);
}

function pctChange(b: number, m: number): number | undefined {
  if (!b || !isFinite(b)) return undefined;
  return ((m - b) / Math.abs(b)) * 100;
}

function fmt$(v: number): string {
  return formatUSD(v);
}

function fmtN(v: number, dec = 1): string {
  if (v == null || !isFinite(v)) return "N/A";
  return formatNumber(v, dec);
}

function fmtSafe$(v: number): string {
  if (v == null || !isFinite(v)) return "N/A";
  return formatUSD(v);
}

/* ── per-crop record stats ── */
interface CropRoundStats {
  crop: string;
  growers: number;
  avgYield: number;
  avgAcre: number;
  avgIncome: number;
  avgExpenses: number;
  avgNetIncome: number;
  medianNetIncome: number;
  totalAcre: number;
  yieldPerAcre: number;
}

function computeCropRecordStats(
  records: CropRecord[],
  farmerIds: Set<number>
): CropRoundStats {
  // Only include records for geo-filtered farmers who actually grow this crop
  const filtered = records.filter((r) => {
    if (!farmerIds.has(r.id)) return false;
    const acre = typeof r.acre === "number" ? r.acre : parseFloat(r.acre as unknown as string);
    return (acre > 0) || (r.netIncome != null && r.netIncome !== 0) || (r.yield > 0);
  });

  if (!filtered.length) {
    return {
      crop: records[0]?.crop ?? "",
      growers: 0,
      avgYield: 0,
      avgAcre: 0,
      avgIncome: 0,
      avgExpenses: 0,
      avgNetIncome: 0,
      medianNetIncome: 0,
      totalAcre: 0,
      yieldPerAcre: 0,
    };
  }

  const parseNum = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : parseFloat(v as string);
    return n != null && isFinite(n) && n > 0 ? n : null;
  };

  const yields = filtered.map((r) => parseNum(r.yield)).filter((v): v is number => v !== null);
  const acres = filtered.map((r) => parseNum(r.acre)).filter((v): v is number => v !== null);
  const incomes = filtered.map((r) => r.income).filter((v) => v != null && isFinite(v));
  const expenses = filtered.map((r) => r.expenses).filter((v) => v != null && isFinite(v) && v > 0);
  const netIncomes = filtered.map((r) => r.netIncome).filter((v) => v != null && isFinite(v));

  const avgYield = safeMean(yields);
  const avgAcre = safeMean(acres);
  const totalAcre = acres.reduce((a, b) => a + b, 0);

  return {
    crop: records[0]?.crop ?? "",
    growers: filtered.length,
    avgYield,
    avgAcre,
    avgIncome: safeMean(incomes),
    avgExpenses: safeMean(expenses),
    avgNetIncome: safeMean(netIncomes),
    medianNetIncome: safeMedian(netIncomes),
    totalAcre,
    yieldPerAcre: avgAcre > 0 && avgYield > 0 ? avgYield / avgAcre : 0,
  };
}

export default function CropsComparative({ data, projectFilter }: CropsComparativeProps) {
  const { getRound } = useData();
  const { geoFilterRound } = useGeo();

  /* ── farmer data — all (for by-group comparisons) ── */
  const baselineFarmers = useMemo(
    () => geoFilterRound(getRound("baseline").farmers),
    [getRound, geoFilterRound]
  );
  const midlineFarmers = useMemo(
    () => geoFilterRound(getRound("midline").farmers),
    [getRound, geoFilterRound]
  );

  /* ── project-filtered — for KPIs and overall metrics ── */
  const bFiltered = useMemo(
    () => projectFilter && projectFilter !== "all"
      ? baselineFarmers.filter((f) => f.project === projectFilter)
      : baselineFarmers,
    [baselineFarmers, projectFilter]
  );
  const mFiltered = useMemo(
    () => projectFilter && projectFilter !== "all"
      ? midlineFarmers.filter((f) => f.project === projectFilter)
      : midlineFarmers,
    [midlineFarmers, projectFilter]
  );

  /* ── load crop records for both rounds ── */
  const [cropRecordsB, setCropRecordsB] = useState<Map<string, CropRecord[]>>(new Map());
  const [cropRecordsM, setCropRecordsM] = useState<Map<string, CropRecord[]>>(new Map());
  const [cropDataLoading, setCropDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCropDataLoading(true);
    Promise.all([
      Promise.all(CROPS.map(async (c) => [c, await loadCropData(c, "baseline")] as [string, CropRecord[]])),
      Promise.all(CROPS.map(async (c) => [c, await loadCropData(c, "midline")] as [string, CropRecord[]])),
    ]).then(([bResults, mResults]) => {
      if (cancelled) return;
      const bMap = new Map<string, CropRecord[]>();
      const mMap = new Map<string, CropRecord[]>();
      for (const [crop, recs] of bResults) bMap.set(crop, recs);
      for (const [crop, recs] of mResults) mMap.set(crop, recs);
      setCropRecordsB(bMap);
      setCropRecordsM(mMap);
      setCropDataLoading(false);
    }).catch(() => {
      if (!cancelled) setCropDataLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  /* ── IDs for crop record filtering (project-filtered) ── */
  const bFarmerIds = useMemo(() => new Set(bFiltered.map((f) => f.id)), [bFiltered]);
  const mFarmerIds = useMemo(() => new Set(mFiltered.map((f) => f.id)), [mFiltered]);

  /* ── detailed crop stats from records ── */
  const detailedCropStats = useMemo(() => {
    if (cropRecordsB.size === 0 && cropRecordsM.size === 0) return [];
    return CROPS.map((crop) => {
      const bRecs = cropRecordsB.get(crop) || [];
      const mRecs = cropRecordsM.get(crop) || [];
      const bStats = computeCropRecordStats(bRecs, bFarmerIds);
      const mStats = computeCropRecordStats(mRecs, mFarmerIds);
      return {
        crop,
        name: CROP_NAMES[crop] || crop,
        color: CROP_COLORS[crop] || "#007BFF",
        baseline: bStats,
        midline: mStats,
      };
    }).filter((c) => c.baseline.growers > 0 || c.midline.growers > 0);
  }, [cropRecordsB, cropRecordsM, bFarmerIds, mFarmerIds]);

  /* ── farmer-level crop income KPIs — project-filtered ── */
  const cropKPIs = useMemo(() => {
    return CROPS.map((crop) => {
      const bIncome = getCropAvgIncome(bFiltered, crop);
      const mIncome = getCropAvgIncome(mFiltered, crop);
      const bMedian = getCropMedianIncome(bFiltered, crop);
      const mMedian = getCropMedianIncome(mFiltered, crop);
      const bGrowers = getCropGrowers(bFiltered, crop);
      const mGrowers = getCropGrowers(mFiltered, crop);
      return {
        crop,
        name: CROP_NAMES[crop] || crop,
        color: CROP_COLORS[crop] || "#007BFF",
        bIncome, mIncome,
        bMedian, mMedian,
        bGrowers, mGrowers,
      };
    }).filter((c) => c.bGrowers > 0 || c.mGrowers > 0);
  }, [bFiltered, mFiltered]);

  /* Control = counterfactual — exclude from treatment-focused group comparisons */
  const visibleGroups = useMemo((): ProjectGroup[] => {
    if (!projectFilter || projectFilter === "all") return TREATMENT_GROUPS;
    return [projectFilter as ProjectGroup];
  }, [projectFilter]);

  /* ── per-group per-crop income ── */
  const groupCropData = useMemo(() => {
    const results: Array<{
      crop: string;
      name: string;
      groups: Array<{ group: ProjectGroup; bIncome: number; mIncome: number; bGrowers: number; mGrowers: number }>;
    }> = [];
    for (const crop of CROPS) {
      const groups = visibleGroups.map((g) => {
        const bGroup = baselineFarmers.filter((f) => f.project === g);
        const mGroup = midlineFarmers.filter((f) => f.project === g);
        return {
          group: g,
          bIncome: getCropAvgIncome(bGroup, crop),
          mIncome: getCropAvgIncome(mGroup, crop),
          bGrowers: getCropGrowers(bGroup, crop),
          mGrowers: getCropGrowers(mGroup, crop),
        };
      });
      if (groups.some((g) => g.bGrowers > 0 || g.mGrowers > 0)) {
        results.push({ crop, name: CROP_NAMES[crop] || crop, groups });
      }
    }
    return results;
  }, [baselineFarmers, midlineFarmers, visibleGroups]);

  /* ── mint practice adoption — project-filtered ── */
  const mintAdoption = useMemo(() => {
    const bVals = bFiltered.map((f) => f.practiceAdoptRateMint).filter((v): v is number => v != null && isFinite(v));
    const mVals = mFiltered.map((f) => f.practiceAdoptRateMint).filter((v): v is number => v != null && isFinite(v));
    return {
      bRate: safeMean(bVals),
      mRate: safeMean(mVals),
      bCount: bVals.length,
      mCount: mVals.length,
    };
  }, [bFiltered, mFiltered]);

  /* ── income composition (crop share) — project-filtered ── */
  const incomeComposition = useMemo(() => {
    const computeShares = (farmers: Farmer[]) => {
      const cropTotals: Record<string, number> = {};
      let grandTotal = 0;
      for (const crop of CROPS) {
        const vals = getCropNetIncome(farmers, crop);
        const total = vals.reduce((a, b) => a + b, 0);
        cropTotals[crop] = Math.max(0, total);
        grandTotal += Math.max(0, total);
      }
      return CROPS.map((crop) => ({
        crop,
        name: CROP_NAMES[crop] || crop,
        color: CROP_COLORS[crop] || "#007BFF",
        share: grandTotal > 0 ? (cropTotals[crop] / grandTotal) * 100 : 0,
        total: cropTotals[crop],
      }));
    };
    return { baseline: computeShares(bFiltered), midline: computeShares(mFiltered) };
  }, [bFiltered, mFiltered]);

  /* ── dumbbell data for income ── */
  const incomeDumbbell = useMemo(
    () => cropKPIs.map((c) => ({ label: c.name, baseline: c.bIncome, midline: c.mIncome, color: c.color })),
    [cropKPIs]
  );

  /* ── grower comparison data ── */
  const growerData = useMemo(
    () => cropKPIs.map((c) => ({ name: c.name, Baseline: c.bGrowers, Midline: c.mGrowers })),
    [cropKPIs]
  );

  /* ── radar data ── */
  const radarData = useMemo(
    () => cropKPIs.map((c) => ({ subject: c.name, Baseline: Math.round(c.bIncome), Midline: Math.round(c.mIncome) })),
    [cropKPIs]
  );

  if (!baselineFarmers.length || !midlineFarmers.length) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
        Both baseline and midline data are required for crop comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Per-Crop KPI Cards (enhanced) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cropKPIs.map((c) => {
          const detail = detailedCropStats.find((d) => d.crop === c.crop);
          return (
            <div
              key={c.crop}
              className="brand-card p-3 space-y-2"
              style={{ borderTop: `3px solid ${c.color}` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {c.name}
                </span>
                <span className="text-[9px] font-mono text-[var(--text-tertiary)]">
                  {c.bGrowers} → {c.mGrowers} growers
                </span>
              </div>

              {/* Income row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-[var(--text-tertiary)]">Avg Net Income</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold font-mono text-[var(--text-primary)]">{fmt$(c.mIncome)}</span>
                    <ChangeIndicator value={c.mIncome - c.bIncome} format="currency" size="sm" />
                  </div>
                  <div className="text-[8px] text-[var(--text-tertiary)] font-mono">was {fmt$(c.bIncome)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[var(--text-tertiary)]">Median Net Income</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold font-mono text-[var(--text-primary)]">{fmt$(c.mMedian)}</span>
                    <ChangeIndicator value={c.mMedian - c.bMedian} format="currency" size="sm" />
                  </div>
                  <div className="text-[8px] text-[var(--text-tertiary)] font-mono">was {fmt$(c.bMedian)}</div>
                </div>
              </div>

              {/* Yield / Acreage / Expenses (from crop records) */}
              {detail && !cropDataLoading && (detail.baseline.growers > 0 || detail.midline.growers > 0) && (
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-[var(--border-primary)]">
                  <div>
                    <div className="text-[8px] text-[var(--text-tertiary)]">Yield/Acre</div>
                    <div className="text-[10px] font-mono font-semibold text-[var(--text-primary)]">
                      {fmtN(detail.midline.yieldPerAcre, 0)} kg
                    </div>
                    {detail.baseline.yieldPerAcre > 0 && (
                      <ChangeIndicator
                        value={detail.midline.yieldPerAcre - detail.baseline.yieldPerAcre}
                        format="number"
                        size="sm"
                        percentChange={pctChange(detail.baseline.yieldPerAcre, detail.midline.yieldPerAcre)}
                      />
                    )}
                  </div>
                  <div>
                    <div className="text-[8px] text-[var(--text-tertiary)]">Avg Acre</div>
                    <div className="text-[10px] font-mono font-semibold text-[var(--text-primary)]">
                      {fmtN(detail.midline.avgAcre, 2)}
                    </div>
                    {detail.baseline.avgAcre > 0 && (
                      <ChangeIndicator
                        value={detail.midline.avgAcre - detail.baseline.avgAcre}
                        format="number"
                        size="sm"
                        percentChange={pctChange(detail.baseline.avgAcre, detail.midline.avgAcre)}
                      />
                    )}
                  </div>
                  <div>
                    <div className="text-[8px] text-[var(--text-tertiary)]">Avg Expenses</div>
                    <div className="text-[10px] font-mono font-semibold text-[var(--text-primary)]">
                      {fmt$(detail.midline.avgExpenses)}
                    </div>
                    {detail.baseline.avgExpenses > 0 && (
                      <ChangeIndicator
                        value={detail.midline.avgExpenses - detail.baseline.avgExpenses}
                        format="currency"
                        higherIsBetter={false}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 2. Income by Crop ── */}
      <ChartContainer
        title="Income by Crop"
        subtitle="Avg net income per grower — Baseline vs Midline"
        tableData={cropKPIs.map((c) => ({
          Crop: c.name,
          Baseline: fmt$(c.bIncome),
          Midline: fmt$(c.mIncome),
          Change: fmt$(c.mIncome - c.bIncome),
          "Baseline Growers": c.bGrowers,
          "Midline Growers": c.mGrowers,
        }))}
      >
        <CropIncomeBarCard
          rows={cropKPIs.map((c) => ({
            crop: c.name,
            color: c.color,
            baseline: c.bIncome,
            midline: c.mIncome,
            bGrowers: c.bGrowers,
            mGrowers: c.mGrowers,
          }))}
          metric="avg"
        />
        <MethodNote
          summary="Per-crop net income = gross crop income − crop expenses. Mean of all farmers who grew that crop (non-zero income). PPP-adjusted USD."
          caveats={[
            "Income recall is self-reported and may underestimate expenses, inflating net income.",
          ]}
        />
      </ChartContainer>

      {/* ── 3. Yield per Acre Dumbbell (from crop records) ── */}
      {!cropDataLoading && detailedCropStats.length > 0 && (
        <ChartContainer
          title="Yield per Acre by Crop"
          subtitle="kg per acre — Baseline → Midline"
          tableData={detailedCropStats.map((c) => ({
            Crop: c.name,
            "Baseline (kg/ac)": fmtN(c.baseline.yieldPerAcre, 0),
            "Midline (kg/ac)": fmtN(c.midline.yieldPerAcre, 0),
            "Change %": c.baseline.yieldPerAcre > 0
              ? `${pctChange(c.baseline.yieldPerAcre, c.midline.yieldPerAcre)?.toFixed(1)}%`
              : "n/a",
          }))}
        >
          <DumbbellChart
            rows={detailedCropStats.map((c) => ({
              label: c.name,
              baseline: c.baseline.yieldPerAcre,
              midline: c.midline.yieldPerAcre,
              color: c.color,
            }))}
            formatter={(v) => `${fmtN(v, 0)} kg/ac`}
            height={detailedCropStats.length * 44 + 24}
          />
          <MethodNote
            summary="Yield per acre = total yield (kg) ÷ total cultivated acres for growers of each crop. Computed from per-crop survey records."
            caveats={[
              "Yield recall may be less accurate than formal crop-cut measurements. Seasonal/weather differences between rounds affect comparability.",
            ]}
          />
        </ChartContainer>
      )}

      {/* ── 4. Avg Expenses Dumbbell ── */}
      {!cropDataLoading && detailedCropStats.length > 0 && (
        <ChartContainer
          title="Avg Expenses by Crop"
          subtitle="Baseline → Midline"
          tableData={detailedCropStats.map((c) => ({
            Crop: c.name,
            "Baseline Expenses": fmt$(c.baseline.avgExpenses),
            "Midline Expenses": fmt$(c.midline.avgExpenses),
            "Change": fmt$(c.midline.avgExpenses - c.baseline.avgExpenses),
          }))}
        >
          <DumbbellChart
            rows={detailedCropStats.map((c) => ({
              label: c.name,
              baseline: c.baseline.avgExpenses,
              midline: c.midline.avgExpenses,
              color: c.color,
            }))}
            formatter={(v) => fmt$(v)}
            height={detailedCropStats.length * 44 + 24}
          />
          <MethodNote
            summary="Average expenses per crop per grower (PPP-adjusted USD). Includes input costs, labour, and other crop-specific expenditures."
            caveats={[
              "Expenses are often underreported in farmer recall surveys. Rising expenses may indicate increased investment rather than inefficiency.",
            ]}
          />
        </ChartContainer>
      )}

      {/* ── 5. Avg Acreage Dumbbell ── */}
      {!cropDataLoading && detailedCropStats.length > 0 && (
        <ChartContainer
          title="Avg Acreage per Grower"
          subtitle="Baseline → Midline"
          tableData={detailedCropStats.map((c) => ({
            Crop: c.name,
            "Baseline Acres": fmtN(c.baseline.avgAcre, 2),
            "Midline Acres": fmtN(c.midline.avgAcre, 2),
            "Change %": c.baseline.avgAcre > 0
              ? `${pctChange(c.baseline.avgAcre, c.midline.avgAcre)?.toFixed(1)}%`
              : "n/a",
          }))}
        >
          <DumbbellChart
            rows={detailedCropStats.map((c) => ({
              label: c.name,
              baseline: c.baseline.avgAcre,
              midline: c.midline.avgAcre,
              color: c.color,
            }))}
            formatter={(v) => `${fmtN(v, 2)} ac`}
            height={detailedCropStats.length * 44 + 24}
          />
          <MethodNote
            summary="Average cultivated acreage per grower for each crop. Changes may reflect crop switching, land expansion, or consolidation."
          />
        </ChartContainer>
      )}

      {/* ── 6. Income Composition Share ── */}
      <ChartContainer
        title="Crop Income Share"
        subtitle="% of total crop income by crop"
        tableData={incomeComposition.baseline.map((bc, i) => ({
          Crop: bc.name,
          "Baseline %": `${fmtN(bc.share, 1)}%`,
          "Midline %": `${fmtN(incomeComposition.midline[i]?.share ?? 0, 1)}%`,
          "Shift": `${fmtN((incomeComposition.midline[i]?.share ?? 0) - bc.share, 1)}pp`,
        }))}
      >
        <div className="space-y-2 px-2">
          {["baseline", "midline"].map((round) => {
            const shares = round === "baseline" ? incomeComposition.baseline : incomeComposition.midline;
            return (
              <div key={round}>
                <div className="text-[9px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">
                  {round === "baseline" ? "Baseline" : "Midline"}
                </div>
                <div className="flex h-5 rounded-sm overflow-hidden">
                  {shares
                    .filter((s) => s.share > 0)
                    .map((s) => (
                      <div
                        key={s.crop}
                        className="flex items-center justify-center text-[7px] font-bold text-white"
                        style={{ width: `${Math.max(s.share, 3)}%`, backgroundColor: s.color }}
                        title={`${s.name}: ${fmtN(s.share, 1)}%`}
                      >
                        {s.share > 8 ? `${s.name} ${fmtN(s.share, 0)}%` : ""}
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
          {/* legend */}
          <div className="flex flex-wrap gap-2 mt-1">
            {incomeComposition.baseline.filter((s) => s.share > 0 || (incomeComposition.midline.find((m) => m.crop === s.crop)?.share ?? 0) > 0).map((s) => (
              <div key={s.crop} className="flex items-center gap-1 text-[8px] text-[var(--text-secondary)]">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.name}
              </div>
            ))}
          </div>
        </div>
        <MethodNote
          summary="Each crop's share of total positive crop income. Negative net incomes are floored at zero for share calculation. Shift in share reflects changing crop economics."
        />
      </ChartContainer>

      {/* ── 7. Grower Count Changes ── */}
      <ChartContainer
        title="Grower Participation"
        subtitle="Farmer count per crop — Baseline vs Midline"
        tableData={growerData}
      >
        <BarChartComponent
          data={growerData}
          dataKey="Midline"
          nameKey="name"
          series={[
            { key: "Baseline", label: "Baseline", color: "#6F42C1", opacity: 0.4 },
            { key: "Midline", label: "Midline", color: "#00A17D" },
          ]}
          height={180}
          tooltipTitle="Grower Count"
        />
        <MethodNote
          summary="Number of farmers with non-zero acreage or income for each crop. Changes reflect crop adoption or abandonment between rounds."
        />
      </ChartContainer>

      {/* ── 8. Radar Overlay ── */}
      <ChartContainer
        title="Crop Income Radar"
        subtitle="Baseline vs Midline overlay"
      >
        <RadarChartComponent
          data={radarData}
          dataKeys={[
            { key: "Baseline", color: "#007BFF", label: "Baseline" },
            { key: "Midline", color: "#00A17D", label: "Midline" },
          ]}
          height={260}
        />
        <MethodNote
          summary="Radar overlay: each axis represents mean net income for one crop. Baseline (blue) vs Midline (green) — outward expansion indicates income growth."
        />
      </ChartContainer>

      {/* ── 9. Per-Group Crop Income Table ── */}
      {groupCropData.length > 0 && (
        <ChartContainer
          title="Income by Crop × Treatment Group"
          subtitle="Avg net income per crop, split by group"
          tableData={groupCropData.flatMap((c) =>
            c.groups.map((g) => ({
              Crop: c.name,
              Group: g.group,
              "Baseline Income": fmt$(g.bIncome),
              "Midline Income": fmt$(g.mIncome),
              "Change": fmt$(g.mIncome - g.bIncome),
              "Baseline Growers": g.bGrowers,
              "Midline Growers": g.mGrowers,
            }))
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] font-mono">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left p-1.5 text-[var(--text-tertiary)] font-semibold">Crop</th>
                  {visibleGroups.map((g) => (
                    <th key={g} className="text-right p-1.5 font-semibold" style={{ color: GROUP_COLORS[g] }}>
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupCropData.map((c) => (
                  <tr key={c.crop} className="border-b border-[var(--border-primary)] border-opacity-50">
                    <td className="p-1.5 font-semibold text-[var(--text-primary)]">{c.name}</td>
                    {c.groups.map((g) => (
                      <td key={g.group} className="text-right p-1.5">
                        <div className="text-[var(--text-primary)]">{fmt$(g.mIncome)}</div>
                        <ChangeIndicator value={g.mIncome - g.bIncome} format="currency" size="sm" />
                        <div className="text-[7px] text-[var(--text-tertiary)]">
                          n={g.mGrowers}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MethodNote
            summary="Per-crop income broken down by treatment group. n = grower count in that group. Groups are not randomly assigned — between-group differences may reflect selection effects."
          />
        </ChartContainer>
      )}

      {/* ── 10. Mint Practice Adoption ── */}
      {(mintAdoption.bCount > 0 || mintAdoption.mCount > 0) && (
        <ChartContainer
          title="Mint Practice Adoption Rate"
          subtitle="Average adoption score"
        >
          <div className="flex items-center gap-4 p-3">
            <div className="flex-1">
              <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Baseline</div>
              <div className="text-lg font-bold font-mono text-[#007BFF]">
                {fmtN(mintAdoption.bRate * 100, 1)}%
              </div>
              <div className="text-[8px] text-[var(--text-tertiary)] font-mono">n={mintAdoption.bCount}</div>
            </div>
            <div className="text-lg font-mono text-[var(--text-tertiary)]">→</div>
            <div className="flex-1">
              <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Midline</div>
              <div className="text-lg font-bold font-mono text-[#00A17D]">
                {fmtN(mintAdoption.mRate * 100, 1)}%
              </div>
              <div className="text-[8px] text-[var(--text-tertiary)] font-mono">n={mintAdoption.mCount}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Change</div>
              <ChangeIndicator
                value={(mintAdoption.mRate - mintAdoption.bRate) * 100}
                format="number"
                percentChange={pctChange(mintAdoption.bRate, mintAdoption.mRate)}
              />
            </div>
          </div>
          <MethodNote
            summary="Mint practice adoption: mean of individual farmer adoption scores (0–1 scale) reflecting uptake of recommended agronomic practices for mentha cultivation."
          />
        </ChartContainer>
      )}

      {/* ── 11. Crop × Metric Heatmap Matrix ── */}
      {!cropDataLoading && detailedCropStats.length > 0 && (
        <ChartContainer
          title="Crop Performance Matrix"
          subtitle="Hover to compare — colour intensity encodes magnitude of change"
          tableData={detailedCropStats.flatMap((c) => [
            { Crop: c.name, Metric: "Avg Net Income", Baseline: fmt$(c.baseline.avgNetIncome), Midline: fmt$(c.midline.avgNetIncome), Change: fmt$(c.midline.avgNetIncome - c.baseline.avgNetIncome) },
            { Crop: c.name, Metric: "Median Income", Baseline: fmt$(c.baseline.medianNetIncome), Midline: fmt$(c.midline.medianNetIncome), Change: fmt$(c.midline.medianNetIncome - c.baseline.medianNetIncome) },
            { Crop: c.name, Metric: "Yield/Acre", Baseline: fmtN(c.baseline.yieldPerAcre, 0), Midline: fmtN(c.midline.yieldPerAcre, 0), Change: `${pctChange(c.baseline.yieldPerAcre, c.midline.yieldPerAcre)?.toFixed(1) ?? "n/a"}%` },
            { Crop: c.name, Metric: "Avg Acreage", Baseline: fmtN(c.baseline.avgAcre, 2), Midline: fmtN(c.midline.avgAcre, 2), Change: fmtN(c.midline.avgAcre - c.baseline.avgAcre, 2) },
            { Crop: c.name, Metric: "Avg Expenses", Baseline: fmt$(c.baseline.avgExpenses), Midline: fmt$(c.midline.avgExpenses), Change: fmt$(c.midline.avgExpenses - c.baseline.avgExpenses) },
            { Crop: c.name, Metric: "Growers", Baseline: `${c.baseline.growers}`, Midline: `${c.midline.growers}`, Change: `${c.midline.growers - c.baseline.growers}` },
          ])}
        >
          <CropMetricMatrix
            rows={detailedCropStats.map((c) => ({
              crop: c.name,
              cropColor: c.color,
              metrics: [
                {
                  key: "avgNetIncome", label: "Avg Net Income",
                  baseline: c.baseline.avgNetIncome, midline: c.midline.avgNetIncome,
                  change: c.midline.avgNetIncome - c.baseline.avgNetIncome,
                  pctChange: pctChange(c.baseline.avgNetIncome, c.midline.avgNetIncome) ?? null,
                  format: "currency" as const, higherIsBetter: true,
                },
                {
                  key: "medianIncome", label: "Median Income",
                  baseline: c.baseline.medianNetIncome, midline: c.midline.medianNetIncome,
                  change: c.midline.medianNetIncome - c.baseline.medianNetIncome,
                  pctChange: pctChange(c.baseline.medianNetIncome, c.midline.medianNetIncome) ?? null,
                  format: "currency" as const, higherIsBetter: true,
                },
                {
                  key: "yieldPerAcre", label: "Yield / Acre",
                  baseline: c.baseline.yieldPerAcre, midline: c.midline.yieldPerAcre,
                  change: c.midline.yieldPerAcre - c.baseline.yieldPerAcre,
                  pctChange: pctChange(c.baseline.yieldPerAcre, c.midline.yieldPerAcre) ?? null,
                  format: "weight" as const, higherIsBetter: true,
                },
                {
                  key: "avgAcreage", label: "Avg Acreage",
                  baseline: c.baseline.avgAcre, midline: c.midline.avgAcre,
                  change: c.midline.avgAcre - c.baseline.avgAcre,
                  pctChange: pctChange(c.baseline.avgAcre, c.midline.avgAcre) ?? null,
                  format: "area" as const, higherIsBetter: true,
                },
                {
                  key: "avgExpenses", label: "Avg Expenses",
                  baseline: c.baseline.avgExpenses, midline: c.midline.avgExpenses,
                  change: c.midline.avgExpenses - c.baseline.avgExpenses,
                  pctChange: pctChange(c.baseline.avgExpenses, c.midline.avgExpenses) ?? null,
                  format: "currency" as const, higherIsBetter: false,
                },
                {
                  key: "growers", label: "Grower Count",
                  baseline: c.baseline.growers, midline: c.midline.growers,
                  change: c.midline.growers - c.baseline.growers,
                  pctChange: pctChange(c.baseline.growers, c.midline.growers) ?? null,
                  format: "number" as const, higherIsBetter: true,
                },
              ],
            }))}
          />
          <MethodNote
            summary="Heatmap matrix: colour intensity encodes % change (midline ÷ baseline − 1). Green = improvement, red = decline (reversed for expenses). Grey = insufficient baseline data."
            caveats={[
              "Pre-post descriptive comparison — does not control for secular trends, weather, or confounders. See Overview tab for DiD causal estimates.",
            ]}
          />
        </ChartContainer>
      )}

      {/* loading indicator for crop records */}
      {cropDataLoading && (
        <div className="text-center py-4 text-[var(--text-tertiary)] text-xs animate-pulse">
          Loading detailed crop records…
        </div>
      )}

    </div>
  );
}
