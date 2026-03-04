"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { useDashboardLayout } from "@/providers/DashboardLayoutProvider";
import GeoBreadcrumb from "@/components/layout/GeoBreadcrumb";
import CollapsibleFilterBar from "@/components/dashboard/CollapsibleFilterBar";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import type { AnalyticsTabId } from "@/components/analytics/AnalyticsTabs";
import InsightsTab from "@/components/analytics/InsightsTab";
import ChatTab from "@/components/analytics/ChatTab";
import ComparativeInsightsTab from "@/components/analytics/ComparativeInsightsTab";
import ComparativeAnalyticsChatTab from "@/components/analytics/ComparativeAnalyticsChatTab";
import { generatePredictions } from "@/lib/utils/predictions";


export default function AnalyticsPage() {
  const router = useRouter();
  const { loading, getRound } = useData();
  const { geoFiltered, geoFilterRound, selection } = useGeo();
  const { viewMode } = useDashboardLayout();
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>("insights");

  const isComparative = viewMode === "comparative";

  /* Single-round predictions (only needed when NOT comparative) */
  const predictions = useMemo(
    () => (isComparative ? [] : generatePredictions(geoFiltered)),
    [geoFiltered, isComparative]
  );

  /* Both-round data for comparative mode */
  const baselineFarmers = useMemo(
    () => (isComparative ? geoFilterRound(getRound("baseline").farmers) : []),
    [isComparative, geoFilterRound, getRound]
  );
  const midlineFarmers = useMemo(
    () => (isComparative ? geoFilterRound(getRound("midline").farmers) : []),
    [isComparative, geoFilterRound, getRound]
  );

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="skeleton h-12 w-64" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-[60vh]" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 80px)" }}
    >
      {/* ── Header strip ── */}
      <div className="shrink-0 space-y-2 pb-2">
        <GeoBreadcrumb />

        {/* ── Collapsible Filter Section ── */}
        <CollapsibleFilterBar />

        {/* Tab bar */}
        <AnalyticsTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── Tab panels — all rendered, inactive hidden to preserve chat state ── */}
      <div className="flex-1 min-h-0 brand-card rounded-2xl overflow-hidden">
        <div
          id="analytics-panel-insights"
          role="tabpanel"
          aria-labelledby="analytics-tab-insights"
          className={`h-full ${activeTab !== "insights" ? "hidden" : ""}`}
        >
          {isComparative ? (
            <ComparativeInsightsTab
              baselineFarmers={baselineFarmers}
              midlineFarmers={midlineFarmers}
            />
          ) : (
            <InsightsTab
              predictions={predictions}
              onNavigateToSimulator={() => router.push("/lib-calculator")}
            />
          )}
        </div>

        <div
          id="analytics-panel-chat"
          role="tabpanel"
          aria-labelledby="analytics-tab-chat"
          className={`h-full ${activeTab !== "chat" ? "hidden" : ""}`}
        >
          {isComparative ? (
            <ComparativeAnalyticsChatTab
              baselineFarmers={baselineFarmers}
              midlineFarmers={midlineFarmers}
            />
          ) : (
            <ChatTab data={geoFiltered} selection={selection} />
          )}
        </div>
      </div>
    </div>
  );
}
