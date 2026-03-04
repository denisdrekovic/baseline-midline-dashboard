"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  PieChart,
  BrainCircuit,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
  Eye,
  GitCompareArrows,
  Disc,
  Target,
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useDashboardLayout, type ViewMode } from "@/providers/DashboardLayoutProvider";
import { useData } from "@/providers/DataProvider";
import { ROUNDS } from "@/lib/data/round-config";
import IDILogo from "@/components/ui/IDILogo";

/* ── Sub-pages that live INSIDE each round ── */
const ROUND_PAGES = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/farmers", label: "Farmers", icon: Users },
  { href: "/segments", label: "Project Groups", icon: PieChart },
  { href: "/analytics", label: "AI Insights", icon: BrainCircuit },
];

/* ── The 4 primary tabs: 3 rounds + 1 standalone tool ── */
const ROUND_TABS: {
  id: ViewMode;
  label: string;
  shortLabel: string;
  color: string;
  icon: typeof LayoutDashboard;
  pillIcon: typeof LayoutDashboard;
}[] = [
  { id: "baseline", label: "Baseline", shortLabel: "B", color: "#007BFF", icon: LayoutDashboard, pillIcon: Disc },
  { id: "midline", label: "Midline", shortLabel: "M", color: "#00A17D", icon: LayoutDashboard, pillIcon: Target },
  { id: "comparative", label: "Comparative", shortLabel: "C", color: "#FFB703", icon: GitCompareArrows, pillIcon: GitCompareArrows },
];

/* ── Mobile bottom nav ── */
const MOBILE_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/farmers", label: "Farmers", icon: Users },
  { href: "/segments", label: "Segments", icon: PieChart },
  { href: "/lib-calculator", label: "LIB Calc", icon: Calculator },
  { href: "/analytics", label: "AI", icon: BrainCircuit },
];

