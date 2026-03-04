"use client";

import dynamic from "next/dynamic";

interface FarmerMarker {
  id: number;
  lat: number;
  lon: number;
  name: string;
  project: string;
  village: string;
}

interface DashboardMapProps {
  farmers?: FarmerMarker[];
  geoJsonUrl?: string;
  height?: string;
  colorMetric?: string;
  onPolygonClick?: (properties: Record<string, unknown>) => void;
  onFarmerDoubleClick?: (farmerId: number) => void;
}

const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="skeleton w-full rounded-xl"
      style={{ height: "400px" }}
    />
  ),
});

export default function DashboardMap(props: DashboardMapProps) {
  return <MapInner {...props} />;
}
