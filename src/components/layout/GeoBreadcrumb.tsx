"use client";

import { ChevronRight, MapPin, ArrowLeft } from "lucide-react";
import { useGeo, GeoLevel } from "@/providers/GeoProvider";

export default function GeoBreadcrumb() {
  const { breadcrumbs, drillDown, resetGeo, drillUp, selection, geoFiltered } = useGeo();

  if (selection.level === "all") return null;

  return (
    <div className="glass flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
      <button
        onClick={drillUp}
        className="flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft size={14} />
      </button>
      <MapPin size={14} className="text-[var(--color-accent)]" />
      {breadcrumbs.map((crumb, i) => (
        <span key={crumb.level} className="flex items-center gap-2">
          {i > 0 && <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
          <button
            onClick={() => {
              if (crumb.level === "all") resetGeo();
              else drillDown(crumb.level, crumb.label);
            }}
            className={`hover:text-[var(--color-accent)] transition-colors ${
              i === breadcrumbs.length - 1
                ? "text-[var(--text-primary)] font-semibold"
                : "text-[var(--text-tertiary)]"
            }`}
          >
            {crumb.label}
          </button>
        </span>
      ))}
      <span className="ml-auto text-xs text-[var(--text-tertiary)]">
        {geoFiltered.length} farmers
      </span>
    </div>
  );
}
