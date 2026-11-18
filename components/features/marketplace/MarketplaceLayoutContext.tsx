"use client";

import { createContext, Suspense, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Category } from "./marketplace-data";

export type MarketplaceView = "browse" | "saved" | "selling";

type MarketplaceLayoutState = {
  activeView: MarketplaceView;
  activeCategory: Category | null;
  isDetailPage: boolean;
  isCreateOpen: boolean;
  savedListingIds: string[];
  setIsDetailPage: (isDetailPage: boolean) => void;
  setIsCreateOpen: (open: boolean) => void;
  toggleSavedListing: (listingId: string) => void;
  chooseView: (view: MarketplaceView) => void;
  chooseCategory: (category: Category | null) => void;
  chooseFilterCategory: (category: Category | null) => void;
  openCreateListing: () => void;
};

const MarketplaceLayoutContext = createContext<MarketplaceLayoutState | null>(null);

function MarketplaceRouteSync() {
  const pathname = usePathname();
  const { setIsDetailPage } = useMarketplaceLayout();

  useEffect(() => {
    setIsDetailPage(pathname !== "/marketplace");
  }, [pathname, setIsDetailPage]);

  return null;
}

export function MarketplaceLayoutProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<MarketplaceView>("browse");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [isDetailPage, setIsDetailPage] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);

  const value = useMemo<MarketplaceLayoutState>(() => ({
    activeView,
    activeCategory,
    isDetailPage,
    isCreateOpen,
    savedListingIds,
    setIsDetailPage,
    setIsCreateOpen,
    toggleSavedListing: (listingId) => {
      setSavedListingIds((current) =>
        current.includes(listingId)
          ? current.filter((savedId) => savedId !== listingId)
          : [...current, listingId],
      );
    },
    chooseView: (view) => {
      setActiveView(view);
      setActiveCategory(null);
      if (isDetailPage) router.push("/marketplace");
    },
    chooseCategory: (category) => {
      setActiveCategory(category);
      setActiveView("browse");
      if (isDetailPage) router.push("/marketplace");
    },
    chooseFilterCategory: (category) => {
      setActiveCategory(category);
      if (category) setActiveView("browse");
    },
    openCreateListing: () => {
      setIsCreateOpen(true);
      if (isDetailPage) router.push("/marketplace");
    },
  }), [activeCategory, activeView, isCreateOpen, isDetailPage, router, savedListingIds]);

  return (
    <MarketplaceLayoutContext.Provider value={value}>
      <Suspense fallback={null}><MarketplaceRouteSync /></Suspense>
      {children}
    </MarketplaceLayoutContext.Provider>
  );
}

export function useMarketplaceLayout() {
  const context = useContext(MarketplaceLayoutContext);
  if (!context) throw new Error("useMarketplaceLayout must be used within MarketplaceLayoutProvider");
  return context;
}
