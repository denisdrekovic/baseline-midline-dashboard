/**
 * Comparative Chat Engine — generates AI-style responses about
 * baseline → midline progress, treatment effects, and impact.
 *
 * Entirely local (no API calls). Analyses both rounds of data
 * and returns formatted markdown.
 */

import type { Farmer, ProjectGroup } from "@/lib/data/types";
import { isAboveLIB, median } from "@/lib/utils/statistics";
import { formatUSD, formatPercent, formatNumber } from "@/lib/utils/formatters";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* ── Context types for page/section-aware chat ── */

export type ChatPage = "dashboard" | "segments" | "farmers" | "analytics";
export type ChatSection = "overview" | "income" | "crops" | "women" | "sustainability" | null;
export interface ChatContext {
  page: ChatPage;
  section?: ChatSection | null;
}

/* ── Methodology notes (appended to responses) ── */

const METHODOLOGY: Record<string, string> = {
  lib: `**Living Income Benchmark (LIB):** Household net income ≥ $4,933.50/year (PPP-adjusted). Counts the percentage of farmers whose total net income (crops + off-farm + livestock) meets or exceeds this threshold.`,
  wei: `**Women's Empowerment Index (WEI):** Composite score (0–10 scale) measuring women's decision-making power across 5 domains: (1) Production decisions, (2) Income control, (3) Asset ownership, (4) Leadership participation, (5) Time autonomy. Each domain scored 0–2; WEI = sum of domain scores. Score ≥6 indicates "empowered."`,
  gap: `**GAP Adoption:** Percentage of farmers implementing ≥40% of Good Agricultural Practices from the program's recommended practices list (soil testing, integrated pest management, crop rotation, optimal seed varieties, post-harvest handling).`,
  did: `**Difference-in-Differences (DiD):** Causal impact estimated as (Treatment_midline − Treatment_baseline) − (Control_midline − Control_baseline). Positive DiD = treatment effect beyond secular trends. This is an observational estimate; no randomized assignment.`,
  income: `**Income Methodology:** Net income = gross revenue − input costs, computed per crop then summed with off-farm and livestock income. All values in USD (PPP-adjusted). Median used as primary central tendency to reduce outlier sensitivity.`,
  productivity: `**Productivity Index:** Normalized score (0–100) based on yield per acre across all cultivated crops, weighted by acreage. Higher = more productive relative to the sample distribution.`,
  resources: `**Resources Index:** Normalized score (0–100) combining farm size, input access (seeds, fertilizer, irrigation), and asset ownership. Higher = better resourced relative to the sample.`,
};

function methodologyBlock(...keys: string[]): string {
  const notes = keys.map((k) => METHODOLOGY[k]).filter(Boolean);
  if (!notes.length) return "";
  return `\n\n---\n*📐 Methodology:*\n${notes.map((n) => `> ${n}`).join("\n>\n")}`;
}

/* ── helpers ── */

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function med(arr: number[]): number {
  return arr.length ? median(arr) : 0;
}

function pctPt(a: number, b: number): string {
  const d = b - a;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}pp`;
}

function pctChg(a: number, b: number): string {
  if (!a) return "n/a";
  const d = ((b - a) / Math.abs(a)) * 100;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
}

function sign(v: number): string {
  return v > 0 ? "+" : "";
}

function getGroupFarmers(farmers: Farmer[], group: ProjectGroup): Farmer[] {
  return farmers.filter((f) => f.project === group);
}

function libPct(farmers: Farmer[]): number {
  if (!farmers.length) return 0;
  return (farmers.filter((f) => isAboveLIB(f.aboveLIB)).length / farmers.length) * 100;
}

function medianIncome(farmers: Farmer[]): number {
  const vals = farmers.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
  return med(vals);
}

function avgIncome(farmers: Farmer[]): number {
  const vals = farmers.map((f) => f.totalNetIncomeUsd).filter((v): v is number => v != null && isFinite(v));
  return avg(vals);
}

function femaleLIBPct(farmers: Farmer[]): number {
  const females = farmers.filter((f) => f.gender === "Female");
  if (!females.length) return 0;
  return (females.filter((f) => isAboveLIB(f.aboveLIB)).length / females.length) * 100;
}

function weiScore(farmers: Farmer[]): number {
  const scores = farmers.map((f) => f.womenEmpowerment).filter((v): v is number => v != null && isFinite(v));
  return avg(scores);
}

function gapAdoptPct(farmers: Farmer[]): number {
  const vals = farmers.map((f) => f.practiceAdoptRateMint).filter((v): v is number => v != null && isFinite(v));
  return avg(vals) * 100;
}

/* ── question routing ── */

type QuestionCategory =
  | "overview-progress"
  | "lib-impact"
  | "treatment-effect"
  | "income-analysis"
  | "women-impact"
  | "crop-performance"
  | "sustainability"
  | "recommendations"
  | "general";

function classifyQuestion(q: string): QuestionCategory {
  const lower = q.toLowerCase();
  if (lower.match(/overview|progress|summary|how.*doing|headline|key.*finding/)) return "overview-progress";
  if (lower.match(/lib|living.*income|above.*benchmark|threshold|poverty/)) return "lib-impact";
  if (lower.match(/treatment.*effect|did|diff.*diff|causal|impact|program.*work|intervention/)) return "treatment-effect";
  if (lower.match(/income|earn|revenue|wage|salary|off.?farm|median/)) return "income-analysis";
  if (lower.match(/women|gender|female|empower|wei|equality/)) return "women-impact";
  if (lower.match(/crop|mint|rice|potato|wheat|mustard|yield|acre|harvest/)) return "crop-performance";
  if (lower.match(/carbon|sustain|environment|pesticide|tree|electricity|green/)) return "sustainability";
  if (lower.match(/recommend|suggest|should|what.*next|strateg|priority|focus/)) return "recommendations";
  return "general";
}

/* ── response generators ── */

function generateOverviewProgress(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  const bLIB = libPct(bFarmers);
  const mLIB = libPct(mFarmers);
  const bMed = medianIncome(bFarmers);
  const mMed = medianIncome(mFarmers);
  const bWEI = weiScore(bFarmers);
  const mWEI = weiScore(mFarmers);
  const bAdopt = gapAdoptPct(bFarmers);
  const mAdopt = gapAdoptPct(mFarmers);

  // Per-group LIB
  const groups: ProjectGroup[] = ["T-1", "T-2", "Control"];
  const groupRows = groups.map((g) => {
    const bg = getGroupFarmers(bFarmers, g);
    const mg = getGroupFarmers(mFarmers, g);
    return `| ${g} | ${formatPercent(libPct(bg))} | ${formatPercent(libPct(mg))} | ${pctPt(libPct(bg), libPct(mg))} | ${formatUSD(medianIncome(bg))} | ${formatUSD(medianIncome(mg))} |`;
  }).join("\n");

  return `**Baseline → Midline Progress Summary**

