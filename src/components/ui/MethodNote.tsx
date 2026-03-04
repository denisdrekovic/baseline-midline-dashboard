"use client";

/* ------------------------------------------------------------------ */
/*  MethodNote                                                         */
/*  A compact, collapsible methodology footnote for impact/outcome     */
/*  charts. Provides transparency for M&E audiences on how estimates   */
/*  are computed, what assumptions are made, and key caveats.          */
/*                                                                     */
/*  Design: obvious expand affordance with "Details ▾" text link,     */
/*  subtle hover highlight, accessible button semantics.               */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

interface MethodNoteProps {
  /** Short one-line summary shown when collapsed */
  summary: string;
  /** Full methodology detail paragraphs shown when expanded */
  details?: string[];
  /** Optional list of key caveats / limitations */
  caveats?: string[];
  /** Visual style — 'inline' blends into card, 'standalone' has own border */
  variant?: "inline" | "standalone";
}

export default function MethodNote({
  summary,
  details,
  caveats,
  variant = "inline",
}: MethodNoteProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandable = (details && details.length > 0) || (caveats && caveats.length > 0);

  return (
    <div
      className="mt-2"
      style={{
        borderTop: variant === "inline" ? "1px solid var(--card-border)" : "none",
        border: variant === "standalone" ? "1px solid var(--card-border)" : undefined,
        borderRadius: variant === "standalone" ? "8px" : undefined,
        padding: variant === "standalone" ? "8px 10px" : "6px 0 0 0",
      }}
    >
      {/* Summary row */}
      <div className="flex items-start gap-1.5 w-full">
        <Info
          size={11}
          className="shrink-0 mt-[1px]"
          style={{ color: "var(--color-brand-gold)", opacity: 0.7 }}
        />
        <div className="flex-1 min-w-0">
          <span
            className="text-[9px] leading-snug text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <strong className="text-[var(--text-quaternary)]">Method: </strong>
            {summary}
          </span>
          {/* Obvious expandable link */}
          {hasExpandable && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-0.5 ml-1.5 text-[9px] font-semibold transition-all rounded-sm px-1 py-0 hover:bg-[var(--card-bg-hover)]"
              style={{
                color: "var(--color-accent)",
                opacity: expanded ? 1 : 0.75,
              }}
              aria-expanded={expanded}
            >
              {expanded ? "Less" : "Details"}
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable detail section */}
      {expanded && hasExpandable && (
        <div
          className="mt-1.5 pl-4 space-y-1.5 text-[8px] leading-relaxed text-[var(--text-quaternary)]"
          style={{
            borderLeft: "2px solid var(--card-border)",
            marginLeft: 4,
          }}
        >
          {details?.map((d, i) => (
            <p key={i}>{d}</p>
          ))}

          {caveats && caveats.length > 0 && (
            <div className="space-y-0.5">
              <span className="font-bold uppercase tracking-wider text-[7px]" style={{ color: "var(--color-warning)" }}>
                Caveats:
              </span>
              <ul className="space-y-0.5 list-none">
                {caveats.map((c, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span style={{ color: "var(--color-warning)" }}>•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
