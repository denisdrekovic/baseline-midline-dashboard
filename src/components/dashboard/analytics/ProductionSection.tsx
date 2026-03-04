"use client";

import { useMemo, useState } from "react";
import { Wheat } from "lucide-react";
import { formatUSD, formatPercent } from "@/lib/utils/formatters";
import { CROP_NAMES, CROP_COLORS, WATERFALL_COLORS } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
import { useCropStats } from "@/hooks/useCropStats";
import {
  Section,
  SubChart,
  MiniBarChart,
  MiniColorBarChart,
  CropTabBar,
  StatRow,
  safeMean,
  type TableRow,
} from "./shared";

interface Props {
  data: Farmer[];
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Create histogram bins dynamically from values */
function makeBins(values: number[], binCount = 6): { label: string; min: number; max: number }[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = Math.max(0, sorted[0]);
  const max = sorted[sorted.length - 1];
  if (max <= min) return [{ label: `${min.toFixed(0)}`, min: min - 0.5, max: max + 0.5 }];

  const step = (max - min) / binCount;
  const bins: { label: string; min: number; max: number }[] = [];
  for (let i = 0; i < binCount; i++) {
    const lo = min + step * i;
    const hi = min + step * (i + 1);
    const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0));
    bins.push({
      label: i === binCount - 1 ? `${fmt(lo)}+` : `${fmt(lo)}-${fmt(hi)}`,
      min: lo,
      max: i === binCount - 1 ? Infinity : hi,
    });
  }
  return bins;
}

