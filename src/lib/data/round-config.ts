/**
 * Round Configuration — Single Source of Truth
 *
 * Each survey round (baseline, midline, endline) is defined here.
 * To add a new round: add an entry to ROUNDS[] and place data files
 * in src/data/rounds/<id>/.
 */

export interface RoundDef {
  /** Unique identifier used in URLs, state, and data paths */
  id: string;
  /** Human-readable label (e.g. "Baseline") */
  label: string;
  /** Short label for charts (e.g. "B") */
  shortLabel: string;
  /** Brand color for this timepoint in charts */
  color: string;
  /** Relative path inside src/data/ */
  dataDir: string;
  /** Whether this round's data is available */
  available: boolean;
}

export type RoundId = "baseline" | "midline" | "endline";

export const ROUNDS: RoundDef[] = [
  {
    id: "baseline",
    label: "Baseline",
    shortLabel: "B",
    color: "#007BFF",
    dataDir: "rounds/baseline",
    available: true,
  },
  {
    id: "midline",
    label: "Midline",
    shortLabel: "M",
    color: "#00A17D",
    dataDir: "rounds/midline",
    available: true,
  },
  // Uncomment when endline data arrives:
  // {
  //   id: "endline",
  //   label: "Endline",
  //   shortLabel: "E",
  //   color: "#FFB703",
  //   dataDir: "rounds/endline",
  //   available: false,
  // },
];

/** Helper: get a round definition by id */
export function getRoundDef(id: string): RoundDef | undefined {
  return ROUNDS.find((r) => r.id === id);
}

/** All round IDs that are currently available */
export function availableRoundIds(): string[] {
  return ROUNDS.filter((r) => r.available).map((r) => r.id);
}
