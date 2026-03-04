"use client";

import { createContext, useContext, useState, useMemo, useCallback, useEffect, ReactNode } from "react";
import type { SectionId } from "@/components/dashboard/SectionTabs";

/* ── Types ── */
export type MapMetric = "lib" | "productivity" | "income" | "resources";
export type ViewMode = "baseline" | "midline" | "comparative";

interface DashboardLayoutContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;
  /** Dynamic panel width in px */
  panelWidth: number;
  mapMetric: MapMetric;
  setMapMetric: (m: MapMetric) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  activeSection: SectionId;
  setActiveSection: (s: SectionId) => void;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextValue>({
  sidebarCollapsed: true,
  setSidebarCollapsed: () => {},
  toggleSidebar: () => {},
  panelOpen: true,
  setPanelOpen: () => {},
  togglePanel: () => {},
  panelWidth: 560,
  mapMetric: "lib",
  setMapMetric: () => {},
  viewMode: "baseline",
  setViewMode: () => {},
  activeSection: "overview",
  setActiveSection: () => {},
});

/* ── Provider ── */
export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mapMetric, setMapMetric] = useState<MapMetric>("lib");
  const [viewMode, setViewMode] = useState<ViewMode>("baseline");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => {
      if (!prev) setSidebarCollapsed(true);
      return !prev;
    });
  }, []);

  /** Auto-open panel when entering comparative mode; reset section */
  useEffect(() => {
    if (viewMode === "comparative") {
      setPanelOpen(true);
      setSidebarCollapsed(true);
    }
    setActiveSection("overview");
  }, [viewMode]);

  const panelWidth = useMemo(() => {
    if (!panelOpen) return 0;
    if (viewMode === "comparative") return sidebarCollapsed ? 680 : 580;
    return sidebarCollapsed ? 560 : 460;
  }, [panelOpen, sidebarCollapsed, viewMode]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      panelOpen,
      setPanelOpen,
      togglePanel,
      panelWidth,
      mapMetric,
      setMapMetric,
      viewMode,
      setViewMode,
      activeSection,
      setActiveSection,
    }),
    [sidebarCollapsed, toggleSidebar, panelOpen, togglePanel, panelWidth, mapMetric, viewMode, activeSection]
  );

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export const useDashboardLayout = () => useContext(DashboardLayoutContext);
