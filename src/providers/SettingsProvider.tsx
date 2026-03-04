"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type CurrencyOption = "USD" | "INR" | "EUR";
export type AreaUnitOption = "Acres" | "Hectares" | "Bigha";

interface SettingsState {
  currency: CurrencyOption;
  areaUnit: AreaUnitOption;
  defaultRegion: string;
}

interface SettingsContextValue extends SettingsState {
  setCurrency: (v: CurrencyOption) => void;
  setAreaUnit: (v: AreaUnitOption) => void;
  setDefaultRegion: (v: string) => void;
}

const STORAGE_KEY = "shubhminth-settings";

const DEFAULTS: SettingsState = {
  currency: "USD",
  areaUnit: "Acres",
  defaultRegion: "All Regions",
};

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULTS,
  setCurrency: () => {},
  setAreaUnit: () => {},
  setDefaultRegion: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SettingsState>;
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, hydrated]);

  const setCurrency = useCallback((v: CurrencyOption) => setState((s) => ({ ...s, currency: v })), []);
  const setAreaUnit = useCallback((v: AreaUnitOption) => setState((s) => ({ ...s, areaUnit: v })), []);
  const setDefaultRegion = useCallback((v: string) => setState((s) => ({ ...s, defaultRegion: v })), []);

  return (
    <SettingsContext.Provider value={{ ...state, setCurrency, setAreaUnit, setDefaultRegion }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