/* ── Component ── */
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { role, logout } = useAuth();
  const { viewMode, setViewMode } = useDashboardLayout();
  const { setActiveRound, loadedRounds } = useData();

  const isLIBCalcActive = pathname === "/lib-calculator";

  /* ── Hover-to-expand when collapsed ── */
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMouseEnter = useCallback(() => {
    if (!collapsed) return;
    hoverTimer.current = setTimeout(() => setHoverExpanded(true), 200);
  }, [collapsed]);
  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverExpanded(false);
  }, []);
  /* Effective visual state: truly collapsed only when collapsed AND not hovered */
  const showExpanded = !collapsed || hoverExpanded;

  /* Click a round tab → expand it (switch viewMode) + navigate to current page within it */
  const handleRoundClick = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "baseline" || mode === "midline") setActiveRound(mode);
    /* If we're on LIB Calc page, navigate back to dashboard */
    if (isLIBCalcActive) router.push("/");
  };

  /* Click a sub-page inside a round */
  const handleSubPageClick = (href: string, roundId: ViewMode) => {
    /* Ensure the round is active before navigating */
    if (viewMode !== roundId) {
      setViewMode(roundId);
      if (roundId === "baseline" || roundId === "midline") setActiveRound(roundId);
    }
  };

  /* Role-based filtering */
  const visibleRoundPages = ROUND_PAGES.filter((item) => {
    if (item.href === "/farmers" && role === "viewer") return false;
    return true;
  });

  const filteredMobileNav = MOBILE_NAV.filter((item) => {
    if (item.href === "/farmers" && role === "viewer") return false;
    return true;
  });

  return (
    <>
      {/* ═══ Mobile bottom nav ═══ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-around py-2 md:hidden"
        style={{
          background: "var(--color-brand-deep-purple)",
          borderTop: "1px solid rgba(228, 213, 245, 0.15)",
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {filteredMobileNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                active
                  ? "text-[var(--color-accent)]"
                  : "text-white/55 hover:text-white/85"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ═══ Desktop sidebar — accordion: Round tabs → sub-pages ═══ */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 transition-all duration-300 ${
          showExpanded ? "w-56" : "w-16"
        }`}
        style={{
          background: "var(--color-brand-deep-purple)",
          borderRight: "1px solid rgba(228, 213, 245, 0.12)",
          boxShadow: hoverExpanded ? "4px 0 24px rgba(0,0,0,0.3)" : undefined,
        }}
        aria-label="Sidebar"
      >
        {/* ── Logo ── */}
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ borderBottom: "1px solid rgba(228, 213, 245, 0.10)" }}
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shrink-0">
            <IDILogo size={20} className="brightness-0 invert" />
          </div>
          {showExpanded && (
            <span
              className="text-sm font-bold tracking-tight truncate text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Shubh Samriddhi
            </span>
          )}
        </div>

        {/* ── Collapse toggle ── */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="absolute z-50 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110"
          style={{
            top: 60,
            right: -12,
            width: 24,
            height: 24,
            background: "white",
            border: "2px solid rgba(228, 213, 245, 0.3)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            color: "var(--color-brand-deep-purple)",
          }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* ── Main nav — accordion rounds ── */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto" aria-label="Primary">
          {ROUND_TABS.map((round) => {
            const isExpanded = viewMode === round.id && !isLIBCalcActive;
            const roundDef = ROUNDS.find((r) => r.id === round.id);
            const isAvailable =
              round.id === "comparative"
                ? loadedRounds.length >= 2
                : loadedRounds.includes(round.id) || (roundDef?.available ?? false);
            const isDisabled = !isAvailable && round.id !== "baseline";

            return (
              <div key={round.id} className="mb-1">
                {/* ── Round header (primary tab) ── */}
                <button
                  onClick={() => !isDisabled && handleRoundClick(round.id)}
                  disabled={isDisabled}
                  title={!showExpanded ? round.label : undefined}
                  aria-expanded={isExpanded}
                  className={`w-full flex items-center transition-all duration-200 ${
                    !showExpanded
                      ? "justify-center py-2 px-1"
                      : "px-3 py-2.5 gap-2.5 rounded-xl"
                  }`}
                  style={{
                    color: isExpanded
                      ? "#fff"
                      : isDisabled
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(255,255,255,0.55)",
                    background: showExpanded && isExpanded ? `${round.color}20` : "transparent",
                    border: "none",
                    borderLeft: showExpanded && isExpanded ? `3px solid ${round.color}` : showExpanded ? "3px solid transparent" : undefined,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {/* Collapsed: soft-glow shape (inactive) → same shape + dot (active) */}
                  {!showExpanded ? (
                    <span
                      className="flex items-center justify-center transition-all duration-300"
                      style={{
                        width: 46,
                        height: 28,
                        borderRadius: 10,
                        background: `${round.color}${isExpanded ? "30" : "15"}`,
                        border: `2px solid ${round.color}${isExpanded ? "90" : "80"}`,
                        boxShadow: !isDisabled
                          ? [
                              `0 0 ${isExpanded ? "20px" : "14px"} ${round.color}${isExpanded ? "55" : "40"}`,
                              `inset 0 0 ${isExpanded ? "16px" : "10px"} ${round.color}${isExpanded ? "35" : "20"}`,
                            ].join(", ")
                          : "inset 0 2px 6px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Active: glowing dot · Inactive: symbolic icon */}
                      {isExpanded ? (
                        <span
                          className="rounded-full"
                          style={{
                            width: 12,
                            height: 12,
                            background: round.color,
                            boxShadow: `0 0 10px ${round.color}70`,
                          }}
                        />
                      ) : (
                        <round.pillIcon
                          size={13}
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        />
                      )}
                    </span>
                  ) : (
                    <>
                      {/* Expanded: color dot + full label */}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
                        style={{
                          background: isExpanded
                            ? round.color
                            : isDisabled
                              ? "rgba(255,255,255,0.12)"
                              : "rgba(255,255,255,0.25)",
                          boxShadow: isExpanded ? `0 0 8px ${round.color}50` : "none",
                        }}
                      />
                      <span
                        className="flex-1 text-left text-[12px] font-bold tracking-wide"
                        style={{ fontFamily: "var(--font-sans)" }}
                      >
                        {round.label}
                      </span>
                      <ChevronDown
                        size={13}
                        className="shrink-0 transition-transform duration-200"
                        style={{
                          transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                          opacity: isDisabled ? 0.3 : 0.5,
                        }}
                      />
                    </>
                  )}
                </button>

                {/* ── Sub-pages (expanded accordion) ── */}
                {isExpanded && showExpanded && (
                  <div
                    className="ml-4 mt-0.5 mb-1 pl-3 space-y-0.5"
                    style={{
                      borderLeft: `1px solid ${round.color}30`,
                    }}
                  >
                    {visibleRoundPages.map((page) => {
                      const Icon = page.icon;
                      const isActive = pathname === page.href;

                      return (
                        <Link
                          key={page.href}
                          href={page.href}
                          onClick={() => handleSubPageClick(page.href, round.id)}
                          aria-current={isActive ? "page" : undefined}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 group"
                          style={{
                            color: isActive ? round.color : "rgba(255,255,255,0.6)",
                            background: isActive ? `${round.color}12` : "transparent",
                          }}
                        >
                          <Icon size={14} />
                          <span
                            className="text-[11px] font-semibold"
                            style={{ fontFamily: "var(--font-sans)" }}
                          >
                            {page.label}
                          </span>
                          {isActive && (
                            <span
                              className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: round.color }}
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* ── Collapsed mode: show sub-page icons (smaller, subordinate) ── */}
                {isExpanded && !showExpanded && (
                  <div
                    className="flex flex-col items-center gap-px mt-0.5 pt-0.5"
                    style={{ borderTop: `1px solid ${round.color}20` }}
                  >
                    {visibleRoundPages.map((page) => {
                      const Icon = page.icon;
                      const isActive = pathname === page.href;
                      return (
                        <Link
                          key={page.href}
                          href={page.href}
                          onClick={() => handleSubPageClick(page.href, round.id)}
                          aria-current={isActive ? "page" : undefined}
                          title={page.label}
                          className="flex items-center justify-center w-7 h-6 rounded-md transition-all"
                          style={{
                            color: isActive ? round.color : "rgba(255,255,255,0.25)",
                            background: isActive ? `${round.color}15` : "transparent",
                          }}
                        >
                          <Icon size={12} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Divider before standalone tool ── */}
          <div
            className="mx-3 my-3"
            style={{ borderTop: "1px solid rgba(228, 213, 245, 0.10)" }}
          />

          {/* ── LIB Calculator — standalone, not inside any round ── */}
          <Link
            href="/lib-calculator"
            aria-current={isLIBCalcActive ? "page" : undefined}
            title={!showExpanded ? "LIB Calculator" : undefined}
            className={`flex items-center rounded-xl transition-all duration-200 ${
              !showExpanded ? "justify-center py-2 px-1" : "px-3 py-2.5 gap-2.5"
            } ${
              isLIBCalcActive
                ? "text-[#A855F7]"
                : "text-white/55 hover:text-white/85"
            }`}
            style={
              isLIBCalcActive
                ? !showExpanded
                  ? {}
                  : { background: "rgba(168,85,247,0.15)", borderLeft: "3px solid #A855F7" }
                : !showExpanded
                  ? {}
                  : { borderLeft: "3px solid transparent" }
            }
          >
            {!showExpanded ? (
              <span
                className="flex items-center justify-center transition-all duration-300"
                style={{
                  width: 46,
                  height: 28,
                  borderRadius: 10,
                  background: `#A855F7${isLIBCalcActive ? "30" : "15"}`,
                  border: `2px solid #A855F7${isLIBCalcActive ? "90" : "80"}`,
                  boxShadow: [
                    `0 0 ${isLIBCalcActive ? "20px" : "14px"} #A855F7${isLIBCalcActive ? "55" : "40"}`,
                    `inset 0 0 ${isLIBCalcActive ? "16px" : "10px"} #A855F7${isLIBCalcActive ? "35" : "20"}`,
                  ].join(", "),
                }}
              >
                {isLIBCalcActive ? (
                  <span
                    className="rounded-full"
                    style={{
                      width: 12,
                      height: 12,
                      background: "#A855F7",
                      boxShadow: "0 0 10px #A855F770",
                    }}
                  />
                ) : (
                  <Calculator
                    size={13}
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  />
                )}
              </span>
            ) : (
              <>
                <Calculator size={18} />
              </>
            )}
            {showExpanded && (
              <span
                className="text-[12px] font-bold tracking-wide"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                LIB Calculator
              </span>
            )}
          </Link>
        </nav>

        {/* ── Footer: Role badge + utilities ── */}
        <div
          className="px-2 pt-2 pb-4 space-y-1.5"
          style={{ borderTop: "1px solid rgba(228, 213, 245, 0.10)" }}
        >
          {/* Role badge */}
          <div
            className={`flex items-center rounded-lg ${
              !showExpanded ? "justify-center px-2 py-1.5" : "px-3 py-1.5 mx-1"
            }`}
            style={{
              background:
                role === "admin"
                  ? "rgba(0, 123, 255, 0.10)"
                  : "rgba(255, 192, 0, 0.10)",
              border: `1px solid ${role === "admin" ? "rgba(0,123,255,0.18)" : "rgba(255,192,0,0.18)"}`,
            }}
            title={!showExpanded ? (role === "admin" ? "Admin" : "Viewer") : undefined}
          >
            <div className="flex items-center gap-2">
              {role === "admin" ? (
                <Shield size={14} className="text-[#007BFF] shrink-0" />
              ) : (
                <Eye size={14} className="text-[#FFC000] shrink-0" />
              )}
              {showExpanded && (
                <span
                  className="text-[10px] uppercase tracking-wider font-bold"
                  style={{ color: role === "admin" ? "#3D9BFF" : "#FFD04A" }}
                >
                  {role === "admin" ? "Admin" : "Viewer"}
                </span>
              )}
            </div>
          </div>

          {/* Utility actions */}
          <div
            className={`flex ${
              !showExpanded
                ? "flex-col items-center gap-0.5"
                : "items-center justify-between mx-1"
            }`}
          >
            <Link
              href="/settings"
              title="Settings"
              aria-label="Settings"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/8 transition-colors"
            >
              <Settings size={15} />
            </Link>
            <Link
              href="/help"
              title="Help & Docs"
              aria-label="Help & Docs"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/8 transition-colors"
            >
              <HelpCircle size={15} />
            </Link>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/8 transition-colors"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white/45 hover:text-red-400 hover:bg-red-400/8 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
