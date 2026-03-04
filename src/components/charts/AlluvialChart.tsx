"use client";

/* ------------------------------------------------------------------ */
/*  AlluvialChart                                                      */
/*  Shows how entities (farmers) flow between categorical states       */
/*  across two time periods (baseline → midline).                      */
/*                                                                     */
/*  Pure SVG implementation. Theme-aware, animated, interactive.       */
/*  The width of each flow band represents the proportion of the       */
/*  population making that transition.                                 */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";

export interface AlluvialCategory {
  key: string;
  label: string;
  color: string;
}

export interface AlluvialFlow {
  from: string;
  to: string;
  value: number;
}

interface AlluvialChartProps {
  categories: AlluvialCategory[];
  flows: AlluvialFlow[];
  /** Left column label */
  leftLabel?: string;
  /** Right column label */
  rightLabel?: string;
  height?: number;
  /** Minimum visible band height in px */
  minBandHeight?: number;
}

/* ═══════ Helpers ═══════ */

function catColor(cats: AlluvialCategory[], key: string): string {
  return cats.find((c) => c.key === key)?.color ?? "var(--text-tertiary)";
}

function catLabel(cats: AlluvialCategory[], key: string): string {
  return cats.find((c) => c.key === key)?.label ?? key;
}

/** Generate a smooth cubic bezier path for the flow band */
function flowPath(
  x1: number,
  y1Top: number,
  y1Bot: number,
  x2: number,
  y2Top: number,
  y2Bot: number
): string {
  const cx = (x1 + x2) / 2;
  return [
    `M ${x1} ${y1Top}`,
    `C ${cx} ${y1Top}, ${cx} ${y2Top}, ${x2} ${y2Top}`,
    `L ${x2} ${y2Bot}`,
    `C ${cx} ${y2Bot}, ${cx} ${y1Bot}, ${x1} ${y1Bot}`,
    `Z`,
  ].join(" ");
}

/* ═══════ Component ═══════ */

