"use client";

import { useMemo } from "react";
import { Landmark } from "lucide-react";
import { GENDER_COLORS } from "@/lib/data/constants";
import type { Farmer } from "@/lib/data/types";
import {
  Section,
  SubChart,
  MiniColorBarChart,
  MiniGroupedBarChart,
  pct,
  genderPct,
  type TableRow,
} from "./shared";

interface Props {
  data: Farmer[];
}

export default function FinanceSection({ data }: Props) {
  const finance = useMemo(() => {
    if (!data.length) return null;
    return {
      ownershipPct: pct(data, (f) => f.ownership === 1),
      financialServicesPct: pct(data, (f) => f.useFinancialServices === 1),
      safetyNetPct: pct(data, (f) => f.accessSafetyNet === 1),
      fpcMemberPct: pct(data, (f) => typeof f.fpcMember === "string" && f.fpcMember.includes("Yes")),
      maleOwnership: genderPct(data, "Male", (f) => f.ownership === 1),
      femaleOwnership: genderPct(data, "Female", (f) => f.ownership === 1),
      maleFinancial: genderPct(
        data,
        "Male",
        (f) => f.useFinancialServices === 1
      ),
      femaleFinancial: genderPct(
        data,
        "Female",
        (f) => f.useFinancialServices === 1
      ),
      maleSafetyNet: genderPct(data, "Male", (f) => f.accessSafetyNet === 1),
      femaleSafetyNet: genderPct(
        data,
        "Female",
        (f) => f.accessSafetyNet === 1
      ),
    };
  }, [data]);

  // Overall access metrics bar chart
  const overallData = useMemo(() => {
    if (!finance) return [];
    return [
      {
        name: "Land Ownership",
        value: +finance.ownershipPct.toFixed(1),
        color: "#00CCCC",
      },
      {
        name: "Financial Services",
        value: +finance.financialServicesPct.toFixed(1),
        color: "#007BFF",
      },
      {
        name: "Safety Net",
        value: +finance.safetyNetPct.toFixed(1),
        color: "#6F42C1",
      },
      {
        name: "FPC Member",
        value: +finance.fpcMemberPct.toFixed(1),
        color: "#FFB703",
      },
    ];
  }, [finance]);

  const tableData: TableRow[] = useMemo(() => {
    if (!finance) return [];
    return [
      { Metric: "Land Ownership", "Overall %": +finance.ownershipPct.toFixed(1), "Male %": +finance.maleOwnership.toFixed(1), "Female %": +finance.femaleOwnership.toFixed(1) },
      { Metric: "Financial Services", "Overall %": +finance.financialServicesPct.toFixed(1), "Male %": +finance.maleFinancial.toFixed(1), "Female %": +finance.femaleFinancial.toFixed(1) },
      { Metric: "Safety Net", "Overall %": +finance.safetyNetPct.toFixed(1), "Male %": +finance.maleSafetyNet.toFixed(1), "Female %": +finance.femaleSafetyNet.toFixed(1) },
      { Metric: "FPC Member", "Overall %": +finance.fpcMemberPct.toFixed(1), "Male %": null, "Female %": null },
    ];
  }, [finance]);

  // Gender comparison grouped bar data
  const genderCompData = useMemo(() => {
    if (!finance) return [];
    return [
      {
        category: "Ownership",
        female: +finance.femaleOwnership.toFixed(1),
        male: +finance.maleOwnership.toFixed(1),
      },
      {
        category: "Finance",
        female: +finance.femaleFinancial.toFixed(1),
        male: +finance.maleFinancial.toFixed(1),
      },
      {
        category: "Safety Net",
        female: +finance.femaleSafetyNet.toFixed(1),
        male: +finance.maleSafetyNet.toFixed(1),
      },
    ];
  }, [finance]);

  return (
    <Section
      id="analytics-finance"
      title="Access to Finance"
      icon={<Landmark size={14} />}
      description="Land ownership, financial services, safety net access, and FPC membership"
      expandable
      tableData={tableData}
    >
      {finance && (
        <>
          {/* Overall access metrics */}
          {overallData.some((d) => d.value > 0) && (
            <SubChart
              title="Access Rates (%)"
              tableData={overallData.map((d) => ({ Metric: d.name, "%": d.value }))}
              expandedContent={
                <MiniColorBarChart data={overallData} height={280} tooltipTitle="Access to Finance (% of farmers)" tooltipFormatter={(v) => `${v.toFixed(1)}%`} />
              }
            >
              <MiniColorBarChart data={overallData} height={120} tooltipTitle="Access to Finance (% of farmers)" tooltipFormatter={(v) => `${v.toFixed(1)}%`} />
            </SubChart>
          )}

          {/* Gender comparison */}
          {genderCompData.some((d) => d.female > 0 || d.male > 0) && (
            <SubChart
              title="Gender Comparison (%)"
              tableData={genderCompData.map((d) => ({ Metric: d.category, "Female %": d.female, "Male %": d.male }))}
              expandedContent={
                <MiniGroupedBarChart
                  data={genderCompData}
                  keys={[
                    { dataKey: "female", color: GENDER_COLORS.Female, label: "Female" },
                    { dataKey: "male", color: GENDER_COLORS.Male, label: "Male" },
                  ]}
                  nameKey="category"
                  height={280}
                  tooltipTitle="Gender Comparison (% of group)"
                  tooltipFormatter={(v) => `${v.toFixed(1)}%`}
                />
              }
            >
              <MiniGroupedBarChart
                data={genderCompData}
                keys={[
                  { dataKey: "female", color: GENDER_COLORS.Female, label: "Female" },
                  { dataKey: "male", color: GENDER_COLORS.Male, label: "Male" },
                ]}
                nameKey="category"
                height={120}
                tooltipTitle="Gender Comparison (% of group)"
                tooltipFormatter={(v) => `${v.toFixed(1)}%`}
              />
            </SubChart>
          )}
        </>
      )}
    </Section>
  );
}
