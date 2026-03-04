"use client";

import { ReactNode, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Maximize2, Table2, BarChart3, Download } from "lucide-react";
import ChartExpandModal from "@/components/charts/ChartExpandModal";

export interface TableRow {
  [key: string]: string | number | null | undefined;
}

function downloadCSV(rows: TableRow[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          return str.includes(",") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MiniTable({ rows, title }: { rows: TableRow[]; title: string }) {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]" role="table" aria-label={`${title} data table`}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-2 py-1.5 font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--card-border)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--card-border)] last:border-0">
              {headers.map((h) => (
                <td key={h} className="px-2 py-1.5 text-[var(--text-secondary)] font-mono">
                  {row[h] != null ? String(row[h]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Pass table data to enable chart ↔ table toggle + CSV download */
  tableData?: TableRow[];
  /** Enable expand-to-modal button */
  expandable?: boolean;
}

export default function ChartContainer({
  title,
  subtitle,
  children,
  className = "",
  delay = 0,
  tableData,
  expandable = true,
}: ChartContainerProps) {
  const [showTable, setShowTable] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDownload = useCallback(() => {
    if (tableData) downloadCSV(tableData, title.replace(/\s+/g, "_").toLowerCase());
  }, [tableData, title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={`brand-card brand-card-hover p-3 ${className}`}
      role="figure"
      aria-label={title}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h3
            className="text-xs font-bold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 ml-2">
          {tableData && tableData.length > 0 && (
            <>
              <button
                onClick={() => setShowTable(!showTable)}
                className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                aria-label={showTable ? "Show chart" : "Show table"}
                title={showTable ? "Chart view" : "Table view"}
              >
                {showTable ? (
                  <BarChart3 size={12} style={{ color: "var(--color-accent)" }} />
                ) : (
                  <Table2 size={12} style={{ color: "var(--text-tertiary)" }} />
                )}
              </button>
              <button
                onClick={handleDownload}
                className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
                aria-label="Download CSV"
                title="Download as CSV"
              >
                <Download size={12} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </>
          )}
          {expandable && (
            <button
              onClick={() => setExpanded(true)}
              className="p-1 rounded-md hover:bg-[var(--card-bg-hover)] transition-colors"
              aria-label={`Expand ${title}`}
              title="Expand chart"
            >
              <Maximize2 size={12} style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
        </div>
      </div>

      {showTable && tableData && tableData.length > 0 ? (
        <MiniTable rows={tableData} title={title} />
      ) : (
        children
      )}

      {expandable && (
        <ChartExpandModal
          open={expanded}
          onClose={() => setExpanded(false)}
          title={title}
        >
          {children}
        </ChartExpandModal>
      )}
    </motion.div>
  );
}