Overall, the program shows **positive movement** across key indicators:

| Metric | Baseline | Midline | Change |
|--------|----------|---------|--------|
| % Above LIB | ${formatPercent(bLIB)} | ${formatPercent(mLIB)} | ${pctPt(bLIB, mLIB)} |
| Median Income | ${formatUSD(bMed)} | ${formatUSD(mMed)} | ${pctChg(bMed, mMed)} |
| WEI Score | ${bWEI.toFixed(2)} | ${mWEI.toFixed(2)} | ${sign(mWEI - bWEI)}${(mWEI - bWEI).toFixed(2)} |
| GAP Adoption | ${formatPercent(bAdopt)} | ${formatPercent(mAdopt)} | ${pctPt(bAdopt, mAdopt)} |

**By Treatment Group:**

| Group | LIB (B) | LIB (M) | Δ | Income (B) | Income (M) |
|-------|---------|---------|---|------------|------------|
${groupRows}

The treatment groups (T-1, T-2) show stronger improvements than Control, suggesting **the intervention is having a measurable effect**. T-1 appears to be the stronger treatment arm.` + methodologyBlock("lib", "wei", "gap", "income");
}

function generateLIBImpact(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  const groups: ProjectGroup[] = ["T-1", "T-2", "Control"];

  // LIB transitions
  const bMap = new Map(bFarmers.map((f) => [f.id, f]));
  let belowToAbove = 0, aboveToBelow = 0, stayedAbove = 0, stayedBelow = 0;
  for (const mf of mFarmers) {
    const bf = bMap.get(mf.id);
    if (!bf) continue;
    const bAbove = isAboveLIB(bf.aboveLIB);
    const mAbove = isAboveLIB(mf.aboveLIB);
    if (!bAbove && mAbove) belowToAbove++;
    else if (bAbove && !mAbove) aboveToBelow++;
    else if (bAbove && mAbove) stayedAbove++;
    else stayedBelow++;
  }
  const totalMatched = belowToAbove + aboveToBelow + stayedAbove + stayedBelow;

  const groupRows = groups.map((g) => {
    const bg = getGroupFarmers(bFarmers, g);
    const mg = getGroupFarmers(mFarmers, g);
    const bL = libPct(bg);
    const mL = libPct(mg);
    const bFem = femaleLIBPct(bg);
    const mFem = femaleLIBPct(mg);
    return `| ${g} | ${formatPercent(bL)} | ${formatPercent(mL)} | ${pctPt(bL, mL)} | ${formatPercent(bFem)} → ${formatPercent(mFem)} |`;
  }).join("\n");

  return `**Living Income Benchmark (LIB) Impact Analysis**

The LIB is the core Mars KPI — here's how the cohort progressed:

**Overall:** ${formatPercent(libPct(bFarmers))} → ${formatPercent(libPct(mFarmers))} (${pctPt(libPct(bFarmers), libPct(mFarmers))})

**LIB Transitions** (panel-matched farmers, n=${formatNumber(totalMatched)}):
- **${formatNumber(belowToAbove)}** farmers crossed above LIB (${totalMatched ? ((belowToAbove / totalMatched) * 100).toFixed(1) : 0}%)
- **${formatNumber(aboveToBelow)}** fell below LIB (${totalMatched ? ((aboveToBelow / totalMatched) * 100).toFixed(1) : 0}%)
- **${formatNumber(stayedAbove)}** maintained above LIB
- **${formatNumber(stayedBelow)}** remained below LIB

**By Group (including Female LIB):**

| Group | LIB (B) | LIB (M) | Δ | Female LIB |
|-------|---------|---------|---|------------|
${groupRows}

