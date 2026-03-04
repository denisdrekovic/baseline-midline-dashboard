import type { ProjectGroup } from "./types";

/** Project group labels & colors — the primary segmentation dimension */
export const PROJECT_LABELS: Record<ProjectGroup, string> = {
  "T-1": "Treatment 1 (Legacy Farmers)",
  "T-2": "Treatment 2 (New Intake)",
  "Control": "Control Group",
};

export const PROJECT_SHORT: Record<ProjectGroup, string> = {
  "T-1": "T-1",
  "T-2": "T-2",
  "Control": "Ctrl",
};

export const CROP_COLORS: Record<string, string> = {
  mint: "#00CCCC",
  rice: "#FFB703",
  potato: "#6F42C1",
  wheat: "#FB8500",
  mustard: "#219EBC",
};

export const CROP_NAMES: Record<string, string> = {
  mint: "Mint",
  rice: "Rice",
  potato: "Potato",
  wheat: "Wheat",
  mustard: "Mustard",
};

export const CROPS = ["mint", "rice", "potato", "wheat", "mustard"] as const;

export const WOMEN_EMPOWERMENT_QUESTIONS = [
  "Agricultural production",
  "Livestock management",
  "Non-farm activities",
  "Income usage",
  "Credit & savings",
  "Community groups",
  "Freedom of movement",
  "Time allocation",
];

export const MAP_CENTER: [number, number] = [26.943, 81.396];
export const MAP_ZOOM = 10;
export const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const TILE_ATTRIBUTION =
  '&copy; Esri, Maxar, Earthstar Geographics';

// Dark tile
export const TILE_URL_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION_DARK =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Administrative / light tile (CARTO Positron — clean, shows labels & boundaries)
export const TILE_URL_ADMIN =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION_ADMIN =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const GENDER_COLORS = {
  Male: "#007BFF",
  Female: "#8ECAE6",
} as const;

/** World Bank poverty line thresholds (per-capita, annual USD) */
export const WB_EXTREME_POVERTY_PC = 785;   // $2.15/day
export const WB_MODERATE_POVERTY_PC = 1332;  // $3.65/day

/** Consistent LIB status colors used site-wide */
export const LIB_COLORS = {
  above: "#FFB703",
  below: "#17A2B8",
} as const;

/** Consistent income source colors used site-wide */
export const INCOME_SOURCE_COLORS = {
  crops: "#00CCCC",
  offFarm: "#007BFF",
  livestock: "#FFB703",
} as const;

/** Semantic waterfall / financial chart colors */
export const WATERFALL_COLORS = {
  increase: "#00CCCC",  // Teal — money coming in
  decrease: "#FB8500",  // Orange — money going out
  subtotal: "#17A2B8",  // Teal — intermediate totals
  total: "var(--text-primary)",  // Theme-adaptive — near-white in dark, near-black in light
} as const;

/** Brand-aligned positive/negative indicator colors */
export const INDICATOR_COLORS = {
  positive: "#00CCCC",
  negative: "#FB8500",
  neutral: "#17A2B8",
} as const;

/** Project group colors (T-1 / T-2 / Control) */
export const PROJECT_COLORS = {
  "T-1": "#007BFF",
  "T-2": "#6F42C1",
  Control: "#FFB703",
} as const;

/** Ordered palette for ad-hoc charts needing N colors */
export const CHART_PALETTE = [
  "#007BFF", "#6F42C1", "#00CCCC", "#FFB703", "#FB8500",
  "#0DCAF0", "#219EBC", "#17A2B8", "#8ECAE6", "#FF6B6B",
] as const;

export const CHART_THEME = {
  gridStroke: "var(--card-border)",
  axisStroke: "var(--card-border-hover)",
  tickFill: "var(--text-tertiary)",
  tooltipBg: "var(--color-surface-1)",
  tooltipBorder: "var(--card-border)",
  fontSize: 12,
};
