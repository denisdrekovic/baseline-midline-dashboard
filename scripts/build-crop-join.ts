/**
 * Repair the baseline crop files: replace the junk id column with the true
 * farmer id and stamp the group (T-1 / T-2 / Control) on every record.
 *
 * Background: scripts/csv-to-baseline.ts originally wrote `num(r.ID)` — an
 * enumeration-cluster code (33 values) — instead of the farmer id, so crop
 * records could not be joined to farmers. The files are farmer-level in
 * farmers.json order (mint strictly positional; other crops ordered
 * subsequences), so the join is reconstructed by walking both files in order
 * and matching on {crop}NetIncome. See docs/PHASE2-DATA-INVESTIGATION.md.
 *
 * Within a run of identical netIncome values the row↔farmer assignment can
 * permute, but the SET of farmers per run is fixed — so group-level income
 * stats are exact; only yield/acre attribution is uncertain inside runs that
 * span more than one group. Those rows are flagged `joinAmbiguous`.
 *
 * Writes (in place): src/data/rounds/baseline/crops/{crop}.json
 * Also writes:       src/data/rounds/baseline/crops-joined.json (combined)
 * Run: npx tsx scripts/build-crop-join.ts
 * Idempotent — matching uses row order + netIncome, not the id column.
 */
import * as fs from "fs";
import * as path from "path";

const BASE = path.join(__dirname, "../src/data/rounds/baseline");
const CROPS = ["mint", "rice", "potato", "wheat", "mustard"] as const;
const NET_KEY: Record<string, string> = {
  mint: "mintNetIncome",
  rice: "riceNetIncome",
  potato: "potatoNetIncome",
  wheat: "wheatNetIncome",
  mustard: "mustardNetIncome",
};

interface CropRow {
  id: number;
  yield: number | null;
  acre: number | null;
  income: number | null;
  expenses: number | null;
  netIncome: number | null;
  crop: string;
  group?: string;
  joinAmbiguous?: boolean;
}

const farmers = JSON.parse(fs.readFileSync(path.join(BASE, "farmers.json"), "utf8"));
const allJoined: CropRow[] = [];

console.log("crop      | rows  | matched | ambiguous | cross-group amb | pooled cost ratio");

for (const crop of CROPS) {
  const rows: CropRow[] = JSON.parse(
    fs.readFileSync(path.join(BASE, "crops", `${crop}.json`), "utf8"),
  );
  const key = NET_KEY[crop];
  let fi = 0;
  let ambiguous = 0;
  let crossGroup = 0;

  const repaired: CropRow[] = rows.map((r) => {
    const target = r.netIncome != null ? Math.round(r.netIncome * 100) : null;
    let farmer = null;
    let nextSameValueFarmer = null;

    while (fi < farmers.length) {
      const f = farmers[fi];
      const v = f[key] != null ? Math.round(f[key] * 100) : null;
      fi++;
      if (v === target) {
        farmer = f;
        const next = farmers[fi];
        if (next && next[key] != null && Math.round(next[key] * 100) === target) {
          nextSameValueFarmer = next;
        }
        break;
      }
    }

    if (!farmer) {
      console.error(`${crop}: unmatched row (netIncome=${r.netIncome}) — join broken, aborting`);
      process.exit(1);
    }

    const isAmbiguous = nextSameValueFarmer != null;
    if (isAmbiguous) {
      ambiguous++;
      if (nextSameValueFarmer.project !== farmer.project) crossGroup++;
    }

    const out: CropRow = {
      id: farmer.id,
      group: farmer.project,
      yield: r.yield ?? null,
      acre: r.acre ?? null,
      income: r.income ?? null,
      expenses: r.expenses ?? null,
      netIncome: r.netIncome ?? null,
      crop,
    };
    if (isAmbiguous) out.joinAmbiguous = true;
    return out;
  });

  // Validation: pooled cost ratio must reproduce the Phase 1 constants
  let inc = 0;
  let net = 0;
  for (const r of repaired) {
    if (r.income == null || r.income <= 0 || r.netIncome == null) continue;
    inc += r.income;
    net += r.netIncome;
  }
  const ratio = ((1 - net / inc) * 100).toFixed(1);
  console.log(
    `${crop.padEnd(9)} | ${String(rows.length).padStart(5)} | ${String(repaired.length).padStart(7)} | ${String(ambiguous).padStart(9)} | ${String(crossGroup).padStart(15)} | ${ratio}%`,
  );

  fs.writeFileSync(path.join(BASE, "crops", `${crop}.json`), JSON.stringify(repaired));
  allJoined.push(...repaired);
}

const out = {
  meta: {
    description:
      "Combined crop records with true farmer id + group, reconstructed by ordered join " +
      "(NOT a source export — see docs/PHASE2-DATA-INVESTIGATION.md). Rows flagged " +
      "joinAmbiguous sit in equal-netIncome runs where farmer attribution can permute; " +
      "group income aggregates are exact regardless.",
    source: "src/data/rounds/baseline/{farmers.json, crops/*.json}",
    records: allJoined.length,
  },
  records: allJoined,
};

fs.writeFileSync(path.join(BASE, "crops-joined.json"), JSON.stringify(out));
console.log(`\nRepaired 5 crop files in place; wrote ${allJoined.length} combined records to crops-joined.json`);