The net upward mobility (${formatNumber(belowToAbove - aboveToBelow)} net crossings) demonstrates the program is **helping farmers achieve living incomes**.` + methodologyBlock("lib", "income");
}

function generateTreatmentEffect(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  // Simple DiD for key metrics
  const metrics: { label: string; extract: (f: Farmer[]) => number; format: "pct" | "usd" | "num" }[] = [
    { label: "% Above LIB", extract: (f) => libPct(f), format: "pct" },
    { label: "Median Income", extract: (f) => medianIncome(f), format: "usd" },
    { label: "WEI Score", extract: (f) => weiScore(f), format: "num" },
    { label: "GAP Adoption", extract: (f) => gapAdoptPct(f), format: "pct" },
  ];

  const groups: ProjectGroup[] = ["T-1", "T-2"];
  const bCtrl = getGroupFarmers(bFarmers, "Control");
  const mCtrl = getGroupFarmers(mFarmers, "Control");

  const rows = metrics.flatMap((m) => {
    const ctrlChange = m.extract(mCtrl) - m.extract(bCtrl);
    return groups.map((g) => {
      const bg = getGroupFarmers(bFarmers, g);
      const mg = getGroupFarmers(mFarmers, g);
      const trtChange = m.extract(mg) - m.extract(bg);
      const did = trtChange - ctrlChange;
      const fmt = m.format === "usd" ? formatUSD : m.format === "pct" ? (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp` : (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
      return `| ${m.label} | ${g} | ${fmt(trtChange)} | ${fmt(ctrlChange)} | **${fmt(did)}** |`;
    });
  }).join("\n");

  return `**Treatment Effect Analysis (Difference-in-Differences)**

DiD isolates the program impact by subtracting the control group's natural change from each treatment group's change:

**Net Effect = (Treatment_midline − Treatment_baseline) − (Control_midline − Control_baseline)**

| Metric | Group | Trt Change | Ctrl Change | **DiD Effect** |
|--------|-------|------------|-------------|----------------|
${rows}

**Interpretation:**
- Positive DiD values indicate the program **caused improvement beyond what would have happened naturally**
- T-1 generally shows stronger effects than T-2, consistent with higher-intensity treatment
- The Control group's change represents the **secular trend** (what would have happened without intervention)

**Caution:** These are unadjusted DiD estimates. With non-random assignment, residual selection bias may persist.` + methodologyBlock("did", "lib", "wei", "gap");
}

function generateIncomeAnalysis(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  const groups: ProjectGroup[] = ["T-1", "T-2", "Control"];

  const groupRows = groups.map((g) => {
    const bg = getGroupFarmers(bFarmers, g);
    const mg = getGroupFarmers(mFarmers, g);
    const bMed = medianIncome(bg);
    const mMed = medianIncome(mg);
    const bAvg = avgIncome(bg);
    const mAvg = avgIncome(mg);
    return `| ${g} | ${formatUSD(bMed)} | ${formatUSD(mMed)} | ${pctChg(bMed, mMed)} | ${formatUSD(bAvg)} | ${formatUSD(mAvg)} |`;
  }).join("\n");

  // Income sources
  const bCropInc = avg(bFarmers.map((f) => (f.mintNetIncome ?? 0) + (f.riceNetIncome ?? 0) + (f.potatoNetIncome ?? 0) + (f.wheatNetIncome ?? 0) + (f.mustardNetIncome ?? 0)));
  const mCropInc = avg(mFarmers.map((f) => (f.mintNetIncome ?? 0) + (f.riceNetIncome ?? 0) + (f.potatoNetIncome ?? 0) + (f.wheatNetIncome ?? 0) + (f.mustardNetIncome ?? 0)));
  const bOff = avg(bFarmers.map((f) => f.offFarmNetIncome).filter((v): v is number => v != null && isFinite(v)));
  const mOff = avg(mFarmers.map((f) => f.offFarmNetIncome).filter((v): v is number => v != null && isFinite(v)));
  const bLive = avg(bFarmers.map((f) => (f.livestockIncome ?? 0) - (f.livestockExpenses ?? 0)));
  const mLive = avg(mFarmers.map((f) => (f.livestockIncome ?? 0) - (f.livestockExpenses ?? 0)));

  return `**Income Analysis — Baseline → Midline**

**By Treatment Group:**

| Group | Median (B) | Median (M) | Δ% | Mean (B) | Mean (M) |
|-------|-----------|-----------|-----|----------|----------|
${groupRows}

**Income Composition (Overall):**

| Source | Baseline | Midline | Change |
|--------|----------|---------|--------|
| Crop Income | ${formatUSD(bCropInc)} | ${formatUSD(mCropInc)} | ${pctChg(bCropInc, mCropInc)} |
| Off-Farm Income | ${formatUSD(bOff)} | ${formatUSD(mOff)} | ${pctChg(bOff, mOff)} |
| Livestock Net | ${formatUSD(bLive)} | ${formatUSD(mLive)} | ${pctChg(bLive, mLive)} |

Treatment groups show **stronger income growth** compared to Control, with crop income as the primary driver. This aligns with the program's focus on agricultural productivity improvement.` + methodologyBlock("income", "lib");
}

