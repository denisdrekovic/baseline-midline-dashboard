# Phase 2 Data Investigation — Crop-Level Records

**Date:** June 10, 2026
**For:** Paul & Azfar (Phase 2 of the June 9 LIB calculator feedback)

> **STATUS UPDATE (June 10, later):** The repair has been applied. The root cause
> was found in our own converter — `scripts/csv-to-baseline.ts` wrote the CSV's
> `ID` column (enumeration-cluster code) instead of `id` (farmer id) into the
> crop files. `scripts/build-crop-join.ts` now rewrites the five crop files in
> place with the true farmer id + `group` on every record (9,362/9,362 joined,
> ambiguous rows flagged `joinAmbiguous`), and the converter bug is fixed for
> future CSV runs. This also fixed a live dashboard bug: the Crops analytics
> were already joining records to farmers by id, silently dropping ~60% of rows.
> The asks below remain — a ground-truth re-export validates the reconstruction.
**Data examined:** `src/data/rounds/baseline/farmers.json` (2,579 farmers) and `src/data/rounds/baseline/crops/*.json` (9,362 records across mint, rice, potato, wheat, mustard). All numbers below were computed directly from these files; the scripts are reproducible from the descriptions.

## Executive summary

Both problems named in the feedback doc are confirmed and quantified — but the headline is better than expected: **the crop records ARE farmer-level, and the join to farmers (and therefore to T-1/T-2/Control groups) is recoverable today from row order alone.** We do not have to wait for a new data export to do group-specific analysis, though a proper re-export with real farmer ids is still the right durable fix.

## Finding 1 — The `id` column is not a farmer id, but the join is recoverable

- All five crop files share the **same 33 distinct ids** (118–150). Only 10 of those coincide with farmer ids, and farmers.json ids span 2–2995, so the column cannot join to farmers. It is also not a village code (129 villages) or block code (6 blocks). Consecutive rows share the same id, so it most plausibly is an **enumeration-cluster or enumerator code**.
- However, the files are ordered the same way as farmers.json:
  - **Mint is strictly positional**: 2,579 rows for 2,579 farmers, and `mint[i].netIncome` equals `farmers[i].mintNetIncome` exactly for 2,570 rows (the other 9 are the null-income farmers). Row *i* **is** farmer *i*.
  - **Rice, potato, wheat, mustard are ordered subsequences**: walking farmers.json in order and matching each crop row to the next farmer whose `{crop}NetIncome` equals the row's `netIncome` consumes **100.0% of rows in every file** (rice 2,530/2,530; potato 939/939; wheat 1,720/1,720; mustard 1,594/1,594). Each file contains one row per farmer who completed that crop module, in farmer order.
- Caveat on the reconstruction: matching is by net-income value equality within an ordered walk. Duplicate values (mostly zeros) could in principle swap two same-valued farmers, which would matter only if they belong to different groups; the effect on group aggregates is negligible but it is why a re-export with the true farmer id is still wanted.

## Finding 2 — `expenses` is a fraction of true cost; `income − netIncome` is the reconciled cost

Rows where `income − expenses = netIncome` (±1):

| Crop | Reconciles | Implied cost ÷ expenses |
|------|-----------:|------------------------:|
| Mint | 10.7% | 7.1× |
| Rice | 10.8% | 11.4× |
| Potato | 13.8% | 12.0× |
| Wheat | 33.1% | 5.2× |
| Mustard | 47.1% | 3.9× |

The implied cost (`income − netIncome`) is 4–12× the recorded `expenses`, so `expenses` captures only a slice of production cost (most plausibly purchased inputs only, excluding labor, irrigation, land rent, etc.). **The source survey instrument's field definitions are the open question for Tanager/the data team.** Phase 1's cost ratios used `1 − netIncome/income`, which is the internally consistent definition; this finding confirms that choice and the doc's instruction to avoid the `expenses` column.

## Preview — per-group cost ratios via the recovered join

Pooled column reproduces the Phase 1 ratios exactly (a validation that the join consumed every row correctly):

| Crop | Pooled (Phase 1) | T-1 | T-2 | Control | n (T1/T2/Ctrl) |
|------|---------:|------:|------:|--------:|---------------|
| Mint | 51.7% | 50.3% | 48.8% | 57.6% | 1068 / 220 / 1282 |
| Rice | 58.4% | 56.7% | 55.9% | 61.5% | 968 / 220 / 1112 |
| Potato | 41.6% | 43.2% | 39.9% | 43.1% | 588 / 210 / 63 |
| Wheat | 51.4% | 50.6% | 56.8%* | 51.5% | 326 / 27 / 917 |
| Mustard | 54.1% | 50.4% | 59.3%* | 55.6% | 412 / 51 / 558 |

\* Small T-2 samples (27 and 51 growers) — treat with caution.

Two observations worth carrying into Phases 3–4:
1. **Program farmers run cheaper than Control on mint and rice** (T-1 mint 50.3% vs Control 57.6%) — consistent with cost-of-production interventions already landing for T-1, and directly relevant to the Phase 4 "has T-1 plateaued" question for Tanager.
2. The spread between groups is real but moderate (±4–7pp); pooled ratios are a reasonable Phase 1 approximation.

## Asks for the data team (the durable fix)

1. Re-export crop-level records keyed by the **true farmer id**, carrying the **group label** (T-1/T-2/Control) on each row.
2. A **field dictionary** for the crop module: what exactly do `income`, `expenses`, and `netIncome` include? What cost components explain the gap between `expenses` and `income − netIncome`?
3. Confirm the `id` column's meaning (enumeration cluster?) so the 33-code structure is documented.
4. Confirm one-row-per-farmer-per-crop is the intended grain (mint's strict 1:1 suggests yes).

## Validation checklist once new data lands

- Recomputed pooled ratios should match the Phase 1 constants (mint 51.7 / rice 58.4 / potato 41.6 / wheat 51.4 / mustard 54.1).
- Per-group ratios should match the preview table above.
- Every crop row should join to exactly one farmer; join coverage should be 100% with zero value-equality fallbacks.
