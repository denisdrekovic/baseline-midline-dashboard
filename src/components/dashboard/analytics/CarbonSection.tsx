"use client";

import { useMemo } from "react";
import { Leaf } from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import { Section, SubChart, MiniColorBarChart, StatRow, safeMean, SectionActionLink, type TableRow } from "./shared";

interface Props {
  data: Farmer[];
}

export default function CarbonSection({ data }: Props) {
  const carbon = useMemo(() => {
    if (!data.length) return null;
    const safeAvg = (key: keyof Farmer) =>
      safeMean(data.map((f) => f[key] as number | null));

    const soilCarbon = safeAvg("soilCarbon");
    const transportation = safeAvg("transportation");
    const electricity = safeAvg("electricity");
    const pesticide = safeAvg("pesticide");
    const miscActivities = safeAvg("miscActivities");
    const carbonFromTrees = safeAvg("carbonFromTrees");
    const carbonFromHousehold = safeAvg("carbonFromHousehold");
    const totalEmissions =
      soilCarbon +
      transportation +
      electricity +
      pesticide +
      miscActivities +
      carbonFromHousehold;
    const netEmissions = totalEmissions - carbonFromTrees;

    return {
      soilCarbon,
      transportation,
      electricity,
      pesticide,
      miscActivities,
      carbonFromTrees,
      carbonFromHousehold,
      totalEmissions,
      netEmissions,
    };
  }, [data]);

  const tableData: TableRow[] = useMemo(() => {
    if (!carbon) return [];
    return [
      { Source: "Soil Carbon", "tCO\u2082e": +carbon.soilCarbon.toFixed(2) },
      { Source: "Transportation", "tCO\u2082e": +carbon.transportation.toFixed(2) },
      { Source: "Electricity", "tCO\u2082e": +carbon.electricity.toFixed(2) },
      { Source: "Pesticide", "tCO\u2082e": +carbon.pesticide.toFixed(2) },
      { Source: "Misc Activities", "tCO\u2082e": +carbon.miscActivities.toFixed(2) },
      { Source: "Household", "tCO\u2082e": +carbon.carbonFromHousehold.toFixed(2) },
      { Source: "Total Emissions", "tCO\u2082e": +carbon.totalEmissions.toFixed(2) },
      { Source: "Tree Offset", "tCO\u2082e": +carbon.carbonFromTrees.toFixed(2) },
      { Source: "Net Emissions", "tCO\u2082e": +carbon.netEmissions.toFixed(2) },
    ];
  }, [carbon]);

  // Emissions breakdown bar data
  const emissionsBarData = useMemo(() => {
    if (!carbon) return [];
    return [
      { name: "Soil Carbon", value: +carbon.soilCarbon.toFixed(2), color: "#17A2B8" },
      { name: "Transport", value: +carbon.transportation.toFixed(2), color: "#FB8500" },
      { name: "Electricity", value: +carbon.electricity.toFixed(2), color: "#FFB703" },
      { name: "Pesticide", value: +carbon.pesticide.toFixed(2), color: "#00CCCC" },
      { name: "Misc", value: +carbon.miscActivities.toFixed(2), color: "#6F42C1" },
      { name: "Household", value: +carbon.carbonFromHousehold.toFixed(2), color: "#007BFF" },
    ].filter((d) => d.value > 0);
  }, [carbon]);

  return (
    <Section
      id="analytics-carbon"
      title={"\u200BCO\u2082 Emissions"}
      icon={<Leaf size={14} />}
      description="Average carbon emissions per farmer from various sources and tree offset"
      expandable
      tableData={tableData}
    >
      {carbon && (
        <>
          {/* Total emissions headline */}
          <div className="text-center py-1">
            <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {carbon.totalEmissions.toFixed(2)}{" "}
              <span className="text-xs font-normal text-[var(--text-tertiary)]">
                tCO{"\u2082"}e
              </span>
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)]">
              Total Carbon Emitted (avg/farmer)
            </div>
          </div>

          {/* Emissions breakdown */}
          <SubChart
            title="Emissions by Source (tCO₂e)"
            tableData={emissionsBarData.map((d) => ({ Source: d.name, "tCO₂e": d.value }))}
            expandedContent={
              <MiniColorBarChart data={emissionsBarData} height={280} tooltipTitle="Avg Emissions (per farmer)" tooltipFormatter={(v) => `${v.toFixed(2)} tCO₂e`} />
            }
          >
            <MiniColorBarChart data={emissionsBarData} height={120} tooltipTitle="Avg Emissions (per farmer)" tooltipFormatter={(v) => `${v.toFixed(2)} tCO₂e`} />
          </SubChart>

          <StatRow
            label="Carbon Offset from Trees"
            value={`${carbon.carbonFromTrees.toFixed(2)} tCO\u2082e`}
          />

          {/* Net carbon */}
          <div className="text-center py-1">
            <div
              className="text-base font-bold font-mono"
              style={{
                color:
                  carbon.netEmissions > 0
                    ? "var(--color-negative)"
                    : "#00CCCC",
              }}
            >
              {carbon.netEmissions > 0 ? "+" : ""}
              {carbon.netEmissions.toFixed(2)} tCO{"\u2082"}e
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)]">
              Net Carbon (Emissions {"\u2212"} Tree Offset)
            </div>
          </div>

          {/* Methodology note */}
          <div
            className="mt-2 p-2.5 rounded-lg text-[9px] leading-relaxed text-[var(--text-tertiary)]"
            style={{ background: "var(--card-bg-hover)", border: "1px solid var(--card-border)" }}
          >
            <div className="font-semibold text-[var(--text-secondary)] mb-1" style={{ fontSize: 9 }}>
              Methodology Note
            </div>
            Emissions estimated using activity-based emission factors scaled to farm size (acres) and household size, aligned with{" "}
            <span className="font-medium text-[var(--text-secondary)]">IPCC 2006 Tier 1</span>{" "}
            guidelines for agricultural GHG inventories. Soil carbon accounts for tillage and fertilizer application; transport, electricity, and pesticide factors follow regional averages for smallholder agriculture in South Asia. Tree offset uses agroforestry sequestration rates from published literature. All values in tCO{"\u2082"}e per year.
          </div>

          <SectionActionLink href="/analytics" label="View AI Sustainability Insights" />
        </>
      )}
    </Section>
  );
}