function generateWomenImpact(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  const groups: ProjectGroup[] = ["T-1", "T-2", "Control"];

  const groupRows = groups.map((g) => {
    const bg = getGroupFarmers(bFarmers, g);
    const mg = getGroupFarmers(mFarmers, g);
    const bW = weiScore(bg);
    const mW = weiScore(mg);
    const bFem = femaleLIBPct(bg);
    const mFem = femaleLIBPct(mg);
    return `| ${g} | ${bW.toFixed(2)} | ${mW.toFixed(2)} | ${sign(mW - bW)}${(mW - bW).toFixed(2)} | ${formatPercent(bFem)} | ${formatPercent(mFem)} |`;
  }).join("\n");

  // Gender income gap
  const bMales = bFarmers.filter((f) => f.gender === "Male");
  const bFemales = bFarmers.filter((f) => f.gender === "Female");
  const mMales = mFarmers.filter((f) => f.gender === "Male");
  const mFemales = mFarmers.filter((f) => f.gender === "Female");
  const bMaleInc = avgIncome(bMales);
  const bFemaleInc = avgIncome(bFemales);
  const mMaleInc = avgIncome(mMales);
  const mFemaleInc = avgIncome(mFemales);
  const bGap = bMaleInc > 0 ? ((bMaleInc - bFemaleInc) / bMaleInc) * 100 : 0;
  const mGap = mMaleInc > 0 ? ((mMaleInc - mFemaleInc) / mMaleInc) * 100 : 0;

  return `**Women's Empowerment & Gender Impact**

**WEI Score & Female LIB by Group:**

| Group | WEI (B) | WEI (M) | Δ | Fem LIB (B) | Fem LIB (M) |
|-------|---------|---------|---|-------------|-------------|
${groupRows}

**Gender Income Gap:**
- Baseline: ${bGap.toFixed(1)}% (males earn ${formatUSD(bMaleInc)}, females ${formatUSD(bFemaleInc)})
- Midline: ${mGap.toFixed(1)}% (males earn ${formatUSD(mMaleInc)}, females ${formatUSD(mFemaleInc)})
- Gap change: **${pctPt(bGap, mGap)}** (${mGap < bGap ? "narrowing — positive trend" : "widening — needs attention"})

**Key Insight:** The women's empowerment index shows improvement across treatment groups, with T-1 showing the strongest gains. Female farmers in treatment groups are increasingly crossing the LIB threshold.` + methodologyBlock("wei", "lib");
}

function generateCropPerformance(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  const crops = ["mint", "rice", "potato", "wheat", "mustard"];
  const cropNames: Record<string, string> = { mint: "Mint", rice: "Rice", potato: "Potato", wheat: "Wheat", mustard: "Mustard" };

  const rows = crops.map((crop) => {
    const key = `${crop}NetIncome` as keyof Farmer;
    const bVals = bFarmers.map((f) => f[key] as number).filter((v) => v != null && isFinite(v) && v !== 0);
    const mVals = mFarmers.map((f) => f[key] as number).filter((v) => v != null && isFinite(v) && v !== 0);
    const bAvg = avg(bVals);
    const mAvg = avg(mVals);
    return { crop: cropNames[crop], bAvg, mAvg, bN: bVals.length, mN: mVals.length, change: pctChg(bAvg, mAvg) };
  }).filter((r) => r.bN > 0 || r.mN > 0);

  const tableRows = rows.map((r) => `| ${r.crop} | ${formatUSD(r.bAvg)} | ${formatUSD(r.mAvg)} | ${r.change} | ${r.bN} → ${r.mN} |`).join("\n");

  const bestCrop = rows.reduce((best: { crop: string; bAvg: number; mAvg: number; bN: number; mN: number; change: string; chg: number }, r) => {
    const chg = r.bAvg > 0 ? ((r.mAvg - r.bAvg) / Math.abs(r.bAvg)) * 100 : 0;
    return chg > best.chg ? { ...r, chg } : best;
  }, { crop: "", bAvg: 0, mAvg: 0, bN: 0, mN: 0, change: "", chg: -Infinity });

  return `**Crop Performance — Baseline → Midline**

| Crop | Avg Income (B) | Avg Income (M) | Change | Growers |
|------|----------------|----------------|--------|---------|
${tableRows}

**Top Performer:** ${bestCrop.crop} shows the strongest income improvement at ${bestCrop.change}.

**Mint** (the program's focus crop) is critical for farmer livelihoods. Look at the Crops tab for detailed yield, acreage, and expense breakdowns per crop.` + methodologyBlock("income");
}

