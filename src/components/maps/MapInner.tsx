"use client";

import { useEffect, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { PROJECT_COLORS, MAP_CENTER, MAP_ZOOM, TILE_URL, TILE_ATTRIBUTION } from "@/lib/data/constants";

interface FarmerMarker {
  id: number;
  lat: number;
  lon: number;
  name: string;
  project: string;
  village: string;
}

interface MapInnerProps {
  farmers?: FarmerMarker[];
  geoJsonUrl?: string;
  height?: string;
  colorMetric?: string;
  onPolygonClick?: (properties: Record<string, unknown>) => void;
  onFarmerDoubleClick?: (farmerId: number) => void;
}

function getProjectColor(project: string): string {
  return (PROJECT_COLORS as Record<string, string>)[project] ?? "#17A2B8";
}

/** Auto-fit map bounds to visible farmers */
function FitToFarmers({ farmers }: { farmers: FarmerMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (farmers.length === 0) return;
    if (farmers.length === 1) {
      map.setView([farmers[0].lat, farmers[0].lon], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(
      farmers.map((f) => [f.lat, f.lon] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
  }, [farmers, map]);
  return null;
}

/** Invalidate map size on container resize */
function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    const container = map.getContainer();
    if (!container) return () => clearTimeout(timer);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [map]);
  return null;
}

/**
 * Render village cluster markers — aggregated dots showing farmer counts per village.
 * These are MUCH lighter than GeoJSON polygons and don't block individual farmer dots.
 */
function VillageClusterLayer({
  clusters,
}: {
  clusters: Map<string, { count: number; lat: number; lon: number }>;
}) {
  const entries = Array.from(clusters.entries());
  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(([village, info]) => {
        // Scale radius by count: min 12, max 30
        const radius = Math.min(30, Math.max(12, 8 + Math.sqrt(info.count) * 4));
        return (
          <CircleMarker
            key={`cluster-${village}`}
            center={[info.lat, info.lon]}
            radius={radius}
            pathOptions={{
              fillColor: "rgba(0,123,255,0.08)",
              fillOpacity: 1,
              color: "rgba(0,123,255,0.2)",
              weight: 1,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "var(--font-body, system-ui)", minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{village}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{info.count} farmer{info.count !== 1 ? "s" : ""}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function MapInner({
  farmers = [],
  height = "400px",
  onFarmerDoubleClick,
}: MapInnerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute farmer village clusters for soft background circles
  const villageClusters = useMemo(() => {
    const map = new Map<string, { count: number; lat: number; lon: number }>();
    for (const f of farmers) {
      const key = f.village;
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.lat = (existing.lat * (existing.count - 1) + f.lat) / existing.count;
        existing.lon = (existing.lon * (existing.count - 1) + f.lon) / existing.count;
      } else {
        map.set(key, { count: 1, lat: f.lat, lon: f.lon });
      }
    }
    return map;
  }, [farmers]);

  // Build unique project group list for legend
  const projectGroups = useMemo(() => {
    const set = new Map<string, string>();
    for (const f of farmers) {
      if (f.project && !set.has(f.project)) {
        set.set(f.project, getProjectColor(f.project));
      }
    }
    return Array.from(set.entries());
  }, [farmers]);

  if (!mounted) return null;

  return (
    <div style={{ height, width: "100%" }} className="rounded-xl overflow-hidden relative">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <MapInvalidator />
        <FitToFarmers farmers={farmers} />

        {/* Village cluster background circles — very light, don't block anything */}
        <VillageClusterLayer clusters={villageClusters} />

        {/* Farmer dots — always on top, no blocking layers */}
        {farmers.map((f) => {
          const color = getProjectColor(f.project);
          return (
            <CircleMarker
              key={`farmer-${f.id}`}
              center={[f.lat, f.lon]}
              radius={6}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.9,
                color: "#fff",
                weight: 1.5,
              }}
              eventHandlers={{
                dblclick: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onFarmerDoubleClick?.(f.id);
                },
              }}
            >
              <Popup>
                <div style={{ fontFamily: "var(--font-body, system-ui)", minWidth: 160, padding: "2px 0" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>{f.village}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      display: "inline-block",
                      width: 10, height: 10,
                      borderRadius: "50%",
                      background: color,
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      {f.project}
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Compact legend */}
      <div
        className="absolute bottom-3 right-3 z-[500]"
        style={{
          background: "var(--color-surface-1)",
          backdropFilter: "blur(12px)",
          borderRadius: 10,
          padding: "8px 12px",
          border: "1px solid var(--card-border)",
          maxWidth: 180,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 4 }}>
          {farmers.length} Farmers &middot; {villageClusters.size} Villages
        </div>
        {projectGroups.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {projectGroups.map(([group, color]) => (
              <div key={group} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--text-secondary)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                {group}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--text-tertiary)", marginTop: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(0,123,255,0.1)", border: "1px solid rgba(0,123,255,0.25)", display: "inline-block" }} />
          Village cluster
        </div>
      </div>
    </div>
  );
}
