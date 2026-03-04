"use client";

import { useMemo, useState } from "react";
import { DollarSign, Wheat, Briefcase, PawPrint, AlertTriangle, TrendingDown } from "lucide-react";
import { formatUSD } from "@/lib/utils/formatters";
import { CROPS, CROP_NAMES, CROP_COLORS, INCOME_SOURCE_COLORS } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
import { useCropStats } from "@/hooks/useCropStats";
import {
  Section,
  SubChart,
  MiniBarChart,
  MiniColorBarChart,
  MiniGroupedBarChart,
  CropTabBar,
  StatRow,
  safeMean,
  SectionActionLink,
  type TableRow,
} from "./shared";

/** Interactive stacked composition bar with proper hover tooltip */
function CompositionBar({ segments }: { segments: { key: string; label: string; pct: number; value: number; color: string }[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredSeg = hovered ? segments.find((s) => s.key === hovered) : null;

  // Calculate left position for tooltip based on hovered segment
  let tooltipLeftPct = 50;
  if (hoveredSeg) {
    let cumPct = 0;
    for (const seg of segments) {
      if (seg.key === hovered) {
        tooltipLeftPct = cumPct + seg.pct / 2;
        break;
      }
      cumPct += seg.pct;
    }
  }

  return (
    <div className="relative">
      <div className="flex w-full h-4 rounded-full overflow-hidden">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="h-full cursor-pointer transition-opacity duration-150"
            style={{
              width: `${seg.pct}%`,
              background: seg.color,
              minWidth: 4,
              opacity: hovered !== null && hovered !== seg.key ? 0.4 : hovered === seg.key ? 1 : 0.85,
            }}
            onMouseEnter={() => setHovered(seg.key)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>
      {/* Styled floating tooltip rendered outside overflow-hidden */}
      {hoveredSeg && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{ bottom: 20, left: `${tooltipLeftPct}%`, transform: "translateX(-50%)" }}
        >
          <div
            className="px-2.5 py-1.5 rounded-lg whitespace-nowrap"
            style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-tooltip)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hoveredSeg.color }} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{hoveredSeg.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>{formatUSD(hoveredSeg.value)} USD</span>
              <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>({hoveredSeg.pct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  data: Farmer[];
}

/* ── Crop income field mapping ── */
const CROP_NET_INCOME_KEY: Record<string, keyof Farmer> = {
  mint: "mintNetIncome",
  rice: "riceNetIncome",
  potato: "potatoNetIncome",
  wheat: "wheatNetIncome",
  mustard: "mustardNetIncome",
};

/* ── Income distribution bins ── */
const INCOME_BINS = [
  { label: "< $50", min: -Infinity, max: 50 },
  { label: "$50-200", min: 50, max: 200 },
  { label: "$200-500", min: 200, max: 500 },
  { label: "$500-1K", min: 500, max: 1000 },
  { label: "$1K-2K", min: 1000, max: 2000 },
  { label: "$2K+", min: 2000, max: Infinity },
];

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function IncomeCompositionSection({ data }: Props) {
  const { cropStats, cropRecords, loading: cropLoading } = useCropStats();
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

  /* ===================================================================
     OVERVIEW STATS (shown when selectedCrop === null)
     =================================================================== */
  const incomeStats = useMemo(() => {
    if (!data.length) return null;
    const incomes = data
      .map((f) => f.totalNetIncomeUsd)
      .filter((v): v is number => v != null && isFinite(v));
    const avgTotal = incomes.length ? safeMean(incomes) : 0;
    const medTotal = incomes.length
      ? (() => {
          const s = [...incomes].sort((a, b) => a - b);
          const m = Math.floor(s.length / 2);
          return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
        })()
      : 0;

    const meanPerFarmer = (key: keyof Farmer) => {
      let total = 0;
      for (const f of data) {
        const v = f[key] as number | null;
        if (v != null && isFinite(v)) total += Math.max(0, v);
      }
      return total / data.length;
    };

    const cropKeys = CROPS.map((c) => `${c}NetIncome` as keyof Farmer);
    const totalCropPerFarmer =
      cropKeys.reduce((sum, key) => sum + meanPerFarmer(key), 0) +
      meanPerFarmer("otherCropsNetIncome");
    const offFarmPerFarmer = meanPerFarmer("offFarmNetIncome");
    const livestockPerFarmer = meanPerFarmer("livestockIncome");
    const sumParts = totalCropPerFarmer + offFarmPerFarmer + livestockPerFarmer;

    const cropPct = sumParts > 0 ? (totalCropPerFarmer / sumParts) * 100 : 0;
    const offFarmPct = sumParts > 0 ? (offFarmPerFarmer / sumParts) * 100 : 0;
    const livestockPct = sumParts > 0 ? (livestockPerFarmer / sumParts) * 100 : 0;

    const offFarmDeps = data
      .map((f) => f.offFarmDependency)
      .filter((v): v is number => v != null && isFinite(v));
    const avgOffFarmDep = offFarmDeps.length ? safeMean(offFarmDeps) : 0;

    const dailyIncomes = data
      .map((f) => f.netIncomeDailyIndividual)
      .filter((v): v is number => v != null && isFinite(v));
    const avgDailyPerCapita = dailyIncomes.length ? safeMean(dailyIncomes) : 0;

    const cropDetails = CROPS.map((crop) => {
      const key = `${crop}NetIncome` as keyof Farmer;
      const growers = data.filter(
        (f) => f[key] != null && isFinite(f[key] as number) && (f[key] as number) > 0
      );
      return {
        crop,
        name: CROP_NAMES[crop],
        growers: growers.length,
        avg: growers.length ? safeMean(growers.map((f) => f[key] as number)) : 0,
        color: CROP_COLORS[crop],
      };
    }).sort((a, b) => b.avg - a.avg);

    const topCrop = cropDetails[0];

    return {
      avgTotal,
      medTotal,
      totalCropPerFarmer,
      offFarmPerFarmer,
      livestockPerFarmer,
      cropPct,
      offFarmPct,
      livestockPct,
      avgOffFarmDep,
      avgDailyPerCapita,
      cropDetails,
      topCrop,
    };
  }, [data]);

  /* ===================================================================
     PER-CROP DETAIL STATS (shown when a crop is selected)
     =================================================================== */
  const cropDetail = useMemo(() => {
    if (!selectedCrop || !data.length) return null;
    const incKey = CROP_NET_INCOME_KEY[selectedCrop];
    if (!incKey) return null;

    // Growers: farmers where this crop's net income > 0
    const growers = data.filter((f) => {
      const v = f[incKey] as number | null;
      return v != null && isFinite(v) && v > 0;
    });

    if (!growers.length) return null;

    const cropIncomes = growers.map((f) => f[incKey] as number);
    const avgNetIncome = safeMean(cropIncomes);
    const medianIncome = median(cropIncomes);
    const farmerShare = (growers.length / data.length) * 100;

    // Income distribution histogram
    const histogramData = INCOME_BINS.map((bin) => ({
      name: bin.label,
      count: cropIncomes.filter((v) => v >= bin.min && v < bin.max).length,
    }));

    // Income composition for growers of this crop
    const avgTotal = safeMean(
      growers
        .map((f) => f.totalNetIncomeUsd)
        .filter((v): v is number => v != null && isFinite(v))
    );
    const avgThisCrop = avgNetIncome;
    const avgOffFarm = safeMean(
      growers
        .map((f) => f.offFarmNetIncome)
        .filter((v): v is number => v != null && isFinite(v))
    );
    // Other on-farm = total - this crop - off-farm (with floor at 0)
    const avgOtherOnFarm = Math.max(0, avgTotal - avgThisCrop - avgOffFarm);

    const compositionTotal = avgThisCrop + avgOffFarm + avgOtherOnFarm;
    const thisCropPct = compositionTotal > 0 ? (avgThisCrop / compositionTotal) * 100 : 0;
    const offFarmPct = compositionTotal > 0 ? (avgOffFarm / compositionTotal) * 100 : 0;
    const otherOnFarmPct = compositionTotal > 0 ? (avgOtherOnFarm / compositionTotal) * 100 : 0;

    return {
      growerCount: growers.length,
      avgNetIncome,
      medianIncome,
      farmerShare,
      histogramData,
      avgTotal,
      composition: {
        thisCrop: { value: avgThisCrop, pct: thisCropPct },
        offFarm: { value: avgOffFarm, pct: offFarmPct },
        otherOnFarm: { value: avgOtherOnFarm, pct: otherOnFarmPct },
      },
    };
  }, [selectedCrop, data]);

  /* ===================================================================
     OVERVIEW CHART DATA
     =================================================================== */
  const cropBarData = useMemo(() => {
    if (!incomeStats) return [];
    return incomeStats.cropDetails
      .filter((c) => c.avg > 0)
      .map((c) => ({
        name: `${c.name} (${c.growers})`,
        value: Math.round(c.avg),
        color: c.color,
      }));
  }, [incomeStats]);

  const sourceCards = useMemo(() => {
    if (!incomeStats) return [];
    return [
      {
        label: "Crops",
        icon: Wheat,
        value: incomeStats.totalCropPerFarmer,
        pct: incomeStats.cropPct,
        color: INCOME_SOURCE_COLORS.crops,
      },
      {
        label: "Off-Farm",
        icon: Briefcase,
        value: incomeStats.offFarmPerFarmer,
        pct: incomeStats.offFarmPct,
        color: INCOME_SOURCE_COLORS.offFarm,
      },
      {
        label: "Livestock",
        icon: PawPrint,
        value: incomeStats.livestockPerFarmer,
        pct: incomeStats.livestockPct,
        color: INCOME_SOURCE_COLORS.livestock,
      },
    ];
  }, [incomeStats]);

  const incomeVsExpensesData = useMemo(() => {
    if (!cropStats.length) return [];
    return cropStats.map((cs) => ({
      name: cs.name,
      Income: Math.round(cs.avgIncome),
      Expenses: Math.round(cs.avgExpenses),
    }));
  }, [cropStats]);

  const cropDetailTableRows: TableRow[] = useMemo(() => {
    if (!cropStats.length) return [];
    return cropStats.map((cs) => ({
      Crop: cs.name,
      Farmers: cs.farmerCount,
      "Avg Yield": cs.avgYield.toFixed(1),
      "Avg Acres": cs.avgAcre.toFixed(2),
      "Avg Income (USD)": Math.round(cs.avgIncome),
      "Avg Expenses (USD)": Math.round(cs.avgExpenses),
      "Avg Net Income (USD)": Math.round(cs.avgNetIncome),
    }));
  }, [cropStats]);

  const tableData: TableRow[] = useMemo(() => {
    if (!incomeStats) return [];
    const rows: TableRow[] = [
      { Source: "Crops (Total)", "Avg Income (USD)": Math.round(incomeStats.totalCropPerFarmer), "% of Total": `${incomeStats.cropPct.toFixed(1)}%` },
      { Source: "Off-Farm", "Avg Income (USD)": Math.round(incomeStats.offFarmPerFarmer), "% of Total": `${incomeStats.offFarmPct.toFixed(1)}%` },
      { Source: "Livestock", "Avg Income (USD)": Math.round(incomeStats.livestockPerFarmer), "% of Total": `${incomeStats.livestockPct.toFixed(1)}%` },
    ];
    for (const cs of cropStats) {
      rows.push({
        Source: `  ${cs.name}`,
        "Avg Income (USD)": Math.round(cs.avgIncome),
        "% of Total": `(${cs.farmerCount} farmers, yield: ${cs.avgYield.toFixed(1)}, acres: ${cs.avgAcre.toFixed(2)})`,
      });
    }
    return rows;
  }, [incomeStats, cropStats]);

  const insight = useMemo(() => {
    if (!incomeStats) return null;
    const { avgOffFarmDep, avgDailyPerCapita, offFarmPct } = incomeStats;
    const warnings: string[] = [];
    if (avgDailyPerCapita > 0 && avgDailyPerCapita < 2.15) {
      warnings.push(`Daily per-capita income is $${avgDailyPerCapita.toFixed(2)} — below the $2.15 extreme poverty line.`);
    }
    if (avgOffFarmDep > 50) {
      warnings.push(`${avgOffFarmDep.toFixed(0)}% off-farm dependency signals vulnerability to non-agricultural income shocks.`);
    }
    if (offFarmPct > 40) {
      warnings.push(`Off-farm income is ${offFarmPct.toFixed(0)}% of total — agricultural programs alone won't close income gaps.`);
    }
    return { warnings };
  }, [incomeStats]);

  /* ===================================================================
     CROP TAB DATA
     =================================================================== */
  const cropTabs = useMemo(() => {
    if (!incomeStats) return [];
    return incomeStats.cropDetails
      .filter((c) => c.growers > 0)
      .sort((a, b) => b.growers - a.growers)
      .map((c) => ({
        key: c.crop,
        name: c.name,
        color: c.color,
        count: c.growers,
      }));
  }, [incomeStats]);

  return (
    <Section
      id="analytics-income"
      title="Income Composition"
      icon={<DollarSign size={14} />}
      description="Income sources, crop breakdown & poverty indicators"
      expandable
      defaultOpen
      tableData={tableData}
    >
      {incomeStats && (
        <>
          {/* ── Crop Tab Bar ── */}
          {cropTabs.length > 0 && (
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
              {/* Insight Banners */}
              {insight && insight.warnings.length > 0 && (
                <div
                  className="rounded-lg px-3 py-2 space-y-1"
                  style={{
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.15)",
                  }}
                >
                  {insight.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {i === 0 ? (
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color: "#FB8500" }} />
                      ) : (
                        <TrendingDown size={11} className="shrink-0 mt-0.5" style={{ color: "#FB8500" }} />
                      )}
                      <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Avg Net Income headline */}
              <div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Avg Net Income</div>
                <div className="text-lg font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                  {formatUSD(incomeStats.avgTotal)}
                </div>
              </div>

              {/* Source Cards */}
              <div className="grid grid-cols-3 gap-2">
                {sourceCards.map((source) => {
                  const Icon = source.icon;
                  return (
                    <div
                      key={source.label}
                      className="rounded-xl p-2 relative overflow-hidden"
                      style={{
                        background: "var(--card-bg-hover)",
                        borderLeft: `3px solid ${source.color}`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={12} style={{ color: source.color }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {source.label}
                        </span>
                      </div>
                      <div className="text-sm font-bold font-mono" style={{ color: source.color }}>
                        {formatUSD(source.value)}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        {source.pct.toFixed(0)}% of total
                      </div>
                      <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${source.pct}%`, background: source.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Poverty & Dependency indicators */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-center py-1.5 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Off-Farm Dep.</div>
                  <div className="text-xs font-mono font-bold mt-0.5" style={{ color: incomeStats.avgOffFarmDep > 50 ? "#FB8500" : undefined }}>
                    {incomeStats.avgOffFarmDep.toFixed(1)}%
                  </div>
                </div>
                {incomeStats.avgDailyPerCapita > 0 && (
                  <div className="text-center py-1.5 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                    <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Daily/Person</div>
                    <div
                      className="text-xs font-mono font-bold mt-0.5"
                      style={{ color: incomeStats.avgDailyPerCapita < 2.15 ? "#FB8500" : "#00CCCC" }}
                    >
                      ${incomeStats.avgDailyPerCapita.toFixed(2)}
                    </div>
                  </div>
                )}
                {incomeStats.topCrop && incomeStats.topCrop.growers > 0 && (
                  <div className="text-center py-1.5 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                    <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Top Crop</div>
                    <div className="text-xs font-mono font-bold mt-0.5" style={{ color: incomeStats.topCrop.color }}>
                      {incomeStats.topCrop.name}
                    </div>
                  </div>
                )}
              </div>

              {/* Per-Crop income bar chart */}
              {cropBarData.length > 0 && (
                <SubChart
                  title="Per-Crop Net Income (Growers Only)"
                  tableData={cropBarData.map((d) => ({ Crop: d.name, "Avg Net Income (USD)": d.value }))}
                  expandedContent={
                    <MiniColorBarChart data={cropBarData} height={280} tooltipTitle="Avg Net Income (per farmer)" tooltipFormatter={(v) => formatUSD(v)} tooltipUnit="USD" layout="vertical" />
                  }
                >
                  <MiniColorBarChart data={cropBarData} height={110} tooltipTitle="Avg Net Income (per farmer)" tooltipFormatter={(v) => formatUSD(v)} tooltipUnit="USD" layout="vertical" />
                </SubChart>
              )}

              {/* Per-Crop Detail Table */}
              {!cropLoading && cropStats.length > 0 && (
                <SubChart
                  title="Per-Crop Detail"
                  tableData={cropDetailTableRows}
                  expandedContent={
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                            <th className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Crop</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Farmers</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Avg Yield</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Avg Acres</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Avg Income</th>
                            <th className="text-right px-2 py-1.5 font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Avg Expenses</th>
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
                              <td className="text-right px-2 py-1.5 font-mono text-[var(--text-secondary)]">{cs.avgYield.toFixed(1)}</td>
                              <td className="text-right px-2 py-1.5 font-mono text-[var(--text-secondary)]">{cs.avgAcre.toFixed(2)}</td>
                              <td className="text-right px-2 py-1.5 font-mono" style={{ color: "#00CCCC" }}>{formatUSD(cs.avgIncome)}</td>
                              <td className="text-right px-2 py-1.5 font-mono" style={{ color: "#FB8500" }}>{formatUSD(cs.avgExpenses)}</td>
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
                          <th className="text-right px-1.5 py-1 font-semibold text-[var(--text-tertiary)]">Net Inc</th>
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
                            <td className="text-right px-1.5 py-1 font-mono text-[var(--text-secondary)]">{cs.avgYield.toFixed(1)}</td>
                            <td className="text-right px-1.5 py-1 font-mono text-[var(--text-secondary)]">{cs.avgAcre.toFixed(2)}</td>
                            <td className="text-right px-1.5 py-1 font-mono font-bold" style={{ color: cs.avgNetIncome >= 0 ? "#00CCCC" : "#FB8500" }}>{formatUSD(cs.avgNetIncome)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SubChart>
              )}

              {/* Income vs Expenses grouped bar chart */}
              {incomeVsExpensesData.length > 0 && (
                <SubChart
                  title="Income vs Expenses by Crop"
                  tableData={incomeVsExpensesData.map((d) => ({ Crop: d.name, "Avg Income (USD)": d.Income, "Avg Expenses (USD)": d.Expenses }))}
                  expandedContent={
                    <MiniGroupedBarChart
                      data={incomeVsExpensesData}
                      keys={[
                        { dataKey: "Income", color: "#00CCCC", label: "Avg Income" },
                        { dataKey: "Expenses", color: "#FB8500", label: "Avg Expenses" },
                      ]}
                      nameKey="name"
                      height={280}
                      tooltipTitle="Avg Income/Expenses (per farmer)"
                      tooltipFormatter={(v) => formatUSD(v)}
                      tooltipUnit="USD"
                    />
                  }
                >
                  <MiniGroupedBarChart
                    data={incomeVsExpensesData}
                    keys={[
                      { dataKey: "Income", color: "#00CCCC", label: "Avg Income" },
                      { dataKey: "Expenses", color: "#FB8500", label: "Avg Expenses" },
                    ]}
                    nameKey="name"
                    height={120}
                    tooltipTitle="Avg Income/Expenses (per farmer)"
                    tooltipFormatter={(v) => formatUSD(v)}
                    tooltipUnit="USD"
                  />
                </SubChart>
              )}

              <SectionActionLink href="/analytics" label="Simulate Income Scenarios" />
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
                    value: cropDetail.growerCount.toLocaleString(),
                    sub: `of ${data.length}`,
                    color: CROP_COLORS[selectedCrop],
                  },
                  {
                    label: "AVG NET INCOME",
                    value: formatUSD(cropDetail.avgNetIncome),
                    sub: "per grower",
                    color: "#00CCCC",
                  },
                  {
                    label: "MEDIAN INCOME",
                    value: formatUSD(cropDetail.medianIncome),
                    sub: "per grower",
                    color: "#007BFF",
                  },
                  {
                    label: "FARMER SHARE",
                    value: `${cropDetail.farmerShare.toFixed(1)}%`,
                    sub: "of all farmers",
                    color: "#6F42C1",
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

              {/* Income Distribution Histogram */}
              <SubChart
                title={`${CROP_NAMES[selectedCrop]} Income Distribution`}
                tableData={cropDetail.histogramData.map((d) => ({ Range: d.name, Farmers: d.count }))}
                expandedContent={
                  <MiniBarChart
                    data={cropDetail.histogramData}
                    dataKey="count"
                    nameKey="name"
                    color={CROP_COLORS[selectedCrop]}
                    height={300}
                    tooltipTitle="Income Distribution"
                    tooltipUnit="farmers"
                  />
                }
              >
                <MiniBarChart
                  data={cropDetail.histogramData}
                  dataKey="count"
                  nameKey="name"
                  color={CROP_COLORS[selectedCrop]}
                  height={130}
                  tooltipTitle="Income Distribution"
                  tooltipUnit="farmers"
                />
              </SubChart>

              {/* Income Composition Breakdown */}
              <SubChart
                title="Income Composition (Growers)"
                tableData={[
                  { Source: `${CROP_NAMES[selectedCrop]} Net Income`, "Avg (USD)": Math.round(cropDetail.composition.thisCrop.value), "%": `${cropDetail.composition.thisCrop.pct.toFixed(1)}%` },
                  { Source: "Off-Farm Income", "Avg (USD)": Math.round(cropDetail.composition.offFarm.value), "%": `${cropDetail.composition.offFarm.pct.toFixed(1)}%` },
                  { Source: "Other On-Farm", "Avg (USD)": Math.round(cropDetail.composition.otherOnFarm.value), "%": `${cropDetail.composition.otherOnFarm.pct.toFixed(1)}%` },
                ]}
              >
                <div className="space-y-2">
                  {/* Stacked composition bar with hover tooltips */}
                  <CompositionBar
                    segments={[
                      cropDetail.composition.thisCrop.pct > 0 ? {
                        key: "crop",
                        label: CROP_NAMES[selectedCrop],
                        pct: cropDetail.composition.thisCrop.pct,
                        value: cropDetail.composition.thisCrop.value,
                        color: CROP_COLORS[selectedCrop],
                      } : null,
                      cropDetail.composition.offFarm.pct > 0 ? {
                        key: "offFarm",
                        label: "Off-Farm Income",
                        pct: cropDetail.composition.offFarm.pct,
                        value: cropDetail.composition.offFarm.value,
                        color: INCOME_SOURCE_COLORS.offFarm,
                      } : null,
                      cropDetail.composition.otherOnFarm.pct > 0 ? {
                        key: "otherOnFarm",
                        label: "Other On-Farm",
                        pct: cropDetail.composition.otherOnFarm.pct,
                        value: cropDetail.composition.otherOnFarm.value,
                        color: "#FFB703",
                      } : null,
                    ].filter(Boolean) as { key: string; label: string; pct: number; value: number; color: string }[]}
                  />

                  {/* Legend + values */}
                  <div className="space-y-1">
                    {[
                      {
                        label: `${CROP_NAMES[selectedCrop]} Net Income`,
                        value: cropDetail.composition.thisCrop.value,
                        pct: cropDetail.composition.thisCrop.pct,
                        color: CROP_COLORS[selectedCrop],
                      },
                      {
                        label: "Off-Farm Income",
                        value: cropDetail.composition.offFarm.value,
                        pct: cropDetail.composition.offFarm.pct,
                        color: INCOME_SOURCE_COLORS.offFarm,
                      },
                      {
                        label: "Other On-Farm",
                        value: cropDetail.composition.otherOnFarm.value,
                        pct: cropDetail.composition.otherOnFarm.pct,
                        color: "#FFB703",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="text-[10px] text-[var(--text-secondary)]">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold" style={{ color: item.color }}>
                            {formatUSD(item.value)}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--text-tertiary)]">
                            {item.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total line */}
                  <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid var(--card-border)" }}>
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Total Net Income</span>
                    <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                      {formatUSD(cropDetail.avgTotal)}
                    </span>
                  </div>
                </div>
              </SubChart>
            </>
          )}

          {/* Per-crop selected but no growers */}
          {selectedCrop !== null && !cropDetail && (
            <div className="text-center py-8 text-[var(--text-tertiary)]">
              <p className="text-sm">No {CROP_NAMES[selectedCrop] || selectedCrop} growers in current selection</p>
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