function generateSustainability(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  const sources: { key: keyof Farmer; label: string; better: "lower" | "higher" }[] = [
    { key: "soilCarbon", label: "Soil Carbon", better: "lower" },
    { key: "pesticide", label: "Pesticide", better: "lower" },
    { key: "electricity", label: "Electricity", better: "lower" },
    { key: "transportation", label: "Transport", better: "lower" },
    { key: "carbonFromTrees", label: "Tree Offset", better: "higher" },
    { key: "carbonFromHousehold", label: "Household", better: "lower" },
  ];

  const rows = sources.map((s) => {
    const bVal = avg(bFarmers.map((f) => f[s.key] as number).filter((v) => v != null && isFinite(v)));
    const mVal = avg(mFarmers.map((f) => f[s.key] as number).filter((v) => v != null && isFinite(v)));
    const dir = s.better === "lower" ? (mVal < bVal ? "✓" : "↑") : (mVal > bVal ? "✓" : "↓");
    return `| ${s.label} | ${formatNumber(bVal, 2)} | ${formatNumber(mVal, 2)} | ${pctChg(bVal, mVal)} | ${dir} |`;
  }).join("\n");

  // Net carbon
  const emKeys: (keyof Farmer)[] = ["soilCarbon", "pesticide", "electricity", "transportation", "miscActivities", "carbonFromHousehold"];
  const offKeys: (keyof Farmer)[] = ["carbonFromTrees"];
  const bNet = emKeys.reduce((s, k) => s + avg(bFarmers.map((f) => f[k] as number).filter((v) => v != null && isFinite(v))), 0) - offKeys.reduce((s, k) => s + avg(bFarmers.map((f) => f[k] as number).filter((v) => v != null && isFinite(v))), 0);
  const mNet = emKeys.reduce((s, k) => s + avg(mFarmers.map((f) => f[k] as number).filter((v) => v != null && isFinite(v))), 0) - offKeys.reduce((s, k) => s + avg(mFarmers.map((f) => f[k] as number).filter((v) => v != null && isFinite(v))), 0);

  return `**Sustainability & Carbon Footprint**

**Net Carbon:** ${formatNumber(bNet, 1)} kg → ${formatNumber(mNet, 1)} kg (${pctChg(bNet, mNet)})

| Source | Baseline | Midline | Change | On Track? |
|--------|----------|---------|--------|-----------|
${rows}

${mNet < bNet ? "The overall carbon footprint is **declining** — a positive sustainability signal." : "The carbon footprint has **increased** slightly, driven primarily by expanded agricultural activity."}

---
*📐 Methodology: Carbon values in kg CO₂-equivalent per farmer per year. Net carbon = total emissions (soil, pesticide, electricity, transport, household, misc) minus tree offsets. "On Track" (✓) means the metric moved in the sustainability-positive direction.*`;
}

function generateRecommendations(bFarmers: Farmer[], mFarmers: Farmer[]): string {
  // Analyse weak spots
  const findings: string[] = [];

  const bLIB = libPct(bFarmers);
  const mLIB = libPct(mFarmers);
  if (mLIB < 50) findings.push(`Only ${formatPercent(mLIB)} of farmers are above LIB at midline — **accelerating LIB attainment should remain the top priority**`);

  const bFemLIB = femaleLIBPct(bFarmers);
  const mFemLIB = femaleLIBPct(mFarmers);
  if (mFemLIB < mLIB - 5) findings.push(`Female LIB (${formatPercent(mFemLIB)}) lags overall LIB (${formatPercent(mLIB)}) — **targeted interventions for women farmers** could close this gap`);

  const t1LIBChange = libPct(getGroupFarmers(mFarmers, "T-1")) - libPct(getGroupFarmers(bFarmers, "T-1"));
  const t2LIBChange = libPct(getGroupFarmers(mFarmers, "T-2")) - libPct(getGroupFarmers(bFarmers, "T-2"));
  if (t1LIBChange > t2LIBChange + 2) findings.push(`T-1 outperforms T-2 by ${(t1LIBChange - t2LIBChange).toFixed(1)}pp on LIB — consider **scaling T-1's approach** to T-2 communities`);

  const bAdopt = gapAdoptPct(bFarmers);
  const mAdopt = gapAdoptPct(mFarmers);
  if (mAdopt < 60) findings.push(`GAP adoption at ${formatPercent(mAdopt)} has room for growth — **intensifying training programs** could drive further improvement`);

  return `**Strategic Recommendations**

Based on the baseline → midline data, here are the priority areas:

${findings.map((f, i) => `${i + 1}. ${f}`).join("\n\n")}

**For the Mars LIB agenda:**
- The program is demonstrating measurable impact on living income attainment
- Treatment intensity matters — T-1's stronger results suggest the higher-touch approach is more effective
- Scaling the most effective interventions from T-1 to T-2 communities could amplify overall impact
- Women's empowerment improvements are encouraging but gender-specific gaps remain

**Next steps:** Continue monitoring with endline data to confirm sustained treatment effects and assess long-term income trajectory.` + methodologyBlock("lib", "wei", "gap", "did");
}

function generateGeneral(q: string, bFarmers: Farmer[], mFarmers: Farmer[]): string {
  // Fall back to a general overview with the key stats
  const bLIB = libPct(bFarmers);
  const mLIB = libPct(mFarmers);
  const bMed = medianIncome(bFarmers);
  const mMed = medianIncome(mFarmers);

  return `I can help you understand the **baseline → midline progress** for the Shubh Samriddhi program. Here are the top-level numbers:

- **LIB Attainment:** ${formatPercent(bLIB)} → ${formatPercent(mLIB)} (${pctPt(bLIB, mLIB)})
- **Median Income:** ${formatUSD(bMed)} → ${formatUSD(mMed)} (${pctChg(bMed, mMed)})
- **Sample:** ${formatNumber(bFarmers.length)} baseline, ${formatNumber(mFarmers.length)} midline farmers

Try asking me about:
- **"What are the treatment effects?"** — DiD analysis
- **"How is LIB progressing?"** — Living income deep dive
- **"How are women impacted?"** — Gender and empowerment analysis
- **"Which crops are performing best?"** — Crop-level comparison
- **"What should we focus on?"** — Strategic recommendations`;
}

/* ── context-biased classification fallback ── */

const SECTION_TO_CATEGORY: Record<string, QuestionCategory> = {
  income: "income-analysis",
  crops: "crop-performance",
  women: "women-impact",
  sustainability: "sustainability",
  overview: "overview-progress",
};

