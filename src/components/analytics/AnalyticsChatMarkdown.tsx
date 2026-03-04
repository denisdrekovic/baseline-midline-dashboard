"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Info, ChevronDown } from "lucide-react";

/* ===================================================================
   Inline text renderer — handles **bold** syntax
   =================================================================== */

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ===================================================================
   Collapsible methodology section
   =================================================================== */

export function MethodologyBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const methodLines = content.split("\n");
  return (
    <div className="mt-3 pt-2 border-t border-[var(--card-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <Info size={11} />
        <span>How was this calculated?</span>
        <ChevronDown
          size={10}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 text-[10px] text-[var(--text-tertiary)] leading-relaxed space-y-1"
        >
          {methodLines.map((line, li) => {
            if (line.match(/^\s*[-*]\s/)) {
              return (
                <div key={li} className="flex gap-1.5 ml-1">
                  <span className="shrink-0">-</span>
                  <span>{renderInline(line.replace(/^\s*[-*]\s/, ""))}</span>
                </div>
              );
            }
            if (line.trim() === "") return <div key={li} className="h-1" />;
            return <div key={li}>{renderInline(line)}</div>;
          })}
        </motion.div>
      )}
    </div>
  );
}

/* ===================================================================
   Markdown-to-JSX renderer for tables, bold, lists, methodology blocks
   =================================================================== */

export function renderMarkdown(text: string) {
  // Split out methodology blocks first
  const methRegex = /%%methodology%%([\s\S]*?)%%\/methodology%%/;
  const methMatch = text.match(methRegex);
  let mainText = text;
  let methodologyContent: string | null = null;
  if (methMatch) {
    mainText = text.replace(methRegex, "").trim();
    methodologyContent = methMatch[1].trim();
  }

  const elements: React.ReactNode[] = [];
  const lines = mainText.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule / separator
    if (line.trim() === "---") {
      elements.push(
        <hr key={`hr-${i}`} className="border-[var(--card-border)] my-3" />
      );
      i++;
      continue;
    }

    // Table detection: line with pipes
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].includes("|") &&
        lines[i].trim().startsWith("|")
      ) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|\s*-+/))
        .map((l) =>
          l
            .split("|")
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map((c) => c.trim())
        );

      if (rows.length > 0) {
        const header = rows[0];
        const body = rows.slice(1);
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {header.map((h, j) => (
                    <th
                      key={j}
                      className="py-1.5 px-2 text-left text-[var(--text-tertiary)] font-medium"
                    >
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr
                    key={ri}
                    className={`border-b border-[var(--card-border)] border-opacity-50 ${
                      row[0]?.includes("Combined") ||
                      row[0]?.includes("Baseline")
                        ? "bg-[var(--card-bg)] font-semibold"
                        : ""
                    }`}
                  >
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-2 font-mono">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // List item
    if (line.match(/^\s*[-*]\s/)) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 ml-1">
          <span className="text-[var(--text-tertiary)] shrink-0">-</span>
          <span>{renderInline(line.replace(/^\s*[-*]\s/, ""))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s/)) {
      const num = line.match(/^\s*(\d+)\./)?.[1];
      elements.push(
        <div key={`ol-${i}`} className="flex gap-2 ml-1">
          <span className="text-[var(--text-tertiary)] shrink-0 font-mono">
            {num}.
          </span>
          <span>{renderInline(line.replace(/^\s*\d+\.\s/, ""))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Regular line
    elements.push(<div key={`p-${i}`}>{renderInline(line)}</div>);
    i++;
  }

  // Methodology collapsible section
  if (methodologyContent) {
    elements.push(
      <MethodologyBlock key="methodology" content={methodologyContent} />
    );
  }

  return <>{elements}</>;
}
