"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Sparkles,
  FlaskConical,
  GitCompare,
  Target,
  BrainCircuit,
  TrendingUp,
} from "lucide-react";
import type { Farmer } from "@/lib/data/types";
import {
  generateChatResponse,
  ChatMessage,
} from "@/lib/utils/predictions";
import { formatNumber } from "@/lib/utils/formatters";
import ChatBubble from "./ChatBubble";

const QUESTION_CATEGORIES = [
  {
    label: "Economic Analysis",
    icon: BrainCircuit,
    color: "#00A17D",
    questions: [
      "What drives income differences?",
      "Why is income low for these farmers?",
      "Show me income inequality analysis",
      "Give me a deep economic analysis",
    ],
  },
  {
    label: "Comparisons",
    icon: GitCompare,
    color: "#6F42C1",
    questions: [
      "Compare male vs female farmers",
      "Compare FPC members vs non-members",
      "Show me income by caste",
      "Compare farm size categories",
    ],
  },
  {
    label: "What-If Scenarios",
    icon: FlaskConical,
    color: "#0DCAF0",
    questions: [
      "What if mint price drops 30% but potato yield rises 15%?",
      "What if mint price drops 25%? (male vs female)",
      "What if yield increases by 30% in women?",
      "What if we expand FPC membership?",
    ],
  },
  {
    label: "Correlations",
    icon: TrendingUp,
    color: "#FB8500",
    questions: [
      "Correlation between practice adoption and yield",
      "Correlation between training and income",
      "Correlation between farm size and income",
      "Correlation between FPC membership and income",
    ],
  },
  {
    label: "Deep Dives",
    icon: Target,
    color: "var(--color-brand-gold)",
    questions: [
      "Who are the top earners?",
      "Which crop is most profitable?",
      "Give me strategic recommendations",
      "Why are women less empowered?",
    ],
  },
];

interface Props {
  data: Farmer[];
  selection: {
    district: string | null;
    block: string | null;
    village: string | null;
  };
}

export default function ChatTab({ data, selection }: Props) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Welcome message on mount only
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (data.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const locationLabel =
        selection.village ||
        selection.block ||
        selection.district ||
        "all regions";
      setChatMessages([
        {
          role: "assistant",
          content: `Welcome! I'm analyzing **${formatNumber(data.length)} farmers** in **${locationLabel}**.\n\nI can help with:\n- **Economic analysis** — income drivers, correlations, inequality, cause-and-effect modeling\n- **Comparisons** — gender, caste, farm size, FPC membership\n- **What-if scenarios** — change yield, price, acreage, empowerment\n- **Deep dives** — income, crops, project groups, sustainability\n\nPick a question below or type your own.`,
        },
      ]);
    }
  }, [data.length, selection.district, selection.block, selection.village]);

  // Append context update when geo selection changes (don't wipe history)
  const prevGeoRef = useRef({
    district: selection.district,
    block: selection.block,
    village: selection.village,
  });
  useEffect(() => {
    const prev = prevGeoRef.current;
    const changed =
      prev.district !== selection.district ||
      prev.block !== selection.block ||
      prev.village !== selection.village;
    prevGeoRef.current = {
      district: selection.district,
      block: selection.block,
      village: selection.village,
    };
    if (changed && hasInitialized.current && data.length > 0) {
      const locationLabel =
        selection.village ||
        selection.block ||
        selection.district ||
        "all regions";
      setChatMessages((msgs) => [
        ...msgs,
        {
          role: "assistant",
          content: `Context updated — now analyzing **${formatNumber(data.length)} farmers** in **${locationLabel}**.`,
        },
      ]);
    }
  }, [data.length, selection.district, selection.block, selection.village]);

  const handleSend = useCallback(
    (text?: string) => {
      const question = text || inputValue.trim();
      if (!question || isTyping) return;

      const userMsg: ChatMessage = { role: "user", content: question };
      setChatMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsTyping(true);

      setTimeout(() => {
        setChatMessages((prev) => {
          const response = generateChatResponse(question, data, prev);
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: response,
          };
          return [...prev, assistantMsg];
        });
        setIsTyping(false);
      }, 400 + Math.random() * 400);
    },
    [inputValue, isTyping, data]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="AI Data Assistant conversation"
      >
        {chatMessages.map((msg, i) => (
          <ChatBubble key={i} message={msg} index={i} />
        ))}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="brand-card rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles
                  size={12}
                  className="text-[var(--color-accent)]"
                />
                <span className="text-[10px] font-semibold text-[var(--color-accent)]">
                  Analyzing data...
                </span>
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" />
                <span
                  className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Question Categories */}
      <div className="px-5 pb-2 shrink-0">
        <div className="flex gap-2 mb-2">
          {QUESTION_CATEGORIES.map((cat, ci) => {
            const CatIcon = cat.icon;
            return (
              <button
                key={ci}
                onClick={() =>
                  setActiveCategory(activeCategory === ci ? null : ci)
                }
                className={`flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeCategory === ci
                    ? "border-[var(--card-border-hover)] bg-[var(--card-bg-hover)]"
                    : "border-[var(--card-border)] hover:border-[var(--card-border-hover)]"
                }`}
                style={{
                  color: activeCategory === ci ? cat.color : undefined,
                }}
              >
                <CatIcon size={11} />
                {cat.label}
              </button>
            );
          })}
        </div>
        {activeCategory != null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 pb-2"
          >
            {QUESTION_CATEGORIES[activeCategory].questions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  handleSend(q);
                  setActiveCategory(null);
                }}
                className="text-[10px] px-3 py-1.5 rounded-full border border-[var(--card-border)] text-[var(--text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="px-5 pb-5 shrink-0">
        <div className="flex items-center gap-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask: what drives income? why is income low? compare male vs female, what if yield rises 25%..."
            aria-label="Ask the AI Data Assistant a question"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Send message"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-dim)] transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
