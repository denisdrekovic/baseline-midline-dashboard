"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from "react";
import { Farmer, Aggregates } from "@/lib/data/types";
import { loadFarmers, loadAggregates } from "@/lib/data/loader";
import { ROUNDS, type RoundDef } from "@/lib/data/round-config";

/* ── Per-round data bucket ── */
export interface RoundData {
  farmers: Farmer[];
  aggregates: Aggregates | null;
}

const EMPTY_ROUND: RoundData = { farmers: [], aggregates: null };

/* ── Context shape ── */
interface DataContextValue {
  /** Active round id (e.g. "baseline") */
  activeRound: string;
  /** Switch the active round */
  setActiveRound: (id: string) => void;
  /** Convenience: farmers for the active round */
  farmers: Farmer[];
  /** Convenience: aggregates for the active round */
  aggregates: Aggregates | null;
  /** Get data for any loaded round by id */
  getRound: (id: string) => RoundData;
  /** All round definitions */
  rounds: RoundDef[];
  /** Which round ids have finished loading */
  loadedRounds: string[];
  /** Overall loading state (true while the active round hasn't loaded yet) */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
}

const DataContext = createContext<DataContextValue>({
  activeRound: "baseline",
  setActiveRound: () => {},
  farmers: [],
  aggregates: null,
  getRound: () => EMPTY_ROUND,
  rounds: ROUNDS,
  loadedRounds: [],
  loading: true,
  error: null,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [activeRound, setActiveRound] = useState("baseline");
  const [roundDataMap, setRoundDataMap] = useState<Map<string, RoundData>>(new Map());
  const [loadedRounds, setLoadedRounds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Load all available rounds on mount */
  useEffect(() => {
    let cancelled = false;

    async function loadAllRounds() {
      const map = new Map<string, RoundData>();
      const loaded: string[] = [];

      // Load rounds in parallel
      const results = await Promise.allSettled(
        ROUNDS.filter((r) => r.available).map(async (round) => {
          const [farmers, aggregates] = await Promise.all([
            loadFarmers(round.id),
            loadAggregates(round.id),
          ]);
          return { id: round.id, farmers, aggregates };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { id, farmers, aggregates } = result.value;
          map.set(id, { farmers, aggregates });
          loaded.push(id);
        }
        // Silently skip failed rounds (they just won't be available)
      }

      if (!cancelled) {
        setRoundDataMap(map);
        setLoadedRounds(loaded);
        if (loaded.length === 0) {
          setError("Failed to load any survey round data");
        }
        setLoading(false);
      }
    }

    loadAllRounds().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const getRound = useCallback(
    (id: string): RoundData => roundDataMap.get(id) ?? EMPTY_ROUND,
    [roundDataMap]
  );

  const activeData = useMemo(() => getRound(activeRound), [getRound, activeRound]);

  const value = useMemo<DataContextValue>(
    () => ({
      activeRound,
      setActiveRound,
      farmers: activeData.farmers,
      aggregates: activeData.aggregates,
      getRound,
      rounds: ROUNDS,
      loadedRounds,
      loading,
      error,
    }),
    [activeRound, activeData, getRound, loadedRounds, loading, error]
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
