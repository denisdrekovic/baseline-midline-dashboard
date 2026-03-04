"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import { Section, SubChart, MiniColorBarChart, pct, type TableRow } from "./shared";

interface Props {
  data: Farmer[];
}

export default function PerspectivesSection({ data }: Props) {
  const perspectives = useMemo(() => {
    if (!data.length) return null;

    const qolOptions = [
      "Very Satisfied",
      "Satisfied",
      "Neutral",
      "Dissatisfied",
      "Very Dissatisfied",
    ];
    const qolColors: Record<string, string> = {
      "Very Satisfied": "#0DCAF0",
      Satisfied: "#00CCCC",
      Neutral: "#6F42C1",
      Dissatisfied: "#FFB703",
      "Very Dissatisfied": "#FB8500",
    };
    const qolData = qolOptions
      .map((opt) => ({
        name: opt,
        value: data.filter((f) => f.qualityOfLife === opt).length,
        color: qolColors[opt] || "#17A2B8",
      }))
      .filter((d) => d.value > 0);

    const tcbOptions = [
      "Very beneficial",
      "Beneficial",
      "Neutral",
      "Not beneficial",
      "Detrimental to quality of life",
    ];
    const tcbColors: Record<string, string> = {
      "Very beneficial": "#00CCCC",
      Beneficial: "#0DCAF0",
      Neutral: "#6F42C1",
      "Not beneficial": "#FFB703",
      "Detrimental to quality of life": "#FB8500",
    };
    const tcbData = tcbOptions
      .map((opt) => ({
        name: opt,
        value: data.filter((f) => f.targetCropBenefit === opt).length,
        color: tcbColors[opt] || "#17A2B8",
      }))
      .filter((d) => d.value > 0);

    // Reduced Drudgery Time (timeChange field)
    const timeChangeColors: Record<string, string> = {
      "Reduced significantly": "#00A17D",
      "Reduced moderately": "#0DCAF0",
      "Reduced but not much": "#FFB703",
      "Stayed the same": "#6F42C1",
      "Increased": "#FB8500",
    };
    const timeChangeMap = new Map<string, number>();
    for (const f of data) {
      if (!f.timeChange) continue;
      // Strip numeric prefix like "1. " from values
      const cleaned = f.timeChange.replace(/^\d+\.\s*/, "").replace(/^The time has /, "").trim();
      // Capitalize first letter
      const label = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      timeChangeMap.set(label, (timeChangeMap.get(label) || 0) + 1);
    }
    // Sort by count descending
    const timeChangeData = Array.from(timeChangeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        color: timeChangeColors[name] || "#17A2B8",
      }));
    const reducedPct = data.length
      ? (data.filter((f) => f.timeChange && /reduced/i.test(f.timeChange)).length / data.length) * 100
      : 0;

    const satisfiedPct = pct(
      data,
      (f) =>
        f.qualityOfLife === "Satisfied" || f.qualityOfLife === "Very Satisfied"
    );
    const beneficialPct = pct(
      data,
      (f) =>
        f.targetCropBenefit === "Beneficial" ||
        f.targetCropBenefit === "Very beneficial"
    );

    return { qolData, tcbData, timeChangeData, reducedPct, satisfiedPct, beneficialPct };
  }, [data]);

  const tableData: TableRow[] = useMemo(() => {
    if (!perspectives) return [];
    return [
      ...perspectives.qolData.map((d) => ({ Category: "Quality of Life", Response: d.name, Farmers: d.value })),
      ...perspectives.tcbData.map((d) => ({ Category: "Target Crop Benefit", Response: d.name, Farmers: d.value })),
      ...perspectives.timeChangeData.map((d) => ({ Category: "Reduced Drudgery Time", Response: d.name, Farmers: d.value })),
    ];
  }, [perspectives]);

  return (
    <Section
      id="analytics-persp"
      title="Farmer Perspectives"
      icon={<Activity size={14} />}
      description="Farmer sentiment on quality of life and target crop benefits"
      expandable
      tableData={tableData}
      summary={
        perspectives
          ? `${perspectives.satisfiedPct.toFixed(0)}% satisfied`
          : undefined
      }
    >
      {perspectives && (
        <>
          {/* Quality of Life (hidden if no data) */}
          {perspectives.qolData.length > 0 && (
            <SubChart title="Effect of Farming on Quality of Life"
              tableData={perspectives.qolData.map((d) => ({ Response: d.name, Farmers: d.value }))}
              expandedContent={
                <MiniColorBarChart data={perspectives.qolData} height={280} tooltipTitle="Quality of Life" tooltipUnit="farmers" layout="vertical" />
              }
            >
              <MiniColorBarChart data={perspectives.qolData} height={120} tooltipTitle="Quality of Life" tooltipUnit="farmers" layout="vertical" />
            </SubChart>
          )}

          {/* Target Crop Benefit (hidden if no data) */}
          {perspectives.tcbData.length > 0 && (
            <SubChart title="Perspective on Target Crop"
              tableData={perspectives.tcbData.map((d) => ({ Response: d.name, Farmers: d.value }))}
              expandedContent={
                <MiniColorBarChart data={perspectives.tcbData} height={280} tooltipTitle="Target Crop Benefit" tooltipUnit="farmers" layout="vertical" />
              }
            >
              <MiniColorBarChart data={perspectives.tcbData} height={120} tooltipTitle="Target Crop Benefit" tooltipUnit="farmers" layout="vertical" />
            </SubChart>
          )}

          {/* Reduced Drudgery Time (hidden if no data) */}
          {perspectives.timeChangeData.length > 0 && (
            <SubChart title={`Reduced Drudgery Time (${perspectives.reducedPct.toFixed(0)}% report reduction)`}
              tableData={perspectives.timeChangeData.map((d) => ({ Response: d.name, Farmers: d.value }))}
              expandedContent={
                <MiniColorBarChart data={perspectives.timeChangeData} height={280} tooltipTitle="Time Change" tooltipUnit="farmers" layout="vertical" />
              }
            >
              <MiniColorBarChart data={perspectives.timeChangeData} height={140} tooltipTitle="Time Change" tooltipUnit="farmers" layout="vertical" />
            </SubChart>
          )}
        </>
      )}
    </Section>
  );
}
