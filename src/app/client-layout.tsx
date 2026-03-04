"use client";

import { ReactNode, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SettingsProvider } from "@/providers/SettingsProvider";
import { DataProvider } from "@/providers/DataProvider";
import { GeoProvider } from "@/providers/GeoProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { DashboardLayoutProvider, useDashboardLayout } from "@/providers/DashboardLayoutProvider";
import { useGeo } from "@/providers/GeoProvider";
import LoginScreen from "@/components/auth/LoginScreen";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "radial-gradient(ellipse at top, #2D1B52 0%, #1A0E2E 70%)" }}
      >
        <Loader2 size={28} className="animate-spin text-[var(--color-accent,#00A17D)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

/** Inner shell that reads sidebar state from DashboardLayoutProvider */
function LayoutShell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, toggleSidebar, viewMode } = useDashboardLayout();
  const { resetGeo } = useGeo();
  const prevViewMode = useRef(viewMode);

  // Reset all geo/demographic filters when switching rounds
  useEffect(() => {
    if (prevViewMode.current !== viewMode) {
      resetGeo();
      prevViewMode.current = viewMode;
    }
  }, [viewMode, resetGeo]);

  return (
    <>
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-white"
        style={{ background: "var(--color-brand-deep-purple)" }}
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
        <main
          id="main-content"
          className={`flex-1 transition-all duration-300 pb-20 md:pb-0 ${
            sidebarCollapsed ? "md:ml-16" : "md:ml-56"
          }`}
        >
          <div className="mx-auto px-4 md:px-6">
            <Header />
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <SettingsProvider>
          <DataProvider>
            <GeoProvider>
                <DashboardLayoutProvider>
                  <LayoutShell>{children}</LayoutShell>
                </DashboardLayoutProvider>
            </GeoProvider>
          </DataProvider>
          </SettingsProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
