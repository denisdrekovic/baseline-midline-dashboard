"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatUSD, formatPercent, formatNumber } from "@/lib/utils/formatters";

interface ChangeIndicatorProps {
  value: number;
  format?: "percent" | "currency" | "number" | "index";
  higherIsBetter?: boolean;
  percentChange?: number;
  showArrow?: boolean;
  size?: "sm" | "md";
}

export default function ChangeIndicator({
  value,
  format = "number",
  higherIsBetter = true,
  percentChange,
  showArrow = true,
  size = "sm",
}: ChangeIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isGood = higherIsBetter ? isPositive : isNegative;
  const isBad = higherIsBetter ? isNegative : isPositive;

  const color = isGood
    ? "#00A17D"
    : isBad
    ? "#910D63"
    : "var(--text-tertiary)";

  const bgColor = isGood
    ? "rgba(0, 161, 125, 0.12)"
    : isBad
    ? "rgba(145, 13, 99, 0.12)"
    : "rgba(128, 128, 128, 0.1)";

  const formatValue = (v: number) => {
    const abs = Math.abs(v);
    switch (format) {
      case "percent":
        return formatPercent(abs);
      case "currency":
        return formatUSD(abs);
      case "index":
        return abs.toFixed(2);
      default:
        return formatNumber(abs);
    }
  };

  const iconSize = size === "sm" ? 10 : 12;
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold ${textSize}`}
      style={{ background: bgColor, color }}
    >
      {showArrow && (
        isPositive ? (
          <ArrowUp size={iconSize} />
        ) : isNegative ? (
          <ArrowDown size={iconSize} />
        ) : (
          <Minus size={iconSize} />
        )
      )}
      <span>{isPositive ? "+" : ""}{formatValue(value)}</span>
      {percentChange != null && (
        <span className="opacity-70 ml-0.5">
          ({percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}
