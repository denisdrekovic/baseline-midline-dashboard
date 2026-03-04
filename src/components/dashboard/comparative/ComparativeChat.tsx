"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Target,
  Heart,
  Wheat,
  Leaf,
  DollarSign,
} from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import type { SectionId } from "@/components/dashboard/SectionTabs";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { formatNumber } from "@/lib/utils/formatters";
import {
  generateComparativeChatResponse,
  type ChatMessage,
  type ChatContext,
} from "@/lib/utils/comparativeChatEngine";
import { renderMarkdown } from "@/components/analytics/AnalyticsChatMarkdown";

/* ── Types ── */
type ChatPage = "dashboard" | "segments" | "farmers" | "analytics";
type QuickQuestion = { icon: React.ComponentType<{ size?: number }>; label: string; q: string };

/* ── Context-aware quick-action questions ── */
const CONTEXT_QUICK_QUESTIONS: Record<string, QuickQuestion[]> = {
  "dashboard:overview": [
    { icon: TrendingUp, label: "Progress summary", q: "Give me an overview of progress from baseline to midline" },
    { icon: Target, label: "LIB impact", q: "How is the Living Income Benchmark progressing?" },
    { icon: Sparkles, label: "Treatment effects", q: "What are the treatment effects? Did the program work?" },
  ],
  "dashboard:income": [
    { icon: DollarSign, label: "Income changes", q: "How has income changed from baseline to midline?" },
    { icon: TrendingUp, label: "Poverty shift", q: "How has poverty changed across groups?" },
    { icon: Target, label: "Income by group", q: "Compare income across treatment groups" },
  ],
  "dashboard:crops": [
    { icon: Wheat, label: "Best crops", q: "Which crops are performing best?" },
    { icon: TrendingUp, label: "Yield changes", q: "How have crop yields changed from baseline to midline?" },
    { icon: Target, label: "Mint practices", q: "How is mint practice adoption progressing?" },
  ],
  "dashboard:women": [
    { icon: Heart, label: "Empowerment", q: "How has women's empowerment changed?" },
    { icon: TrendingUp, label: "WEI scores", q: "How are WEI scores progressing across groups?" },
    { icon: Target, label: "Female LIB", q: "How is the female LIB rate changing?" },
  ],
  "dashboard:sustainability": [
    { icon: Leaf, label: "Carbon footprint", q: "How has the carbon footprint changed?" },
    { icon: TrendingUp, label: "Tree offset", q: "How are tree carbon offsets progressing?" },
    { icon: Target, label: "Pesticide use", q: "What's happening with pesticide use?" },
  ],
  segments: [
    { icon: TrendingUp, label: "Group comparison", q: "Compare treatment groups across key metrics" },
    { icon: Target, label: "LIB by group", q: "How does LIB compare across groups?" },
    { icon: Sparkles, label: "Treatment effects", q: "What are the treatment effects? Did the program work?" },
  ],
  farmers: [
    { icon: TrendingUp, label: "Farmer progress", q: "Summarize farmer-level progress from baseline to midline" },
    { icon: Target, label: "Top improvements", q: "Which areas improved the most?" },
    { icon: Heart, label: "Recommendations", q: "What should we focus on next?" },
  ],
  analytics: [
    { icon: TrendingUp, label: "Key findings", q: "What are the key findings from baseline to midline?" },
    { icon: Target, label: "Treatment effects", q: "What are the treatment effects? Did the program work?" },
    { icon: Heart, label: "Recommendations", q: "Give me strategic recommendations" },
  ],
};

/* ── Context-aware welcome messages ── */
const WELCOME_MESSAGES: Record<string, string> = {
  "dashboard:overview": "I can discuss overall baseline \u2192 midline progress, LIB trends, and treatment effects.",
  "dashboard:income": "I can analyse income changes, poverty transitions, and income composition shifts between rounds.",
  "dashboard:crops": "I can explore crop performance, yield changes, expense trends, and practice adoption.",
  "dashboard:women": "I can discuss women's empowerment, WEI scores, female LIB rates, and gender income gaps.",
  "dashboard:sustainability": "I can analyse carbon footprint changes, emission sources, and sustainability trends.",
  segments: "I can compare treatment groups across key metrics and explore segment-level patterns.",
  farmers: "I can summarise farmer-level progress, highlight improvements, and suggest focus areas.",
  analytics: "I can provide deep analysis of baseline → midline changes, treatment effects, and strategic recommendations.",
};

