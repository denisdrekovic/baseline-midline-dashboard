"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  children: ReactNode;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2;
  className?: string;
  delay?: number;
}

const COL_SPAN = {
  1: "",
  2: "md:col-span-2",
  3: "md:col-span-2 lg:col-span-3",
  4: "md:col-span-3 lg:col-span-4",
};

const ROW_SPAN = {
  1: "",
  2: "row-span-2",
};

export default function BentoCard({
  children,
  colSpan = 1,
  rowSpan = 1,
  className = "",
  delay = 0,
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={`brand-card brand-card-hover p-3 ${COL_SPAN[colSpan]} ${ROW_SPAN[rowSpan]} ${className}`}
      role="region"
    >
      {children}
    </motion.div>
  );
}
