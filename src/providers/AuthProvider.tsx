"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { clearDataCache } from "@/lib/data/loader";

export type AuthRole = "viewer" | "admin";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: AuthRole | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
  role: null,
  login: async () => ({ success: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Hydrate auth state from server session on mount */
  useEffect(() => {
    fetch("/api/auth", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.isLoggedIn) {
          setIsAuthenticated(true);
          setRole(data.role);
        }
      })
      .catch(() => {
        /* server unreachable — stay logged out */
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setRole(data.role);
        return { success: true };
      }
      return { success: false, error: data.error || "Authentication failed" };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const logout = useCallback(() => {
    fetch("/api/auth", { method: "DELETE", credentials: "include" })
      .catch(() => {})
      .finally(() => {
        setIsAuthenticated(false);
        setRole(null);
        clearDataCache();
      });
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
