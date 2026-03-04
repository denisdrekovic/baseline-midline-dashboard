"use client";

import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, User } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import IDILogo from "@/components/ui/IDILogo";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(result.error || "Authentication failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden px-4"
      style={{
        background: "radial-gradient(ellipse at top, #2D1B52 0%, #1A0E2E 70%)",
      }}
    >
      {/* Decorative ambient glow */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "rgba(0, 161, 125, 0.06)", filter: "blur(120px)" }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "rgba(145, 13, 99, 0.08)", filter: "blur(120px)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm relative z-10"
      >
        <div
          className="rounded-2xl p-8"
          style={{
            background: "var(--card-bg, rgba(42, 16, 85, 0.55))",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--card-border, rgba(228, 213, 245, 0.12))",
            boxShadow: "var(--shadow-elevated, 0 12px 40px rgba(26, 14, 46, 0.5))",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-12 h-12 rounded-xl bg-[var(--color-accent,#00A17D)] flex items-center justify-center mb-4"
              style={{ boxShadow: "0 4px 20px rgba(0, 161, 125, 0.3)" }}
            >
              <IDILogo size={28} className="brightness-0 invert" />
            </div>
            <h1
              className="text-xl font-bold text-white tracking-tight"
              style={{ fontFamily: "var(--font-heading, 'Poppins', sans-serif)" }}
            >
              Shubh Samriddhi
            </h1>
            <p
              className="text-xs mt-1"
              style={{
                color: "var(--text-tertiary, rgba(245, 243, 247, 0.45))",
                fontFamily: "var(--font-sans, 'Source Sans 3', sans-serif)",
              }}
            >
              Baseline Agricultural Analytics
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5"
                style={{
                  color: "var(--text-tertiary, rgba(245, 243, 247, 0.45))",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Username
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200"
                style={{
                  background: "var(--color-surface-1, rgba(42, 16, 85, 0.4))",
                  border: "1px solid var(--card-border, rgba(228, 213, 245, 0.12))",
                }}
              >
                <User size={16} style={{ color: "var(--text-tertiary, rgba(245, 243, 247, 0.45))", flexShrink: 0 }} />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  autoFocus
                  className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
                  style={{
                    color: "var(--text-primary, #F5F3F7)",
                    fontFamily: "var(--font-sans)",
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5"
                style={{
                  color: "var(--text-tertiary, rgba(245, 243, 247, 0.45))",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Password
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200"
                style={{
                  background: "var(--color-surface-1, rgba(42, 16, 85, 0.4))",
                  border: "1px solid var(--card-border, rgba(228, 213, 245, 0.12))",
                }}
              >
                <Lock size={16} style={{ color: "var(--text-tertiary, rgba(245, 243, 247, 0.45))", flexShrink: 0 }} />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
                  style={{
                    color: "var(--text-primary, #F5F3F7)",
                    fontFamily: "var(--font-sans)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="p-0.5 rounded transition-colors hover:opacity-80"
                  style={{ color: "var(--text-tertiary, rgba(245, 243, 247, 0.45))" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="text-xs text-center py-1.5"
                style={{ color: "var(--color-negative, #910D63)" }}
              >
                {error}
              </motion.p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isSubmitting
                  ? "var(--color-accent-dim, #008A6B)"
                  : "var(--color-accent, #00A17D)",
                fontFamily: "var(--font-heading, 'Poppins', sans-serif)",
                boxShadow: "0 4px 14px rgba(0, 161, 125, 0.25)",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = "var(--color-accent-dim, #008A6B)";
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = "var(--color-accent, #00A17D)";
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p
            className="text-center mt-6 text-[10px]"
            style={{ color: "var(--text-tertiary, rgba(245, 243, 247, 0.35))" }}
          >
            Protected dashboard. Enter your credentials to continue.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
