# Decision Brief — Meenal Meeting, June 11 2026

One page of decisions needed to unblock the rest of the June 9 roadmap. Status first, then the decision list with the defaults currently implemented (changeable cheaply if the meeting decides otherwise).

## Where things stand

- **Shipped to branch** (`client-feedback-2026-06-phase1`, [PR #2](https://github.com/denisdrekovic/baseline-midline-dashboard/pull/2), not deployed): Phase 1 per-crop cost ratios + all standalone logic fixes + independent review fixes. Merging to main deploys.
- **Phase 2 (Paul/Azfar)**: largely pre-solved — `docs/PHASE2-DATA-INVESTIGATION.md` shows the crop→farmer join is recoverable from row order today, and includes per-group cost ratios. Remaining asks: re-export with true farmer ids, and a field dictionary explaining `expenses`.
- **Gated on this meeting**: all Stream B interface work (tiles, chart fixes, lever panel reorder, compare page).
- **Gated on Tanager**: Phase 4's "has T-1 plateaued on mint" assumption.

## Decisions needed

1. **Income-increase tiles: nominal or real?** The new "Median Income Increase since joining" metric is nominal — in a zero-intervention scenario it shows +$348 (T1) / +$836 (T2) of pure 4%/yr inflation. Options: (a) CPI-deflate so business-as-usual reads $0, or (b) keep nominal with the Non-program column as the inflation comparator plus an explicit label. *Recommend (a) — nobody should have to mentally subtract inflation.*

2. **Extrapolation rate (30/50/80%) — define or remove.** The toggle has never affected any number; the Stream B lever-panel order lists it, but no formula exists. Either define how it scales the non-program contribution to the KPI, or drop it from the panel until it means something.

3. **Wheat display.** Currently a read-only "Rabi · auto" row showing the derived acreage (clamped at −100%). Confirm this beats hiding wheat entirely.

4. **CPI-only LIB (open question 5).** Implemented per the doc; needs Mars-side confirmation so Phase 5 builds on it.

5. **Supply-shed KPI composition framing.** BAU moves the KPI 6.6%→19.2% by 2030 purely by enrolling T2 farmers, whose survey sample is far better-off (67% above LIB vs T1's 11%, median $7,010 vs $1,312). The methodology modal now discloses this; decide whether Mars reporting needs the decomposition (income-driven vs enrollment-driven KPI movement) made explicit in the UI.

6. **"# Above LIB" parenthetical** in the comparison table (doc open question 3): the number in parentheses is the delta vs Business-as-Usual — confirm the label wording for the rebuilt table.

7. **Tanager coverage** (doc open question 4): does monitoring include control farmers' yields, or do off-years need an index assumption for control?

## Stream B notes for the build that follows

- T2-in-2024 and single-LIB fixes that Stream B charts depend on are already live in the engine.
- The new tile metrics (median income / median LIB gap / income increase, per cohort incl. non-program) are already computed by the engine — tiles only need wiring.
- The lever panel reorder (Supply Shed → Extrapolation → Cohorts & Coverage → Crop Levers) and left-opening panel are straightforward; the mobile clipping issue found in review gets fixed by the same redesign.
- Only the Crop Income Contribution drill-down waits on data work (and the recovered join may unblock even that early).
