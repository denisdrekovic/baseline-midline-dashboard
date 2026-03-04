"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, RotateCcw, Filter } from "lucide-react";
import { useGeo } from "@/providers/GeoProvider";
import { PROJECT_COLORS } from "@/lib/data/constants";

interface DropdownProps {
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
  placeholder: string;
  disabled?: boolean;
}

function Dropdown({ label, value, options, onChange, placeholder, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // All options including "All" at index 0
  const allOpts = [null, ...options];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset focus index when opening
  useEffect(() => {
    if (open) {
      const idx = value ? options.indexOf(value) + 1 : 0;
      setFocusIdx(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  // Scroll focused option into view
  useEffect(() => {
    if (open && listRef.current && focusIdx >= 0) {
      const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
      items[focusIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, focusIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!disabled) setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIdx((prev) => Math.min(prev + 1, allOpts.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setFocusIdx(0);
        break;
      case "End":
        e.preventDefault();
        setFocusIdx(allOpts.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < allOpts.length) {
          onChange(allOpts[focusIdx]);
          setOpen(false);
          triggerRef.current?.focus();
        }
        break;
    }
  };

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 font-medium">
        {label}
      </div>
      <button
        ref={triggerRef}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${value || placeholder}`}
        className={`flex items-center gap-2 min-w-[140px] px-3 py-2 rounded-lg text-sm border transition-all ${
          disabled
            ? "opacity-40 cursor-not-allowed border-[var(--card-border)]"
            : open
            ? "border-[var(--color-brand-gold)] bg-[rgba(255,192,0,0.08)]"
            : value
            ? "border-[var(--card-border-hover)] bg-[var(--card-bg-hover)]"
            : "border-[var(--card-border)] hover:border-[var(--card-border-hover)]"
        }`}
      >
        <span className={`flex-1 text-left truncate ${value ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-tertiary)]"}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && options.length > 0 && (
        <div ref={listRef} role="listbox" aria-label={label} aria-activedescendant={focusIdx >= 0 ? `${label}-opt-${focusIdx}` : undefined} className="absolute top-full left-0 mt-1 w-full min-w-[180px] max-h-[260px] overflow-y-auto z-50 rounded-lg py-1 shadow-xl" style={{ background: "var(--color-surface-1)", backdropFilter: "blur(20px)", border: "1px solid var(--card-border)" }}>
          <button
            id={`${label}-opt-0`}
            role="option"
            aria-selected={!value}
            onClick={() => { onChange(null); setOpen(false); triggerRef.current?.focus(); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              focusIdx === 0 ? "bg-[var(--card-bg-hover)]" : ""
            } ${!value ? "text-[var(--color-brand-gold)] font-medium" : "text-[var(--text-secondary)]"}`}
          >
            All
          </button>
          {options.map((opt, i) => (
            <button
              key={opt}
              id={`${label}-opt-${i + 1}`}
              role="option"
              aria-selected={value === opt}
              onClick={() => { onChange(opt); setOpen(false); triggerRef.current?.focus(); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                focusIdx === i + 1 ? "bg-[var(--card-bg-hover)]" : ""
              } ${value === opt ? "text-[var(--color-brand-gold)] font-medium" : "text-[var(--text-secondary)]"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const GENDER_FILTER_COLORS: Record<string, string> = {
  Male: "#007BFF",
  Female: "#8ECAE6",
};

export default function FilterBar() {
  const { selection, drillDown, resetGeo, geoFiltered, availableDistricts, availableBlocks, availableVillages, genders, setGenders, availableGenders, projects, setProjects, allProjects, castes, setCastes, availableCastes, farmSizes, setFarmSizes, availableFarmSizes } = useGeo();
  const [showProjects, setShowProjects] = useState(false);
  const [showGenders, setShowGenders] = useState(false);
  const [showCastes, setShowCastes] = useState(false);
  const [showFarmSizes, setShowFarmSizes] = useState(false);
  const projRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const casteRef = useRef<HTMLDivElement>(null);
  const farmSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (projRef.current && !projRef.current.contains(e.target as Node)) setShowProjects(false);
      if (genderRef.current && !genderRef.current.contains(e.target as Node)) setShowGenders(false);
      if (casteRef.current && !casteRef.current.contains(e.target as Node)) setShowCastes(false);
      if (farmSizeRef.current && !farmSizeRef.current.contains(e.target as Node)) setShowFarmSizes(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowProjects(false);
        setShowGenders(false);
        setShowCastes(false);
        setShowFarmSizes(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const allProjectsSelected = projects.length === allProjects.length;

  const hasFilters = selection.level !== "all" || projects.length < allProjects.length || genders.length > 0 || castes.length > 0 || farmSizes.length > 0;

  const toggleProject = (proj: string) => {
    if (projects.includes(proj)) {
      setProjects(projects.filter((p) => p !== proj));
    } else {
      setProjects([...projects, proj]);
    }
  };

  const toggleGender = (g: string) => {
    if (genders.includes(g)) {
      setGenders(genders.filter((v) => v !== g));
    } else {
      setGenders([...genders, g]);
    }
  };

  const toggleCaste = (c: string) => {
    if (castes.includes(c)) {
      setCastes(castes.filter((v) => v !== c));
    } else {
      setCastes([...castes, c]);
    }
  };

  const toggleFarmSize = (fs: string) => {
    if (farmSizes.includes(fs)) {
      setFarmSizes(farmSizes.filter((v) => v !== fs));
    } else {
      setFarmSizes([...farmSizes, fs]);
    }
  };

  return (
    <div className="px-4 py-2" role="toolbar" aria-label="Data filters">
      <div className="flex items-end gap-3 flex-wrap">

        {/* Geographic cascading dropdowns */}
        <Dropdown
          label="District"
          value={selection.district}
          options={availableDistricts}
          onChange={(val) => {
            if (val) drillDown("district", val);
            else resetGeo();
          }}
          placeholder="All Districts"
        />

        <Dropdown
          label="Block"
          value={selection.block}
          options={availableBlocks}
          onChange={(val) => {
            if (val) drillDown("block", val);
            else if (selection.district) drillDown("district", selection.district);
          }}
          placeholder="All Blocks"
          disabled={!selection.district}
        />

        <Dropdown
          label="Village"
          value={selection.village}
          options={availableVillages}
          onChange={(val) => {
            if (val) drillDown("village", val);
            else if (selection.block) drillDown("block", selection.block);
          }}
          placeholder="All Villages"
          disabled={!selection.block}
        />

        {/* Gender filter */}
        <div ref={genderRef} className="relative">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 font-medium">
            Gender
          </div>
          <button
            onClick={() => setShowGenders(!showGenders)}
            aria-expanded={showGenders}
            aria-label={`Gender: ${genders.length === 0 ? "All" : `${genders.length} selected`}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
              showGenders
                ? "border-[var(--color-brand-gold)] bg-[rgba(255,192,0,0.08)]"
                : genders.length > 0
                ? "border-[var(--card-border-hover)] bg-[var(--card-bg-hover)]"
                : "border-[var(--card-border)] hover:border-[var(--card-border-hover)]"
            }`}
          >
            <span className="text-[var(--text-secondary)]">
              {genders.length === 0 ? "All" : genders.join(", ")}
            </span>
            <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${showGenders ? "rotate-180" : ""}`} />
          </button>

          {showGenders && (
            <div className="absolute top-full left-0 mt-1 min-w-[140px] z-50 rounded-lg py-2 px-3 shadow-xl" style={{ background: "var(--color-surface-1)", backdropFilter: "blur(20px)", border: "1px solid var(--card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">Gender</span>
                <button
                  onClick={() => setGenders(genders.length > 0 ? [] : [...availableGenders])}
                  className="text-[10px] text-[var(--color-brand-gold)] hover:underline"
                  aria-label={genders.length > 0 ? "Select all genders" : "Deselect all genders"}
                >
                  {genders.length > 0 ? "All" : "None"}
                </button>
              </div>
              {availableGenders.map((g) => (
                <label
                  key={g}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={genders.includes(g)}
                    onChange={() => toggleGender(g)}
                    className="sr-only"
                  />
                  <div
                    className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                      genders.includes(g) ? "border-transparent" : "border-[var(--card-border-hover)]"
                    }`}
                    style={{ backgroundColor: genders.includes(g) ? (GENDER_FILTER_COLORS[g] || "#007BFF") : "transparent" }}
                  >
                    {genders.includes(g) && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">{g}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Project type filter (T-1, T-2, Control) */}
        <div ref={projRef} className="relative">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 font-medium">
              Project Group
            </div>
            <button
              onClick={() => setShowProjects(!showProjects)}
              aria-expanded={showProjects}
              aria-label={`Project Group: ${allProjectsSelected ? "All Groups" : `${projects.length} selected`}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                showProjects
                  ? "border-[var(--color-brand-gold)] bg-[rgba(255,192,0,0.08)]"
                  : !allProjectsSelected
                  ? "border-[var(--card-border-hover)] bg-[var(--card-bg-hover)]"
                  : "border-[var(--card-border)] hover:border-[var(--card-border-hover)]"
              }`}
            >
              <span className="text-[var(--text-secondary)]">
                {allProjectsSelected ? "All Groups" : `${projects.length} selected`}
              </span>
              <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${showProjects ? "rotate-180" : ""}`} />
            </button>

            {showProjects && (
              <div className="absolute top-full left-0 mt-1 min-w-[160px] z-50 rounded-lg py-2 px-3 shadow-xl" style={{ background: "var(--color-surface-1)", backdropFilter: "blur(20px)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">Toggle Group</span>
                  <button
                    onClick={() => setProjects(allProjectsSelected ? [] : [...allProjects])}
                    className="text-[10px] text-[var(--color-brand-gold)] hover:underline"
                    aria-label={allProjectsSelected ? "Deselect all project groups" : "Select all project groups"}
                  >
                    {allProjectsSelected ? "None" : "All"}
                  </button>
                </div>
                {allProjects.map((proj) => (
                  <label
                    key={proj}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={projects.includes(proj)}
                      onChange={() => toggleProject(proj)}
                      className="sr-only"
                    />
                    <div
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                        projects.includes(proj) ? "border-transparent" : "border-[var(--card-border-hover)]"
                      }`}
                      style={{ backgroundColor: projects.includes(proj) ? (PROJECT_COLORS as Record<string, string>)[proj] : "transparent" }}
                    >
                      {projects.includes(proj) && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">{proj}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

        {/* Caste filter */}
        {availableCastes.length > 0 && (
          <div ref={casteRef} className="relative">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 font-medium">
              Caste
            </div>
            <button
              onClick={() => setShowCastes(!showCastes)}
              aria-expanded={showCastes}
              aria-label={`Caste: ${castes.length === 0 ? "All" : `${castes.length} selected`}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                showCastes
                  ? "border-[var(--color-brand-gold)] bg-[rgba(255,192,0,0.08)]"
                  : castes.length > 0
                  ? "border-[var(--card-border-hover)] bg-[var(--card-bg-hover)]"
                  : "border-[var(--card-border)] hover:border-[var(--card-border-hover)]"
              }`}
            >
              <span className="text-[var(--text-secondary)]">
                {castes.length === 0 ? "All" : castes.length <= 2 ? castes.join(", ") : `${castes.length} selected`}
              </span>
              <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${showCastes ? "rotate-180" : ""}`} />
            </button>

            {showCastes && (
              <div className="absolute top-full left-0 mt-1 min-w-[140px] z-50 rounded-lg py-2 px-3 shadow-xl" style={{ background: "var(--color-surface-1)", backdropFilter: "blur(20px)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">Caste</span>
                  <button
                    onClick={() => setCastes(castes.length > 0 ? [] : [...availableCastes])}
                    className="text-[10px] text-[var(--color-brand-gold)] hover:underline"
                  >
                    {castes.length > 0 ? "All" : "None"}
                  </button>
                </div>
                {availableCastes.map((c) => (
                  <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors">
                    <input type="checkbox" checked={castes.includes(c)} onChange={() => toggleCaste(c)} className="sr-only" />
                    <div
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                        castes.includes(c) ? "border-transparent" : "border-[var(--card-border-hover)]"
                      }`}
                      style={{ backgroundColor: castes.includes(c) ? "#9333EA" : "transparent" }}
                    >
                      {castes.includes(c) && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Farm Size filter */}
        {availableFarmSizes.length > 0 && (
          <div ref={farmSizeRef} className="relative">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 font-medium">
              Farm Size
            </div>
            <button
              onClick={() => setShowFarmSizes(!showFarmSizes)}
              aria-expanded={showFarmSizes}
              aria-label={`Farm Size: ${farmSizes.length === 0 ? "All" : `${farmSizes.length} selected`}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                showFarmSizes
                  ? "border-[var(--color-brand-gold)] bg-[rgba(255,192,0,0.08)]"
                  : farmSizes.length > 0
                  ? "border-[var(--card-border-hover)] bg-[var(--card-bg-hover)]"
                  : "border-[var(--card-border)] hover:border-[var(--card-border-hover)]"
              }`}
            >
              <span className="text-[var(--text-secondary)]">
                {farmSizes.length === 0 ? "All" : farmSizes.length <= 2 ? farmSizes.join(", ") : `${farmSizes.length} selected`}
              </span>
              <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${showFarmSizes ? "rotate-180" : ""}`} />
            </button>

            {showFarmSizes && (
              <div className="absolute top-full left-0 mt-1 min-w-[140px] z-50 rounded-lg py-2 px-3 shadow-xl" style={{ background: "var(--color-surface-1)", backdropFilter: "blur(20px)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">Farm Size</span>
                  <button
                    onClick={() => setFarmSizes(farmSizes.length > 0 ? [] : [...availableFarmSizes])}
                    className="text-[10px] text-[var(--color-brand-gold)] hover:underline"
                  >
                    {farmSizes.length > 0 ? "All" : "None"}
                  </button>
                </div>
                {availableFarmSizes.map((fs) => (
                  <label key={fs} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors">
                    <input type="checkbox" checked={farmSizes.includes(fs)} onChange={() => toggleFarmSize(fs)} className="sr-only" />
                    <div
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                        farmSizes.includes(fs) ? "border-transparent" : "border-[var(--card-border-hover)]"
                      }`}
                      style={{ backgroundColor: farmSizes.includes(fs) ? "#F59E0B" : "transparent" }}
                    >
                      {farmSizes.includes(fs) && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">{fs}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reset */}
        {hasFilters && (
          <button
            onClick={() => resetGeo()}
            className="flex items-center gap-1.5 px-3 py-2 mb-0.5 rounded-lg text-xs font-medium border border-[var(--card-border)] hover:border-[var(--color-negative)] text-[var(--text-tertiary)] hover:text-[var(--color-negative)] transition-colors"
            aria-label="Reset all filters"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Reset
          </button>
        )}

        {/* Farmer count badge */}
        <div className="ml-auto flex items-center gap-2 pb-2" aria-live="polite" aria-atomic="true">
          <div className="w-2 h-2 rounded-full bg-[var(--color-brand-gold)] animate-pulse" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold text-[var(--text-secondary)]">
            {geoFiltered.length.toLocaleString()} farmers
          </span>
        </div>
      </div>
    </div>
  );
}
