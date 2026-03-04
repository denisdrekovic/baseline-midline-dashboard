"use client";

import { PROJECT_COLORS } from "@/lib/data/constants";
import type { ProjectGroup } from "@/lib/data/types";

interface ProjectBadgeProps {
  project: string;
  size?: "sm" | "md";
}

/** Badge showing project group (T-1, T-2, Control) with color coding */
export default function ProjectBadge({ project, size = "sm" }: ProjectBadgeProps) {
  const color = (PROJECT_COLORS as Record<string, string>)[project] ?? "#17A2B8";
  const isControl = project === "Control";

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold leading-none ${sizeClasses}`}
      style={{
        backgroundColor: isControl ? "transparent" : `${color}20`,
        color,
        border: `1px ${isControl ? "dashed" : "solid"} ${color}40`,
      }}
    >
      {project}
    </span>
  );
}

// Keep old name as alias for migration
export { ProjectBadge as SegmentBadge };
