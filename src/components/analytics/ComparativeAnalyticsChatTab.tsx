"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Sparkles,
  TrendingUp,
  Target,
  Heart,
  Leaf,
  DollarSign,
  FlaskConical,
} from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import { useData } from "@/providers/DataProvider";
import { useGeo } from "@/providers/GeoProvider";
import { formatNumber } from "@/lib/utils/formatters";
import {
  generateComparativeChatResponse,
  type ChatMessage,
  type ChatContext,
} from "@/lib/utils/comparativeChatEngine";
import { renderMarkdown } from "@/components/analytics/AnalyticsChatMarkdown";

/* ── Quick questions for analytics ── */
const QUICK_QUESTIONS = [
  { icon: TrendingUp, label: "Key findings", q: "What are the key findings from baseline to midline?" },
  { icon: FlaskConical, label: "Treatment effects", q: "What are the treatment effects? Did the program work?" },
  { icon: DollarSign, label: "Income analysis", q: "How has income changed from baseline to midline?" },
  { icon: Target, label: "LIB progress", q: "How is the Living Income Benchmark progressing?" },
  { icon: Heart, label: "Women's empowerment", q: "How has women's empowerment changed?" },
  { icon: Leaf, label: "Recommendations", q: "Give me strategic recommendations" },
];

interface Props {
  baselineFarmers: Farmer[];
  midlineFarmers: Farmer[];
}

export default function ComparativeAnalyticsChatTab({ baselineFarmers, midlineFarmers }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatContext: ChatContext = useMemo(() => ({
    page: "analytics" as const,
    section: null,
  }), []);

  // Welcome message
  const hasInit = useRef(false);
  useEffect(() => {
    if (!hasInit.current && baselineFarmers.length > 0) {
      hasInit.current = true;
      setMessages([{
        role: "assistant",
        content: `**Analytics** — Comparative Analysis\n\nI can provide deep analysis of baseline → midline changes, treatment effects, and strategic recommendations.\n\nI'm working with **${formatNumber(baselineFarmers.length)} baseline** and **${formatNumber(midlineFarmers.length)} midline** farmers.\n\nPick a question below or ask your own.`,
      }]);
    }
  }, [baselineFarmers.length, midlineFarmers.length]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleSend = useCallback(
    (text?: string) => {
      const question = text || input.trim();
      if (!question || isTyping) return;

      setMessages((prev) => [...prev, { role: "user", content: question }]);
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Comparative AI Analysis conversation"
      >
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  isUser ? "text-white rounded-br-md" : "brand-card rounded-bl-md"
                }`}
                style={isUser ? { background: "var(--color-brand-plum)" } : undefined}
              >
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={12} className="text-[var(--color-accent)]" />
                    <span className="text-[10px] font-semibold text-[var(--color-accent)]">
                      Comparative Analysis
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="brand-card rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-[var(--color-accent)]" />
                <span className="text-[10px] font-semibold text-[var(--color-accent)]">
                  Analysing both rounds...
                </span>
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div className="shrink-0 px-5 pb-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((qq) => {
              const Icon = qq.icon;
              return (
                <button
                  key={qq.q}
                  onClick={() => handleSend(qq.q)}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-2 rounded-full hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                  style={{
                    background: "var(--card-bg-hover)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <Icon size={12} />
                  {qq.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-5 pb-5 pt-2" style={{ borderTop: "1px solid var(--card-border)" }}>
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about baseline → midline progress, treatment effects, recommendations..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
            style={{ color: "var(--text-primary)" }}
            aria-label="Ask about comparative analysis"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-30 hover:opacity-90 transition-all"
            style={{ background: "var(--color-accent)" }}
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
