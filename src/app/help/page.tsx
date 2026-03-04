"use client";

import {
  LayoutDashboard,
  BrainCircuit,
  Users,
  PieChart,
  Map,
  Filter,
  SlidersHorizontal,
  MessageSquare,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  {
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    description:
      "The main dashboard provides a map-based view of farmer data with an analytics panel. Use the side panel to explore demographics, income, living income status, and more. Click any district or block on the map to drill down into specific regions.",
    tips: [
      "Toggle the analytics panel using the chevron button between the panel and map",
      "Use project group toggles in the filter bar to focus on T-1, T-2, or Control groups",
      "Select a district on the map, then drill into blocks and villages",
    ],
  },
  {
    title: "Geographic Filtering",
    icon: Map,
    description:
      "Use the geo dropdowns (District, Block, Village) to filter the entire dashboard to a specific location. These filters are shared across all pages so your selection persists as you navigate.",
    tips: [
      "Start broad (district level) and progressively narrow down",
      "The breadcrumb at the top shows your current geographic selection",
      "Click the X button on any filter to clear it and zoom out",
    ],
  },
  {
    title: "Project Group Filters",
    icon: Filter,
    description:
      "Farmers are classified into three project groups: T-1 (Treatment 1 — Legacy Farmers), T-2 (Treatment 2 — New Intake), and Control (reference group for contextualization). Use the project group toggle to filter views.",
    tips: [
      "T-1 = Treatment 1 (Legacy Farmers), T-2 = Treatment 2 (New Intake)",
      "Control group is for reference and contextualization only",
      "Project group colors are consistent across all charts and the map",
    ],
  },
  {
    title: "AI Analytics & Predictions",
    icon: BrainCircuit,
    description:
      "The AI Analytics page uses statistical analysis to generate predictions about income trends, productivity patterns, and risk factors. These are data-driven insights based on the current filtered dataset.",
    tips: [
      "Predictions update automatically when you change geographic or project group filters",
      "Higher confidence scores indicate stronger statistical backing",
      "Use the Scenario Simulator to test what-if scenarios with crop prices and yields",
    ],
  },
  {
    title: "Scenario Simulator",
    icon: SlidersHorizontal,
    description:
      "Adjust crop prices, yield changes, and acreage changes to model projected impacts on farmer income and living income status. All changes are relative — +20% means a 20% increase from current levels.",
    tips: [
      "Reset all sliders to zero to return to the baseline",
      "The impact breakdown shows which factors contribute most to income changes",
      "Expand charts for a larger, more detailed view",
    ],
  },
  {
    title: "AI Chat",
    icon: MessageSquare,
    description:
      "Ask natural language questions about the farmer data. The AI assistant can analyze trends, compare project groups, and provide context about specific metrics.",
    tips: [
      "Ask specific questions like \"What is the median income for female farmers?\"",
      "The chat uses the same filtered dataset as the rest of the page",
      "Try asking for comparisons between project groups or districts",
    ],
  },
  {
    title: "Farmer Profiles",
    icon: Users,
    description:
      "Browse individual farmer records with detailed income breakdowns, crop data, and empowerment scores. Use search and filters to find specific farmers.",
    tips: [
      "Click any farmer row to see their detailed profile",
      "Sort columns by clicking the column header",
      "Use the search bar to find farmers by name or village",
    ],
  },
  {
    title: "Living Income Benchmark",
    icon: TrendingUp,
    description:
      "The Living Income Benchmark (LIB) measures whether a household earns enough for a decent standard of living. Farmers above LIB meet the threshold; those below need additional support.",
    tips: [
      "Gold color = above LIB, Gray = below LIB throughout the dashboard",
      "Gender breakdowns show if men and women have equal chances of meeting LIB",
      "The scenario simulator can project how price changes affect LIB status",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="py-2 max-w-3xl">
      {/* Quick navigation */}
      <div className="brand-card rounded-xl p-4 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">
          Quick Links
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/", label: "Dashboard", icon: LayoutDashboard },
            { href: "/analytics", label: "AI Analytics", icon: BrainCircuit },
            { href: "/farmers", label: "Farmers", icon: Users },
            { href: "/segments", label: "Project Groups", icon: PieChart },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--card-bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <link.icon size={14} />
              {link.label}
              <ChevronRight size={10} className="ml-auto text-[var(--text-tertiary)]" />
            </Link>
          ))}
        </div>
      </div>

      {/* Documentation sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title} className="brand-card rounded-xl p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(0, 161, 125, 0.12)" }}
                >
                  <Icon size={14} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="text-sm font-bold">{section.title}</h2>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                {section.description}
              </p>
              <div className="space-y-1.5">
                {section.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: "var(--color-accent)" }}
                    />
                    <span className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                      {tip}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Version info */}
      <div className="mt-6 text-center text-[10px] text-[var(--text-tertiary)]">
        Shubh Samriddhi Baseline Dashboard v1.0 &mdash; Built with Next.js
      </div>
    </div>
  );
}