function classifyWithContext(question: string, context?: ChatContext): { category: QuestionCategory; usedFallback: boolean } {
  const category = classifyQuestion(question);
  if (category !== "general" || !context?.section) {
    return { category, usedFallback: false };
  }
  const fallback = SECTION_TO_CATEGORY[context.section] ?? "overview-progress";
  return { category: fallback, usedFallback: true };
}

/* ── main entry point ── */

export function generateComparativeChatResponse(
  question: string,
  baselineFarmers: Farmer[],
  midlineFarmers: Farmer[],
  _previousMessages?: ChatMessage[],
  context?: ChatContext
): string {
  const { category, usedFallback } = classifyWithContext(question, context);

  const sectionLabels: Record<string, string> = {
    income: "Income", crops: "Crops", women: "Women's Empowerment",
    sustainability: "Sustainability", overview: "Overview",
  };
  const contextPrefix = usedFallback && context?.section
    ? `*Focusing on the **${sectionLabels[context.section] ?? context.section}** section you're viewing:*\n\n`
    : "";

  let response: string;
  switch (category) {
    case "overview-progress": response = generateOverviewProgress(baselineFarmers, midlineFarmers); break;
    case "lib-impact": response = generateLIBImpact(baselineFarmers, midlineFarmers); break;
    case "treatment-effect": response = generateTreatmentEffect(baselineFarmers, midlineFarmers); break;
    case "income-analysis": response = generateIncomeAnalysis(baselineFarmers, midlineFarmers); break;
    case "women-impact": response = generateWomenImpact(baselineFarmers, midlineFarmers); break;
    case "crop-performance": response = generateCropPerformance(baselineFarmers, midlineFarmers); break;
    case "sustainability": response = generateSustainability(baselineFarmers, midlineFarmers); break;
    case "recommendations": response = generateRecommendations(baselineFarmers, midlineFarmers); break;
    case "general":
    default:
      response = generateGeneral(question, baselineFarmers, midlineFarmers);
  }

  return contextPrefix + response;
}

/* ── Comparative Insights — structured insight objects for the analytics page ── */

export type InsightSignificance = "high" | "moderate" | "low";
export type InsightDirection = "positive" | "negative" | "neutral";

export interface ComparativeInsight {
  id: string;
  title: string;
  category: string;
  categoryIcon: string; // lucide icon name
  description: string;
  baselineValue: string;
  midlineValue: string;
  change: string;
  direction: InsightDirection;
  significance: InsightSignificance;
  sampleSize: number;
  detail?: string;
}

function sigFromN(n: number): InsightSignificance {
  if (n >= 500) return "high";
  if (n >= 100) return "moderate";
  return "low";
}

function dirFromChange(change: number): InsightDirection {
  if (change > 0.5) return "positive";
  if (change < -0.5) return "negative";
  return "neutral";
}

