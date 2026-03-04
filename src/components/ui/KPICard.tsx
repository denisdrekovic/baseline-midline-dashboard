"use client";

import { motion, useReducedMotion } from "framer-motion";
import AnimatedNumber from "../shared/AnimatedNumber";

interface KPICardProps {
  label: string;
  value: number;
  formatter?: (n: number) => string;
  icon?: React.ReactNode;
  accent?: string;
  delay?: number;
}

export default function KPICard({
  label,
  value,
  formatter,
  icon,
  accent,
  delay = 0,
}: KPICardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay, ease: "easeOut" }}
      className="brand-card brand-card-hover p-3 flex flex-col gap-2"
      role="status"
      aria-label={`${label}: ${formatter ? formatter(value) : value}`}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {label}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: accent ? `${accent}15` : "var(--card-bg)" }}
          >
            <span style={{ color: accent }} aria-hidden="true">{icon}</span>
          </div>
        )}
      </div>
      <div
        className="text-xl md:text-2xl font-bold tracking-tight"
        style={{ color: accent, fontFamily: "var(--font-heading)" }}
      >
        <AnimatedNumber value={value} formatter={formatter} />
      </div>
    </motion.div>
  );
}