export default function ProductionSection({ data }: Props) {
  const { cropStats, cropRecords, loading: cropLoading } = useCropStats();
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

  /* ===================================================================
     OVERVIEW STATS
     =================================================================== */
  const production = useMemo(() => {
    if (!data.length) return null;
    const avgAcre = safeMean(data.map((f) => f.totalAcre));
    const avgTotalExpenses = safeMean(data.map((f) => f.totalExpensesUsd));
    const avgTotalIncome = safeMean(data.map((f) => f.totalIncomeUsd));
    const avgFixedCost = safeMean(data.map((f) => f.fixedCostAllCrops));
    const avgOffFarmDep = safeMean(data.map((f) => f.offFarmDependency));
    const irrigated = data.filter(
      (f) =>
        f.irrigationSession != null &&
        f.irrigationSession !== "" &&
        f.irrigationSession !== "No"
    ).length;
    const irrigPct = data.length ? (irrigated / data.length) * 100 : 0;
    return { avgAcre, avgTotalExpenses, avgTotalIncome, avgFixedCost, avgOffFarmDep, irrigPct };
  }, [data]);

  /* ===================================================================
     PER-CROP DETAIL
     =================================================================== */
  const cropDetail = useMemo(() => {
    if (!selectedCrop) return null;
    const stat = cropStats.find((cs) => cs.crop === selectedCrop);
    const records = cropRecords.get(selectedCrop);
    if (!stat || stat.farmerCount === 0) return null;

    // Yield distribution
    const yields = records
      ? records.map((r) => r.yield).filter((v) => v > 0)
      : [];
    const yieldBins = makeBins(yields);
    const yieldHistogram = yieldBins.map((bin) => ({
      name: bin.label,
      count: yields.filter((v) => v >= bin.min && v < bin.max).length,
    }));

    // Acreage distribution
    const acres = records
      ? records.map((r) => r.acre).filter((v) => v > 0)
      : [];
    const acreBins = makeBins(acres);
    const acreHistogram = acreBins.map((bin) => ({
      name: bin.label,
      count: acres.filter((v) => v >= bin.min && v < bin.max).length,
    }));

    // Income per acre
    const incomePerAcre = stat.avgAcre > 0 ? stat.avgIncome / stat.avgAcre : 0;

    // Median net income
    const netIncomes = records ? records.map((r) => r.netIncome) : [];
    const medianNet = median(netIncomes);

    return {
      stat,
      yieldHistogram,
      acreHistogram,
      incomePerAcre,
      medianNet,
      medianYield: median(yields),
      medianAcre: median(acres),
    };
  }, [selectedCrop, cropStats, cropRecords]);

  /* ===================================================================
     OVERVIEW CHART DATA
     =================================================================== */
  const yieldBarData = useMemo(() => {
    if (!cropStats.length) return [];
    return cropStats
      .filter((cs) => cs.avgYield > 0)
      .sort((a, b) => b.avgYield - a.avgYield)
      .map((cs) => ({
        name: `${cs.name} (${cs.farmerCount})`,
        value: Math.round(cs.avgYield * 10) / 10,
        color: cs.color,
      }));
  }, [cropStats]);

  const acreBarData = useMemo(() => {
    if (!cropStats.length) return [];
    return cropStats
      .filter((cs) => cs.avgAcre > 0)
      .sort((a, b) => b.avgAcre - a.avgAcre)
      .map((cs) => ({
        name: `${cs.name} (${cs.farmerCount})`,
        value: Math.round(cs.avgAcre * 100) / 100,
        color: cs.color,
      }));
  }, [cropStats]);

  const cropProdTableRows: TableRow[] = useMemo(() => {
    if (!cropStats.length) return [];
    return cropStats.map((cs) => ({
      Crop: cs.name,
      Farmers: cs.farmerCount,
      "Avg Yield": isFinite(cs.avgYield) ? cs.avgYield.toFixed(1) : "—",
      "Avg Acres": isFinite(cs.avgAcre) ? cs.avgAcre.toFixed(2) : "—",
      "Income/Acre": cs.avgAcre > 0 && isFinite(cs.avgIncome) ? formatUSD(cs.avgIncome / cs.avgAcre) : "—",
      "Avg Net Income": isFinite(cs.avgNetIncome) ? formatUSD(cs.avgNetIncome) : "—",
    }));
  }, [cropStats]);

  const tableData: TableRow[] = useMemo(() => {
    if (!production) return [];
    const rows: TableRow[] = [
      { Metric: "Avg Farm Size (acres)", Value: production.avgAcre.toFixed(2) },
      { Metric: "Avg Gross Income (USD)", Value: Math.round(production.avgTotalIncome) },
      { Metric: "Avg Expenses (USD)", Value: Math.round(production.avgTotalExpenses) },
      { Metric: "Avg Fixed Costs (USD)", Value: Math.round(production.avgFixedCost) },
      { Metric: "Irrigation Coverage (%)", Value: production.irrigPct.toFixed(1) },
    ];
    for (const cs of cropStats) {
      rows.push({ Metric: `${cs.name} — Farmers`, Value: cs.farmerCount });
      rows.push({ Metric: `${cs.name} — Avg Yield`, Value: isFinite(cs.avgYield) ? cs.avgYield.toFixed(1) : "—" });
      rows.push({ Metric: `${cs.name} — Avg Acres`, Value: isFinite(cs.avgAcre) ? cs.avgAcre.toFixed(2) : "—" });
      rows.push({ Metric: `${cs.name} — Avg Net Income (USD)`, Value: isFinite(cs.avgNetIncome) ? Math.round(cs.avgNetIncome) : "—" });
    }
    return rows;
  }, [production, cropStats]);

  const finBarData = useMemo(() => {
    if (!production) return [];
    return [
      { name: "Gross Income", value: Math.round(production.avgTotalIncome), color: WATERFALL_COLORS.increase },
      { name: "Expenses", value: Math.round(production.avgTotalExpenses), color: WATERFALL_COLORS.decrease },
      { name: "Fixed Costs", value: Math.round(production.avgFixedCost), color: WATERFALL_COLORS.decrease },
    ];
  }, [production]);

  /* ===================================================================
     CROP TAB DATA
     =================================================================== */
  const cropTabs = useMemo(() => {
    return cropStats
      .filter((cs) => cs.farmerCount > 0)
      .sort((a, b) => b.farmerCount - a.farmerCount)
      .map((cs) => ({
        key: cs.crop,
        name: cs.name,
        color: cs.color,
        count: cs.farmerCount,
      }));
  }, [cropStats]);

  return (
    <Section
      id="analytics-prod"
      title="Production"
      icon={<Wheat size={14} />}
      description="Farm size, yield, acreage, and per-crop production metrics"
      expandable
      defaultOpen
      tableData={tableData}
    >
      {production && (
        <>
          {/* ── Crop Tab Bar ── */}
          {!cropLoading && cropTabs.length > 0 && (
            <CropTabBar
              crops={cropTabs}
              selected={selectedCrop}
              onSelect={setSelectedCrop}
            />
          )}

          {/* ===================================================================
              OVERVIEW VIEW (selectedCrop === null)
              =================================================================== */}
          {selectedCrop === null && (
            <>
              {/* Avg farm size */}
              <div className="text-center py-1">
                <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                  {isFinite(production.avgAcre) ? production.avgAcre.toFixed(2) : "—"}{" "}
                  <span className="text-xs font-normal text-[var(--text-tertiary)]">acres</span>
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Average Farm Size</div>
              </div>

              {/* Financial Overview */}
              <SubChart
                title="Financial Overview (avg/farmer)"
                tableData={finBarData.map((d) => ({ Category: d.name, "Value (USD)": d.value }))}
                expandedContent={
                  <MiniColorBarChart data={finBarData} height={280} tooltipTitle="Avg Production Economics (per farmer)" tooltipFormatter={(v) => formatUSD(v)} tooltipUnit="USD" />
                }
              >
                <MiniColorBarChart data={finBarData} height={120} tooltipTitle="Avg Production Economics (per farmer)" tooltipFormatter={(v) => formatUSD(v)} tooltipUnit="USD" />
              </SubChart>

              <StatRow label="Irrigation Coverage" value={formatPercent(production.irrigPct)} />

              {/* Per-Crop Yield bar chart */}
              {!cropLoading && yieldBarData.length > 0 && (
                <SubChart
                  title="Avg Yield per Crop"
                  tableData={yieldBarData.map((d) => ({ Crop: d.name, "Avg Yield (kg/ac)": d.value }))}
                  expandedContent={
                    <MiniColorBarChart data={yieldBarData} height={280} tooltipTitle="Crop Yield" tooltipUnit="kg/ac" layout="vertical" />
                  }
                >
                  <MiniColorBarChart data={yieldBarData} height={110} tooltipTitle="Crop Yield" tooltipUnit="kg/ac" layout="vertical" />
                </SubChart>
              )}

              {/* Acreage Distribution */}
              {!cropLoading && acreBarData.length > 0 && (
                <SubChart
                  title="Avg Acreage per Crop"
                  tableData={acreBarData.map((d) => ({ Crop: d.name, "Avg Acres": d.value }))}
                  expandedContent={
                    <MiniColorBarChart data={acreBarData} height={280} tooltipTitle="Crop Acreage" tooltipUnit="ac" layout="vertical" />
                  }
                >
                  <MiniColorBarChart data={acreBarData} height={110} tooltipTitle="Crop Acreage" tooltipUnit="ac" layout="vertical" />
                </SubChart>
              )}

              {/* Per-Crop Production Detail Table */}
              {!cropLoading && cropStats.length > 0 && (
                <SubChart
                  title="Per-Crop Production Detail"
                  tableData={cropProdTableRows}
                  expandedContent={
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                            <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Crop</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Farmers</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Avg Yield</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Avg Acres</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Income/Acre</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Net Income</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cropStats.map((cs) => (
                            <tr key={cs.crop} style={{ borderBottom: "1px solid var(--card-border)" }} className="hover:bg-[var(--card-bg-hover)] transition-colors">
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cs.color }} />
                                  <span className="font-semibold text-[var(--text-primary)]">{cs.name}</span>
                                </div>
                              </td>
                              <td className="text-right px-2 py-1.5 font-mono text-[var(--text-secondary)]">{cs.farmerCount.toLocaleString()}</td>
                              <td className="text-right px-2 py-1.5 font-mono text-[var(--text-secondary)]">{isFinite(cs.avgYield) ? cs.avgYield.toFixed(1) : "—"}</td>
                              <td className="text-right px-2 py-1.5 font-mono text-[var(--text-secondary)]">{isFinite(cs.avgAcre) ? cs.avgAcre.toFixed(2) : "—"}</td>
                              <td className="text-right px-2 py-1.5 font-mono text-[var(--text-secondary)]">{cs.avgAcre > 0 && isFinite(cs.avgIncome) ? formatUSD(cs.avgIncome / cs.avgAcre) : "—"}</td>
                              <td className="text-right px-2 py-1.5 font-mono font-bold" style={{ color: cs.avgNetIncome >= 0 ? "#00CCCC" : "#FB8500" }}>{formatUSD(cs.avgNetIncome)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                          <th className="text-left px-1.5 py-1 font-semibold text-[var(--text-tertiary)]">Crop</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-[var(--text-tertiary)]">N</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-[var(--text-tertiary)]">Yield</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-[var(--text-tertiary)]">Acres</th>
                          <th className="text-right px-1.5 py-1 font-semibold text-[var(--text-tertiary)]">$/Acre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cropStats.map((cs) => (
                          <tr key={cs.crop} style={{ borderBottom: "1px solid var(--card-border)" }}>
                            <td className="px-1.5 py-1">
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cs.color }} />
                                <span className="font-medium text-[var(--text-primary)]">{cs.name}</span>
                              </div>
                            </td>
                            <td className="text-right px-1.5 py-1 font-mono text-[var(--text-secondary)]">{cs.farmerCount}</td>
                            <td className="text-right px-1.5 py-1 font-mono text-[var(--text-secondary)]">{isFinite(cs.avgYield) ? cs.avgYield.toFixed(1) : "—"}</td>
                            <td className="text-right px-1.5 py-1 font-mono text-[var(--text-secondary)]">{isFinite(cs.avgAcre) ? cs.avgAcre.toFixed(2) : "—"}</td>
                            <td className="text-right px-1.5 py-1 font-mono text-[var(--text-secondary)]">{cs.avgAcre > 0 && isFinite(cs.avgIncome) ? formatUSD(cs.avgIncome / cs.avgAcre) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SubChart>
              )}
            </>
          )}

          {/* ===================================================================
              PER-CROP DETAIL VIEW (selectedCrop is set)
              =================================================================== */}
          {selectedCrop !== null && cropDetail && (
            <>
              {/* KPI Cards: 2×2 grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "GROWERS",
                    value: cropDetail.stat.farmerCount.toLocaleString(),
                    sub: "farmers",
                    color: CROP_COLORS[selectedCrop],
                  },
                  {
                    label: "AVG YIELD",
                    value: isFinite(cropDetail.stat.avgYield) ? `${cropDetail.stat.avgYield.toFixed(1)}` : "—",
                    sub: "kg/farmer",
                    color: "#00CCCC",
                  },
                  {
                    label: "AVG ACREAGE",
                    value: isFinite(cropDetail.stat.avgAcre) ? `${cropDetail.stat.avgAcre.toFixed(2)}` : "—",
                    sub: "acres",
                    color: "#007BFF",
                  },
                  {
                    label: "AVG NET INCOME",
                    value: formatUSD(cropDetail.stat.avgNetIncome),
                    sub: "per grower",
                    color: cropDetail.stat.avgNetIncome >= 0 ? "#00CCCC" : "#FB8500",
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-lg p-2.5"
                    style={{
                      background: "var(--card-bg-hover)",
                      borderLeft: `3px solid ${kpi.color}`,
                    }}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-0.5">
                      {kpi.label}
                    </div>
                    <div className="text-base font-bold font-mono" style={{ color: kpi.color }}>
                      {kpi.value}
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Additional stats */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-center py-1.5 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)]">Median Net Inc</div>
                  <div className="text-xs font-mono font-bold mt-0.5" style={{ color: "#007BFF" }}>
                    {formatUSD(cropDetail.medianNet)}
                  </div>
                </div>
                <div className="text-center py-1.5 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)]">Income/Acre</div>
                  <div className="text-xs font-mono font-bold mt-0.5" style={{ color: "#6F42C1" }}>
                    {formatUSD(cropDetail.incomePerAcre)}
                  </div>
                </div>
                <div className="text-center py-1.5 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)]">Total Acres</div>
                  <div className="text-xs font-mono font-bold mt-0.5">
                    {typeof cropDetail.stat.totalAcre === "number" ? cropDetail.stat.totalAcre.toFixed(0) : String(cropDetail.stat.totalAcre ?? "—")}
                  </div>
                </div>
              </div>

              {/* Yield Distribution Histogram */}
              {cropDetail.yieldHistogram.length > 0 && (
                <SubChart
                  title={`${CROP_NAMES[selectedCrop]} Yield Distribution`}
                  tableData={cropDetail.yieldHistogram.map((d) => ({ Range: d.name, Farmers: d.count }))}
                  expandedContent={
                    <MiniBarChart
                      data={cropDetail.yieldHistogram}
                      dataKey="count"
                      nameKey="name"
                      color={CROP_COLORS[selectedCrop]}
                      height={300}
                      tooltipTitle="Yield Distribution"
                      tooltipUnit="farmers"
                    />
                  }
                >
                  <MiniBarChart
                    data={cropDetail.yieldHistogram}
                    dataKey="count"
                    nameKey="name"
                    color={CROP_COLORS[selectedCrop]}
                    height={130}
                    tooltipTitle="Yield Distribution"
                    tooltipUnit="farmers"
                  />
                </SubChart>
              )}

              {/* Acreage Distribution Histogram */}
              {cropDetail.acreHistogram.length > 0 && (
                <SubChart
                  title={`${CROP_NAMES[selectedCrop]} Acreage Distribution`}
                  tableData={cropDetail.acreHistogram.map((d) => ({ Range: d.name, Farmers: d.count }))}
                  expandedContent={
                    <MiniBarChart
                      data={cropDetail.acreHistogram}
                      dataKey="count"
                      nameKey="name"
                      color="#007BFF"
                      height={300}
                      tooltipTitle="Acreage Distribution"
                      tooltipUnit="farmers"
                    />
                  }
                >
                  <MiniBarChart
                    data={cropDetail.acreHistogram}
                    dataKey="count"
                    nameKey="name"
                    color="#007BFF"
                    height={130}
                    tooltipTitle="Acreage Distribution"
                    tooltipUnit="farmers"
                  />
                </SubChart>
              )}

              {/* Economics breakdown */}
              <SubChart
                title="Crop Economics"
                tableData={[
                  { Metric: "Avg Income", "Value (USD)": Math.round(cropDetail.stat.avgIncome) },
                  { Metric: "Avg Expenses", "Value (USD)": Math.round(cropDetail.stat.avgExpenses) },
                  { Metric: "Avg Net Income", "Value (USD)": Math.round(cropDetail.stat.avgNetIncome) },
                  { Metric: "Income per Acre", "Value (USD)": Math.round(cropDetail.incomePerAcre) },
                ]}
              >
                <div className="space-y-1">
                  <StatRow
                    label="Avg Income"
                    value={formatUSD(cropDetail.stat.avgIncome)}
                    color="#00CCCC"
                  />
                  <StatRow
                    label="Avg Expenses"
                    value={formatUSD(cropDetail.stat.avgExpenses)}
                    color="#FB8500"
                  />
                  <StatRow
                    label="Avg Net Income"
                    value={formatUSD(cropDetail.stat.avgNetIncome)}
                    color={cropDetail.stat.avgNetIncome >= 0 ? "#00CCCC" : "#FB8500"}
                  />
                  <StatRow
                    label="Income per Acre"
                    value={formatUSD(cropDetail.incomePerAcre)}
                    color="#6F42C1"
                  />
                </div>
              </SubChart>
            </>
          )}

          {/* Per-crop selected but no growers */}
          {selectedCrop !== null && !cropDetail && (
            <div className="text-center py-8 text-[var(--text-tertiary)]">
              <p className="text-sm">No {CROP_NAMES[selectedCrop] || selectedCrop} data in current selection</p>
              <button
                onClick={() => setSelectedCrop(null)}
                className="text-xs text-[var(--color-brand-gold)] mt-2 underline"
              >
                Back to overview
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
