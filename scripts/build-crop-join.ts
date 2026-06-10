/**
 * Reconstruct the crop-record → farmer join from row order.
 *
 * The crop files' `id` column is not a farmer id (33 cluster-like codes shared
 * across all five files). But the files are farmer-level in farmers.json order:
 * mint is strictly positional (row i = farmer i) and the other crops are ordered
 * subsequences — each row matches the next farmer (in file order) whose
 * {crop}NetIncome equals the row's netIncome. See docs/PHASE2-DATA-INVESTIGATION.md.
 *
 * Writes src/data/rounds/baseline/crops-joined.json: every crop record tagged
 * with farmerId and group (T-1 / T-2 / Control), plus provenance metadata.
 * Run: npx tsx scripts/build-crop-join.ts
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
}

interface JoinedRow extends Omit<CropRow, "id"> {
  farmerId: number;
  group: string;
  sourceClusterId: number;
}

const farmers = JSON.parse(fs.readFileSync(path.join(BASE, "farmers.json"), "utf8"));
const joined: JoinedRow[] = [];
const stats: Record<string, { rows: number; matched: number; ambiguous: number }> = {};

for (const crop of CROPS) {
  const rows: CropRow[] = JSON.parse(
    fs.readFileSync(path.join(BASE, "crops", `${crop}.json`), "utf8"),
  );
  const key = NET_KEY[crop];
  let fi = 0;
  let matched = 0;
  let ambiguous = 0;

  for (const r of rows) {
    const target = r.netIncome != null ? Math.round(r.netIncome * 100) : null;
    let farmer = null;

    while (fi < farmers.length) {
      const f = farmers[fi];
      const v = f[key] != null ? Math.round(f[key] * 100) : null;
      fi++;
      if (v === target) {
        farmer = f;
        // Equal value on the immediately following farmer means the greedy
        // assignment is not provably unique — count it so the re-export
        // validation knows where to look.
        const next = farmers[fi];
        if (next && next[key] != null && Math.round(next[key] * 100) === target) ambiguous++;
        break;
      }
    }

    if (!farmer) {
      console.error(`${crop}: unmatched row (netIncome=${r.netIncome}) — join broken, aborting`);
      process.exit(1);
    }

    matched++;
    joined.push({
      farmerId: farmer.id,
      group: farmer.project,
      sourceClusterId: r.id,
      yield: r.yield ?? null,
      acre: r.acre ?? null,
      income: r.income ?? null,
      expenses: r.expenses ?? null,
      netIncome: r.netIncome ?? null,
      crop,
    });
  }

  stats[crop] = { rows: rows.length, matched, ambiguous };
}

// Validation: per-group pooled cost ratios must reproduce the Phase 1 constants
console.log("crop      | rows  | matched | ambiguous | pooled cost ratio");
for (const crop of CROPS) {
  const s = stats[crop];
  let inc = 0;
  let net = 0;
  for (const r of joined) {
    if (r.crop !== crop || r.income == null || r.income <= 0 || r.netIncome == null) continue;
    inc += r.income;
    net += r.netIncome;
  }
  const ratio = ((1 - net / inc) * 100).toFixed(1);
  console.log(
    `${crop.padEnd(9)} | ${String(s.rows).padStart(5)} | ${String(s.matched).padStart(7)} | ${String(s.ambiguous).padStart(9)} | ${ratio}%`,
  );
}

const out = {
  meta: {
    description:
      "Crop records joined to farmers by ordered reconstruction (NOT a source export). " +
      "Provisional until the data team re-exports with true farmer ids. " +
      "Method and validation: docs/PHASE2-DATA-INVESTIGATION.md",
    source: "src/data/rounds/baseline/{farmers.json, crops/*.json}",
    records: joined.length,
  },
  records: joined,
};

fs.writeFileSync(path.join(BASE, "crops-joined.json"), JSON.stringify(out));
console.log(`\nWrote ${joined.length} joined records to src/data/rounds/baseline/crops-joined.json`);
