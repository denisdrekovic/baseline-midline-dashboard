"use client";

import { Settings, Sun, Moon, Palette, Globe, Bell, Database, ChevronDown, Check } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useSettings, type CurrencyOption, type AreaUnitOption } from "@/providers/SettingsProvider";
import { useData } from "@/providers/DataProvider";
import { useState, useRef, useEffect } from "react";

/* ── Reusable dropdown for settings ── */
function SettingsDropdown<T extends string>({
  value,
  options,
  onChange,
  formatLabel,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = formatLabel ? formatLabel(value) : value;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer"
        style={{
          color: "var(--color-accent)",
          background: "rgba(0,161,125,0.08)",
          border: `1px solid ${open ? "var(--color-accent)" : "transparent"}`,
        }}
      >
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[140px] z-50 rounded-lg py-1 shadow-xl"
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--card-border)",
          }}
        >
          {options.map((opt) => {
            const isActive = opt === value;
            const display = formatLabel ? formatLabel(opt) : opt;
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors hover:bg-[var(--card-bg-hover)] cursor-pointer"
                style={{ color: isActive ? "var(--color-accent)" : "var(--text-secondary)" }}
              >
                <span className={isActive ? "font-semibold" : ""}>{display}</span>
                {isActive && <Check size={12} style={{ color: "var(--color-accent)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Toggle Switch ── */
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-all ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ background: checked ? "var(--color-accent)" : "var(--card-border-hover)" }}
      role="switch"
      aria-checked={checked}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
        style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}

const CURRENCY_LABELS: Record<CurrencyOption, string> = {
  USD: "USD ($)",
  INR: "INR (₹)",
  EUR: "EUR (€)",
};

const AREA_LABELS: Record<AreaUnitOption, string> = {
  Acres: "Acres",
  Hectares: "Hectares",
  Bigha: "Bigha",
};

export default function SettingsPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { currency, areaUnit, defaultRegion, setCurrency, setAreaUnit, setDefaultRegion } = useSettings();
  const { aggregates } = useData();

  const regions = ["All Regions", ...(aggregates?.districts ?? [])];

  return (
    <div className="py-2 max-w-2xl">
      <div className="space-y-4">
        {/* Appearance */}
        <div className="brand-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Appearance</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-[var(--text-tertiary)]">Choose your preferred color scheme</p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--card-bg-hover)" }}>
                {[
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => { if (theme !== value) toggleTheme(); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      theme === value
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="brand-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Data Preferences</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Currency</p>
                <p className="text-xs text-[var(--text-tertiary)]">Display currency for income values</p>
              </div>
              <SettingsDropdown
                value={currency}
                options={["USD", "INR", "EUR"] as CurrencyOption[]}
                onChange={setCurrency}
                formatLabel={(v) => CURRENCY_LABELS[v]}
              />
            </div>
            <div className="border-t border-[var(--card-border)]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Area Unit</p>
                <p className="text-xs text-[var(--text-tertiary)]">Unit for farm size measurements</p>
              </div>
              <SettingsDropdown
                value={areaUnit}
                options={["Acres", "Hectares", "Bigha"] as AreaUnitOption[]}
                onChange={setAreaUnit}
                formatLabel={(v) => AREA_LABELS[v]}
              />
            </div>
            <div className="border-t border-[var(--card-border)]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Default Region</p>
                <p className="text-xs text-[var(--text-tertiary)]">Starting geographic scope on load</p>
              </div>
              <SettingsDropdown
                value={defaultRegion}
                options={regions}
                onChange={setDefaultRegion}
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="brand-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dashboard Alerts</p>
                <p className="text-xs text-[var(--text-tertiary)]">Show alerts for significant data changes</p>
              </div>
              <div className="flex items-center gap-2">
                <ToggleSwitch checked={false} onChange={() => {}} disabled />
                <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded" style={{ color: "var(--text-tertiary)", background: "var(--card-bg-hover)" }}>
                  Soon
                </span>
              </div>
            </div>
            <div className="border-t border-[var(--card-border)]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Reports</p>
                <p className="text-xs text-[var(--text-tertiary)]">Receive weekly summary emails</p>
              </div>
              <div className="flex items-center gap-2">
                <ToggleSwitch checked={false} onChange={() => {}} disabled />
                <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded" style={{ color: "var(--text-tertiary)", background: "var(--card-bg-hover)" }}>
                  Soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