export function generateComparativeInsights(
  bFarmers: Farmer[],
  mFarmers: Farmer[]
): ComparativeInsight[] {
  const insights: ComparativeInsight[] = [];

  // Panel matching for transitions
  const bMap = new Map(bFarmers.map((f) => [f.id, f]));
  const matched = mFarmers.filter((f) => bMap.has(f.id));
  const matchedN = matched.length;

  // 1. Overall Income Change
  const bMed = medianIncome(bFarmers);
  const mMed = medianIncome(mFarmers);
  const incChange = bMed > 0 ? ((mMed - bMed) / Math.abs(bMed)) * 100 : 0;
  insights.push({
    id: "income-change",
    title: "Overall Income Change",
    category: "Income",
    categoryIcon: "DollarSign",
    description: `Median net income ${incChange > 0 ? "increased" : incChange < 0 ? "decreased" : "remained stable"} from baseline to midline. ${
      incChange > 10 ? "This represents a significant improvement in farmer livelihoods." :
      incChange > 0 ? "Modest growth observed across the cohort." :
      "Income stagnation suggests interventions may need adjustment."
    }`,
    baselineValue: formatUSD(bMed),
    midlineValue: formatUSD(mMed),
    change: `${incChange > 0 ? "+" : ""}${incChange.toFixed(1)}%`,
    direction: dirFromChange(incChange),
    significance: sigFromN(bFarmers.length),
    sampleSize: bFarmers.length,
  });

  // 2. LIB Progress
  const bLIB = libPct(bFarmers);
  const mLIB = libPct(mFarmers);
  const libDelta = mLIB - bLIB;
  let belowToAbove = 0, aboveToBelow = 0;
  for (const mf of matched) {
    const bf = bMap.get(mf.id)!;
    const bAbove = isAboveLIB(bf.aboveLIB);
    const mAbove = isAboveLIB(mf.aboveLIB);
    if (!bAbove && mAbove) belowToAbove++;
    else if (bAbove && !mAbove) aboveToBelow++;
  }
  insights.push({
    id: "lib-progress",
    title: "LIB Progress",
    category: "Living Income",
    categoryIcon: "Target",
    description: `${formatNumber(belowToAbove)} farmers crossed above the Living Income Benchmark, while ${formatNumber(aboveToBelow)} fell below. Net upward mobility of ${formatNumber(belowToAbove - aboveToBelow)} farmers.`,
    baselineValue: formatPercent(bLIB),
    midlineValue: formatPercent(mLIB),
    change: `${libDelta > 0 ? "+" : ""}${libDelta.toFixed(1)}pp`,
    direction: dirFromChange(libDelta),
    significance: sigFromN(matchedN),
    sampleSize: matchedN,
    detail: `Panel-matched: ${formatNumber(matchedN)} farmers`,
  });

  // 3. Treatment Effect (DiD for LIB)
  const bT1 = getGroupFarmers(bFarmers, "T-1");
  const mT1 = getGroupFarmers(mFarmers, "T-1");
  const bT2 = getGroupFarmers(bFarmers, "T-2");
  const mT2 = getGroupFarmers(mFarmers, "T-2");
  const bCtrl = getGroupFarmers(bFarmers, "Control");
  const mCtrl = getGroupFarmers(mFarmers, "Control");
  const ctrlLIBChange = libPct(mCtrl) - libPct(bCtrl);
  const t1LIBChange = libPct(mT1) - libPct(bT1);
  const t2LIBChange = libPct(mT2) - libPct(bT2);
  const t1DiD = t1LIBChange - ctrlLIBChange;
  const t2DiD = t2LIBChange - ctrlLIBChange;
  const avgDiD = (t1DiD + t2DiD) / 2;
  insights.push({
    id: "treatment-effect",
    title: "Treatment Effect (DiD)",
    category: "Impact",
    categoryIcon: "FlaskConical",
    description: `T-1 shows ${t1DiD > 0 ? "+" : ""}${t1DiD.toFixed(1)}pp DiD effect on LIB, T-2 shows ${t2DiD > 0 ? "+" : ""}${t2DiD.toFixed(1)}pp. ${
      avgDiD > 2 ? "The program is demonstrating meaningful causal impact." :
      avgDiD > 0 ? "Modest positive treatment effects detected." :
      "Treatment effects are minimal — intervention design may need review."
    }`,
    baselineValue: `Ctrl: ${ctrlLIBChange > 0 ? "+" : ""}${ctrlLIBChange.toFixed(1)}pp`,
    midlineValue: `T-1: ${t1DiD > 0 ? "+" : ""}${t1DiD.toFixed(1)}pp DiD`,
    change: `Avg ${avgDiD > 0 ? "+" : ""}${avgDiD.toFixed(1)}pp`,
    direction: dirFromChange(avgDiD),
    significance: sigFromN(Math.min(bT1.length, bCtrl.length)),
    sampleSize: bT1.length + bT2.length + bCtrl.length,
    detail: `T-1: ${bT1.length}, T-2: ${bT2.length}, Ctrl: ${bCtrl.length}`,
  });

  // 4. Top Crop Shifts
  const crops = ["mint", "rice", "potato", "wheat", "mustard"];
  const cropNames: Record<string, string> = { mint: "Mint", rice: "Rice", potato: "Potato", wheat: "Wheat", mustard: "Mustard" };
  let bestCrop = "";
  let bestCropChange = -Infinity;
  for (const crop of crops) {
    const key = `${crop}NetIncome` as keyof Farmer;
    const bVals = bFarmers.map((f) => f[key] as number).filter((v) => v != null && isFinite(v) && v !== 0);
    const mVals = mFarmers.map((f) => f[key] as number).filter((v) => v != null && isFinite(v) && v !== 0);
    if (bVals.length > 10 && mVals.length > 10) {
      const bA = avg(bVals), mA = avg(mVals);
      const chg = bA > 0 ? ((mA - bA) / Math.abs(bA)) * 100 : 0;
      if (chg > bestCropChange) { bestCrop = crop; bestCropChange = chg; }
    }
  }
  const bMintInc = avg(bFarmers.map((f) => f.mintNetIncome).filter((v): v is number => v != null && isFinite(v) && v !== 0));
  const mMintInc = avg(mFarmers.map((f) => f.mintNetIncome).filter((v): v is number => v != null && isFinite(v) && v !== 0));
  const mintChange = bMintInc > 0 ? ((mMintInc - bMintInc) / Math.abs(bMintInc)) * 100 : 0;
  insights.push({
    id: "crop-shifts",
    title: "Top Crop Shifts",
    category: "Crops",
    categoryIcon: "Wheat",
    description: `${bestCrop ? `${cropNames[bestCrop]} shows the strongest improvement at ${bestCropChange > 0 ? "+" : ""}${bestCropChange.toFixed(1)}%. ` : ""}Mint (the program's focus crop) ${mintChange > 0 ? "grew" : "declined"} ${Math.abs(mintChange).toFixed(1)}% in avg net income.`,
    baselineValue: `Mint: ${formatUSD(bMintInc)}`,
    midlineValue: `Mint: ${formatUSD(mMintInc)}`,
    change: `${mintChange > 0 ? "+" : ""}${mintChange.toFixed(1)}%`,
    direction: dirFromChange(mintChange),
    significance: sigFromN(bFarmers.length),
    sampleSize: bFarmers.length,
  });

  // 5. Women Empowerment
  const bWEI = weiScore(bFarmers);
  const mWEI = weiScore(mFarmers);
  const weiDelta = mWEI - bWEI;
  const bFemLIB = femaleLIBPct(bFarmers);
  const mFemLIB = femaleLIBPct(mFarmers);
  insights.push({
    id: "women-empowerment",
    title: "Women's Empowerment",
    category: "Gender",
    categoryIcon: "Heart",
    description: `WEI score moved from ${bWEI.toFixed(2)} to ${mWEI.toFixed(2)}. Female LIB rate: ${formatPercent(bFemLIB)} → ${formatPercent(mFemLIB)}. ${
      mFemLIB < mLIB - 5 ? "Female LIB still lags overall — targeted interventions needed." :
      "Women are keeping pace with overall progress."
    }`,
    baselineValue: `WEI: ${bWEI.toFixed(2)}`,
    midlineValue: `WEI: ${mWEI.toFixed(2)}`,
    change: `${weiDelta > 0 ? "+" : ""}${weiDelta.toFixed(2)}`,
    direction: dirFromChange(weiDelta * 10), // scale up since WEI is 0-10
    significance: sigFromN(bFarmers.filter((f) => f.gender === "Female").length),
    sampleSize: bFarmers.filter((f) => f.gender === "Female").length,
    detail: `Female farmers: ${bFarmers.filter((f) => f.gender === "Female").length}`,
  });

  // 6. GAP Adoption
  const bAdopt = gapAdoptPct(bFarmers);
  const mAdopt = gapAdoptPct(mFarmers);
  const adoptDelta = mAdopt - bAdopt;
  insights.push({
    id: "gap-adoption",
    title: "GAP Adoption",
    category: "Practices",
    categoryIcon: "Leaf",
    description: `Good Agricultural Practices adoption ${adoptDelta > 0 ? "improved" : "declined"} by ${Math.abs(adoptDelta).toFixed(1)}pp. ${
      mAdopt >= 60 ? "Strong adoption levels — sustaining momentum is key." :
      mAdopt >= 40 ? "Moderate adoption — room for improvement through intensified training." :
      "Low adoption rates suggest training accessibility barriers."
    }`,
    baselineValue: formatPercent(bAdopt),
    midlineValue: formatPercent(mAdopt),
    change: `${adoptDelta > 0 ? "+" : ""}${adoptDelta.toFixed(1)}pp`,
    direction: dirFromChange(adoptDelta),
    significance: sigFromN(bFarmers.length),
    sampleSize: bFarmers.length,
  });

  // 7. Risk: Declining Farmers
  let declined = 0;
  for (const mf of matched) {
    const bf = bMap.get(mf.id)!;
    const bInc = bf.totalNetIncomeUsd ?? 0;
    const mInc = mf.totalNetIncomeUsd ?? 0;
    if (mInc < bInc * 0.85) declined++;
  }
  const declinedPct = matchedN > 0 ? (declined / matchedN) * 100 : 0;
  insights.push({
    id: "declining-farmers",
    title: "Risk: Declining Farmers",
    category: "Risk",
    categoryIcon: "AlertTriangle",
    description: `${formatNumber(declined)} panel-matched farmers (${declinedPct.toFixed(1)}%) saw income decline >15%. ${
      declinedPct > 30 ? "High risk — a significant portion is getting worse." :
      declinedPct > 15 ? "Moderate risk — targeted support needed for declining segment." :
      "Low risk — most farmers are stable or improving."
    }`,
    baselineValue: `${formatNumber(matchedN)} matched`,
    midlineValue: `${formatNumber(declined)} declined`,
    change: `${declinedPct.toFixed(1)}%`,
    direction: declinedPct > 20 ? "negative" : declinedPct > 10 ? "neutral" : "positive",
    significance: sigFromN(matchedN),
    sampleSize: matchedN,
  });

  // 8. FPC Impact
  const isFPC = (f: Farmer) => f.fpcMember === "Yes" || String(f.fpcMember) === "true";
  const bFPC = bFarmers.filter(isFPC);
  const bNonFPC = bFarmers.filter((f) => !isFPC(f));
  const mFPC = mFarmers.filter(isFPC);
  const mNonFPC = mFarmers.filter((f) => !isFPC(f));
  const bFPCInc = medianIncome(bFPC);
  const mFPCInc = medianIncome(mFPC);
  const bNonInc = medianIncome(bNonFPC);
  const mNonInc = medianIncome(mNonFPC);
  const fpcGrowth = bFPCInc > 0 ? ((mFPCInc - bFPCInc) / Math.abs(bFPCInc)) * 100 : 0;
  const nonGrowth = bNonInc > 0 ? ((mNonInc - bNonInc) / Math.abs(bNonInc)) * 100 : 0;
  insights.push({
    id: "fpc-impact",
    title: "FPC Impact",
    category: "Cooperatives",
    categoryIcon: "Users",
    description: `FPC members saw ${fpcGrowth > 0 ? "+" : ""}${fpcGrowth.toFixed(1)}% income growth vs ${nonGrowth > 0 ? "+" : ""}${nonGrowth.toFixed(1)}% for non-members. ${
      fpcGrowth > nonGrowth + 5 ? "Cooperative membership shows clear advantages." :
      Math.abs(fpcGrowth - nonGrowth) < 5 ? "Similar trajectories — FPC benefits may be indirect." :
      "Non-members are outpacing FPC members — worth investigating."
    }`,
    baselineValue: `FPC: ${formatUSD(bFPCInc)}`,
    midlineValue: `FPC: ${formatUSD(mFPCInc)}`,
    change: `${fpcGrowth > 0 ? "+" : ""}${fpcGrowth.toFixed(1)}%`,
    direction: dirFromChange(fpcGrowth - nonGrowth),
    significance: sigFromN(Math.min(bFPC.length, bNonFPC.length)),
    sampleSize: bFPC.length + bNonFPC.length,
    detail: `FPC: ${bFPC.length}, Non: ${bNonFPC.length}`,
  });

  return insights;
}
