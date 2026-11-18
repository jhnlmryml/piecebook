"use client";

import { Suspense, createContext, useContext, useState, type ReactNode } from "react";
import AppHeader from "@/components/layout/AppHeader";

type AppShellContextValue = {
  wallSearchTerm: string;
  setWallSearchTerm: (value: string) => void;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShellSearch() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShellSearch must be used within the app shell");
  }
  return context;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [wallSearchTerm, setWallSearchTerm] = useState("");

  return (
    <AppShellContext.Provider value={{ wallSearchTerm, setWallSearchTerm }}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Suspense
          fallback={
            <header
              aria-hidden="true"
              className="piecebook-header sticky top-0 z-30 min-h-14 shrink-0"
            />
          }
        >
          <AppHeader
            searchTerm={wallSearchTerm}
            onSearchTermChange={setWallSearchTerm}
          />
        </Suspense>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </AppShellContext.Provider>
  );
}