function getContextKey(page: ChatPage, section?: SectionId | null): string {
  if (page === "dashboard" && section) return `dashboard:${section}`;
  return page;
}

function getContextLabel(page: ChatPage, section?: SectionId | null): string {
  const labels: Record<string, string> = {
    overview: "Overview", income: "Income", crops: "Crops",
    women: "Women", sustainability: "Sustainability",
  };
  if (page === "dashboard" && section) return `Dashboard \u00B7 ${labels[section] ?? section}`;
  if (page === "segments") return "Project Groups";
  if (page === "farmers") return "Farmer Explorer";
  if (page === "analytics") return "AI Analytics";
  return "Dashboard";
}

/* ── Component ── */

interface ComparativeChatProps {
  projectFilter?: string;
  page: ChatPage;
  section?: SectionId | null;
}

export default function ComparativeChat({ projectFilter, page, section }: ComparativeChatProps) {
  const { getRound } = useData();
  const { geoFilterRound } = useGeo();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Context key (for detecting changes) ── */
  const contextKey = getContextKey(page, section);
  const contextLabel = getContextLabel(page, section);

  /* ── Farmer data — both rounds, project-filtered ── */
  const baselineFarmers = useMemo(() => {
    const all = geoFilterRound(getRound("baseline").farmers);
    return projectFilter && projectFilter !== "all"
      ? all.filter((f) => f.project === projectFilter)
      : all;
  }, [getRound, geoFilterRound, projectFilter]);

  const midlineFarmers = useMemo(() => {
    const all = geoFilterRound(getRound("midline").farmers);
    return projectFilter && projectFilter !== "all"
      ? all.filter((f) => f.project === projectFilter)
      : all;
  }, [getRound, geoFilterRound, projectFilter]);

  /* ── Chat context for the engine ── */
  const chatContext: ChatContext = useMemo(() => ({
    page,
    section: section ?? null,
  }), [page, section]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Reset chat when page/section changes ── */
  const prevContextKey = useRef(contextKey);
  useEffect(() => {
    if (prevContextKey.current !== contextKey) {
      prevContextKey.current = contextKey;
      setMessages([]);
      hasInit.current = false;
      if (isOpen && baselineFarmers.length > 0) {
        const welcomeText = WELCOME_MESSAGES[contextKey] ?? WELCOME_MESSAGES["dashboard:overview"];
        hasInit.current = true;
        setMessages([{
          role: "assistant",
          content: `**${contextLabel}** \u2014 Comparative Analysis\n\n${welcomeText}\n\nI'm working with **${formatNumber(baselineFarmers.length)} baseline** and **${formatNumber(midlineFarmers.length)} midline** farmers.\n\nPick a question below or type your own.`,
        }]);
      }
    }
  }, [contextKey, contextLabel, isOpen, baselineFarmers.length, midlineFarmers.length]);

  /* ── Welcome message on first open ── */
  const hasInit = useRef(false);
  useEffect(() => {
    if (isOpen && !hasInit.current && baselineFarmers.length > 0) {
      hasInit.current = true;
      const welcomeText = WELCOME_MESSAGES[contextKey] ?? WELCOME_MESSAGES["dashboard:overview"];
      setMessages([{
        role: "assistant",
        content: `**${contextLabel}** \u2014 Comparative Analysis\n\n${welcomeText}\n\nI'm working with **${formatNumber(baselineFarmers.length)} baseline** and **${formatNumber(midlineFarmers.length)} midline** farmers.\n\nPick a question below or type your own.`,
      }]);
    }
  }, [isOpen, baselineFarmers.length, midlineFarmers.length, contextKey, contextLabel]);

  /* ── Focus input when opened ── */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  /* ── Quick questions for current context ── */
  const quickQuestions = useMemo(() => {
    return CONTEXT_QUICK_QUESTIONS[contextKey] ?? CONTEXT_QUICK_QUESTIONS["dashboard:overview"];
  }, [contextKey]);

  /* ── Message count badge (shown when collapsed with conversation) ── */
  const messageCount = messages.filter((m) => m.role === "assistant").length;

  const handleSend = useCallback(
    (text?: string) => {
      const question = text || input.trim();
      if (!question || isTyping) return;

      const userMsg: ChatMessage = { role: "user", content: question };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      setTimeout(() => {
        setMessages((prev) => {
          const response = generateComparativeChatResponse(
            question,
            baselineFarmers,
            midlineFarmers,
            prev,
            chatContext
          );
          return [...prev, { role: "assistant", content: response }];
        });
        setIsTyping(false);
      }, 300 + Math.random() * 500);
    },
    [input, isTyping, baselineFarmers, midlineFarmers, chatContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="shrink-0 flex h-full order-4"
      style={{ borderLeft: "1px solid var(--card-border)" }}
    >
      {/* ── Toggle tab (always visible) — matches LIB Calculator LEVERS tab exactly ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="shrink-0 w-9 flex flex-col items-center justify-center gap-2 transition-all"
        style={{
          background: isOpen
            ? "var(--card-bg)"
            : "linear-gradient(180deg, var(--color-brand-light-green, #D4F0E7) 0%, var(--color-brand-light-purple, #E4D5F5) 100%)",
          borderLeft: isOpen ? "none" : "2px solid var(--color-accent, #00A17D)",
        }}
        title={isOpen ? "Close impact chat" : "Open impact chat"}
      >
        <div className="relative">
          <Sparkles size={14} style={{ color: isOpen ? "var(--color-accent)" : "var(--color-brand-deep-purple, #2A1055)" }} />
          {!isOpen && messageCount > 1 && (
            <span
              className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center text-white"
              style={{ background: "var(--color-accent, #00A17D)" }}
            >
              {messageCount}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
        ) : (
          <ChevronLeft size={12} style={{ color: "var(--color-brand-deep-purple, #2A1055)" }} />
        )}
        <span
          className="text-[8px] font-bold uppercase tracking-widest"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            color: isOpen ? "var(--text-tertiary)" : "var(--color-brand-deep-purple, #2A1055)",
          }}
        >
          Impact
        </span>
      </button>

      {/* ── Expandable chat panel — matches LIB Calculator panel animation ── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden flex flex-col h-full"
            style={{
              background: "var(--color-surface-1)",
            }}
          >
            {/* Panel header */}
            <div
              className="shrink-0 flex items-center justify-between px-3 py-2"
              style={{ borderBottom: "1px solid var(--card-border)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-[var(--color-accent)]" />
                <div>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">Impact Analysis</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-[var(--text-tertiary)]">{contextLabel}</span>
                    <span className="text-[var(--text-tertiary)] text-[9px]">&middot;</span>
                    <span className="text-[9px] font-mono text-[var(--color-accent)]">
                      {formatNumber(baselineFarmers.length)}B
                    </span>
                    <span className="text-[var(--text-tertiary)] text-[9px]">&middot;</span>
                    <span className="text-[9px] font-mono text-[var(--color-accent)]">
                      {formatNumber(midlineFarmers.length)}M
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-3 space-y-3">
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                        isUser ? "text-white rounded-br-md" : "brand-card rounded-bl-md"
                      }`}
                      style={isUser ? { background: "var(--color-brand-plum)" } : undefined}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles size={10} className="text-[var(--color-accent)]" />
                          <span className="text-[9px] font-semibold text-[var(--color-accent)]">
                            AI Analysis
                          </span>
                        </div>
                      )}
                      <div className={isUser ? "whitespace-pre-wrap" : ""}>
                        {isUser ? msg.content : renderMarkdown(msg.content)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="brand-card rounded-2xl rounded-bl-md px-3.5 py-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles size={10} className="text-[var(--color-accent)]" />
                      <span className="text-[9px] font-semibold text-[var(--color-accent)]">Analysing...</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick questions — show only when conversation is fresh */}
            {messages.length <= 1 && (
              <div className="shrink-0 px-3 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {quickQuestions.map((qq) => {
                    const Icon = qq.icon;
                    return (
                      <button
                        key={qq.q}
                        onClick={() => handleSend(qq.q)}
                        className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-full hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                        style={{
                          background: "var(--card-bg-hover)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--card-border)",
                        }}
                      >
                        <Icon size={10} />
                        {qq.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="shrink-0 px-3 pb-3 pt-2" style={{ borderTop: "1px solid var(--card-border)" }}>
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                style={{
                  background: "var(--card-bg-hover)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about impact..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--text-tertiary)]"
                  style={{ color: "var(--text-primary)" }}
                  aria-label="Ask about progress and impact"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white disabled:opacity-30 hover:opacity-90 transition-all"
                  style={{ background: "var(--color-accent)" }}
                  aria-label="Send"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
