import { Farmer, CropRecord, Aggregates } from "./types";

const cache = new Map<string, unknown>();

async function loadJSON<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(path, { credentials: "include" });
  if (res.status === 401) throw new Error("Session expired — please log in again.");
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  const data = await res.json();
  cache.set(path, data);
  return data as T;
}

/** Clear all cached data (useful on logout) */
export function clearDataCache() {
  cache.clear();
}

/** Clear cache for a specific round (useful when reloading round data) */
export function clearRoundCache(round: string) {
  for (const key of cache.keys()) {
    if (key.includes(`round=${round}`)) cache.delete(key);
  }
}

export async function loadFarmers(round: string = "baseline"): Promise<Farmer[]> {
  return loadJSON<Farmer[]>(`/api/data/farmers?round=${round}`);
}

export async function loadAggregates(round: string = "baseline"): Promise<Aggregates> {
  return loadJSON<Aggregates>(`/api/data/aggregates?round=${round}`);
}

export async function loadCropData(crop: string, round: string = "baseline"): Promise<CropRecord[]> {
  return loadJSON<CropRecord[]>(`/api/data/crops?crop=${encodeURIComponent(crop)}&round=${round}`);
}

export async function loadGeoJSON(
  name: string
): Promise<GeoJSON.FeatureCollection> {
  return loadJSON<GeoJSON.FeatureCollection>(`/api/data/geo?name=${encodeURIComponent(name)}`);
}
