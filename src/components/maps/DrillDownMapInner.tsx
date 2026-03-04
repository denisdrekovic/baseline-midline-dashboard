"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import {
  MAP_CENTER,
  MAP_ZOOM,
  TILE_URL,
  TILE_ATTRIBUTION,
  TILE_URL_ADMIN,
  TILE_ATTRIBUTION_ADMIN,
  TILE_URL_DARK,
  TILE_ATTRIBUTION_DARK,
} from "@/lib/data/constants";
import { useGeo, type GeoLevel } from "@/providers/GeoProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useDashboardLayout, type MapMetric } from "@/providers/DashboardLayoutProvider";
import { useData } from "@/providers/DataProvider";
import MapMetricToggle from "@/components/maps/MapMetricToggle";
import type { Farmer } from "@/lib/data/types";
import { mean, isAboveLIB } from "@/lib/utils/statistics";
import { useCropStats } from "@/hooks/useCropStats";

/* ──────────── Helpers ──────────── */

/** Escape HTML entities to prevent XSS in Leaflet popups */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function FitBounds({
  farmers,
  drillLockUntil,
  selectionLevel,
  districtCentroids,
}: {
  farmers: Farmer[];
  drillLockUntil?: React.RefObject<number>;
  selectionLevel?: string;
  districtCentroids?: Map<string, [number, number]>;
}) {
  const map = useMap();
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountTimeRef = useRef(Date.now());

  // Cap fitBounds zoom to stay within the current level's ZoomDrillHandler zone.
  // Zones:  ≤9 → "all",  10-11 → "district",  12-13 → "block",  ≥14 → "village"
  const levelMaxZoom = selectionLevel === "all" ? 9
    : selectionLevel === "district" ? 11
    : selectionLevel === "block" ? 13
    : 16;

  // Core fit logic — accepts optional overrides for padding/animation/maxZoom
  const fitNow = useCallback((opts?: { padding?: [number, number]; animate?: boolean; maxZoom?: number }) => {
    // Use max() so fitNow never shortens a longer lock set by the resize handler
    const setLock = (ms: number) => {
      if (drillLockUntil) {
        drillLockUntil.current = Math.max(drillLockUntil.current, Date.now() + ms);
      }
    };

    if (selectionLevel === "all") {
      if (districtCentroids && districtCentroids.size > 0) {
        setLock(3000);
        const pts = Array.from(districtCentroids.values());
        if (pts.length === 1) {
          map.setView(pts[0], opts?.maxZoom ?? levelMaxZoom);
          return;
        }
        const bounds = L.latLngBounds(pts);
        map.fitBounds(bounds, {
          padding: opts?.padding ?? [80, 80],
          maxZoom: opts?.maxZoom ?? levelMaxZoom,
          animate: opts?.animate ?? true,
        });
      }
      return;
    }
    const points = farmers.filter((f) => f.lat && f.lon);
    if (points.length === 0) return;
    setLock(3000);
    if (points.length === 1) {
      map.setView([points[0].lat!, points[0].lon!], opts?.maxZoom ?? levelMaxZoom);
      return;
    }
    const bounds = L.latLngBounds(
      points.map((f) => [f.lat!, f.lon!] as [number, number])
    );
    map.fitBounds(bounds, {
      padding: opts?.padding ?? [50, 50],
      maxZoom: opts?.maxZoom ?? levelMaxZoom,
      animate: opts?.animate ?? true,
    });
  }, [farmers, map, drillLockUntil, selectionLevel, districtCentroids, levelMaxZoom]);

  // Fit on data/selection changes (original behavior)
  useEffect(() => {
    fitNow();
  }, [fitNow]);

  // Re-fit when the map container actually resizes.
  // Leaflet fires 'resize' whenever invalidateSize() detects a size change,
  // so this responds to panel toggle, window resize, etc. — no React prop needed.
  useEffect(() => {
    const onResize = () => {
      // Skip resize events in the first 1.5 s after mount (initial fit handles that)
      if (Date.now() - mountTimeRef.current < 1500) return;

      // Lock drill handler immediately so zoom changes don't trigger drill-downs
      if (drillLockUntil) drillLockUntil.current = Date.now() + 4000;

      // Debounce: refit 400 ms after the last resize event
      // (the CSS panel transition is 300 ms; MapInvalidator fires multiple
      //  invalidateSize() calls that each produce a resize event)
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        if (drillLockUntil) drillLockUntil.current = Date.now() + 4000;
        fitNow({ padding: [30, 30], animate: false });
      }, 400);
    };

    map.on("resize", onResize);
    return () => {
      map.off("resize", onResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [map, fitNow, drillLockUntil]);

  return null;
}

/** Invalidate Leaflet map size when container resizes — fixes blank tiles */
function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    // Initial invalidation after mount
    const timer = setTimeout(() => map.invalidateSize(), 200);
    const container = map.getContainer();
    if (!container) return () => clearTimeout(timer);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const clearTimers = () => timers.forEach(clearTimeout);

    // Watch for container resizing (panel toggle, window resize)
    const ro = new ResizeObserver(() => {
      // Fire multiple invalidations spanning the 300ms CSS panel transition
      map.invalidateSize();
      clearTimers();
      timers.length = 0;
      timers.push(setTimeout(() => map.invalidateSize(), 50));
      timers.push(setTimeout(() => map.invalidateSize(), 150));
      timers.push(setTimeout(() => map.invalidateSize(), 320));
      timers.push(setTimeout(() => map.invalidateSize(), 500));
    });

    // Observe all ancestors up to the flex layout container
    ro.observe(container);
    let el: HTMLElement | null = container.parentElement;
    for (let i = 0; i < 4 && el; i++) {
      ro.observe(el);
      el = el.parentElement;
    }

    // Also listen for CSS transition end events on the panel sibling
    const flexParent = container.closest('.flex.flex-col.md\\:flex-row') ||
                       container.parentElement?.parentElement;
    const onTransitionEnd = () => {
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 50);
    };
    flexParent?.addEventListener('transitionend', onTransitionEnd);

    return () => {
      clearTimeout(timer);
      clearTimers();
      ro.disconnect();
      flexParent?.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [map]);
  return null;
}

/* ──────────── Metric configuration ──────────── */

interface MetricContextData {
  metricNote: string;
  benchmarkLabel: string;
  benchmarkValue: string;
  unit: string;
  source: { title: string; url: string };
  formatCurrentAvg: (regionData: RegionDatum[]) => string;
}

interface MetricConfig {
  bgColor: string;
  shadowColor: string;
  labelFn: (region: RegionDatum) => string;
  valueFn: (region: RegionDatum) => number;
  farmerDotPositive: string;
  farmerDotNegative: string;
  farmerClassifyFn: (f: Farmer) => boolean;
  legendLarger: string;
  legendSmaller: string;
  legendFooter: string;
  legendFooterAbbr: string;
  legendFooterFull: string;
  context: MetricContextData;
}

interface RegionDatum {
  name: string;
  count: number;
  avgIncome: number;
  maleCount: number;
  femaleCount: number;
  aboveLIBPct: number;
  avgProductivity: number;
  avgResources: number;
  avgAcre: number;
  avgYieldPerAcre: number;
  centerLat: number;
  centerLon: number;
  level: "district" | "block" | "village";
}

/** Comparative region data — stores baseline, midline, and change per metric */
interface ComparativeRegionDatum {
  name: string;
  count: number;
  level: "district" | "block" | "village";
  centerLat: number;
  centerLon: number;
  baselineLIBPct: number;
  midlineLIBPct: number;
  deltaLIBPct: number;
  baselineIncome: number;
  midlineIncome: number;
  deltaIncome: number;
  deltaIncomePct: number;
  baselineProductivity: number;
  midlineProductivity: number;
  deltaProductivity: number;
  baselineResources: number;
  midlineResources: number;
  deltaResources: number;
  baselineAcre: number;
  midlineAcre: number;
}

/** Map a metric key to its change value in a ComparativeRegionDatum */
function getComparativeDelta(r: ComparativeRegionDatum, metric: MapMetric): number {
  switch (metric) {
    case "lib": return r.deltaLIBPct;
    case "income": return r.deltaIncomePct;
    case "productivity": return r.deltaProductivity;
    case "resources": return r.deltaResources;
  }
}

/** Diverging color scale: negative → plum, zero → white, positive → accent green.
 *  Uses brand palette: plum #910D63 (declined) ↔ accent #00A17D (improved).
 *  `value` is a change amount, `maxAbs` normalizes it to [-1, 1]. */
function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs === 0) return "rgba(200, 200, 200, 0.4)";
  const t = Math.max(-1, Math.min(1, value / maxAbs)); // normalize to [-1, 1]
  if (t < 0) {
    // Plum side: interpolate from white (t=0) to brand-plum (t=-1)
    // Target: #910D63 → rgb(145, 13, 99)
    const s = -t;
    const r = Math.round(220 - s * 75);    // 220 → 145
    const g = Math.round(220 - s * 207);   // 220 → 13
    const b = Math.round(220 - s * 121);   // 220 → 99
    return `rgba(${r}, ${g}, ${b}, 0.50)`;
  } else {
    // Green side: interpolate from white (t=0) to accent-green (t=1)
    // Target: #00A17D → rgb(0, 161, 125)
    const s = t;
    const r = Math.round(220 - s * 220);   // 220 → 0
    const g = Math.round(220 - s * 59);    // 220 → 161
    const b = Math.round(220 - s * 95);    // 220 → 125
    return `rgba(${r}, ${g}, ${b}, 0.50)`;
  }
}

/** Solid version of diverging color for pill borders/text.
 *  Brand plum #910D63 (declined) ↔ accent #00A17D (improved). */
