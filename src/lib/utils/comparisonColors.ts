/**
 * Color utilities for the Scenario Comparison panel.
 *
 * BAU (Business as Usual) is always rendered as a dashed gray baseline.
 * Other scenarios cycle through a distinct palette that avoids the
 * existing T1/T2/Total chart colors (#007BFF, #6F42C1, #00A17D).
 */

/** Baseline / BAU color – neutral gray */
export const BAU_COLOR = "#888";

/** Stroke dash pattern for BAU lines (SVG dash-array) */
export const BAU_DASH = "6 3";

/**
 * 5-color palette for non-BAU scenarios.
 * Chosen for strong mutual contrast on dark backgrounds while
 * avoiding confusion with the builder's T1/T2/Total line colors.
 */
const PALETTE = [
  "#910D63", // plum
  "#457B9D", // steel blue
  "#2A9D8F", // teal
  "#E9C46A", // golden
  "#264653", // dark teal
];

/**
 * Assign colors to an ordered list of scenario names.
 * "Business as Usual" always gets BAU_COLOR; others cycle through PALETTE.
 */
export function assignColors(names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let paletteIdx = 0;
  for (const name of names) {
    if (name === "Business as Usual") {
      map.set(name, BAU_COLOR);
    } else {
      map.set(name, PALETTE[paletteIdx % PALETTE.length]);
      paletteIdx++;
    }
  }
  return map;
}

/**
 * Return a hex color with an appended alpha suffix for CSS.
 * E.g. lighten("#910D63", 0.2) → "#910D6333"
 */
export function lighten(hex: string, opacity = 0.6): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}
