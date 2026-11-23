"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  CircleAlert,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Package,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/context/ProfileContext";
import { formatPrice, type Listing } from "./marketplace-data";
import { SupabaseImageWithFallback } from "@/components/shared/SupabaseImageWithFallback";
import { useMarketplaceLayout, type SellerPaymentStatus } from "./MarketplaceLayoutContext";
import { MarketplaceListingManagement } from "./MarketplaceListingManagement";
import { MarketplaceSellerPayoutCard } from "./MarketplaceSellerPayoutCard";

type DashboardSection = "overview" | "listings" | "orders" | "payments" | "settings";

type SellerOrder = {
  id: string;
  listing_title: string;
  listing_photos: string[];
  buyer_name: string;
  buyer_location: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  payment_status: string;
  created_at: string;
};

type RecentListing = {
  id: string;
  title: string;
  status: string;
  price: number;
  quantity: number;
  image: string | null;
  createdAt: string;
};

type SellerDashboardData = {
  stripe: {
    status: Exclude<SellerPaymentStatus, "loading" | "unavailable"> | "unavailable";
    paymentEligible: boolean;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
  metrics: {
    activeListings: number;
    soldListings: number;
    totalOrders: number;
    totalSales: number;
    verifiedSales: number;
    pendingOrders: number;
  } | null;
  orders: SellerOrder[];
  recentListings: RecentListing[];
};

type SectionItem = {
  id: DashboardSection;
  label: string;
  Icon: typeof LayoutDashboard;
};

const sections: SectionItem[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "listings", label: "My Listings", Icon: Package },
  { id: "orders", label: "Orders & Sales", Icon: ShoppingBag },
  { id: "payments", label: "Payments", Icon: CreditCard },
  { id: "settings", label: "Account Settings", Icon: Settings2 },
];

function isDashboardSection(value: string | null): value is DashboardSection {
  return sections.some((section) => section.id === value);
}

const dashboardSectionEvent = "piecebook:seller-dashboard-section";

function subscribeToDashboardSection(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(dashboardSectionEvent, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(dashboardSectionEvent, callback);
  };
}

function getDashboardSectionSnapshot(): DashboardSection {
  const section = new URLSearchParams(window.location.search).get("section");
  return isDashboardSection(section) ? section : "overview";
}

function getServerDashboardSectionSnapshot(): DashboardSection {
  return "overview";
}

function stateLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pending payment",
    paid: "Paid",
    legacy: "Historical sale",
    failed: "Failed",
    canceled: "Canceled",
    refunded: "Refunded",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function listingStatusLabel(status: string) {
  if (status === "available") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

const pendingDashboardRequests = new Map<string, Promise<SellerDashboardData>>();

function fetchSellerDashboard(profileId: string): Promise<SellerDashboardData> {
  const pending = pendingDashboardRequests.get(profileId);
  if (pending) return pending;
  const query = new URLSearchParams({ profileId });
  const request = (async () => {
    const response = await fetch(`/api/marketplace/seller-dashboard?${query.toString()}`, { cache: "no-store" });
    const result = (await response.json()) as SellerDashboardData | { error?: { message?: string } };
    if (!response.ok || !("stripe" in result)) {
      throw new Error("error" in result ? result.error?.message ?? "Could not load your seller dashboard." : "Could not load your seller dashboard.");
    }
    return result;
  })().finally(() => {
    if (pendingDashboardRequests.get(profileId) === request) pendingDashboardRequests.delete(profileId);
  });
  pendingDashboardRequests.set(profileId, request);
  return request;
}

export function MarketplaceSellerDashboard({
  listings,
  listingsStatus,
  listingsError,
  onRefreshListings,
}: {
  listings: Listing[];
  listingsStatus: "loading" | "ready" | "error";
  listingsError: string | null;
  onRefreshListings: () => void;
}) {
  const { currentUser } = useProfile();
  const currentProfileId = currentUser?.id;
  const { openCreateListing, sellerPaymentStatus, sellerPaymentError } = useMarketplaceLayout();
  const section = useSyncExternalStore(
    subscribeToDashboardSection,
    getDashboardSectionSnapshot,
    getServerDashboardSectionSnapshot,
  );
  const [dashboardState, setDashboardState] = useState<{
    profileId: string;
    loading: boolean;
    data: SellerDashboardData | null;
    error: string | null;
  }>({ profileId: "", loading: true, data: null, error: null });
  const dashboardData = dashboardState.profileId === currentUser?.id ? dashboardState.data : null;
  const dashboardError = dashboardState.profileId === currentUser?.id ? dashboardState.error : null;
  const isLoading = !currentUser || dashboardState.profileId !== currentUser.id || dashboardState.loading;
  const sellerListings = useMemo(
    () => listings.filter((listing) => listing.sellerId === currentUser?.id),
    [currentUser?.id, listings],
  );
  const sellerListingSnapshot = useMemo(
    () => JSON.stringify(sellerListings.map((listing) => [
      listing.id,
      listing.title,
      listing.status,
      listing.price,
      listing.quantity,
      listing.createdAt,
      listing.image,
    ])),
    [sellerListings],
  );
  const previousListings = useRef<{ profileId: string; snapshot: string } | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!currentProfileId) return;
    try {
      const data = await fetchSellerDashboard(currentProfileId);
      setDashboardState({ profileId: currentProfileId, loading: false, data, error: null });
    } catch (error) {
      setDashboardState({
        profileId: currentProfileId,
        loading: false,
        data: null,
        error: error instanceof Error ? error.message : "Could not load your seller dashboard.",
      });
    }
  }, [currentProfileId]);

  useEffect(() => {
    let active = true;
    if (!currentProfileId) return;
    void fetchSellerDashboard(currentProfileId)
      .then((data) => {
        if (active) setDashboardState({ profileId: currentProfileId, loading: false, data, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setDashboardState({
            profileId: currentProfileId,
            loading: false,
            data: null,
            error: error instanceof Error ? error.message : "Could not load your seller dashboard.",
          });
        }
      });
    return () => { active = false; };
  }, [currentProfileId]);

  useEffect(() => {
    if (!currentProfileId || listingsStatus !== "ready") return;
    const previous = previousListings.current;
    previousListings.current = { profileId: currentProfileId, snapshot: sellerListingSnapshot };
    if (!previous || previous.profileId !== currentProfileId || previous.snapshot === sellerListingSnapshot) return;
    if (!dashboardData?.stripe.paymentEligible) return;
    let active = true;
    void fetchSellerDashboard(currentProfileId)
      .then((data) => {
        if (active) setDashboardState({ profileId: currentProfileId, loading: false, data, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setDashboardState({
            profileId: currentProfileId,
            loading: false,
            data: null,
            error: error instanceof Error ? error.message : "Could not load your seller dashboard.",
          });
        }
      });
    return () => { active = false; };
  }, [currentProfileId, dashboardData?.stripe.paymentEligible, listingsStatus, sellerListingSnapshot]);

  const chooseSection = (nextSection: DashboardSection) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("seller_dashboard", "1");
      url.searchParams.set("section", nextSection);
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new Event(dashboardSectionEvent));
    }
  };

  const paymentStatus = dashboardData?.stripe.status ?? sellerPaymentStatus;
  const stripeEligible = Boolean(dashboardData?.stripe.paymentEligible && sellerPaymentStatus === "connected");

  if (isLoading || sellerPaymentStatus === "loading") {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-5 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-24 animate-pulse rounded-2xl bg-muted/70" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/70" />)}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-muted/70" />
        </div>
      </main>
    );
  }

  if (dashboardError) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-5 sm:px-5 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <DashboardHeader onCreate={openCreateListing} disabled={!stripeEligible} />
          <Card className="mt-5 rounded-2xl border border-destructive/20 p-6 text-center shadow-sm sm:p-8">
            <CircleAlert className="mx-auto size-8 text-destructive" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">Seller dashboard could not load</h2>
            <p className="mt-1 text-sm text-muted-foreground">{dashboardError}</p>
            <Button type="button" onClick={() => void loadDashboard()} className="mt-4 rounded-xl"><RefreshCw className="size-4" />Try again</Button>
          </Card>
          <MarketplaceSellerPayoutCard profileId={currentUser?.id ?? ""} />
        </div>
      </main>
    );
  }

  if (!stripeEligible || !dashboardData?.metrics) {
    const isStripeUnavailable = paymentStatus === "unavailable";
    const isPending = paymentStatus === "pending";
    const isIncomplete = paymentStatus === "incomplete";
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto bg-background px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <DashboardHeader onCreate={openCreateListing} disabled />
          <Card className="mt-5 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="bg-primary/5 px-5 py-7 sm:px-8 sm:py-9">
              <span className={`flex size-12 items-center justify-center rounded-2xl ${paymentStatus === "connected" ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/10 text-primary"}`}>
                {paymentStatus === "connected" ? <BadgeCheck className="size-6" /> : isStripeUnavailable ? <CircleAlert className="size-6" /> : <CreditCard className="size-6" />}
              </span>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Seller setup · step 1 of 1</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {isStripeUnavailable ? "Stripe status is unavailable" : isPending ? "Stripe is reviewing your account" : isIncomplete ? "Finish setting up Stripe" : "Connect Stripe to start selling"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {isStripeUnavailable
                  ? sellerPaymentError ?? "We could not confirm that your account can accept payments and receive payouts. Retry the check or continue onboarding."
                  : isPending
                    ? "Your Stripe account is connected, but it is not yet eligible to accept charges and receive payouts. Continue onboarding to provide any information Stripe still needs."
                    : "Piecebook uses Stripe Express to send seller payouts. Connect and finish Stripe onboarding before you create or publish marketplace listings."}
              </p>
            </div>
            <div className="px-5 py-5 sm:px-8">
              <div className="grid gap-3 sm:grid-cols-3">
                <SetupStep title="Secure checkout" description="Buyers pay through Stripe-hosted Checkout." />
                <SetupStep title="Direct seller charges" description="Eligible orders are charged on your connected account." />
                <SetupStep title="Payout readiness" description="Stripe confirms charges and payouts before listings go live." />
              </div>
              {currentUser && <MarketplaceSellerPayoutCard profileId={currentUser.id} />}
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Listing creation, editing to active status, and publishing stay locked until Stripe confirms onboarding is complete, charges are enabled, and payouts are enabled.
              </p>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  const metrics = dashboardData.metrics;
  const visibleOrders = dashboardData.orders;

  return (
    <main className="scrollbar-hide h-full min-h-0 overflow-y-auto bg-background px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[92rem]">
        <DashboardHeader onCreate={openCreateListing} disabled={!stripeEligible} />

        <div className="mt-5 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
          <nav aria-label="Seller dashboard sections" className="shrink-0 rounded-2xl border border-border/70 bg-card p-1.5 shadow-sm lg:sticky lg:top-4 lg:w-56 lg:p-2">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide lg:flex-col">
              {sections.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseSection(id)}
                  aria-current={section === id ? "page" : undefined}
                  className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition-colors lg:w-full ${section === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            {section === "overview" && (
              <OverviewSection
                metrics={metrics}
                orders={visibleOrders.slice(0, 5)}
                recentListings={dashboardData.recentListings}
                onViewOrders={() => chooseSection("orders")}
                onViewListings={() => chooseSection("listings")}
              />
            )}
            {section === "listings" && (
              <ListingsSection
                listings={sellerListings}
                status={listingsStatus}
                error={listingsError}
                onCreate={openCreateListing}
                onRefresh={onRefreshListings}
                onDeleted={() => {
                  onRefreshListings();
                  void loadDashboard();
                }}
              />
            )}
            {section === "orders" && <OrdersSection orders={visibleOrders} metrics={metrics} />}
            {section === "payments" && <PaymentsSection data={dashboardData} profileId={currentUser?.id ?? ""} />}
            {section === "settings" && currentUser && <SettingsSection profile={currentUser} />}
          </div>
        </div>
      </div>
    </main>
  );
}

function DashboardHeader({ onCreate, disabled }: { onCreate: () => void; disabled: boolean }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Seller Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage your listings, orders, and payouts in one place.</p>
      </div>
      <Button type="button" onClick={onCreate} disabled={disabled} className="h-10 shrink-0 rounded-xl font-semibold">
        <Plus className="size-4" />Create listing
      </Button>
    </header>
  );
}

function SetupStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricCard({ label, value, detail, Icon }: { label: string; value: string; detail: string; Icon: typeof Package }) {
  return (
    <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      </div>
    </Card>
  );
}

function OverviewSection({
  metrics,
  orders,
  recentListings,
  onViewOrders,
  onViewListings,
}: {
  metrics: NonNullable<SellerDashboardData["metrics"]>;
  orders: SellerOrder[];
  recentListings: RecentListing[];
  onViewOrders: () => void;
  onViewListings: () => void;
}) {
  return (
    <section aria-labelledby="seller-overview-heading" className="space-y-4">
      <div className="mb-4">
        <h2 id="seller-overview-heading" className="text-lg font-bold tracking-tight">Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">A live summary of your Piecebook seller activity.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="Active listings" value={metrics.activeListings.toLocaleString()} detail="Available to buyers" Icon={Package} />
        <MetricCard label="Sold listings" value={metrics.soldListings.toLocaleString()} detail="Listings marked sold" Icon={BadgeCheck} />
        <MetricCard label="Total orders" value={metrics.totalOrders.toLocaleString()} detail={`${metrics.pendingOrders.toLocaleString()} pending payment`} Icon={ShoppingBag} />
        <MetricCard label="Total sales" value={formatPrice(metrics.totalSales)} detail="Paid and historical completed orders" Icon={Banknote} />
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
        <Card className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="font-semibold">Recent orders</h3><p className="mt-0.5 text-xs text-muted-foreground">Latest activity across your listings</p></div>
            <Button type="button" variant="ghost" onClick={onViewOrders} className="h-9 shrink-0 rounded-xl px-2 text-xs font-semibold text-primary">All orders<ArrowUpRight className="size-3.5" /></Button>
          </div>
          {orders.length === 0 ? <p className="rounded-xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">Your orders will appear here.</p> : (
            <div className="space-y-2">
              {orders.map((order) => <CompactOrder key={order.id} order={order} />)}
            </div>
          )}
        </Card>
        <Card className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="font-semibold">Recent listing activity</h3><p className="mt-0.5 text-xs text-muted-foreground">Your newest listings and their current status</p></div>
            <Button type="button" variant="ghost" onClick={onViewListings} className="h-9 shrink-0 rounded-xl px-2 text-xs font-semibold text-primary">My listings<ArrowUpRight className="size-3.5" /></Button>
          </div>
          {recentListings.length === 0 ? <p className="rounded-xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">Create a listing to get your seller page started.</p> : (
            <div className="space-y-2">
              {recentListings.map((listing) => (
                <div key={listing.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 p-2.5">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {listing.image ? <SupabaseImageWithFallback src={listing.image} alt="" fill sizes="48px" className="object-cover" /> : <Package className="absolute inset-0 m-auto size-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{listing.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(listing.createdAt)} · {formatPrice(listing.price)}</p></div>
                  <StatusPill label={listingStatusLabel(listing.status)} tone={listing.status === "available" ? "success" : "neutral"} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function CompactOrder({ order }: { order: SellerOrder }) {
  return (
    <Link href={`/marketplace/orders/${encodeURIComponent(order.id)}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 p-2.5 transition-colors hover:border-primary/25 hover:bg-muted/30">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        {order.listing_photos[0] ? <SupabaseImageWithFallback src={order.listing_photos[0]} alt="" fill sizes="48px" className="object-cover" /> : <ShoppingBag className="absolute inset-0 m-auto size-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{order.listing_title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{order.buyer_name} · {formatDate(order.created_at)}</p></div>
      <div className="shrink-0 text-right"><p className="text-sm font-semibold">{formatPrice(Number(order.total_price))}</p><StatusPill label={stateLabel(order.payment_status)} tone={order.payment_status === "paid" || order.payment_status === "legacy" ? "success" : order.payment_status === "pending" ? "warning" : "neutral"} /></div>
    </Link>
  );
}

function ListingsSection({
  listings,
  status,
  error,
  onCreate,
  onRefresh,
  onDeleted,
}: {
  listings: Listing[];
  status: "loading" | "ready" | "error";
  error: string | null;
  onCreate: () => void;
  onRefresh: () => void;
  onDeleted: () => void;
}) {
  return (
    <section aria-labelledby="seller-listings-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="seller-listings-heading" className="text-lg font-bold tracking-tight">My Listings</h2><p className="mt-1 text-sm text-muted-foreground">Manage only the listings connected to your selected seller profile.</p></div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} className="h-10 rounded-xl"><RefreshCw className="size-4" />Refresh</Button>
          <Button type="button" onClick={onCreate} className="h-10 rounded-xl"><Plus className="size-4" />Create listing</Button>
        </div>
      </div>
      {status === "loading" ? <ListingsLoading /> : status === "error" ? (
        <Card className="rounded-2xl border border-destructive/20 p-6 text-center shadow-sm">
          <CircleAlert className="mx-auto size-7 text-destructive" />
          <h3 className="mt-3 font-semibold">Listings could not load</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? "Try refreshing your listings."}</p>
          <Button type="button" onClick={onRefresh} className="mt-4 rounded-xl">Try again</Button>
        </Card>
      ) : listings.length === 0 ? (
        <Card className="rounded-2xl border border-border/70 px-5 py-12 text-center shadow-sm">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="size-7" /></span>
          <h3 className="mt-4 text-lg font-semibold">No listings yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Your products will appear here after you create a listing.</p>
          <Button type="button" onClick={onCreate} className="mt-5 rounded-xl max-w-md self-center"><Plus className="size-4" />Create your first listing</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
              <Link href={`/marketplace/${encodeURIComponent(listing.id)}`} aria-label={`View ${listing.title}`} className="relative aspect-4/3 w-full shrink-0 overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-20 sm:aspect-square">
                {listing.image ? <SupabaseImageWithFallback src={listing.image} alt="" fill sizes="(max-width: 640px) 100vw, 80px" className="object-cover" /> : <Package className="absolute inset-0 m-auto size-6 text-muted-foreground" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 truncate font-semibold">{listing.title}</h3><StatusPill label={listingStatusLabel(listing.status)} tone={listing.status === "available" ? "success" : listing.status === "pending" ? "warning" : "neutral"} /></div>
                <p className="mt-1 text-sm font-semibold">{formatPrice(listing.price)} <span className="font-normal text-muted-foreground">· {listing.quantity} in stock</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Listed {formatDate(listing.createdAt)} · {listing.category}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button type="button" variant="outline" nativeButton={false} render={<Link href={`/marketplace/${encodeURIComponent(listing.id)}`} />} className="h-10 rounded-xl">View listing<ArrowUpRight className="size-4" /></Button>
                <MarketplaceListingManagement listing={listing} sellerId={listing.sellerId ?? ""} onDeleted={onDeleted} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function ListingsLoading() {
  return <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/70" />)}</div>;
}

function OrdersSection({ orders, metrics }: { orders: SellerOrder[]; metrics: NonNullable<SellerDashboardData["metrics"]> }) {
  return (
    <section aria-labelledby="seller-orders-heading">
      <div className="mb-4"><h2 id="seller-orders-heading" className="text-lg font-bold tracking-tight">Orders & Sales</h2><p className="mt-1 text-sm text-muted-foreground">Order records for listings owned by this seller profile.</p></div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SmallMetric label="Total orders" value={metrics.totalOrders.toLocaleString()} Icon={ShoppingBag} />
        <SmallMetric label="Pending payment" value={metrics.pendingOrders.toLocaleString()} Icon={Clock3} />
        <SmallMetric label="Total sales" value={formatPrice(metrics.totalSales)} Icon={Banknote} />
      </div>
      <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 px-4 py-3 sm:px-5"><h3 className="text-sm font-semibold">Sales history</h3><p className="mt-0.5 text-xs text-muted-foreground">Buyer names and locations come from the order’s public profile snapshot. Email and payment identifiers are not shown.</p></div>
        {orders.length === 0 ? <div className="px-5 py-12 text-center"><ShoppingBag className="mx-auto size-7 text-muted-foreground" /><h3 className="mt-3 font-semibold">No orders yet</h3><p className="mt-1 text-sm text-muted-foreground">Orders for your listings will appear here.</p></div> : (
          <div className="divide-y divide-border/70">
            {orders.map((order) => (
              <div key={order.id} className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {order.listing_photos[0] ? <SupabaseImageWithFallback src={order.listing_photos[0]} alt="" fill sizes="56px" className="object-cover" /> : <ShoppingBag className="absolute inset-0 m-auto size-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/marketplace/orders/${encodeURIComponent(order.id)}`} className="truncate text-sm font-semibold underline-offset-4 hover:text-primary hover:underline">{order.listing_title}</Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">Buyer: {order.buyer_name}{order.buyer_location ? ` · ${order.buyer_location}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{order.quantity} × {formatPrice(Number(order.unit_price))} · {formatDate(order.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="text-sm font-bold">{formatPrice(Number(order.total_price))}</p>
                  <StatusPill label={stateLabel(order.payment_status)} tone={order.payment_status === "paid" || order.payment_status === "legacy" ? "success" : order.payment_status === "pending" ? "warning" : "neutral"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">The existing order schema records payment state but does not track shipping or fulfillment milestones.</p>
    </section>
  );
}

function PaymentsSection({ data, profileId }: { data: SellerDashboardData; profileId: string }) {
  return (
    <section aria-labelledby="seller-payments-heading">
      <div className="mb-4"><h2 id="seller-payments-heading" className="text-lg font-bold tracking-tight">Payments</h2><p className="mt-1 text-sm text-muted-foreground">Stripe Express connection and sales totals.</p></div>
      <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><BadgeCheck className="size-5" /></span>
            <div><h3 className="font-semibold">Stripe Express · Connected</h3><p className="mt-1 text-sm text-muted-foreground">Your account is eligible to accept charges and receive payouts.</p></div>
          </div>
          <StatusPill label="Eligible" tone="success" />
        </div>
        <div className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-3">
          <StripeCheck label="Onboarding details submitted" enabled={data.stripe.detailsSubmitted} />
          <StripeCheck label="Accept charges" enabled={data.stripe.chargesEnabled} />
          <StripeCheck label="Receive payouts" enabled={data.stripe.payoutsEnabled} />
        </div>
      </Card>
      <MarketplaceSellerPayoutCard profileId={profileId} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SmallMetric label="Verified Stripe sales" value={formatPrice(data.metrics?.verifiedSales ?? 0)} Icon={Banknote} />
        <SmallMetric label="Pending orders" value={(data.metrics?.pendingOrders ?? 0).toLocaleString()} Icon={Clock3} />
      </div>
      <Card className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
        Stripe-hosted Checkout creates direct charges on your connected account. Piecebook applies a 10% platform fee; the private Stripe account ID and payment records stay on the server.
      </Card>
    </section>
  );
}

function StripeCheck({ label, enabled }: { label: string; enabled: boolean }) {
  return <div className="flex items-center gap-2 text-sm"><span className={`flex size-6 items-center justify-center rounded-full ${enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700"}`}>{enabled ? <BadgeCheck className="size-4" /> : <CircleAlert className="size-4" />}</span><span>{label}: <strong>{enabled ? "Yes" : "No"}</strong></span></div>;
}

function SettingsSection({ profile }: { profile: NonNullable<ReturnType<typeof useProfile>["currentUser"]> }) {
  const items = [
    { label: "Seller name", value: profile.full_name || "Not set" },
    { label: "Email", value: profile.email || "Not set" },
    { label: "Location", value: profile.location || "Not set" },
    { label: "Profile role", value: profile.role || "Not set" },
  ];
  return (
    <section aria-labelledby="seller-settings-heading">
      <div className="mb-4"><h2 id="seller-settings-heading" className="text-lg font-bold tracking-tight">Account Settings</h2><p className="mt-1 text-sm text-muted-foreground">Seller identity and contact details from your selected Piecebook profile.</p></div>
      <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></span>
          <div className="min-w-0"><h3 className="truncate font-semibold">{profile.full_name || "Seller profile"}</h3><p className="truncate text-sm text-muted-foreground">{profile.email || "No email on this profile"}</p></div>
        </div>
        <dl className="grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-2">
          {items.map((item) => <div key={item.label}><dt className="text-xs font-medium text-muted-foreground">{item.label}</dt><dd className="mt-1 break-words text-sm font-medium">{item.value}</dd></div>)}
        </dl>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">Changes to your public seller profile are managed through Piecebook profile settings.</p>
          <Button type="button" variant="outline" nativeButton={false} render={<Link href="/profile" />} className="h-10 rounded-xl">Edit profile<ArrowUpRight className="size-4" /></Button>
        </div>
      </Card>
    </section>
  );
}

function SmallMetric({ label, value, Icon }: { label: string; value: string; Icon: typeof Package }) {
  return <Card className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-bold">{value}</p></div></Card>;
}

function StatusPill({ label, tone }: { label: string; tone: "success" | "warning" | "neutral" }) {
  const className = tone === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : tone === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex max-w-36 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-tight ${className}`}>{label}</span>;
}