function divergingColorSolid(value: number, maxAbs: number): string {
  if (maxAbs === 0) return "rgb(128, 128, 128)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  if (t < 0) {
    // Plum: interpolate from neutral (128,128,128) toward #910D63
    const s = -t;
    return `rgb(${Math.round(128 + s * 17)}, ${Math.round(128 - s * 115)}, ${Math.round(128 - s * 29)})`;
  } else {
    // Accent green: interpolate from neutral (128,128,128) toward #00A17D
    const s = t;
    return `rgb(${Math.round(128 - s * 128)}, ${Math.round(128 + s * 33)}, ${Math.round(128 - s * 3)})`;
  }
}

const METRIC_CONFIGS: Record<MapMetric, MetricConfig> = {
  lib: {
    bgColor: "rgba(255,192,0,0.85)",
    shadowColor: "rgba(255,192,0,0.4)",
    labelFn: (r) => `${r.aboveLIBPct.toFixed(1)}%`,
    valueFn: (r) => r.aboveLIBPct,
    farmerDotPositive: "#00A17D",
    farmerDotNegative: "#910D63",
    farmerClassifyFn: (f) => isAboveLIB(f.aboveLIB),
    legendLarger: "Higher % above LIB",
    legendSmaller: "Lower % above LIB",
    legendFooter: "Living Income Benchmark",
    legendFooterAbbr: "LIB",
    legendFooterFull: "Living Income Benchmark ($4,934/yr household)",
    context: {
      metricNote: "Percentage of farmers earning above the Living Income Benchmark",
      benchmarkLabel: "LIB THRESHOLD",
      benchmarkValue: "$4,934/yr household ($830/yr per-capita)",
      unit: "Percentage of Farmers",
      source: {
        title: "Living Income Community of Practice (Anker methodology)",
        url: "https://www.living-income.com/",
      },
      formatCurrentAvg: (rd) => {
        const totalFarmers = rd.reduce((s, r) => s + r.count, 0);
        const avg = totalFarmers ? rd.reduce((s, r) => s + r.aboveLIBPct * r.count, 0) / totalFarmers : 0;
        return `${avg.toFixed(1)}%`;
      },
    },
  },
  productivity: {
    bgColor: "rgba(0,161,125,0.85)",
    shadowColor: "rgba(0,161,125,0.4)",
    labelFn: (r) => `${r.avgProductivity.toFixed(1)}%`,
    valueFn: (r) => r.avgProductivity, // already 0-100 scale
    farmerDotPositive: "#00A17D",
    farmerDotNegative: "#FB8500",
    farmerClassifyFn: (f) => (f.productivityIndex ?? 0) >= 0.5,
    legendLarger: "Higher productivity score",
    legendSmaller: "Lower productivity score",
    legendFooter: "Productivity Index",
    legendFooterAbbr: "Prod.",
    legendFooterFull: "Composite productivity index (0-100%)",
    context: {
      metricNote: "Composite score based on crop yields, management practices, and resource utilization",
      benchmarkLabel: "BENCHMARK RANGE",
      benchmarkValue: "50-80% (well-managed farms)",
      unit: "Productivity Index (0-100%)",
      source: {
        title: "Variation in farm productivity — Cambridge Experimental Agriculture",
        url: "https://www.cambridge.org/core/journals/experimental-agriculture/article/abs/variation-in-indonesian-cocoa-farm-productivity-in-relation-to-management-environmental-and-edaphic-factors/40DA416BDB13364EB6CE8F3DBF0A38ED",
      },
      formatCurrentAvg: (rd) => {
        const totalFarmers = rd.reduce((s, r) => s + r.count, 0);
        const avg = totalFarmers ? rd.reduce((s, r) => s + r.avgProductivity * r.count, 0) / totalFarmers : 0;
        return `${avg.toFixed(1)}%`;
      },
    },
  },
  income: {
    bgColor: "rgba(0,123,255,0.85)",
    shadowColor: "rgba(0,123,255,0.4)",
    labelFn: (r) => {
      const k = r.avgIncome / 1000;
      return k >= 1 ? `$${k.toFixed(1)}k` : `$${Math.round(r.avgIncome)}`;
    },
    valueFn: (r) => Math.min(r.avgIncome / 50, 100), // normalize to 0-100 for bubble sizing
    farmerDotPositive: "#00A17D",
    farmerDotNegative: "#910D63",
    farmerClassifyFn: (f) => (f.totalNetIncomeUsd ?? 0) >= 4933.50,
    legendLarger: "Higher avg income",
    legendSmaller: "Lower avg income",
    legendFooter: "Avg Net Income",
    legendFooterAbbr: "Income",
    legendFooterFull: "Average Net Income (USD per household, annually)",
    context: {
      metricNote: "Average total net income per household across all income sources",
      benchmarkLabel: "LIB THRESHOLD",
      benchmarkValue: "$4,934/yr household",
      unit: "USD per Household, Annually",
      source: {
        title: "Baseline Household Survey",
        url: "",
      },
      formatCurrentAvg: (rd) => {
        const totalFarmers = rd.reduce((s, r) => s + r.count, 0);
        const avg = totalFarmers ? rd.reduce((s, r) => s + r.avgIncome * r.count, 0) / totalFarmers : 0;
        const k = avg / 1000;
        return k >= 1 ? `$${k.toFixed(1)}k` : `$${Math.round(avg)}`;
      },
    },
  },
  resources: {
    bgColor: "rgba(111,66,193,0.85)",
    shadowColor: "rgba(111,66,193,0.4)",
    labelFn: (r) => `${r.avgAcre.toFixed(1)}ac`,
    valueFn: (r) => Math.min(r.avgAcre * 10, 100), // normalize acres to 0-100 for bubble sizing
    farmerDotPositive: "#219EBC",
    farmerDotNegative: "#FB8500",
    farmerClassifyFn: (f) => (f.resourcesIndex ?? 0) >= 0.5,
    legendLarger: "Larger avg farm size",
    legendSmaller: "Smaller avg farm size",
    legendFooter: "Average Farm Size",
    legendFooterAbbr: "Resources",
    legendFooterFull: "Average farm size in acres for the region",
    context: {
      metricNote: "Average total cultivated area per household",
      benchmarkLabel: "SMALLHOLDER THRESHOLD",
      benchmarkValue: "< 2 hectares (5 acres)",
      unit: "Acres per Household",
      source: {
        title: "FAO Smallholder Definition",
        url: "https://www.fao.org/family-farming/detail/en/c/385026/",
      },
      formatCurrentAvg: (rd) => {
        const totalFarmers = rd.reduce((s, r) => s + r.count, 0);
        const avg = totalFarmers ? rd.reduce((s, r) => s + r.avgAcre * r.count, 0) / totalFarmers : 0;
        return `${avg.toFixed(2)} ac`;
      },
    },
  },
};

/** Compact pill marker — colored tag with metric value + region name */
function createBubbleIcon(
  label: string,
  _pct: number,
  bgColor: string,
  _shadowColor: string,
  regionName?: string,
  isCompact?: boolean,
  _farmerCount?: number,
  drillLevel?: string,
  drillName?: string,
): L.DivIcon {
  // Extract solid RGB from bgColor like "rgba(255,192,0,0.85)" → "255,192,0"
  const rgbMatch = bgColor.match(/[\d.]+/g);
  const r = rgbMatch?.[0] ?? "255";
  const g = rgbMatch?.[1] ?? "192";
  const b = rgbMatch?.[2] ?? "0";
  const solid = `rgb(${r},${g},${b})`;

  const valueFontSize = isCompact ? 12 : 14;
  const nameFontSize = isCompact ? 9 : 10;

  // Pill: [● VALUE  NAME ▾]
  const nameHtml = regionName
    ? `<span style="
        font-size:${nameFontSize}px;font-weight:600;
        color:rgba(30,30,30,0.7);
        white-space:nowrap;
        max-width:${isCompact ? 60 : 80}px;
        overflow:hidden;text-overflow:ellipsis;
      ">${escapeHTML(regionName)}</span>`
    : "";

  const w = regionName ? (isCompact ? 110 : 130) : (isCompact ? 50 : 60);
  const h = isCompact ? 26 : 30;

  // Actual rendered height: pill (~h-4) + triangle (5px) = h+1
  const totalH = h + 1;
  return L.divIcon({
    className: "",
    iconSize: [w, totalH],
    iconAnchor: [w / 2, totalH],
    html: `<div data-drill-level="${drillLevel ?? ""}" data-drill-name="${drillName ? escapeHTML(drillName) : ""}"
        style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
      <div style="
        display:flex;align-items:center;gap:${isCompact ? 4 : 5}px;
        background:#fff;
        border:2px solid ${solid};
        border-radius:${h / 2}px;
        padding:${isCompact ? "3px 8px" : "4px 10px"};
        cursor:pointer;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
        transition:transform 0.15s ease, box-shadow 0.15s ease;
        white-space:nowrap;
      " onmouseover="this.style.transform='scale(1.08)';this.style.boxShadow='0 4px 14px rgba(0,0,0,0.25)'"
         onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.18)'"
      >
        <span style="
          font-size:${valueFontSize}px;font-weight:800;
          color:${solid};
          font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,monospace;
          letter-spacing:-0.02em;line-height:1;
        ">${escapeHTML(label)}</span>
        ${nameHtml}
      </div>
      <div style="
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-top:6px solid ${solid};
        margin-top:-1px;
      "></div>
    </div>`,
  });
}

/** Create a farmer dot icon with the given color */
function createFarmerDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="
      width:14px;height:14px;
      border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.7);
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      cursor:pointer;
    "></div>`,
  });
}

/** Cached farmer dot icon maps keyed by metric */
const FARMER_ICONS_CACHE = new Map<string, L.DivIcon>();
function getFarmerIcon(color: string): L.DivIcon {
  let icon = FARMER_ICONS_CACHE.get(color);
  if (!icon) {
    icon = createFarmerDotIcon(color);
    FARMER_ICONS_CACHE.set(color, icon);
  }
  return icon;
}

