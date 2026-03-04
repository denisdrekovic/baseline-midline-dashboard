"use client";

import GeoBreadcrumb from "@/components/layout/GeoBreadcrumb";
import CollapsibleFilterBar from "@/components/dashboard/CollapsibleFilterBar";
import LIBScenarioTool from "@/components/analytics/LIBScenarioTool";
import { useData } from "@/providers/DataProvider";

export default function LIBCalculatorPage() {
  const { loading } = useData();

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
      {/* Header strip */}
      <div className="shrink-0 space-y-2 pb-2">
        <GeoBreadcrumb />
        <CollapsibleFilterBar />
      </div>

      {/* LIB Scenario Tool — fills remaining space */}
      <div className="flex-1 min-h-0 brand-card rounded-2xl overflow-hidden">
        <LIBScenarioTool />
      </div>
    </div>
  );
}
