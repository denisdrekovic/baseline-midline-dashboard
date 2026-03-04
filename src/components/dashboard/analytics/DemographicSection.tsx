"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import { Section, SubChart, MiniBarChart, GenderBar, safeMean, type TableRow } from "./shared";

interface Props {
  data: Farmer[];
}

export default function DemographicSection({ data }: Props) {
  const demographics = useMemo(() => {
    if (!data.length) return null;
    const male = data.filter((f) => f.gender === "Male").length;
    const female = data.filter((f) => f.gender === "Female").length;

    const ageBins = [
      { label: "Under 25", min: 0, max: 24 },
      { label: "25-35", min: 25, max: 35 },
      { label: "36-45", min: 36, max: 45 },
      { label: "45-55", min: 46, max: 55 },
      { label: "55-65", min: 56, max: 65 },
      { label: "Over 65", min: 66, max: 200 },
    ];
    const ageData = ageBins.map((bin) => ({
      name: bin.label,
      count: data.filter((f) => f.age >= bin.min && f.age <= bin.max).length,
    }));

    const hhBins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const hhData = hhBins
      .map((n) => ({
        name: String(n),
        count: data.filter((f) => f.totalFamilyMembers === n).length,
      }))
      .concat([
        {
          name: "10+",
          count: data.filter((f) => f.totalFamilyMembers > 10).length,
        },
      ])
      .filter((d) => d.count > 0);

    const farmSizes = ["Marginal", "Small", "Medium", "Large"];
    const farmSizeData = farmSizes
      .map((s) => ({
        name: s,
        count: data.filter((f) => f.farmSizeCategory === s).length,
      }))
      .filter((d) => d.count > 0);

    const avgAge = safeMean(data.map((f) => f.age));
    const avgHH = safeMean(data.map((f) => f.totalFamilyMembers));
    const avgAcre = safeMean(data.map((f) => f.totalAcre));

    return { male, female, total: data.length, ageData, hhData, farmSizeData, avgAge, avgHH, avgAcre };
  }, [data]);

  const tableData: TableRow[] = useMemo(() => {
    if (!demographics) return [];
    return [
      ...demographics.ageData.map((d) => ({ Category: "Age", Group: d.name, Farmers: d.count })),
      ...demographics.farmSizeData.map((d) => ({ Category: "Farm Size", Group: d.name, Farmers: d.count })),
      { Category: "Gender", Group: "Male", Farmers: demographics.male },
      { Category: "Gender", Group: "Female", Farmers: demographics.female },
    ];
  }, [demographics]);

  return (
    <Section
      id="analytics-demo"
      title="Demographic"
      icon={<Users size={14} />}
      description="Age, gender, household size, and farm size distribution"
      expandable
      defaultOpen
      tableData={tableData}
    >
      {demographics && (
        <>
          {/* Key stats row */}
          <div className="flex items-center gap-4 justify-center">
            <div className="text-center flex-1">
              <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                {demographics.avgAge.toFixed(0)}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Avg Age
              </div>
            </div>
            <div
              className="w-px h-6"
              style={{ background: "var(--card-border)" }}
            />
            <div className="text-center flex-1">
              <div className="text-base font-bold font-mono text-[var(--text-primary)]">
                {demographics.avgHH.toFixed(1)}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                Avg Household
              </div>
            </div>
          </div>

          <SubChart
            title="Gender Distribution"
            tableData={[
              { Gender: "Male", Farmers: demographics.male, "% of Total": `${((demographics.male / demographics.total) * 100).toFixed(1)}%` },
              { Gender: "Female", Farmers: demographics.female, "% of Total": `${((demographics.female / demographics.total) * 100).toFixed(1)}%` },
            ]}
          >
            <GenderBar
              male={demographics.male}
              female={demographics.female}
              total={demographics.total}
            />
          </SubChart>

          <SubChart
            title="Age Distribution"
            tableData={demographics.ageData.map((d) => ({ "Age Group": d.name, Farmers: d.count, "% of Total": `${((d.count / demographics.total) * 100).toFixed(1)}%` }))}
            expandedContent={
              <MiniBarChart data={demographics.ageData} dataKey="count" nameKey="name" color="#0DCAF0" height={280} tooltipTitle="Age Group" tooltipUnit="farmers" />
            }
          >
            <MiniBarChart data={demographics.ageData} dataKey="count" nameKey="name" color="#0DCAF0" height={110} tooltipTitle="Age Group" tooltipUnit="farmers" />
          </SubChart>

          <SubChart
            title="Household Members"
            tableData={demographics.hhData.map((d) => ({ Members: d.name, Farmers: d.count, "% of Total": `${((d.count / demographics.total) * 100).toFixed(1)}%` }))}
            expandedContent={
              <MiniBarChart data={demographics.hhData} dataKey="count" nameKey="name" color="#6F42C1" height={280} tooltipTitle="Household Size" tooltipUnit="farmers" />
            }
          >
            <MiniBarChart data={demographics.hhData} dataKey="count" nameKey="name" color="#6F42C1" height={110} tooltipTitle="Household Size" tooltipUnit="farmers" />
          </SubChart>

          {demographics.farmSizeData.length > 0 && (
            <SubChart
              title="Farm Size Category"
              tableData={demographics.farmSizeData.map((d) => ({ Category: d.name, Farmers: d.count, "% of Total": `${((d.count / demographics.total) * 100).toFixed(1)}%` }))}
              expandedContent={
                <MiniBarChart data={demographics.farmSizeData} dataKey="count" nameKey="name" color="#FFB703" height={280} tooltipTitle="Farm Size" tooltipUnit="farmers" />
              }
            >
              <MiniBarChart data={demographics.farmSizeData} dataKey="count" nameKey="name" color="#FFB703" height={110} tooltipTitle="Farm Size" tooltipUnit="farmers" />
            </SubChart>
          )}
        </>
      )}
    </Section>
  );
}