/** Custom cluster icon — metric-colored circle with farmer count */
function createClusterIcon(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cluster: any,
  bgColor: string = "rgba(255,192,0,0.8)",
  shadowColor: string = "rgba(255,192,0,0.35)"
): L.DivIcon {
  const count = cluster.getChildCount();
  const size = Math.max(44, Math.min(72, 36 + Math.sqrt(count) * 4));
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background: ${bgColor};
      border: 3px solid rgba(255,255,255,0.5);
      display:flex;align-items:center;justify-content:center;
      font-size:${size > 56 ? 14 : 12}px;font-weight:800;color:#fff;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
      box-shadow: 0 4px 16px ${shadowColor}, 0 0 0 2px rgba(0,0,0,0.1);
      text-shadow: 0 1px 2px rgba(0,0,0,0.4);
      cursor:pointer;
    ">${count}</div>`,
  });
}

/** Rich HTML popup for regions (XSS-safe) */
function buildRegionPopupHTML(region: {
  name: string;
  count: number;
  avgIncome: number;
  maleCount: number;
  femaleCount: number;
  aboveLIBPct: number;
  level: string;
}): string {
  const name = escapeHTML(region.name);
  const level = escapeHTML(region.level);
  return `
    <div style="font-family:'Poppins',system-ui,sans-serif;min-width:210px;padding:4px 0;">
      <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--card-border);letter-spacing:-0.02em;">
        ${name}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text-tertiary);">Farmers</span>
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:monospace;">${region.count.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text-tertiary);">Above Living Income</span>
          <span style="font-size:13px;font-weight:700;color:#FFB703;font-family:monospace;">${region.aboveLIBPct.toFixed(1)}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text-tertiary);">Avg Income</span>
          <span style="font-size:13px;font-weight:700;color:#00A17D;font-family:monospace;">$${Math.round(region.avgIncome).toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text-tertiary);">Male / Female</span>
          <span style="font-size:12px;font-weight:600;font-family:monospace;">
            <span style="color:#007BFF;">${region.maleCount}</span>
            <span style="color:var(--text-tertiary);"> / </span>
            <span style="color:#8ECAE6;">${region.femaleCount}</span>
          </span>
        </div>
      </div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--card-border);font-size:10px;color:var(--text-tertiary);">
        ${level === "village" ? "Village aggregate" : `Click to drill into ${level}`}
      </div>
    </div>
  `;
}

/** Rich HTML popup for individual farmers (XSS-safe) */
function buildFarmerPopupHTML(f: Farmer): string {
  const libColor = isAboveLIB(f.aboveLIB) ? "#00A17D" : "#910D63";
  const libText = isAboveLIB(f.aboveLIB) ? "Above" : "Below";
  const name = escapeHTML(f.name || "Unknown");
  const village = escapeHTML(f.village || "");
  const block = escapeHTML(f.block || "");
  return `
    <div style="font-family:'Poppins',system-ui,sans-serif;min-width:190px;padding:4px 0;">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:3px;">${name}</div>
      <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--card-border);">
        ${village} &middot; ${block}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:11px;color:var(--text-tertiary);">Net Income</span>
          <span style="font-size:12px;font-weight:700;color:#00A17D;font-family:monospace;">$${(f.totalNetIncomeUsd || 0).toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:11px;color:var(--text-tertiary);">LIB Status</span>
          <span style="font-size:12px;font-weight:700;color:${libColor};">${libText} LIB</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:11px;color:var(--text-tertiary);">Gender</span>
          <span style="font-size:12px;font-weight:600;color:${f.gender === "Male" ? "#007BFF" : "#8ECAE6"};">${escapeHTML(f.gender || "")}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:11px;color:var(--text-tertiary);">Farm Size</span>
          <span style="font-size:12px;font-weight:600;color:var(--text-primary);font-family:monospace;">${f.totalAcre} ac</span>
        </div>
      </div>
    </div>
  `;
}

/** Comparative pill marker — shows delta value colored by direction */
function createComparativeBubbleIcon(
  deltaLabel: string,
  deltaValue: number,
  maxAbs: number,
  regionName?: string,
  isCompact?: boolean,
  drillLevel?: string,
  drillName?: string,
): L.DivIcon {
  const solidColor = divergingColorSolid(deltaValue, maxAbs);
  const valueFontSize = isCompact ? 12 : 14;
  const nameFontSize = isCompact ? 9 : 10;

  const nameHtml = regionName
    ? `<span style="
        font-size:${nameFontSize}px;font-weight:600;
        color:rgba(30,30,30,0.7);
        white-space:nowrap;
        max-width:${isCompact ? 60 : 80}px;
        overflow:hidden;text-overflow:ellipsis;
      ">${escapeHTML(regionName)}</span>`
    : "";

  const w = regionName ? (isCompact ? 120 : 140) : (isCompact ? 60 : 70);
  const h = isCompact ? 26 : 30;
  const totalH = h + 1;

  return L.divIcon({
    className: "",
    iconSize: [w, totalH],
    iconAnchor: [w / 2, totalH],
    html: `<div data-drill-level="${drillLevel ?? ""}" data-drill-name="${drillName ? escapeHTML(drillName) : ""}"
        style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
      <div style="
        display:flex;align-items:center;gap:${isCompact ? 4 : 5}px;
        background:#fff;
        border:2px solid ${solidColor};
        border-radius:${h / 2}px;
        padding:${isCompact ? "3px 8px" : "4px 10px"};
        cursor:pointer;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
        transition:transform 0.15s ease, box-shadow 0.15s ease;
        white-space:nowrap;
      " onmouseover="this.style.transform='scale(1.08)';this.style.boxShadow='0 4px 14px rgba(0,0,0,0.25)'"
         onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.18)'"
      >
        <span style="
          font-size:${valueFontSize}px;font-weight:800;
          color:${solidColor};
          font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,monospace;
          letter-spacing:-0.02em;line-height:1;
        ">${escapeHTML(deltaLabel)}</span>
        ${nameHtml}
      </div>
      <div style="
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-top:6px solid ${solidColor};
        margin-top:-1px;
      "></div>
    </div>`,
  });
}

/** Rich HTML popup for comparative regions — shows baseline, midline, change */
function buildComparativeRegionPopupHTML(region: ComparativeRegionDatum, metric: MapMetric): string {
  const name = escapeHTML(region.name);
  const level = escapeHTML(region.level);
  const deltaColor = (v: number) => v > 0 ? "#00A17D" : v < 0 ? "#910D63" : "#888";
  const sign = (v: number) => v > 0 ? "+" : "";

  const rows: { label: string; baseline: string; midline: string; change: string; changeValue: number }[] = [
    {
      label: "Above LIB",
      baseline: `${region.baselineLIBPct.toFixed(1)}%`,
      midline: `${region.midlineLIBPct.toFixed(1)}%`,
      change: `${sign(region.deltaLIBPct)}${region.deltaLIBPct.toFixed(1)}pp`,
      changeValue: region.deltaLIBPct,
    },
    {
      label: "Avg Income",
      baseline: `$${Math.round(region.baselineIncome).toLocaleString()}`,
      midline: `$${Math.round(region.midlineIncome).toLocaleString()}`,
      change: `${sign(region.deltaIncomePct)}${region.deltaIncomePct.toFixed(1)}%`,
      changeValue: region.deltaIncomePct,
    },
    {
      label: "Productivity",
      baseline: `${region.baselineProductivity.toFixed(1)}%`,
      midline: `${region.midlineProductivity.toFixed(1)}%`,
      change: `${sign(region.deltaProductivity)}${region.deltaProductivity.toFixed(1)}pp`,
      changeValue: region.deltaProductivity,
    },
  ];

  // Highlight the active metric row
  const activeIdx = metric === "lib" ? 0 : metric === "income" ? 1 : metric === "productivity" ? 2 : -1;

  return `
    <div style="font-family:'Poppins',system-ui,sans-serif;min-width:260px;padding:4px 0;">
      <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--card-border);letter-spacing:-0.02em;">
        ${name}
        <span style="font-size:10px;font-weight:500;color:var(--text-tertiary);margin-left:6px;">${region.count} farmers</span>
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:4px 8px;align-items:center;">
        <span style="font-size:9px;color:var(--text-tertiary);font-weight:600;"></span>
        <span style="font-size:9px;color:var(--text-tertiary);font-weight:600;text-align:right;">Baseline</span>
        <span style="font-size:9px;color:var(--text-tertiary);font-weight:600;text-align:right;">Midline</span>
        <span style="font-size:9px;color:var(--text-tertiary);font-weight:600;text-align:right;">Change</span>
        ${rows.map((r, i) => `
          <span style="font-size:11px;color:var(--text-secondary);font-weight:${i === activeIdx ? 700 : 500};">${r.label}</span>
          <span style="font-size:11px;font-weight:600;font-family:monospace;text-align:right;color:var(--text-secondary);">${r.baseline}</span>
          <span style="font-size:11px;font-weight:600;font-family:monospace;text-align:right;color:var(--text-primary);">${r.midline}</span>
          <span style="font-size:11px;font-weight:700;font-family:monospace;text-align:right;color:${deltaColor(r.changeValue)};">${r.change}</span>
        `).join("")}
      </div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--card-border);font-size:10px;color:var(--text-tertiary);">
        ${level === "village" ? "Village aggregate • Baseline → Midline" : `Click to drill into ${level} • Baseline → Midline`}
      </div>
    </div>
  `;
}

/* ──────────── Breadcrumb Bar ──────────── */

