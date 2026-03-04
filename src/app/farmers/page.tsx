"use client";

import { useMemo, useState, useCallback } from "react";
import { Search, X, MapPin, Wheat, ChevronLeft, ChevronRight, ShieldAlert, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import { useData } from "@/providers/DataProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useDashboardLayout } from "@/providers/DashboardLayoutProvider";
import BentoGrid from "@/components/layout/BentoGrid";
import BentoCard from "@/components/layout/BentoCard";
import CollapsibleFilterBar from "@/components/dashboard/CollapsibleFilterBar";
import DashboardMap from "@/components/maps/DashboardMap";
import ProjectBadge from "@/components/ui/SegmentBadge";
import ChangeIndicator from "@/components/ui/ChangeIndicator";
import ComparativeChat from "@/components/dashboard/comparative/ComparativeChat";
import CropIncomeBarCard from "@/components/charts/CropIncomeBarCard";
import { formatUSD } from "@/lib/utils/formatters";
import { CROP_COLORS, CROP_NAMES, PROJECT_COLORS } from "@/lib/data/constants";
import { Farmer } from "@/lib/data/types";

const PAGE_SIZE = 20;

const CROP_FIELDS: { key: keyof Farmer; crop: string }[] = [
  { key: "mintNetIncome", crop: "mint" },
  { key: "riceNetIncome", crop: "rice" },
  { key: "wheatNetIncome", crop: "wheat" },
  { key: "potatoNetIncome", crop: "potato" },
  { key: "mustardNetIncome", crop: "mustard" },
];

/* ── Matched farmer for comparative view ── */
interface MatchedFarmer {
  id: number;
  name: string;
  village: string;
  project: string;
  baseline: Farmer;
  midline: Farmer;
  incomeChange: number;
  incomeChangePct: number;
}

export default function FarmersPage() {
  const { role } = useAuth();

  if (role === "viewer") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="brand-card rounded-2xl p-10 max-w-md text-center"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(239, 68, 68, 0.12)" }}
          >
            <ShieldAlert size={28} className="text-[var(--color-negative)]" />
          </div>
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            Admin Access Required
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            Individual farmer profiles contain personally identifiable information.
            Please sign in with admin credentials to access this page.
          </p>
        </div>
      </div>
    );
  }

  const { loading, getRound } = useData();
  const { geoFiltered: filtered, geoFilterRound } = useGeo();
  const { viewMode } = useDashboardLayout();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Farmer | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchedFarmer | null>(null);
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const isComparative = viewMode === "comparative";

  /* ── Multi-round data ── */
  const baselineFarmers = useMemo(() => geoFilterRound(getRound("baseline").farmers), [getRound, geoFilterRound]);
  const midlineFarmers = useMemo(() => geoFilterRound(getRound("midline").farmers), [getRound, geoFilterRound]);

  /* Active farmers for single-round modes */
  const activeFarmers = useMemo(() => {
    if (viewMode === "midline") return midlineFarmers;
    if (viewMode === "baseline") return baselineFarmers;
    return filtered; // fallback
  }, [viewMode, baselineFarmers, midlineFarmers, filtered]);

  /* ── Matched farmers for comparative mode ── */
  const matchedFarmers = useMemo<MatchedFarmer[]>(() => {
    if (!isComparative) return [];
    const midlineMap = new Map(midlineFarmers.map((f) => [f.id, f]));
    const matched: MatchedFarmer[] = [];
    for (const bf of baselineFarmers) {
      const mf = midlineMap.get(bf.id);
      if (mf) {
        const bIncome = bf.totalNetIncomeUsd ?? 0;
        const mIncome = mf.totalNetIncomeUsd ?? 0;
        matched.push({
          id: bf.id,
          name: bf.name ?? mf.name ?? "Unknown",
          village: bf.village ?? mf.village ?? "",
          project: bf.project ?? mf.project ?? "",
          baseline: bf,
          midline: mf,
          incomeChange: mIncome - bIncome,
          incomeChangePct: bIncome !== 0 ? ((mIncome - bIncome) / Math.abs(bIncome)) * 100 : 0,
        });
      }
    }
    return matched;
  }, [isComparative, baselineFarmers, midlineFarmers]);

  /* ── Search & sort for single-round view ── */
  const searched = useMemo(() => {
    const data = isComparative ? [] : activeFarmers;
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.village?.toLowerCase().includes(q) ||
        f.block?.toLowerCase().includes(q)
    );
  }, [activeFarmers, search, isComparative]);

  const sorted = useMemo(() => {
    return [...searched].sort((a, b) => {
      const aVal = a[sortBy as keyof Farmer];
      const bVal = b[sortBy as keyof Farmer];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [searched, sortBy, sortDir]);

  /* ── Search & sort for comparative view ── */
  const searchedMatched = useMemo(() => {
    if (!isComparative) return [];
    if (!search.trim()) return matchedFarmers;
    const q = search.toLowerCase();
    return matchedFarmers.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.village?.toLowerCase().includes(q)
    );
  }, [matchedFarmers, search, isComparative]);

  const sortedMatched = useMemo(() => {
    return [...searchedMatched].sort((a, b) => {
      if (sortBy === "incomeChange") {
        return sortDir === "asc" ? a.incomeChange - b.incomeChange : b.incomeChange - a.incomeChange;
      }
      if (sortBy === "incomeChangePct") {
        return sortDir === "asc" ? a.incomeChangePct - b.incomeChangePct : b.incomeChangePct - a.incomeChangePct;
      }
      if (sortBy === "baselineIncome") {
        const av = a.baseline.totalNetIncomeUsd ?? 0;
        const bv = b.baseline.totalNetIncomeUsd ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (sortBy === "midlineIncome") {
        const av = a.midline.totalNetIncomeUsd ?? 0;
        const bv = b.midline.totalNetIncomeUsd ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      // Default: name
      const cmp = (a.name ?? "").localeCompare(b.name ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [searchedMatched, sortBy, sortDir]);

  const displayData = isComparative ? sortedMatched : sorted;
  const paged = displayData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(displayData.length / PAGE_SIZE);

  const mapFarmers = useMemo(() => {
    const source = isComparative
      ? matchedFarmers.map((m) => m.midline)
      : searched;
    return source
      .filter((f) => f.lat && f.lon)
      .map((f) => ({
        id: f.id,
        lat: f.lat!,
        lon: f.lon!,
        name: f.name,
        project: f.project,
        village: f.village,
      }));
  }, [isComparative, matchedFarmers, searched]);

  /* ── Double-click farmer dot on map → open detail modal ── */
  const handleFarmerDoubleClick = useCallback((farmerId: number) => {
    if (isComparative) {
      const match = matchedFarmers.find((m) => m.id === farmerId);
      if (match) setSelectedMatch(match);
    } else {
      const farmer = (isComparative ? [] : activeFarmers).find((f) => f.id === farmerId);
      if (farmer) setSelected(farmer);
    }
  }, [isComparative, matchedFarmers, activeFarmers]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  /* ── Polygon double-click handler — filter by region name ── */
  const handlePolygonClick = useCallback((props: Record<string, unknown>) => {
    const regionName =
      (props.name as string) || (props.NAME as string) || (props.Name as string) ||
      (props.taluk as string) || (props.TALUK as string) || (props.Taluk as string) ||
      (props.block as string) || (props.BLOCK as string) || (props.Block as string) ||
      "";
    if (regionName) {
      setSearch(regionName);
      setPage(0);
    }
  }, []);

  /* ── Income bar helpers for modal ── */
  const getMaxCropIncome = (farmer: Farmer) => {
    const vals = CROP_FIELDS.map((c) => Math.max(0, (farmer[c.key] as number) || 0));
    return Math.max(...vals, 1);
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="skeleton h-12" />
        <BentoGrid cols={2}>
          <div className="skeleton h-96" />
          <div className="skeleton h-96" />
        </BentoGrid>
      </div>
    );
  }

  /* ── Sort indicator helper ── */
  const SortArrow = ({ col }: { col: string }) =>
    sortBy === col ? (
      <span className="ml-1 text-[var(--color-accent)]">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
    ) : null;

  return (
    <div className="flex">
      <div className="flex-1 min-w-0 space-y-4 pb-8">
      <CollapsibleFilterBar />

      {/* Search */}
      <div className="brand-card flex items-center gap-2 px-4 py-2.5 rounded-xl">
        <Search size={16} className="text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Search by name, village, or block..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          aria-label="Search farmers by name, village, or block"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--text-tertiary)]"
        />
        {search && (
          <button onClick={() => setSearch("")} className="cursor-pointer">
            <X size={14} className="text-[var(--text-tertiary)]" />
          </button>
        )}
        <span className="text-xs text-[var(--text-tertiary)] ml-2">
          {isComparative ? `${searchedMatched.length} matched` : `${searched.length} farmers`}
        </span>
      </div>

      {/* Comparative summary strip */}
      {isComparative && matchedFarmers.length > 0 && (
        <div
          className="brand-card rounded-xl px-4 py-3 flex items-center gap-6"
          style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)" }}
        >
          <div className="text-xs">
            <span className="text-[var(--text-tertiary)]">Matched farmers:</span>
            <span className="font-bold ml-1">{matchedFarmers.length}</span>
          </div>
          <div className="text-xs">
            <span className="text-[var(--text-tertiary)]">Avg income change:</span>
            <span className="font-bold font-mono ml-1" style={{ color: matchedFarmers.reduce((s, m) => s + m.incomeChange, 0) >= 0 ? "#00A17D" : "#910D63" }}>
              {formatUSD(matchedFarmers.reduce((s, m) => s + m.incomeChange, 0) / matchedFarmers.length)}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-[var(--text-tertiary)]">Improved:</span>
            <span className="font-bold ml-1 text-[#00A17D]">
              {matchedFarmers.filter((m) => m.incomeChange > 0).length}
            </span>
            <span className="text-[var(--text-tertiary)] mx-1">/</span>
            <span className="text-[var(--text-tertiary)]">Declined:</span>
            <span className="font-bold ml-1 text-[#910D63]">
              {matchedFarmers.filter((m) => m.incomeChange < 0).length}
            </span>
          </div>
        </div>
      )}

      <BentoGrid cols={2}>
        {/* Map */}
        <BentoCard className="p-0 overflow-hidden">
          <div className="p-4 pb-2 flex items-center gap-2">
            <MapPin size={14} className="text-[var(--text-tertiary)]" />
            <h3 className="text-sm font-semibold">Farmer Locations</h3>
            {isComparative && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,183,3,0.15)", color: "#FFB703" }}>
                Comparative
              </span>
            )}
          </div>
          <div className="px-2 pb-2" style={{ isolation: "isolate", position: "relative", zIndex: 0 }}>
            <DashboardMap
              farmers={mapFarmers}
              geoJsonUrl="/data/geo/taluks.geojson"
              height="450px"
              onPolygonClick={handlePolygonClick}
              onFarmerDoubleClick={handleFarmerDoubleClick}
            />
          </div>
        </BentoCard>

        {/* Table */}
        <BentoCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--color-surface-1)] z-10">
                {isComparative ? (
                  /* ── Comparative columns ── */
                  <tr className="border-b border-[var(--card-border)]">
                    {([
                      ["name", "Name"],
                      ["village", "Village"],
                      ["baselineIncome", "Baseline"],
                      ["midlineIncome", "Midline"],
                      ["incomeChange", "Change"],
                      ["project", "Project"],
                    ] as [string, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        className="text-left px-3 py-3 font-medium text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        <SortArrow col={key} />
                      </th>
                    ))}
                  </tr>
                ) : (
                  /* ── Single-round columns ── */
                  <tr className="border-b border-[var(--card-border)]">
                    {([
                      ["name", "Name"],
                      ["village", "Village"],
                      ["totalNetIncomeUsd", "Net Income"],
                      ["project", "Project"],
                    ] as [string, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        className="text-left px-4 py-3 font-medium text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                        onClick={() => handleSort(key)}
                        aria-sort={sortBy === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      >
                        {label}
                        <SortArrow col={key} />
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {isComparative
                  ? /* ── Comparative rows ── */
                    (paged as MatchedFarmer[]).map((m) => {
                      const isUp = m.incomeChange > 0;
                      const isDown = m.incomeChange < 0;
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-[var(--card-border)] hover:bg-[var(--card-bg-hover)] cursor-pointer transition-colors"
                          onClick={() => setSelectedMatch(m)}
                        >
                          <td className="px-3 py-2.5 font-medium">{m.name}</td>
                          <td className="px-3 py-2.5 text-[var(--text-secondary)]">{m.village}</td>
                          <td className="px-3 py-2.5 font-mono text-[var(--text-secondary)]">
                            {formatUSD(m.baseline.totalNetIncomeUsd)}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold">
                            {formatUSD(m.midline.totalNetIncomeUsd)}
                          </td>
                          <td className="px-3 py-2.5">
                            <ChangeIndicator
                              value={m.incomeChange}
                              format="currency"
                              percentChange={m.incomeChangePct}
                              size="sm"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <ProjectBadge project={m.project} size="sm" />
                          </td>
                        </tr>
                      );
                    })
                  : /* ── Single-round rows ── */
                    (paged as Farmer[]).map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-[var(--card-border)] hover:bg-[var(--card-bg-hover)] cursor-pointer transition-colors"
                        onClick={() => setSelected(f)}
                      >
                        <td className="px-4 py-2.5 font-medium">{f.name}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{f.village}</td>
                        <td className="px-4 py-2.5 font-mono">{formatUSD(f.totalNetIncomeUsd)}</td>
                        <td className="px-4 py-2.5">
                          <ProjectBadge project={f.project} size="sm" />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--card-border)]">
            <span className="text-xs text-[var(--text-tertiary)]">
              Page {page + 1} of {Math.max(totalPages, 1)} &middot; {displayData.length} results
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg brand-card disabled:opacity-30 cursor-pointer disabled:cursor-default transition-opacity"
              >
                <ChevronLeft size={12} />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg brand-card disabled:opacity-30 cursor-pointer disabled:cursor-default transition-opacity"
              >
                Next
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>

      {/* ── Single-round Farmer Detail Modal ── */}
      {selected && !isComparative && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="brand-card rounded-2xl p-6 max-w-lg w-full mx-4 space-y-5 animate-[fade-in_0.2s_ease-out]"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: (PROJECT_COLORS as Record<string, string>)[selected.project] || "#666" }}
                >
                  {selected.name?.charAt(0) || "?"}
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>{selected.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin size={10} className="text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-tertiary)]">{selected.village}, {selected.block}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors cursor-pointer">
                <X size={16} className="text-[var(--text-tertiary)]" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Age", value: selected.age ?? "—" },
                { label: "Gender", value: selected.gender ?? "—" },
                { label: "Farm", value: selected.totalAcre ? `${selected.totalAcre} ac` : "—" },
                { label: "Family", value: selected.totalFamilyMembers ?? "—" },
              ].map((stat) => (
                <div key={stat.label} className="text-center py-2 px-1 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">{stat.label}</div>
                  <div className="text-sm font-bold mt-0.5">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Project Group + District */}
            <div className="flex items-center gap-3">
              <ProjectBadge project={selected.project} />
              <span className="text-xs text-[var(--text-tertiary)]">&middot;</span>
              <span className="text-xs text-[var(--text-secondary)]">{selected.district}</span>
            </div>

            {/* Income Breakdown with visual bars */}
            <div className="border-t border-[var(--card-border)] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Wheat size={12} className="text-[var(--text-tertiary)]" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Crop Income</span>
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                  {formatUSD(selected.totalNetIncomeUsd)}
                </span>
              </div>
              <div className="space-y-2">
                {CROP_FIELDS.map(({ key, crop }) => {
                  const val = Math.max(0, (selected[key] as number) || 0);
                  const maxVal = getMaxCropIncome(selected);
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <div key={crop} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)] w-16 shrink-0">{CROP_NAMES[crop]}</span>
                      <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: "var(--card-bg-hover)" }}>
                        <div
                          className="h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1.5"
                          style={{ width: `${Math.max(pct, val > 0 ? 8 : 0)}%`, background: CROP_COLORS[crop] }}
                        >
                          {val > 0 && <span className="text-[9px] font-mono font-bold text-white">{formatUSD(val)}</span>}
                        </div>
                      </div>
                      {val === 0 && <span className="text-[10px] text-[var(--text-tertiary)] font-mono">—</span>}
                    </div>
                  );
                })}
              </div>
              {/* Off-farm + Livestock row */}
              <div className="flex gap-3 mt-1">
                <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Off-Farm</div>
                  <div className="text-xs font-mono font-bold mt-0.5">{formatUSD(selected.offFarmNetIncome)}</div>
                </div>
                <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Livestock</div>
                  <div className="text-xs font-mono font-bold mt-0.5">{formatUSD(selected.livestockIncome)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Comparative Farmer Detail Modal ── */}
      {selectedMatch && isComparative && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="rounded-2xl max-w-2xl w-full mx-4 overflow-hidden animate-[fade-in_0.2s_ease-out]"
            style={{
              background: "var(--color-surface-1)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px var(--card-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Accent gradient header bar ── */}
            <div
              className="px-6 pt-5 pb-4"
              style={{
                background: "linear-gradient(135deg, rgba(0,123,255,0.08) 0%, rgba(0,161,125,0.08) 100%)",
                borderBottom: "1px solid var(--card-border)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base"
                    style={{
                      background: (() => {
                        const c = (PROJECT_COLORS as Record<string, string>)[selectedMatch.project] || "#666";
                        return `linear-gradient(135deg, ${c}, ${c}cc)`;
                      })(),
                      boxShadow: `0 4px 12px ${(PROJECT_COLORS as Record<string, string>)[selectedMatch.project] || "#666"}40`,
                    }}
                  >
                    {selectedMatch.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                      {selectedMatch.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={11} className="text-[var(--text-tertiary)]" />
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {selectedMatch.village}, {selectedMatch.baseline.block}
                      </span>
                      <span className="mx-1 text-[var(--text-tertiary)]">&middot;</span>
                      <ProjectBadge project={selectedMatch.project} size="sm" />
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedMatch(null)} className="p-1.5 rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors cursor-pointer">
                  <X size={16} className="text-[var(--text-tertiary)]" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">

            {/* ── Demographics — top of card ── */}
            <div className="grid grid-cols-4 gap-2.5">
              {([
                { label: "Age", value: selectedMatch.midline.age ?? selectedMatch.baseline.age, isMono: true },
                { label: "Gender", value: selectedMatch.baseline.gender ?? selectedMatch.midline.gender, isMono: false },
                { label: "Farm (ac)", value: selectedMatch.midline.totalAcre ?? selectedMatch.baseline.totalAcre, isMono: true },
                { label: "Family", value: selectedMatch.midline.totalFamilyMembers ?? selectedMatch.baseline.totalFamilyMembers, isMono: true },
              ]).map((stat) => (
                <div
                  key={stat.label}
                  className="text-center py-2.5 px-1.5 rounded-xl"
                  style={{
                    background: "var(--color-surface-1)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">{stat.label}</div>
                  <div
                    className={`text-base font-bold mt-1 ${stat.isMono ? "font-mono" : ""}`}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {String(stat.value ?? "—")}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Net Income — single unified comparison card ── */}
            <div
              className="rounded-xl px-5 py-4"
              style={{
                background: "linear-gradient(135deg, rgba(91,141,239,0.06) 0%, rgba(45,212,168,0.06) 100%)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-3">
                Net Income
              </div>
              <div className="flex items-end justify-between">
                {/* Baseline side */}
                <div>
                  <div className="text-[10px] font-semibold mb-1" style={{ color: "var(--color-baseline)" }}>Baseline</div>
                  <div className="text-lg font-bold font-mono" style={{ color: "var(--color-baseline)" }}>
                    {formatUSD(selectedMatch.baseline.totalNetIncomeUsd)}
                  </div>
                </div>
                {/* Center: arrow + change */}
                <div className="flex flex-col items-center gap-1 px-3 pb-0.5">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold"
                    style={{
                      background: selectedMatch.incomeChange >= 0
                        ? "rgba(0,161,125,0.12)"
                        : "rgba(145,13,99,0.12)",
                      color: selectedMatch.incomeChange >= 0 ? "#00A17D" : "#910D63",
                    }}
                  >
                    {selectedMatch.incomeChange >= 0 ? (
                      <TrendingUp size={11} />
                    ) : (
                      <TrendingDown size={11} />
                    )}
                    <span>
                      {selectedMatch.incomeChange >= 0 ? "+" : ""}{formatUSD(selectedMatch.incomeChange)}
                      {` (${selectedMatch.incomeChangePct >= 0 ? "+" : ""}${selectedMatch.incomeChangePct.toFixed(1)}%)`}
                    </span>
                  </div>
                </div>
                {/* Midline side */}
                <div className="text-right">
                  <div className="text-[10px] font-semibold mb-1" style={{ color: "var(--color-midline)" }}>Midline</div>
                  <div className="text-xl font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                    {formatUSD(selectedMatch.midline.totalNetIncomeUsd)}
                  </div>
                </div>
              </div>
              {/* Thin visual progress bar */}
              {(() => {
                const bVal = selectedMatch.baseline.totalNetIncomeUsd ?? 0;
                const mVal = selectedMatch.midline.totalNetIncomeUsd ?? 0;
                const maxVal = Math.max(Math.abs(bVal), Math.abs(mVal), 1);
                return (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-bg-hover)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(Math.abs(bVal) / maxVal) * 100}%`, background: "color-mix(in srgb, var(--color-baseline) 31%, transparent)" }}
                      />
                    </div>
                    {/* Divider */}
                    <div className="w-px h-3 rounded-full" style={{ background: "var(--card-border)" }} />
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--card-bg-hover)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(Math.abs(mVal) / maxVal) * 100}%`, background: "var(--color-midline)" }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Crop income comparison — area chart */}
            <div className="pt-4" style={{ borderTop: "1px solid var(--card-border)" }}>
              <CropIncomeBarCard
                rows={CROP_FIELDS.map(({ key, crop }) => ({
                  crop: CROP_NAMES[crop] ?? crop,
                  color: CROP_COLORS[crop] ?? "var(--text-tertiary)",
                  baseline: Math.max(0, (selectedMatch.baseline[key] as number) || 0),
                  midline: Math.max(0, (selectedMatch.midline[key] as number) || 0),
                }))}
                extras={[
                  {
                    label: "Off-Farm",
                    baseline: (selectedMatch.baseline.offFarmNetIncome as number) ?? 0,
                    midline: (selectedMatch.midline.offFarmNetIncome as number) ?? 0,
                  },
                  {
                    label: "Livestock",
                    baseline: (selectedMatch.baseline.livestockIncome as number) ?? 0,
                    midline: (selectedMatch.midline.livestockIncome as number) ?? 0,
                  },
                ]}
              />
            </div>

            </div>{/* end p-6 content wrapper */}
          </div>
        </div>
      )}

      </div>

      {/* ── Impact Chat — right side panel for comparative mode ── */}
      {viewMode === "comparative" && <ComparativeChat page="farmers" />}
    </div>
  );
}
