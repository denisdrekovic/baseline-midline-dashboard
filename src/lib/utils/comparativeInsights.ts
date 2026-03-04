/**
 * Programmatic insight generator for the Comparative (baseline→midline) dashboard.
 *
 * Analyses both rounds of farmer data and surfaces the most salient findings,
 * ranked by relevance. Mars cares most about Living Income progress, so LIB
 * insights are given the highest priority.
 */

import type { Farmer, Insight, ProjectGroup } from "../data/types";
import { isAboveLIB } from "./statistics";

/* ── helpers ─────────────────────────────────────────────── */
function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}
function delta(b: number, m: number): number {
  return m - b;
}
function pctChange(b: number, m: number): number {
  return b !== 0 ? ((m - b) / Math.abs(b)) * 100 : 0;
}
function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`;
}
function fmtUsd(v: number): string {
  const sign = v >= 0 ? "+" : "";
  if (Math.abs(v) >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(v)}`;
}
function fmtPctChg(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const GROUPS: ProjectGroup[] = ["T-1", "T-2", "Control"];

/* ── main generator ──────────────────────────────────────── */
export function generateComparativeInsights(
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[],
): Insight[] {
  if (!baselineFarmers.length || !midlineFarmers.length) return [];
  const insights: (Insight & { priority: number })[] = [];

  /* ── 1. LIB Attainment — highest priority ────────────── */
  const bLIB = pct(baselineFarmers.filter((f) => isAboveLIB(f.aboveLIB)).length, baselineFarmers.length);
  const mLIB = pct(midlineFarmers.filter((f) => isAboveLIB(f.aboveLIB)).length, midlineFarmers.length);
  const libDelta = delta(bLIB, mLIB);

  if (Math.abs(libDelta) > 0.5) {
    const improved = libDelta > 0;
    insights.push({
      type: "highlight",
      icon: improved ? "TrendingUp" : "AlertTriangle",
      title: improved
        ? `Living Income: ${fmtPct(libDelta)} more farmers above LIB`
        : `Living Income: ${fmtPct(libDelta)} decline in LIB attainment`,
      body: `Overall LIB attainment moved from ${bLIB.toFixed(1)}% to ${mLIB.toFixed(1)}%. ${improved ? "The program is lifting farmers above the benchmark." : "Fewer farmers meet the living income threshold — requires attention."}`,
      severity: improved ? "success" : "warning",
      priority: 100,
    });
  }

  /* Per-group LIB */
  const groupLIB = GROUPS.map((g) => {
    const bG = baselineFarmers.filter((f) => f.project === g);
    const mG = midlineFarmers.filter((f) => f.project === g);
    const bP = pct(bG.filter((f) => isAboveLIB(f.aboveLIB)).length, bG.length);
    const mP = pct(mG.filter((f) => isAboveLIB(f.aboveLIB)).length, mG.length);
    return { group: g, baseline: bP, midline: mP, delta: mP - bP, n: mG.length };
  }).filter((g) => g.n > 0);

  const bestLIBGroup = groupLIB.reduce((a, b) => (b.delta > a.delta ? b : a), groupLIB[0]);
  const worstLIBGroup = groupLIB.reduce((a, b) => (b.delta < a.delta ? b : a), groupLIB[0]);

  if (bestLIBGroup && bestLIBGroup.delta > 1) {
    insights.push({
      type: "comparison",
      icon: "TrendingUp",
      title: `${bestLIBGroup.group} leads LIB progress (${fmtPct(bestLIBGroup.delta)})`,
      body: `${bestLIBGroup.group} moved from ${bestLIBGroup.baseline.toFixed(1)}% to ${bestLIBGroup.midline.toFixed(1)}% above LIB — the strongest improvement across treatment groups.`,
      severity: "success",
      priority: 95,
    });
  }

  if (worstLIBGroup && worstLIBGroup !== bestLIBGroup && worstLIBGroup.delta < -1) {
    insights.push({
      type: "comparison",
      icon: "AlertTriangle",
      title: `${worstLIBGroup.group} saw LIB decline (${fmtPct(worstLIBGroup.delta)})`,
      body: `${worstLIBGroup.group} dropped from ${worstLIBGroup.baseline.toFixed(1)}% to ${worstLIBGroup.midline.toFixed(1)}% above LIB — possible regression that needs investigation.`,
      severity: "warning",
      priority: 90,
    });
  }

  /* ── 2. Treatment effect (DiD-style) ──────────────────── */
  for (const tGroup of (["T-1", "T-2"] as ProjectGroup[])) {
    const tBF = baselineFarmers.filter((f) => f.project === tGroup);
    const tMF = midlineFarmers.filter((f) => f.project === tGroup);
    const cBF = baselineFarmers.filter((f) => f.project === "Control");
    const cMF = midlineFarmers.filter((f) => f.project === "Control");
    if (!tBF.length || !tMF.length || !cBF.length || !cMF.length) continue;

    const tIncB = avg(tBF.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
    const tIncM = avg(tMF.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
    const cIncB = avg(cBF.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
    const cIncM = avg(cMF.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));

    const didEffect = (tIncM - tIncB) - (cIncM - cIncB);

    if (Math.abs(didEffect) > 50) {
      const positive = didEffect > 0;
      insights.push({
        type: "comparison",
        icon: positive ? "TrendingUp" : "AlertTriangle",
        title: `${tGroup} treatment effect: ${fmtUsd(didEffect)} vs Control`,
        body: `After accounting for the control group's trend, ${tGroup} farmers ${positive ? "gained" : "lost"} ${fmtUsd(Math.abs(didEffect))} in avg net income — ${positive ? "suggesting the intervention is working" : "the intervention may not be yielding expected returns"}.`,
        severity: positive ? "success" : "warning",
        priority: 85,
      });
    }
  }

  /* ── 3. Income changes ────────────────────────────────── */
  const bInc = avg(baselineFarmers.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  const mInc = avg(midlineFarmers.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  const incChange = pctChange(bInc, mInc);

  if (Math.abs(incChange) > 2) {
    insights.push({
      type: "trend",
      icon: incChange > 0 ? "TrendingUp" : "AlertTriangle",
      title: `Average income ${incChange > 0 ? "up" : "down"} ${fmtPctChg(incChange)}`,
      body: `Average net income moved from ${fmtUsd(bInc).replace("+", "")} to ${fmtUsd(mInc).replace("+", "")} per farmer. ${Math.abs(incChange) > 15 ? "This is a substantial shift." : ""}`,
      severity: incChange > 0 ? "success" : "warning",
      priority: 70,
    });
  }

  /* ── 4. Gender gap ────────────────────────────────────── */
  const bMaleInc = avg(baselineFarmers.filter((f) => f.gender === "Male").map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  const bFemInc = avg(baselineFarmers.filter((f) => f.gender === "Female").map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  const mMaleInc = avg(midlineFarmers.filter((f) => f.gender === "Male").map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));
  const mFemInc = avg(midlineFarmers.filter((f) => f.gender === "Female").map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v)));

  const bGap = bMaleInc > 0 ? ((bMaleInc - bFemInc) / bMaleInc) * 100 : 0;
  const mGap = mMaleInc > 0 ? ((mMaleInc - mFemInc) / mMaleInc) * 100 : 0;
  const gapDelta = mGap - bGap;

  if (Math.abs(gapDelta) > 2) {
    const closing = gapDelta < 0;
    insights.push({
      type: "trend",
      icon: closing ? "Heart" : "AlertTriangle",
      title: closing
        ? `Gender income gap narrowing (${gapDelta.toFixed(1)}pp)`
        : `Gender income gap widening (+${gapDelta.toFixed(1)}pp)`,
      body: `The male–female income gap moved from ${bGap.toFixed(1)}% to ${mGap.toFixed(1)}%. ${closing ? "Women are catching up." : "The disparity is growing — women's empowerment programs may need strengthening."}`,
      severity: closing ? "success" : "warning",
      priority: 65,
    });
  }

  /* ── 5. Women's empowerment (WEI) ─────────────────────── */
  const bWEI = avg(baselineFarmers.map((f) => f.womenEmpowerment).filter((v): v is number => v != null && isFinite(v)));
  const mWEI = avg(midlineFarmers.map((f) => f.womenEmpowerment).filter((v): v is number => v != null && isFinite(v)));
  const weiDelta = delta(bWEI, mWEI);

  if (Math.abs(weiDelta) > 0.01) {
    insights.push({
      type: "trend",
      icon: weiDelta > 0 ? "Heart" : "AlertTriangle",
      title: `Women Empowerment Index ${weiDelta > 0 ? "improved" : "declined"} by ${Math.abs(weiDelta).toFixed(2)}`,
      body: `WEI score moved from ${bWEI.toFixed(2)} to ${mWEI.toFixed(2)}. ${weiDelta > 0 ? "Empowerment programs are having a measurable impact." : "Empowerment outcomes are regressing."}`,
      severity: weiDelta > 0 ? "success" : "warning",
      priority: 60,
    });
  }

  /* ── 6. Crop diversification ──────────────────────────── */
  const countCrops = (f: Farmer) => {
    let n = 0;
    if (f.mintNetIncome != null && f.mintNetIncome > 0) n++;
    if (f.riceNetIncome != null && f.riceNetIncome > 0) n++;
    if (f.potatoNetIncome != null && f.potatoNetIncome > 0) n++;
    if (f.mustardNetIncome != null && f.mustardNetIncome > 0) n++;
    if (f.wheatNetIncome != null && f.wheatNetIncome > 0) n++;
    return n;
  };
  const bAvgCrops = avg(baselineFarmers.map(countCrops));
  const mAvgCrops = avg(midlineFarmers.map(countCrops));
  const cropDelta = mAvgCrops - bAvgCrops;

  if (Math.abs(cropDelta) > 0.1) {
    insights.push({
      type: "trend",
      icon: cropDelta > 0 ? "Leaf" : "AlertTriangle",
      title: cropDelta > 0
        ? `Crop diversification improving (+${cropDelta.toFixed(1)} crops/farmer)`
        : `Crop portfolio shrinking (${cropDelta.toFixed(1)} crops/farmer)`,
      body: `Average profitable crops per farmer moved from ${bAvgCrops.toFixed(1)} to ${mAvgCrops.toFixed(1)}. ${cropDelta > 0 ? "Farmers are spreading risk across more crops." : "Concentration risk is increasing."}`,
      severity: cropDelta > 0 ? "info" : "warning",
      priority: 50,
    });
  }

  /* ── 7. Carbon / sustainability ───────────────────────── */
  const carbonKeys: (keyof Farmer)[] = ["soilCarbon", "pesticide", "electricity", "transportation", "miscActivities", "carbonFromHousehold"];
  const offsetKeys: (keyof Farmer)[] = ["carbonFromTrees"];
  const netCarbon = (farmers: Farmer[]) => {
    const emissions = carbonKeys.reduce((s, k) => s + avg(farmers.map((f) => (f[k] as number) ?? 0).filter(isFinite)), 0);
    const offsets = offsetKeys.reduce((s, k) => s + avg(farmers.map((f) => (f[k] as number) ?? 0).filter(isFinite)), 0);
    return emissions - offsets;
  };
  const bCarbon = netCarbon(baselineFarmers);
  const mCarbon = netCarbon(midlineFarmers);
  const carbonDelta = mCarbon - bCarbon;

  if (Math.abs(carbonDelta) > 0.5) {
    const reduced = carbonDelta < 0;
    insights.push({
      type: "trend",
      icon: reduced ? "Leaf" : "AlertTriangle",
      title: reduced
        ? `Net carbon footprint reduced by ${Math.abs(carbonDelta).toFixed(1)} kg`
        : `Net carbon footprint increased by ${carbonDelta.toFixed(1)} kg`,
      body: `Per-farmer net emissions moved from ${bCarbon.toFixed(1)} to ${mCarbon.toFixed(1)} kg CO\u2082e. ${reduced ? "Sustainability efforts are paying off." : "Environmental impact is growing."}`,
      severity: reduced ? "success" : "warning",
      priority: 45,
    });
  }

  /* ── 8. Off-farm dependency ───────────────────────────── */
  const bOff = avg(baselineFarmers.map((f) => f.offFarmDependency).filter((v): v is number => v != null && isFinite(v)));
  const mOff = avg(midlineFarmers.map((f) => f.offFarmDependency).filter((v): v is number => v != null && isFinite(v)));
  const offDelta = mOff - bOff;

  if (Math.abs(offDelta) > 2) {
    const decreasing = offDelta < 0;
    insights.push({
      type: "trend",
      icon: decreasing ? "TrendingUp" : "AlertTriangle",
      title: decreasing
        ? `Off-farm dependency falling (${offDelta.toFixed(1)}pp)`
        : `Off-farm dependency rising (+${offDelta.toFixed(1)}pp)`,
      body: `Off-farm income share moved from ${bOff.toFixed(1)}% to ${mOff.toFixed(1)}%. ${decreasing ? "Farming is becoming the primary livelihood — a positive sign of farm viability." : "Farmers are relying more on non-farm income, suggesting farm returns may be insufficient."}`,
      severity: decreasing ? "success" : "warning",
      priority: 40,
    });
  }

  /* ── sort by priority and return top insights ─────────── */
  return insights
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority, ...insight }) => insight);
}