function DrillDownBreadcrumb({
  selection,
  farmerCount,
  onNavigate,
}: {
  selection: { level: string; district: string | null; block: string | null; village: string | null };
  farmerCount: number;
  onNavigate: (level: string) => void;
}) {
  const levelLabels: Record<string, string> = {
    all: "District Level",
    district: "Block Level",
    block: "Village Level",
    village: "Farmer Level",
  };

  // Hide at default "all" level — info already in analytics panel header
  if (selection.level === "all") return null;

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 10,
        padding: "6px 10px",
        border: "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        marginBottom: 6,
      }}
      role="navigation"
      aria-label="Geographic drill-down level"
    >
      {/* Level badge + farmer count + reset */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: "rgba(108, 52, 175, 0.12)",
            color: "rgba(108, 52, 175, 0.85)",
            fontFamily: "var(--font-heading)",
          }}
          title="Current geographic drill-down level"
        >
          {levelLabels[selection.level] || "Overview"}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-[8px] sm:text-[9px] font-semibold shrink-0 tabular-nums"
            style={{ color: "rgba(0, 0, 0, 0.4)", fontFamily: "var(--font-sans)" }}
          >
            {farmerCount.toLocaleString()} farmers
          </span>
          <button
            onClick={() => onNavigate("all")}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold transition-all hover:scale-105"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "rgba(239, 68, 68, 0.8)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
            title="Reset to all districts"
            aria-label="Reset geographic drill-down"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb trail */}
      <nav className="flex items-center gap-1 text-[9px] sm:text-[10px] min-w-0 overflow-hidden" aria-label="Geographic navigation breadcrumb">
        <button
          onClick={() => onNavigate("all")}
          className="shrink-0 hover:underline transition-colors"
          style={{
            color: "rgba(0, 0, 0, 0.45)",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
          }}
          title="Click to zoom out to all districts"
        >
          All Districts
        </button>

        {selection.district && (
          <>
            <span style={{ color: "rgba(0, 0, 0, 0.2)" }}>&rsaquo;</span>
            <button
              onClick={() => onNavigate("district")}
              className="shrink-0 hover:underline transition-colors truncate max-w-[100px] sm:max-w-[140px]"
              style={{
                color: selection.level === "district" ? "rgba(108, 52, 175, 0.85)" : "rgba(0, 0, 0, 0.45)",
                fontFamily: "var(--font-sans)",
                fontWeight: selection.level === "district" ? 600 : 500,
              }}
            >
              {selection.district}
            </button>
          </>
        )}

        {selection.block && (
          <>
            <span style={{ color: "rgba(0, 0, 0, 0.2)" }}>&rsaquo;</span>
            <button
              onClick={() => onNavigate("block")}
              className="shrink-0 hover:underline transition-colors truncate max-w-[100px] sm:max-w-[140px]"
              style={{
                color: selection.level === "block" ? "rgba(108, 52, 175, 0.85)" : "rgba(0, 0, 0, 0.45)",
                fontFamily: "var(--font-sans)",
                fontWeight: selection.level === "block" ? 600 : 500,
              }}
            >
              {selection.block}
            </button>
          </>
        )}

        {selection.village && (
          <>
            <span style={{ color: "rgba(0, 0, 0, 0.2)" }}>&rsaquo;</span>
            <span
              className="truncate max-w-[100px] sm:max-w-[140px]"
              style={{
                color: "rgba(108, 52, 175, 0.85)",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
              }}
            >
              {selection.village}
            </span>
          </>
        )}
      </nav>
    </div>
  );
}

/* ──────────── Zoom ↔ Drill-down sync ──────────── */

/** Zoom thresholds that map to geographic levels.
 *  zoom ≤ 9   → "all"      (district bubbles)
 *  zoom 10–11 → "district"  (block bubbles)
 *  zoom 12–13 → "block"     (village bubbles)
 *  zoom ≥ 14  → "village"   (farmer markers)
 *
 *  Thresholds use `< 12` / `< 14` (not `<= 11` / `<= 13`) to give a
 *  half-step buffer for zoomSnap: 0.5, preventing boundary flicker.  */
const LEVEL_ORDER: GeoLevel[] = ["all", "district", "block", "village"];
function zoomToLevel(zoom: number): GeoLevel {
  if (zoom <= 9) return "all";
  if (zoom < 12) return "district";
  if (zoom < 14) return "block";
  return "village";
}
function ZoomDrillHandler({
  regionData,
  selection,
  drillDown,
  drillUp,
  resetGeo,
  drillLockUntil,
}: {
  regionData: Array<{
    name: string;
    centerLat: number;
    centerLon: number;
    level: "district" | "block" | "village";
  }>;
  selection: { level: string; district: string | null; block: string | null; village: string | null };
  drillDown: (level: "district" | "block" | "village", name: string) => void;
  drillUp: () => void;
  resetGeo: () => void;
  drillLockUntil: React.RefObject<number>;
}) {
  const map = useMap();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    zoomend: () => {
      // Skip if a programmatic drill recently happened (click or previous zoom-drill)
      if (Date.now() < drillLockUntil.current) return;

      // Debounce to let fitBounds animations settle
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Re-check lock after debounce
        if (Date.now() < drillLockUntil.current) return;

        const zoom = map.getZoom();
        const targetLevel = zoomToLevel(zoom);
        const currentLevel = selection.level as GeoLevel;

        if (targetLevel === currentLevel) return;

        const currentIdx = LEVEL_ORDER.indexOf(currentLevel);
        const targetIdx = LEVEL_ORDER.indexOf(targetLevel);

        // Lock to prevent cascading zoom events from fitBounds
        drillLockUntil.current = Date.now() + 2000;

        if (targetIdx < currentIdx) {
          // Zooming out → drill up
          if (targetLevel === "all") {
            resetGeo();
          } else {
            drillUp();
          }
        } else if (targetIdx > currentIdx && regionData.length > 0) {
          // Zooming in → find closest region to map center and drill into it
          const center = map.getCenter();
          let closest = regionData[0];
          let minDist = Infinity;
          for (const r of regionData) {
            if (!r.centerLat || !r.centerLon) continue;
            const d =
              (center.lat - r.centerLat) ** 2 +
              (center.lng - r.centerLon) ** 2;
            if (d < minDist) {
              minDist = d;
              closest = r;
            }
          }
          if (closest && closest.name) {
            drillDown(closest.level, closest.name);
          }
        }
      }, 500);
    },
  });

  return null;
}

/* ──────────── Main component ──────────── */

interface DrillDownMapInnerProps {
  height?: string;
}

