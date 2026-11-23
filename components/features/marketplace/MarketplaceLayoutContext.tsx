"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";
import type { Category } from "./marketplace-data";

export type MarketplaceView = "browse" | "saved" | "selling" | "purchases" | "sales";
export type SellerPaymentStatus = "loading" | "not_connected" | "incomplete" | "pending" | "connected" | "unavailable";

type MarketplaceLayoutState = {
  activeView: MarketplaceView;
  activeCategory: Category | null;
  sellerPaymentStatus: SellerPaymentStatus;
  sellerPaymentError: string | null;
  isSellerPaymentEligible: boolean;
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
  const searchParams = useSearchParams();
  const { setIsDetailPage, chooseView } = useMarketplaceLayout();
  const lastDashboardRequest = useRef<string | null>(null);

  useEffect(() => {
    setIsDetailPage(pathname !== "/marketplace");
    const isDashboardRequest = pathname === "/marketplace" && searchParams.get("seller_dashboard") === "1";
    if (!isDashboardRequest) {
      lastDashboardRequest.current = null;
      return;
    }
    const requestKey = searchParams.toString();
    if (lastDashboardRequest.current === requestKey) return;
    lastDashboardRequest.current = requestKey;
    chooseView("selling");
  }, [chooseView, pathname, searchParams, setIsDetailPage]);

  return null;
}

export function MarketplaceLayoutProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { currentUser, isLoading: isProfileLoading } = useProfile();
  const [activeView, setActiveView] = useState<MarketplaceView>("browse");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [isDetailPage, setIsDetailPage] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [sellerPaymentState, setSellerPaymentState] = useState<{
    profileId: string;
    status: Exclude<SellerPaymentStatus, "loading">;
    error: string | null;
  }>({ profileId: "", status: "unavailable", error: null });

  useEffect(() => {
    if (isProfileLoading || !currentUser) return;
    let active = true;
    const query = new URLSearchParams({ profileId: currentUser.id });
    void fetch(`/api/stripe/connect?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          status?: Exclude<SellerPaymentStatus, "loading">;
          error?: { message?: string };
        };
        if (!response.ok || !result.status) {
          throw new Error(result.error?.message ?? "Could not verify Stripe seller eligibility.");
        }
        if (active) {
          setSellerPaymentState({ profileId: currentUser.id, status: result.status, error: null });
        }
      })
      .catch((statusError: unknown) => {
        if (active) {
          setSellerPaymentState({
            profileId: currentUser.id,
            status: "unavailable",
            error: statusError instanceof Error ? statusError.message : "Could not verify Stripe seller eligibility.",
          });
        }
      });
    return () => { active = false; };
  }, [currentUser, isProfileLoading]);

  const sellerPaymentStatus: SellerPaymentStatus = isProfileLoading
    ? "loading"
    : !currentUser
      ? "unavailable"
      : sellerPaymentState.profileId === currentUser.id
        ? sellerPaymentState.status
        : "loading";
  const sellerPaymentError = sellerPaymentState.profileId === currentUser?.id
    ? sellerPaymentState.error
    : null;
  const toggleSavedListing = useCallback((listingId: string) => {
    setSavedListingIds((current) =>
      current.includes(listingId)
        ? current.filter((savedId) => savedId !== listingId)
        : [...current, listingId],
    );
  }, []);

  const value = useMemo<MarketplaceLayoutState>(() => ({
    activeView,
    activeCategory,
    sellerPaymentStatus,
    sellerPaymentError,
    isSellerPaymentEligible: sellerPaymentStatus === "connected",
    isDetailPage,
    isCreateOpen,
    savedListingIds,
    setIsDetailPage,
    setIsCreateOpen,
    toggleSavedListing,
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
      if (sellerPaymentStatus !== "connected") {
        setActiveView("selling");
        setActiveCategory(null);
        if (isDetailPage) router.push("/marketplace");
        return;
      }
      setIsCreateOpen(true);
      if (isDetailPage) router.push("/marketplace");
    },
  }), [activeCategory, activeView, isCreateOpen, isDetailPage, router, savedListingIds, sellerPaymentError, sellerPaymentStatus, toggleSavedListing]);

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