export default function AlluvialChart({
  categories,
  flows,
  leftLabel = "Baseline",
  rightLabel = "Midline",
  height: propHeight,
  minBandHeight = 3,
}: AlluvialChartProps) {
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());

  const toggleCat = (key: string) => {
    setHiddenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding all
        if (categories.length - next.size > 1) next.add(key);
      }
      return next;
    });
  };

  // Filter flows based on hidden categories
  const visibleFlows = useMemo(
    () => flows.filter((f) => !hiddenCats.has(f.from) && !hiddenCats.has(f.to)),
    [flows, hiddenCats]
  );

  const layout = useMemo(() => {
    const totalFlow = visibleFlows.reduce((s, f) => s + f.value, 0);
    if (totalFlow === 0) return null;

    // Compute node sizes (left and right)
    const leftTotals = new Map<string, number>();
    const rightTotals = new Map<string, number>();

    for (const f of visibleFlows) {
      leftTotals.set(f.from, (leftTotals.get(f.from) ?? 0) + f.value);
      rightTotals.set(f.to, (rightTotals.get(f.to) ?? 0) + f.value);
    }

    // Order nodes by category order
    const orderedCats = categories.map((c) => c.key);
    const leftNodes = orderedCats.filter((k) => leftTotals.has(k));
    const rightNodes = orderedCats.filter((k) => rightTotals.has(k));

    // Layout dimensions
    const nodeWidth = 28;
    const gapBetween = 8;
    const marginLeft = 100;
    const marginRight = 100;
    const flowAreaWidth = 300;
    const svgWidth = marginLeft + nodeWidth + flowAreaWidth + nodeWidth + marginRight;

    // Calculate auto height if not specified
    const numNodes = Math.max(leftNodes.length, rightNodes.length);
    const svgHeight = propHeight ?? Math.max(220, numNodes * 52 + 60);
    const usableHeight = svgHeight - 40; // vertical padding

    // Position nodes vertically
    function layoutColumn(
      nodes: string[],
      totals: Map<string, number>
    ): Map<string, { y: number; h: number; total: number }> {
      const map = new Map<string, { y: number; h: number; total: number }>();
      const totalSize = nodes.reduce((s, k) => s + (totals.get(k) ?? 0), 0);
      const totalGap = (nodes.length - 1) * gapBetween;
      const availH = usableHeight - totalGap;

      let yOffset = 20;
      for (const k of nodes) {
        const val = totals.get(k) ?? 0;
        const h = Math.max(minBandHeight, (val / totalSize) * availH);
        map.set(k, { y: yOffset, h, total: val });
        yOffset += h + gapBetween;
      }
      return map;
    }

    const leftLayout = layoutColumn(leftNodes, leftTotals);
    const rightLayout = layoutColumn(rightNodes, rightTotals);

    // Position flows within each node
    // Track used vertical offset per node
    const leftOffsets = new Map<string, number>();
    const rightOffsets = new Map<string, number>();
    for (const [k, v] of leftLayout) leftOffsets.set(k, v.y);
    for (const [k, v] of rightLayout) rightOffsets.set(k, v.y);

    const flowPaths = visibleFlows
      .filter((f) => f.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((f) => {
        const lNode = leftLayout.get(f.from)!;
        const rNode = rightLayout.get(f.to)!;
        if (!lNode || !rNode) return null;

        const lFrac = f.value / (leftTotals.get(f.from) ?? 1);
        const rFrac = f.value / (rightTotals.get(f.to) ?? 1);
        const bandH_left = Math.max(minBandHeight * 0.5, lFrac * lNode.h);
        const bandH_right = Math.max(minBandHeight * 0.5, rFrac * rNode.h);

        const y1 = leftOffsets.get(f.from) ?? 0;
        const y2 = rightOffsets.get(f.to) ?? 0;

        leftOffsets.set(f.from, y1 + bandH_left);
        rightOffsets.set(f.to, y2 + bandH_right);

        const x1 = marginLeft + nodeWidth;
        const x2 = marginLeft + nodeWidth + flowAreaWidth;

        return {
          id: `${f.from}->${f.to}`,
          from: f.from,
          to: f.to,
          value: f.value,
          pct: ((f.value / totalFlow) * 100).toFixed(1),
          path: flowPath(x1, y1, y1 + bandH_left, x2, y2, y2 + bandH_right),
          color: catColor(categories, f.from),
          toColor: catColor(categories, f.to),
          isSameCategory: f.from === f.to,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      svgWidth,
      svgHeight,
      leftLayout,
      rightLayout,
      leftNodes,
      rightNodes,
      flowPaths,
      marginLeft,
      nodeWidth,
      flowAreaWidth,
      totalFlow,
    };
  }, [categories, visibleFlows, propHeight, minBandHeight]);

  if (!layout) {
    return (
      <div className="text-center py-8 text-[var(--text-tertiary)] text-[11px]">
        No transition data available.
      </div>
    );
  }

  const {
    svgWidth,
    svgHeight,
    leftLayout,
    rightLayout,
    leftNodes,
    rightNodes,
    flowPaths,
    marginLeft,
    nodeWidth,
    flowAreaWidth,
    totalFlow,
  } = layout;

  const isFlowHighlighted = (f: { from: string; to: string; id: string }) => {
    if (hoveredFlow) return f.id === hoveredFlow;
    if (hoveredNode) return f.from === hoveredNode || f.to === hoveredNode;
    return true;
  };

  return (
    <div className="w-full overflow-x-auto">
      {/* Column headers */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-heading)", marginLeft: marginLeft }}
        >
          {leftLabel}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-heading)", marginRight: marginLeft }}
        >
          {rightLabel}
        </span>
      </div>

      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Alluvial diagram showing transitions between categories"
      >
        <defs>
          {flowPaths.map((f) => (
            <linearGradient
              key={`grad-${f.id}`}
              id={`alluvGrad-${f.id.replace(/[^a-zA-Z0-9]/g, "_")}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor={f.color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={f.toColor} stopOpacity={0.5} />
            </linearGradient>
          ))}
        </defs>

        {/* Flow bands */}
        {flowPaths.map((f) => {
          const highlighted = isFlowHighlighted(f);
          return (
            <path
              key={f.id}
              d={f.path}
              fill={`url(#alluvGrad-${f.id.replace(/[^a-zA-Z0-9]/g, "_")})`}
              opacity={highlighted ? 0.65 : 0.08}
              stroke={f.color}
              strokeWidth={highlighted ? 0.5 : 0}
              strokeOpacity={0.3}
              style={{
                transition: "opacity 0.25s ease, stroke-width 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoveredFlow(f.id)}
              onMouseLeave={() => setHoveredFlow(null)}
            >
              <title>
                {catLabel(categories, f.from)} → {catLabel(categories, f.to)}: {f.value.toLocaleString()} ({f.pct}%)
              </title>
            </path>
          );
        })}

        {/* Left column nodes */}
        {leftNodes.map((key) => {
          const node = leftLayout.get(key)!;
          const color = catColor(categories, key);
          const label = catLabel(categories, key);
          const isActive = hoveredNode === `left-${key}`;

          return (
            <g
              key={`left-${key}`}
              onMouseEnter={() => setHoveredNode(key)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={marginLeft}
                y={node.y}
                width={nodeWidth}
                height={node.h}
                rx={4}
                fill={color}
                opacity={isActive ? 1 : 0.85}
                style={{ transition: "opacity 0.2s ease" }}
              />
              {/* Glow on hover */}
              {isActive && (
                <rect
                  x={marginLeft - 2}
                  y={node.y - 2}
                  width={nodeWidth + 4}
                  height={node.h + 4}
                  rx={5}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.3}
                />
              )}
              <text
                x={marginLeft - 8}
                y={node.y + node.h / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--text-secondary)"
                fontFamily="var(--font-sans)"
              >
                {label}
              </text>
              <text
                x={marginLeft - 8}
                y={node.y + node.h / 2 + 12}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-sans)"
              >
                {node.total.toLocaleString()} ({((node.total / totalFlow) * 100).toFixed(0)}%)
              </text>
            </g>
          );
        })}

        {/* Right column nodes */}
        {rightNodes.map((key) => {
          const node = rightLayout.get(key)!;
          const color = catColor(categories, key);
          const label = catLabel(categories, key);
          const isActive = hoveredNode === key;

          return (
            <g
              key={`right-${key}`}
              onMouseEnter={() => setHoveredNode(key)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={marginLeft + nodeWidth + flowAreaWidth}
                y={node.y}
                width={nodeWidth}
                height={node.h}
                rx={4}
                fill={color}
                opacity={isActive ? 1 : 0.85}
                style={{ transition: "opacity 0.2s ease" }}
              />
              {isActive && (
                <rect
                  x={marginLeft + nodeWidth + flowAreaWidth - 2}
                  y={node.y - 2}
                  width={nodeWidth + 4}
                  height={node.h + 4}
                  rx={5}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.3}
                />
              )}
              <text
                x={marginLeft + nodeWidth * 2 + flowAreaWidth + 8}
                y={node.y + node.h / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--text-secondary)"
                fontFamily="var(--font-sans)"
              >
                {label}
              </text>
              <text
                x={marginLeft + nodeWidth * 2 + flowAreaWidth + 8}
                y={node.y + node.h / 2 + 12}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={9}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-sans)"
              >
                {node.total.toLocaleString()} ({((node.total / totalFlow) * 100).toFixed(0)}%)
              </text>
            </g>
          );
        })}
      </svg>

      {/* Interactive legend */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 px-1"
        role="group"
        aria-label="Toggle category visibility"
      >
        {categories.map((cat) => {
          const isVisible = !hiddenCats.has(cat.key);
          return (
            <button
              key={cat.key}
              onClick={() => toggleCat(cat.key)}
              className="flex items-center gap-1.5 text-[11px] transition-all cursor-pointer"
              style={{ opacity: isVisible ? 1 : 0.35 }}
              aria-pressed={isVisible}
              title={`Click to ${isVisible ? "hide" : "show"} ${cat.label}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{
                  backgroundColor: isVisible ? cat.color : "var(--text-tertiary)",
                  opacity: isVisible ? 1 : 0.3,
                }}
              />
              <span
                className={isVisible ? "" : "line-through"}
                style={{ color: isVisible ? cat.color : "var(--text-tertiary)" }}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
        {hiddenCats.size > 0 && (
          <button
            onClick={() => setHiddenCats(new Set())}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--card-bg-hover)]"
            style={{ color: "var(--color-accent)" }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Hover tooltip / summary bar */}
      {hoveredFlow && (() => {
        const flow = flowPaths.find((f) => f.id === hoveredFlow);
        if (!flow) return null;
        return (
          <div
            className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg text-[10px]"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: flow.color }}
            />
            <span className="font-semibold" style={{ color: flow.color }}>
              {catLabel(categories, flow.from)}
            </span>
            <span className="text-[var(--text-tertiary)]">&rarr;</span>
            <span className="font-semibold" style={{ color: flow.toColor }}>
              {catLabel(categories, flow.to)}
            </span>
            <span className="text-[var(--text-tertiary)] ml-1">
              {flow.value.toLocaleString()} farmers ({flow.pct}%)
            </span>
            {flow.isSameCategory && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                style={{
                  background: "rgba(0, 161, 125, 0.12)",
                  color: "#00A17D",
                }}
              >
                Retained
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