/** Responsive breakpoints: compact = mobile (<640), default = tablet/desktop */
function useCompactMap(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setCompact(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return compact;
}

export default function DrillDownMapInner({
  height = "100%",
}: DrillDownMapInnerProps) {
  const { selection, drillDown, drillUp, resetGeo, geoFiltered, geoFilterRound } = useGeo();
  const { role } = useAuth();
  const { theme } = useTheme();
  const { mapMetric, viewMode } = useDashboardLayout();
  const { getRound } = useData();
  const { farmerYieldMap } = useCropStats();
  const isComparative = viewMode === "comparative";
  const [mapStyle, setMapStyle] = useState<"admin" | "satellite">("admin");
  const isDark = theme === "dark";
  const [talukGeo, setTalukGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [villageGeo, setVillageGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const drillLockUntil = useRef<number>(0);   // long lock — zoom/resize auto-drill prevention
  const clickLockUntil = useRef<number>(0);   // short lock — prevent polygon+marker double-fire
  const compact = useCompactMap();

  const metricConfig = METRIC_CONFIGS[mapMetric];

  useEffect(() => {
    fetch("/data/geo/taluks.geojson")
      .then((r) => r.json())
      .then(setTalukGeo)
      .catch(() => {});
    fetch("/data/geo/districts.geojson")
      .then((r) => r.json())
      .then(setVillageGeo)
      .catch(() => {});
  }, []);

  const activeGeo = useMemo(() => {
    if (selection.level === "all" || selection.level === "district") {
      if (!talukGeo) return null;
      if (selection.level === "all") return talukGeo;
      // Filter taluks to selected district
      const filtered = talukGeo.features.filter(
        (f) => f.properties?.District?.toUpperCase() === selection.district?.toUpperCase() ||
               f.properties?.DISTRICT?.toUpperCase() === selection.district?.toUpperCase()
      );
      return { type: "FeatureCollection" as const, features: filtered };
    }
    if (!villageGeo) return null;
    if (selection.level === "block") {
      // Filter villages to selected tehsil/block
      const filtered = villageGeo.features.filter(
        (f) => f.properties?.TEHSIL?.toUpperCase() === selection.block?.toUpperCase()
      );
      return { type: "FeatureCollection" as const, features: filtered };
    }
    if (selection.level === "village") {
      // Filter villages to selected village
      const filtered = villageGeo.features.filter(
        (f) => f.properties?.VILLAGE?.toUpperCase() === selection.village?.toUpperCase()
      );
      return { type: "FeatureCollection" as const, features: filtered };
    }
    return null;
  }, [talukGeo, villageGeo, selection]);

  /* Pre-compute GeoJSON centroids at every level so bubbles sit inside polygons */
  const { districtCentroids, tehsilCentroids } = useMemo(() => {
    const districts = new Map<string, [number, number]>();
    const tehsils = new Map<string, [number, number]>();
    if (!talukGeo) return { districtCentroids: districts, tehsilCentroids: tehsils };

    /** Compute bounding-box center [lat, lon] from a GeoJSON geometry. */
    const bboxCenter = (geom: GeoJSON.Geometry): [number, number] | null => {
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      const scan = (rings: number[][][]) => {
        for (const ring of rings) for (const pt of ring) {
          if (pt[0] < minLon) minLon = pt[0];
          if (pt[0] > maxLon) maxLon = pt[0];
          if (pt[1] < minLat) minLat = pt[1];
          if (pt[1] > maxLat) maxLat = pt[1];
        }
      };
      if (geom.type === "Polygon") scan((geom as GeoJSON.Polygon).coordinates);
      else if (geom.type === "MultiPolygon")
        for (const poly of (geom as GeoJSON.MultiPolygon).coordinates) scan(poly);
      if (!isFinite(minLon)) return null;
      return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
    };

    // Per-tehsil centroids (each feature = one tehsil polygon)
    for (const feat of talukGeo.features) {
      if (!feat.geometry) continue;
      const tehsil = (feat.properties?.TEHSIL || "").toUpperCase();
      if (!tehsil) continue;
      const center = bboxCenter(feat.geometry);
      if (center) tehsils.set(tehsil, center);
    }

    // Per-district centroids (bbox of all tehsils belonging to same district)
    const distBounds = new Map<string, { minLon: number; maxLon: number; minLat: number; maxLat: number }>();
    for (const feat of talukGeo.features) {
      if (!feat.geometry) continue;
      const dist = (feat.properties?.District || feat.properties?.DISTRICT || "").toUpperCase();
      if (!dist) continue;
      const b = distBounds.get(dist) || { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
      const scan = (rings: number[][][]) => {
        for (const ring of rings) for (const pt of ring) {
          if (pt[0] < b.minLon) b.minLon = pt[0];
          if (pt[0] > b.maxLon) b.maxLon = pt[0];
          if (pt[1] < b.minLat) b.minLat = pt[1];
          if (pt[1] > b.maxLat) b.maxLat = pt[1];
        }
      };
      if (feat.geometry.type === "Polygon") scan((feat.geometry as GeoJSON.Polygon).coordinates);
      else if (feat.geometry.type === "MultiPolygon")
        for (const poly of (feat.geometry as GeoJSON.MultiPolygon).coordinates) scan(poly);
      distBounds.set(dist, b);
    }
    for (const [dist, b] of distBounds) {
      if (isFinite(b.minLon)) {
        districts.set(dist, [(b.minLat + b.maxLat) / 2, (b.minLon + b.maxLon) / 2]);
      }
    }

    return { districtCentroids: districts, tehsilCentroids: tehsils };
  }, [talukGeo]);

  /* Pre-compute village centroids from village-level GeoJSON boundaries (bbox center) */
  const villageCentroids = useMemo(() => {
    const centroids = new Map<string, [number, number]>();
    if (!villageGeo) return centroids;
    for (const feat of villageGeo.features) {
      if (!feat.geometry) continue;
      const name = (feat.properties?.VILLAGE || "").toUpperCase();
      if (!name) continue;
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      const scan = (rings: number[][][]) => {
        for (const ring of rings) for (const pt of ring) {
          if (pt[0] < minLon) minLon = pt[0];
          if (pt[0] > maxLon) maxLon = pt[0];
          if (pt[1] < minLat) minLat = pt[1];
          if (pt[1] > maxLat) maxLat = pt[1];
        }
      };
      if (feat.geometry.type === "Polygon") scan((feat.geometry as GeoJSON.Polygon).coordinates);
      else if (feat.geometry.type === "MultiPolygon")
        for (const poly of (feat.geometry as GeoJSON.MultiPolygon).coordinates) scan(poly);
      if (isFinite(minLon)) {
        centroids.set(name, [(minLat + maxLat) / 2, (minLon + maxLon) / 2]);
      }
    }
    return centroids;
  }, [villageGeo]);

  /* Group farmers into regions and compute metrics */
  const regionData: RegionDatum[] = useMemo(() => {
    const computeRegion = (name: string, group: Farmer[], level: "district" | "block" | "village", geoCentroid?: [number, number]): RegionDatum => {
      const lats = group.filter((f) => f.lat).map((f) => f.lat!);
      const lons = group.filter((f) => f.lon).map((f) => f.lon!);
      const incomes = group.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const aboveLIB = group.filter((f) => isAboveLIB(f.aboveLIB)).length;
      const prodValues = group.filter((f) => f.productivityIndex != null).map((f) => f.productivityIndex!);
      const resValues = group.filter((f) => f.resourcesIndex != null).map((f) => f.resourcesIndex!);

      const acreValues = group.map((f) => f.totalAcre).filter((v) => v != null && isFinite(v));

      // Compute avg yield/acre from crop data (farmerYieldMap)
      const yieldValues: number[] = [];
      for (const f of group) {
        const ypa = farmerYieldMap.get(f.id);
        if (ypa != null && isFinite(ypa)) yieldValues.push(ypa);
      }

      return {
        name,
        count: group.length,
        avgIncome: incomes.length ? mean(incomes) : 0,
        maleCount: group.filter((f) => f.gender === "Male").length,
        femaleCount: group.filter((f) => f.gender === "Female").length,
        aboveLIBPct: group.length ? (aboveLIB / group.length) * 100 : 0,
        avgProductivity: prodValues.length ? mean(prodValues) * 100 : 0,
        avgResources: resValues.length ? mean(resValues) * 100 : 0,
        avgAcre: acreValues.length ? mean(acreValues) : 0,
        avgYieldPerAcre: yieldValues.length ? mean(yieldValues) : 0,
        centerLat: geoCentroid ? geoCentroid[0] : (lats.length ? mean(lats) : 0),
        centerLon: geoCentroid ? geoCentroid[1] : (lons.length ? mean(lons) : 0),
        level,
      };
    };

    if (selection.level === "all" || selection.level === "district") {
      const targetLevel = selection.level === "all" ? "district" : "block";
      const key = targetLevel as keyof Farmer;
      const groups = new Map<string, Farmer[]>();
      for (const f of geoFiltered) {
        const val = f[key] as string;
        if (!val) continue;
        const arr = groups.get(val) || [];
        arr.push(f);
        groups.set(val, arr);
      }
      return Array.from(groups.entries()).map(([name, group]) => {
        const geoCentroid = selection.level === "all"
          ? districtCentroids.get(name.toUpperCase())
          : tehsilCentroids.get(name.toUpperCase());
        return computeRegion(name, group, targetLevel as "district" | "block", geoCentroid);
      });
    }
    if (selection.level === "block") {
      const groups = new Map<string, Farmer[]>();
      for (const f of geoFiltered) {
        if (!f.village) continue;
        const arr = groups.get(f.village) || [];
        arr.push(f);
        groups.set(f.village, arr);
      }
      return Array.from(groups.entries()).map(([name, group]) => {
        const geoCentroid = villageCentroids.get(name.toUpperCase());
        return computeRegion(name, group, "village", geoCentroid);
      });
    }
    return [];
  }, [geoFiltered, selection, districtCentroids, tehsilCentroids, villageCentroids, farmerYieldMap]);

  /* ── Comparative region data — computed from both rounds ── */
  const comparativeRegionData: ComparativeRegionDatum[] = useMemo(() => {
    if (!isComparative) return [];

    const baselineFarmers = geoFilterRound(getRound("baseline").farmers);
    const midlineFarmers = geoFilterRound(getRound("midline").farmers);

    const computeCompRegion = (
      name: string,
      bGroup: Farmer[],
      mGroup: Farmer[],
      level: "district" | "block" | "village",
      geoCentroid?: [number, number],
    ): ComparativeRegionDatum => {
      const count = Math.max(bGroup.length, mGroup.length);

      // LIB
      const bLIB = bGroup.length ? (bGroup.filter((f) => isAboveLIB(f.aboveLIB)).length / bGroup.length) * 100 : 0;
      const mLIB = mGroup.length ? (mGroup.filter((f) => isAboveLIB(f.aboveLIB)).length / mGroup.length) * 100 : 0;

      // Income
      const bIncomes = bGroup.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const mIncomes = mGroup.filter((f) => f.totalNetIncomeUsd != null).map((f) => f.totalNetIncomeUsd!);
      const bIncome = bIncomes.length ? mean(bIncomes) : 0;
      const mIncome = mIncomes.length ? mean(mIncomes) : 0;

      // Productivity
      const bProdVals = bGroup.filter((f) => f.productivityIndex != null).map((f) => f.productivityIndex!);
      const mProdVals = mGroup.filter((f) => f.productivityIndex != null).map((f) => f.productivityIndex!);
      const bProd = bProdVals.length ? mean(bProdVals) * 100 : 0;
      const mProd = mProdVals.length ? mean(mProdVals) * 100 : 0;

      // Resources (acre)
      const bAcreVals = bGroup.map((f) => f.totalAcre).filter((v) => v != null && isFinite(v));
      const mAcreVals = mGroup.map((f) => f.totalAcre).filter((v) => v != null && isFinite(v));
      const bAcre = bAcreVals.length ? mean(bAcreVals) : 0;
      const mAcre = mAcreVals.length ? mean(mAcreVals) : 0;

      // Resources index
      const bResVals = bGroup.filter((f) => f.resourcesIndex != null).map((f) => f.resourcesIndex!);
      const mResVals = mGroup.filter((f) => f.resourcesIndex != null).map((f) => f.resourcesIndex!);
      const bRes = bResVals.length ? mean(bResVals) * 100 : 0;
      const mRes = mResVals.length ? mean(mResVals) * 100 : 0;

      // Centroids
      const allFarmers = [...bGroup, ...mGroup];
      const lats = allFarmers.filter((f) => f.lat).map((f) => f.lat!);
      const lons = allFarmers.filter((f) => f.lon).map((f) => f.lon!);

      return {
        name,
        count,
        level,
        centerLat: geoCentroid ? geoCentroid[0] : (lats.length ? mean(lats) : 0),
        centerLon: geoCentroid ? geoCentroid[1] : (lons.length ? mean(lons) : 0),
        baselineLIBPct: bLIB,
        midlineLIBPct: mLIB,
        deltaLIBPct: mLIB - bLIB,
        baselineIncome: bIncome,
        midlineIncome: mIncome,
        deltaIncome: mIncome - bIncome,
        deltaIncomePct: bIncome > 0 ? ((mIncome - bIncome) / bIncome) * 100 : 0,
        baselineProductivity: bProd,
        midlineProductivity: mProd,
        deltaProductivity: mProd - bProd,
        baselineResources: bRes,
        midlineResources: mRes,
        deltaResources: mRes - bRes,
        baselineAcre: bAcre,
        midlineAcre: mAcre,
      };
    };

    const groupByKey = (farmers: Farmer[], key: keyof Farmer) => {
      const groups = new Map<string, Farmer[]>();
      for (const f of farmers) {
        const val = f[key] as string;
        if (!val) continue;
        const arr = groups.get(val) || [];
        arr.push(f);
        groups.set(val, arr);
      }
      return groups;
    };

    if (selection.level === "all" || selection.level === "district") {
      const targetLevel = selection.level === "all" ? "district" : "block";
      const key = targetLevel as keyof Farmer;
      const bGroups = groupByKey(baselineFarmers, key);
      const mGroups = groupByKey(midlineFarmers, key);
      const allNames = new Set([...bGroups.keys(), ...mGroups.keys()]);
      return Array.from(allNames).map((name) => {
        const geoCentroid = selection.level === "all"
          ? districtCentroids.get(name.toUpperCase())
          : tehsilCentroids.get(name.toUpperCase());
        return computeCompRegion(
          name,
          bGroups.get(name) || [],
          mGroups.get(name) || [],
          targetLevel as "district" | "block",
          geoCentroid,
        );
      });
    }
    if (selection.level === "block") {
      const bGroups = groupByKey(baselineFarmers, "village" as keyof Farmer);
      const mGroups = groupByKey(midlineFarmers, "village" as keyof Farmer);
      const allNames = new Set([...bGroups.keys(), ...mGroups.keys()]);
      return Array.from(allNames).map((name) => {
        const geoCentroid = villageCentroids.get(name.toUpperCase());
        return computeCompRegion(name, bGroups.get(name) || [], mGroups.get(name) || [], "village", geoCentroid);
      });
    }
    return [];
  }, [isComparative, geoFilterRound, getRound, selection, districtCentroids, tehsilCentroids, villageCentroids]);

  /** Max absolute change value for scaling the diverging color palette */
  const compMaxAbs = useMemo(() => {
    if (!comparativeRegionData.length) return 1;
    return Math.max(1, ...comparativeRegionData.map((r) => Math.abs(getComparativeDelta(r, mapMetric))));
  }, [comparativeRegionData, mapMetric]);

  const showFarmerMarkers = selection.level === "village" && role === "admin";

  const farmerMarkers = useMemo(() => {
    if (!showFarmerMarkers) return [];
    return geoFiltered.filter((f) => f.lat && f.lon);
  }, [geoFiltered, showFarmerMarkers]);

  const handleRegionClick = useCallback(
    (level: "district" | "block" | "village", name: string) => {
      // Viewers can drill to block level (village bubbles) but not into individual villages
      if (level === "village" && role !== "admin") return;
      // Short lock: prevent polygon + marker from both firing on the same click
      if (Date.now() < clickLockUntil.current) return;
      clickLockUntil.current = Date.now() + 600;
      // Also lock the zoom handler so fitBounds animation doesn't auto-drill
      drillLockUntil.current = Date.now() + 3500;
      drillDown(level, name);
    },
    [drillDown, role]
  );

  const handleBreadcrumbNavigate = useCallback(
    (level: string) => {
      drillLockUntil.current = Date.now() + 3500;
      if (level === "all") {
        resetGeo();
      } else if (level === "district" && selection.district) {
        // Go back to district level (showing blocks)
        drillDown("district", selection.district);
      } else if (level === "block" && selection.block) {
        // Go back to block level (showing villages)
        drillDown("block", selection.block);
      }
    },
    [resetGeo, drillDown, selection]
  );

  // Memoize cluster icon creator based on metric
  const clusterIconFn = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cluster: any) => createClusterIcon(cluster, metricConfig.bgColor, metricConfig.shadowColor),
    [metricConfig.bgColor, metricConfig.shadowColor]
  );

  // Native DOM event delegation for pill marker clicks.
  // Bypasses Leaflet's internal event system which can miss DivIcon clicks.
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrapper = mapWrapperRef.current;
    if (!wrapper) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const pill = target.closest("[data-drill-level]") as HTMLElement | null;
      if (!pill) return;
      const level = pill.dataset.drillLevel as "district" | "block" | "village";
      const name = pill.dataset.drillName;
      if (level && name) {
        e.stopPropagation();
        handleRegionClick(level, name);
      }
    };
    wrapper.addEventListener("click", handler, true); // capture phase
    return () => wrapper.removeEventListener("click", handler, true);
  }, [handleRegionClick]);

  return (
    <div
      ref={mapWrapperRef}
      style={{ height, width: "100%" }}
      className="relative"
      role="application"
      aria-roledescription="Interactive drill-down map"
      aria-label="Geographic map with farmer data. Click regions to drill down."
    >
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        zoomControl
        doubleClickZoom
        dragging
        touchZoom
        zoomSnap={0.5}
        zoomDelta={1}
      >
        {/* Map tiles — dark (dark mode), satellite, or admin (light default) */}
        <TileLayer
          key={`${mapStyle}-${isDark}`}
          url={mapStyle === "satellite" ? TILE_URL : isDark ? TILE_URL_DARK : TILE_URL_ADMIN}
          attribution={mapStyle === "satellite" ? TILE_ATTRIBUTION : isDark ? TILE_ATTRIBUTION_DARK : TILE_ATTRIBUTION_ADMIN}
        />
        <MapInvalidator />

        <FitBounds
          farmers={geoFiltered}
          drillLockUntil={drillLockUntil}
          selectionLevel={selection.level}
          districtCentroids={districtCentroids}
        />

        {/* Zoom-based geographic drill-down handler */}
        <ZoomDrillHandler
          regionData={isComparative ? comparativeRegionData : regionData}
          selection={selection}
          drillDown={handleRegionClick}
          drillUp={drillUp}
          resetGeo={resetGeo}
          drillLockUntil={drillLockUntil}
        />

        {/* Contextual GeoJSON boundaries */}
        {activeGeo && (
          <GeoJSON
            key={`geo-${selection.level}-${selection.district}-${selection.block}-${selection.village}-${mapStyle}-${isDark}-${isComparative ? `comp-${mapMetric}` : "single"}`}
            data={activeGeo}
            style={(feature) => {
              const sat = mapStyle === "satellite" || isDark;

              // ─── Comparative mode: diverging choropleth fill ───
              if (isComparative && comparativeRegionData.length > 0) {
                const p = feature?.properties ?? {};
                let regionName = "";
                if (selection.level === "all") {
                  regionName = (p.District || p.DISTRICT || "").toString();
                } else if (selection.level === "district") {
                  regionName = (p.TEHSIL || p.tehsil || "").toString();
                } else if (selection.level === "block") {
                  regionName = (p.VILLAGE || p.village || "").toString();
                }
                const match = comparativeRegionData.find(
                  (r) => r.name.toUpperCase() === regionName.toUpperCase()
                );
                const delta = match ? getComparativeDelta(match, mapMetric) : 0;
                const fillColor = match ? divergingColor(delta, compMaxAbs) : "rgba(200,200,200,0.15)";
                return {
                  fillColor,
                  fillOpacity: 1,
                  weight: sat ? 2 : 2.5,
                  color: sat ? "rgba(255,255,255,0.4)" : "rgba(0,50,120,0.5)",
                  dashArray: "",
                };
              }

              // ─── Standard mode ───
              // At "all" level — district shapes with clear borders
              if (selection.level === "all") {
                const dist = feature?.properties?.District || feature?.properties?.DISTRICT || "";
                const isFirst = dist.toUpperCase().includes("BARABANKI");
                return {
                  fillColor: isFirst
                    ? (sat ? "rgba(0,123,255,0.12)" : "rgba(0,123,255,0.12)")
                    : (sat ? "rgba(111,66,193,0.12)" : "rgba(111,66,193,0.12)"),
                  fillOpacity: 1,
                  weight: sat ? 2 : 2.5,
                  color: sat ? "rgba(255,255,255,0.30)" : "rgba(0,50,120,0.6)",
                  dashArray: "",
                };
              }
              // At "district" level, style tehsils/blocks individually
              if (selection.level === "district") {
                return {
                  fillColor: sat ? "rgba(0,123,255,0.12)" : "rgba(0,123,255,0.10)",
                  fillOpacity: 1,
                  weight: 2,
                  color: sat ? "rgba(255,255,255,0.55)" : "rgba(0,50,120,0.5)",
                  dashArray: "",
                };
              }
              // At "block" level, style village boundaries
              if (selection.level === "block") {
                return {
                  fillColor: sat ? "rgba(255,183,3,0.10)" : "rgba(255,183,3,0.10)",
                  fillOpacity: 1,
                  weight: sat ? 1.5 : 2,
                  color: sat ? "rgba(255,255,255,0.5)" : "rgba(80,60,0,0.45)",
                  dashArray: "",
                };
              }
              // At "village" level, highlight selected village
              return {
                fillColor: sat ? "rgba(255,183,3,0.15)" : "rgba(255,183,3,0.15)",
                fillOpacity: 1,
                weight: 2,
                color: sat ? "rgba(255,255,255,0.6)" : "rgba(80,60,0,0.55)",
                dashArray: "",
              };
            }}
            onEachFeature={(feature, layer) => {
              const sat = mapStyle === "satellite" || isDark;
              // Use comparative data for matching names in comparative mode
              const matchData = isComparative ? comparativeRegionData : regionData;
              layer.on({
                click: () => {
                  const p = feature.properties ?? {};
                  // Match GeoJSON property (UPPERCASE) to regionData name (farmer-data casing)
                  // so the drillDown value matches the farmer data exactly.
                  if (selection.level === "all") {
                    const dist = (p.District || p.DISTRICT || "").toString().toUpperCase();
                    const match = matchData.find((r) => r.name.toUpperCase() === dist);
                    if (match) handleRegionClick("district", match.name);
                  } else if (selection.level === "district") {
                    const block = (p.TEHSIL || p.tehsil || "").toString().toUpperCase();
                    const match = matchData.find((r) => r.name.toUpperCase() === block);
                    if (match) handleRegionClick("block", match.name);
                  } else if (selection.level === "block") {
                    const village = (p.VILLAGE || p.village || "").toString().toUpperCase();
                    const match = matchData.find((r) => r.name.toUpperCase() === village);
                    if (match) handleRegionClick("village", match.name);
                  }
                },
                mouseover: (e) => {
                  if (isComparative) {
                    // In comparative mode, just highlight the border
                    e.target.setStyle({
                      weight: 3.5,
                      color: sat ? "rgba(255,255,255,0.85)" : "rgba(0,50,120,0.8)",
                    });
                  } else if (selection.level === "all") {
                    const dist = feature?.properties?.District || feature?.properties?.DISTRICT || "";
                    const isFirst = dist.toUpperCase().includes("BARABANKI");
                    e.target.setStyle({
                      fillColor: isFirst ? "rgba(0,123,255,0.22)" : "rgba(111,66,193,0.22)",
                      weight: 2.5,
                      color: sat ? "rgba(255,255,255,0.55)" : "rgba(0,50,120,0.65)",
                    });
                  } else {
                    e.target.setStyle({
                      weight: 3,
                      color: sat ? "rgba(255,255,255,0.85)" : "rgba(0,50,120,0.7)",
                      fillOpacity: 1,
                    });
                  }
                  e.target.bringToFront();
                },
                mouseout: (e) => {
                  if (isComparative) {
                    // Restore comparative style — re-derive fill from data
                    const p = feature?.properties ?? {};
                    let rName = "";
                    if (selection.level === "all") rName = (p.District || p.DISTRICT || "").toString();
                    else if (selection.level === "district") rName = (p.TEHSIL || p.tehsil || "").toString();
                    else if (selection.level === "block") rName = (p.VILLAGE || p.village || "").toString();
                    const match = comparativeRegionData.find((r) => r.name.toUpperCase() === rName.toUpperCase());
                    const delta = match ? getComparativeDelta(match, mapMetric) : 0;
                    e.target.setStyle({
                      fillColor: match ? divergingColor(delta, compMaxAbs) : "rgba(200,200,200,0.15)",
                      weight: sat ? 2 : 2.5,
                      color: sat ? "rgba(255,255,255,0.4)" : "rgba(0,50,120,0.5)",
                    });
                  } else {
                    const dist = feature?.properties?.District || feature?.properties?.DISTRICT || "";
                    if (selection.level === "all") {
                      const isFirst = dist.toUpperCase().includes("BARABANKI");
                      e.target.setStyle({
                        fillColor: isFirst
                          ? (sat ? "rgba(0,123,255,0.12)" : "rgba(0,123,255,0.12)")
                          : (sat ? "rgba(111,66,193,0.12)" : "rgba(111,66,193,0.12)"),
                        weight: sat ? 2 : 2.5,
                        color: sat ? "rgba(255,255,255,0.30)" : "rgba(0,50,120,0.6)",
                      });
                    } else if (selection.level === "district") {
                      e.target.setStyle({
                        fillColor: sat ? "rgba(0,123,255,0.12)" : "rgba(0,123,255,0.10)",
                        weight: 2,
                        color: sat ? "rgba(255,255,255,0.55)" : "rgba(0,50,120,0.5)",
                      });
                    } else if (selection.level === "block") {
                      e.target.setStyle({
                        fillColor: sat ? "rgba(255,183,3,0.10)" : "rgba(255,183,3,0.10)",
                        weight: sat ? 1.5 : 2,
                        color: sat ? "rgba(255,255,255,0.5)" : "rgba(80,60,0,0.45)",
                      });
                    } else {
                      e.target.setStyle({
                        fillColor: sat ? "rgba(255,183,3,0.15)" : "rgba(255,183,3,0.15)",
                        weight: 2,
                        color: sat ? "rgba(255,255,255,0.6)" : "rgba(80,60,0,0.55)",
                      });
                    }
                  }
                },
              });
              // Show pointer cursor on polygons to indicate clickability
              const el = (layer as L.Path).getElement?.() as HTMLElement | undefined;
              if (el) el.style.cursor = "pointer";

              if (feature.properties) {
                // Choose the right name property based on level
                const name =
                  feature.properties.VILLAGE ||
                  feature.properties.TEHSIL ||
                  feature.properties.District ||
                  feature.properties.DISTRICT ||
                  feature.properties.district ||
                  feature.properties.name ||
                  "";
                if (name) {
                  layer.bindTooltip(
                    `<div style="font-weight:700;font-size:12px;color:#fff;">${escapeHTML(name)}</div>`,
                    { sticky: true, direction: "top", className: "map-tooltip-custom" }
                  );
                }
              }
            }}
          />
        )}

        {/* Region bubble markers — metric-colored with region name labels */}
        {!showFarmerMarkers && !isComparative &&
          regionData.map((region) => {
            if (!region.centerLat || !region.centerLon) return null;
            const label = metricConfig.labelFn(region);
            const value = metricConfig.valueFn(region);
            // Title-case the region name for display
            const displayName = region.name
              .split(/\s+/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");
            const icon = createBubbleIcon(label, value, metricConfig.bgColor, metricConfig.shadowColor, displayName, compact, region.count, region.level, region.name);
            return (
              <Marker
                key={`region-${region.name}-${mapMetric}`}
                position={[region.centerLat, region.centerLon]}
                icon={icon}
                eventHandlers={{
                  click: () => handleRegionClick(region.level, region.name),
                  mouseover: (e) => {
                    const target = e.target as L.Marker;
                    target
                      .bindPopup(buildRegionPopupHTML(region), {
                        className: "map-popup-custom",
                        closeButton: false,
                        maxWidth: 280,
                      })
                      .openPopup();
                  },
                  mouseout: (e) => {
                    const target = e.target as L.Marker;
                    target.closePopup();
                  },
                }}
              />
            );
          })}

        {/* Comparative region markers — delta values with diverging colors */}
        {!showFarmerMarkers && isComparative &&
          comparativeRegionData.map((region) => {
            if (!region.centerLat || !region.centerLon) return null;
            const delta = getComparativeDelta(region, mapMetric);
            const sign = delta > 0 ? "+" : "";
            let deltaLabel: string;
            switch (mapMetric) {
              case "lib": deltaLabel = `${sign}${delta.toFixed(1)}pp`; break;
              case "income": deltaLabel = `${sign}${region.deltaIncomePct.toFixed(1)}%`; break;
              case "productivity": deltaLabel = `${sign}${delta.toFixed(1)}pp`; break;
              case "resources": deltaLabel = `${sign}${delta.toFixed(1)}pp`; break;
            }
            const displayName = region.name
              .split(/\s+/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");
            const icon = createComparativeBubbleIcon(
              deltaLabel, delta, compMaxAbs, displayName, compact, region.level, region.name
            );
            return (
              <Marker
                key={`comp-region-${region.name}-${mapMetric}`}
                position={[region.centerLat, region.centerLon]}
                icon={icon}
                eventHandlers={{
                  click: () => handleRegionClick(region.level, region.name),
                  mouseover: (e) => {
                    const target = e.target as L.Marker;
                    target
                      .bindPopup(buildComparativeRegionPopupHTML(region, mapMetric), {
                        className: "map-popup-custom",
                        closeButton: false,
                        maxWidth: 320,
                      })
                      .openPopup();
                  },
                  mouseout: (e) => {
                    const target = e.target as L.Marker;
                    target.closePopup();
                  },
                }}
              />
            );
          })}

        {/* Individual farmer dots — clustered, colored by active metric */}
        {showFarmerMarkers && (
          <MarkerClusterGroup
            key={`cluster-${mapMetric}`}
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom
            iconCreateFunction={clusterIconFn}
          >
            {farmerMarkers.map((f, i) => {
              const positive = metricConfig.farmerClassifyFn(f);
              const icon = getFarmerIcon(
                positive ? metricConfig.farmerDotPositive : metricConfig.farmerDotNegative
              );
              return (
                <Marker
                  key={`farmer-${f.id}-${i}`}
                  position={[f.lat!, f.lon!]}
                  icon={icon}
                  eventHandlers={{
                    mouseover: (e) => {
                      const target = e.target as L.Marker;
                      target
                        .bindPopup(buildFarmerPopupHTML(f), {
                          className: "map-popup-custom",
                          closeButton: false,
                          maxWidth: 250,
                        })
                        .openPopup();
                    },
                    mouseout: (e) => {
                      const target = e.target as L.Marker;
                      target.closePopup();
                    },
                  }}
                />
              );
            })}
          </MarkerClusterGroup>
        )}
      </MapContainer>

      {/* Map metric toggle — top right */}
      <MapMetricToggle />

      {/* Comparative mode badge — top center */}
      {isComparative && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold"
          style={{
            background: "rgba(42, 16, 85, 0.88)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(228, 213, 245, 0.2)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            color: "rgba(228, 213, 245, 0.9)",
            letterSpacing: "0.03em",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
          <span>Baseline → Midline Change</span>
        </div>
      )}

      {/* Map style toggle — top left */}
      <button
        onClick={() => setMapStyle((s) => s === "admin" ? "satellite" : "admin")}
        className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer"
        style={{
          background: (mapStyle === "satellite" || isDark) ? "rgba(12,16,24,0.7)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: (mapStyle === "satellite" || isDark) ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          color: (mapStyle === "satellite" || isDark) ? "rgba(255,255,255,0.8)" : "rgba(30,30,30,0.7)",
        }}
        title={mapStyle === "satellite" ? "Switch to admin map" : "Switch to satellite"}
        aria-label={mapStyle === "satellite" ? "Switch to admin map" : "Switch to satellite"}
      >
        {mapStyle === "satellite" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        )}
        <span className="hidden sm:inline">{mapStyle === "satellite" ? "Admin Map" : "Satellite"}</span>
      </button>

      {/* Bottom-right stack: breadcrumb + legend */}
      <div
        className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-[1000]"
        style={{ minWidth: compact ? 160 : 200, maxWidth: compact ? 220 : 280 }}
      >
        {/* Breadcrumb — only visible when drilled into a district/block/village */}
        <DrillDownBreadcrumb
          selection={selection}
          farmerCount={geoFiltered.length}
          onNavigate={handleBreadcrumbNavigate}
        />

        {/* Legend — frosted white glass, responsive */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: compact ? 10 : 12,
            padding: compact ? "8px 10px" : "10px 14px",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          }}
          role="complementary"
          aria-label="Map legend"
        >
        {isComparative ? (
          <>
            {/* ── Comparative legend ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: compact ? 4 : 6 }}>
              <span
                style={{
                  fontSize: compact ? 8 : 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(0, 0, 0, 0.5)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {"Δ "}{metricConfig.legendFooterAbbr}
              </span>
              <span style={{ fontSize: compact ? 9 : 10, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>
                Baseline → Midline
              </span>
            </div>

            {/* Diverging gradient bar */}
            <div style={{ marginBottom: 6 }}>
              <div style={{
                height: compact ? 10 : 12,
                borderRadius: 4,
                background: "linear-gradient(to right, rgb(145,13,99), rgb(220,220,220), rgb(0,161,125))",
                border: "1px solid rgba(0,0,0,0.08)",
              }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: compact ? 7 : 8, color: "rgb(145,13,99)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  Declined
                </span>
                <span style={{ fontSize: compact ? 7 : 8, color: "rgba(0,0,0,0.35)", fontWeight: 500 }}>
                  No change
                </span>
                <span style={{ fontSize: compact ? 7 : 8, color: "rgb(0,130,100)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  Improved
                </span>
              </div>
            </div>

            {/* Boundary item */}
            <ul style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 4, listStyle: "none", margin: 0, padding: 0 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden="true" style={{ width: compact ? 10 : 14, height: compact ? 6 : 8, borderRadius: 2, background: "rgba(200,200,200,0.4)", border: "1.5px solid rgba(0,0,0,0.12)", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: compact ? 8 : 10, color: "rgba(0, 0, 0, 0.6)" }}>
                  {selection.level === "all" ? "District boundaries" : selection.level === "district" ? "Block boundaries" : "Village boundaries"}
                </span>
              </li>
            </ul>

            {/* Methodology note */}
            {!compact && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0, 0, 0, 0.06)" }}>
                <span style={{ fontSize: 8, color: "rgba(0,0,0,0.4)", lineHeight: 1.3, display: "block" }}>
                  Change from baseline to midline survey. Positive = improvement.
                  {mapMetric === "lib" && " Percentage point change in farmers above $4,934/yr."}
                  {mapMetric === "income" && " Percentage change in average household income."}
                  {mapMetric === "productivity" && " Percentage point change in productivity index (0-100%)."}
                  {mapMetric === "resources" && " Percentage point change in resources index (0-100%)."}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
        {/* Title + current avg inline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: compact ? 4 : 6 }}>
          <span
            style={{
              fontSize: compact ? 8 : 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(0, 0, 0, 0.5)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {metricConfig.legendFooterAbbr}
          </span>
          <span style={{ fontSize: compact ? 10 : 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: metricConfig.bgColor.replace(/,0\.\d+\)/, ",1)") }}>
            {metricConfig.context.formatCurrentAvg(regionData)}
          </span>
        </div>

        {/* Items */}
        <ul style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 5, listStyle: "none", margin: 0, padding: 0 }}>
          {showFarmerMarkers ? (
            <>
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden="true" style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, borderRadius: "50%", background: metricConfig.farmerDotPositive, border: "1.5px solid rgba(0,0,0,0.1)", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: compact ? 8 : 10, color: "rgba(0, 0, 0, 0.75)", fontWeight: 500 }}>
                  {mapMetric === "lib" ? "Above LIB ($4,934/yr)" : mapMetric === "productivity" ? "Productivity \u2265 50%" : mapMetric === "income" ? "Income \u2265 $4,934" : "Resources Index \u2265 0.5"}
                </span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden="true" style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, borderRadius: "50%", background: metricConfig.farmerDotNegative, border: "1.5px solid rgba(0,0,0,0.1)", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: compact ? 8 : 10, color: "rgba(0, 0, 0, 0.75)", fontWeight: 500 }}>
                  {mapMetric === "lib" ? "Below LIB" : mapMetric === "productivity" ? "Productivity < 50%" : mapMetric === "income" ? "Income < $4,934" : "Resources Index < 0.5"}
                </span>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden="true" style={{ width: compact ? 10 : 12, height: compact ? 10 : 12, borderRadius: "50%", background: metricConfig.bgColor, border: "1.5px solid rgba(0,0,0,0.1)", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: compact ? 8 : 10, color: "rgba(0, 0, 0, 0.75)", fontWeight: 500 }}>Cluster</span>
              </li>
            </>
          ) : (
            <>
              {/* Bubble size — single row with both dots */}
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <span style={{ width: compact ? 10 : 14, height: compact ? 10 : 14, borderRadius: "50%", background: metricConfig.bgColor, border: "1.5px solid rgba(0,0,0,0.1)", display: "inline-block" }} />
                  <span style={{ width: compact ? 6 : 8, height: compact ? 6 : 8, borderRadius: "50%", background: metricConfig.bgColor, border: "1.5px solid rgba(0,0,0,0.1)", display: "inline-block" }} />
                </div>
                <span style={{ fontSize: compact ? 8 : 10, color: "rgba(0, 0, 0, 0.65)", fontWeight: 500 }}>
                  {metricConfig.legendLarger} / {metricConfig.legendSmaller.toLowerCase()}
                </span>
              </li>

              {/* Boundary item */}
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden="true" style={{ width: compact ? 10 : 14, height: compact ? 6 : 8, borderRadius: 2, background: selection.level === "all" ? "rgba(0,123,255,0.18)" : selection.level === "district" ? "rgba(0,123,255,0.15)" : "rgba(255,183,3,0.15)", border: "1.5px solid rgba(0,0,0,0.12)", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: compact ? 8 : 10, color: "rgba(0, 0, 0, 0.6)" }}>
                  {selection.level === "all" ? "District boundaries" : selection.level === "district" ? "Block boundaries" : "Village boundaries"}
                </span>
              </li>
            </>
          )}
        </ul>

        {/* Context — compact grid, hidden on mobile */}
        {!compact && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0, 0, 0, 0.06)" }}>
            {/* Benchmark row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
              <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0, 0, 0, 0.4)" }}>
                {metricConfig.context.benchmarkLabel}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "var(--font-mono)", color: "rgba(0, 0, 0, 0.65)" }}>
                {metricConfig.context.benchmarkValue}
              </span>
            </div>

            {/* Unit row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
              <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0, 0, 0, 0.4)" }}>
                Unit
              </span>
              <span style={{ fontSize: 9, color: "rgba(0, 0, 0, 0.55)" }}>
                {metricConfig.context.unit}
              </span>
            </div>

            {/* Source row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(0, 0, 0, 0.4)", flexShrink: 0 }}>
                Source
              </span>
              {metricConfig.context.source.url ? (
                <a
                  href={metricConfig.context.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 8, color: "#007BFF", textDecoration: "none", textAlign: "right", lineHeight: 1.2 }}
                  title={metricConfig.context.source.title}
                >
                  {metricConfig.context.source.title.length > 35
                    ? metricConfig.context.source.title.slice(0, 35) + "…"
                    : metricConfig.context.source.title}
                </a>
              ) : (
                <span style={{ fontSize: 8, color: "rgba(0, 0, 0, 0.45)" }}>
                  {metricConfig.context.source.title}
                </span>
              )}
            </div>
          </div>
        )}
          </>
        )}
        </div>
      </div>

      {/* Popup/tooltip/cluster styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
          background: transparent !important;
        }
        .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
          background: transparent !important;
        }
        .map-popup-custom .leaflet-popup-content-wrapper {
          background: var(--color-surface-1) !important;
          border: 1px solid var(--card-border) !important;
          border-radius: 14px !important;
          box-shadow: var(--shadow-tooltip) !important;
          backdrop-filter: blur(20px) !important;
          padding: 0 !important;
        }
        .map-popup-custom .leaflet-popup-content {
          margin: 14px 16px !important;
          color: var(--text-primary) !important;
        }
        .map-popup-custom .leaflet-popup-tip {
          background: var(--color-surface-1) !important;
          border: 1px solid var(--card-border) !important;
        }
        .map-tooltip-custom {
          background: rgba(42, 16, 85, 0.92) !important;
          border: 1px solid rgba(228, 213, 245, 0.15) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
          padding: 6px 12px !important;
          color: #fff !important;
        }
        .map-tooltip-custom::before {
          border-top-color: rgba(42, 16, 85, 0.92) !important;
        }
        .leaflet-control-zoom {
          position: absolute !important;
          bottom: 60px !important;
          left: 10px !important;
          top: auto !important;
          border: none !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(42, 16, 85, 0.85) !important;
          backdrop-filter: blur(12px) !important;
          color: #fff !important;
          border: 1px solid rgba(228, 213, 245, 0.15) !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(42, 16, 85, 0.95) !important;
        }
        .leaflet-top.leaflet-left {
          top: auto !important;
          bottom: 60px !important;
        }
        /* Pill marker clicks are handled by native DOM event delegation (capture
           phase) in the map wrapper — see mapWrapperRef useEffect.  This stops
           propagation so the GeoJSON polygon click below doesn't double-fire.
           Polygon clicks (outside pill areas) still work normally. */
      ` }} />
    </div>
  );
}
