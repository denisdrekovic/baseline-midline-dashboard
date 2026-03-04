"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/utils/predictions";
import { renderMarkdown } from "./AnalyticsChatMarkdown";

export default function ChatBubble({
  message,
  index,
}: {
  message: ChatMessage;
  index: number;
}) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
          isUser
            ? "text-white rounded-br-md"
            : "brand-card rounded-bl-md"
        }`}
        style={isUser ? { background: "var(--color-brand-plum)" } : undefined}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-[var(--color-accent)]" />
            <span className="text-[10px] font-semibold text-[var(--color-accent)]">
              AI Insights
            </span>
          </div>
        )}
        <div className={isUser ? "whitespace-pre-wrap" : ""}>
          {isUser ? message.content : renderMarkdown(message.content)}
        </div>
      </div>
    </motion.div>
  );
}
