"use client";

import { motion } from "framer-motion";
import { formatNumber, formatUSD, formatPercent } from "@/lib/utils/formatters";

interface InfographicHeroProps {
  totalFarmers: number;
  maleFarmers: number;
  femaleFarmers: number;
  aboveLIBCount: number;
  avgIncome: number;
  medianIncome: number;
  totalDistricts: number;
  totalVillages: number;
}

/** Single person silhouette SVG path */
function PersonIcon({
  filled,
  color,
  size = 28,
}: {
  filled: boolean;
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 24 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <circle
        cx="12"
        cy="7"
        r="5.5"
        fill={filled ? color : "transparent"}
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Body */}
      <path
        d="M4 18C4 14 7.5 12 12 12C16.5 12 20 14 20 18V28C20 29.1 19.1 30 18 30H6C4.9 30 4 29.1 4 28V18Z"
        fill={filled ? color : "transparent"}
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Legs */}
      <path
        d="M8 30V36M16 30V36"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-2xl font-bold font-mono tracking-tight"
        style={{ color: color || "rgba(255,255,255,0.95)" }}
      >
        {value}
      </span>
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

export default function InfographicHero({
  totalFarmers,
  maleFarmers,
  femaleFarmers,
  aboveLIBCount,
  avgIncome,
  medianIncome,
  totalDistricts,
  totalVillages,
}: InfographicHeroProps) {
  const aboveLIBPct = totalFarmers > 0 ? (aboveLIBCount / totalFarmers) * 100 : 0;
  const maleCount = Math.min(maleFarmers, 10);
  const femaleCount = Math.min(femaleFarmers, 10);

  // Normalize to show max 10 figures each
  const maleIcons = Math.round((maleFarmers / totalFarmers) * 10);
  const femaleIcons = Math.round((femaleFarmers / totalFarmers) * 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="brand-card p-6 rounded-2xl"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — People visualization */}
        <div className="lg:w-[280px] shrink-0">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-4">
            Farmer Population
          </h4>

          {/* Human figures row */}
          <div className="flex flex-col gap-3">
            {/* Male row */}
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider w-12">
                  Male
                </span>
                <span className="text-xs font-mono font-bold text-[#007BFF]">
                  {formatNumber(maleFarmers)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                  {((maleFarmers / totalFarmers) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <PersonIcon
                    key={`m-${i}`}
                    filled={i < maleIcons}
                    color="#007BFF"
                    size={16}
                  />
                ))}
              </div>
            </div>

            {/* Female row */}
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider w-12">
                  Female
                </span>
                <span className="text-xs font-mono font-bold text-[#8ECAE6]">
                  {formatNumber(femaleFarmers)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                  {((femaleFarmers / totalFarmers) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <PersonIcon
                    key={`f-${i}`}
                    filled={i < femaleIcons}
                    color="#8ECAE6"
                    size={16}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* LIB indicator */}
          <div className="mt-4 pt-3 border-t border-[var(--card-border)]">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              <span className="text-[11px] text-[var(--text-secondary)]">
                Above Living Income Benchmark
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-[var(--color-accent)]">
                {formatNumber(aboveLIBCount)}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                of {formatNumber(totalFarmers)} farmers
              </span>
              <span className="text-xs font-mono font-semibold text-[var(--color-accent)] ml-auto">
                {aboveLIBPct.toFixed(1)}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-[var(--card-border)] mt-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${aboveLIBPct}%` }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="h-full rounded-full bg-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Right — Key stats */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="brand-card p-4 rounded-xl">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">
              Total Farmers
            </span>
            <span className="text-3xl font-bold font-mono text-[var(--color-accent)]">
              {formatNumber(totalFarmers)}
            </span>
            <div className="flex gap-3 mt-2 text-[10px] text-[var(--text-tertiary)]">
              <span>{totalDistricts} districts</span>
              <span>{totalVillages} villages</span>
            </div>
          </div>

          <div className="brand-card p-4 rounded-xl">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block">
              Average Income
            </span>
            <span className="text-3xl font-bold font-mono text-[var(--color-brand-gold)]">
              {formatUSD(avgIncome)}
            </span>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-2">
              Median: {formatUSD(medianIncome)}
            </div>
          </div>

          <div className="brand-card p-4 rounded-xl col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2 block">
              Gender Income Gap
            </span>
            <div className="flex items-end gap-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#007BFF]" />
                  <span className="text-[10px] text-[var(--text-tertiary)]">Male</span>
                </div>
                <span className="text-lg font-bold font-mono text-[#007BFF]">
                  {formatPercent((maleFarmers / totalFarmers) * 100, 0)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#8ECAE6]" />
                  <span className="text-[10px] text-[var(--text-tertiary)]">Female</span>
                </div>
                <span className="text-lg font-bold font-mono text-[#8ECAE6]">
                  {formatPercent((femaleFarmers / totalFarmers) * 100, 0)}
                </span>
              </div>
              {/* Visual bar */}
              <div className="flex-1 h-3 rounded-full bg-[var(--card-border)] overflow-hidden flex">
                <div
                  className="h-full bg-[#007BFF] transition-all duration-700"
                  style={{ width: `${(maleFarmers / totalFarmers) * 100}%` }}
                />
                <div
                  className="h-full bg-[#8ECAE6] transition-all duration-700"
                  style={{ width: `${(femaleFarmers / totalFarmers) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
