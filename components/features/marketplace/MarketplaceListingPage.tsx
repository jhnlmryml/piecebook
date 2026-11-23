"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Mail,
  MapPin,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { checkoutFormSchema } from "@/lib/form-schemas";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { isValidMarketplaceEmail } from "@/lib/marketplace-email";
import { SupabaseImageWithFallback } from "@/components/shared/SupabaseImageWithFallback";
import { requestMarketplaceMessaging } from "@/lib/messaging-events";
import { useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { ListingDetailsView } from "./ListingDetailsView";
import { MarketplaceListingEngagement } from "./MarketplaceListingEngagement";
import { ListingCard } from "./ListingCard";
import { MarketplaceListingManagement } from "./MarketplaceListingManagement";
import { MarketplaceDetailSkeleton } from "@/components/shared/LoadingSkeletons";
import {
  getMarketplaceListingSnapshot,
  isOwnMarketplaceListing,
  getServerMarketplaceListingSnapshot,
  getMarketplaceListingsSnapshot,
  getServerMarketplaceListingsSnapshot,
  checkoutMarketplaceListing,
  formatPrice,
  refreshMarketplaceListings,
  subscribeToMarketplaceListings,
} from "./marketplace-data";

type MarketplaceListingPageProps = {
  listingId: string;
};

type SellerPaymentStatus = "loading" | "not_connected" | "incomplete" | "pending" | "connected" | "unavailable";

type SellerPaymentStatusResponse = {
  status?: Exclude<SellerPaymentStatus, "loading">;
  error?: { message?: string };
};

const sellerPaymentStatusCache = new Map<
  string,
  { expiresAt: number; promise: Promise<Exclude<SellerPaymentStatus, "loading">> }
>();
const sellerPaymentStatusCacheDuration = 15_000;

function getSellerPaymentStatus(listingId: string, sellerId: string) {
  const cacheKey = `${listingId}:${sellerId}`;
  const cached = sellerPaymentStatusCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const query = new URLSearchParams({ listingId, profileId: sellerId });
  const promise = fetch(`/api/stripe/connect?${query.toString()}`, { cache: "no-store" })
    .then(async (response) => {
      const result = (await response.json()) as SellerPaymentStatusResponse;
      if (!response.ok || !result.status) {
        throw new Error(result.error?.message ?? "Could not verify seller payout setup.");
      }
      return result.status;
    })
    .catch((error: unknown) => {
      const current = sellerPaymentStatusCache.get(cacheKey);
      if (current?.promise === promise) sellerPaymentStatusCache.delete(cacheKey);
      throw error;
    });

  sellerPaymentStatusCache.set(cacheKey, {
    expiresAt: Date.now() + sellerPaymentStatusCacheDuration,
    promise,
  });
  return promise;
}

function CheckoutPartyCard({
  label,
  name,
  role,
  location,
  image,
}: {
  label: string;
  name: string;
  role?: string | null;
  location?: string | null;
  image?: string | null;
}) {
  return (
    <Card className="min-w-0 rounded-2xl border-border/70 bg-card p-3 shadow-none">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-10 shrink-0 ring-2 ring-primary/10">
          <AvatarImage src={image ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {role || label} · {location || "Location not provided"}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function MarketplaceListingPage({
  listingId,
}: MarketplaceListingPageProps) {
  const snapshot = useSyncExternalStore(
    subscribeToMarketplaceListings,
    () => getMarketplaceListingSnapshot(listingId),
    getServerMarketplaceListingSnapshot,
  );
  const listingsSnapshot = useSyncExternalStore(
    subscribeToMarketplaceListings,
    getMarketplaceListingsSnapshot,
    getServerMarketplaceListingsSnapshot,
  );
  const { savedListingIds, toggleSavedListing } = useMarketplaceLayout();
  const { currentUser, allUsers, isLoading: isUserLoading } = useProfile();
  const router = useRouter();
  const saveListing = useCallback(
    (savedListingId: string) => toggleSavedListing(savedListingId),
    [toggleSavedListing],
  );
  const listing = snapshot.status === "ready" ? snapshot.listing : null;
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutQuantity, setCheckoutQuantity] = useState("1");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"review" | "confirm">("review");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [sellerPaymentState, setSellerPaymentState] = useState<{
    key: string;
    attempt: number;
    status: SellerPaymentStatus;
    error: string | null;
  }>({ key: "", attempt: -1, status: "unavailable", error: null });
  const [sellerStatusRetryCount, setSellerStatusRetryCount] = useState(0);
  const sellerId = listing?.sellerId ?? null;
  const sellerStatusKey = sellerId ? `${listingId}:${sellerId}` : "";
  const shouldCheckSellerStatus = Boolean(
    snapshot.status === "ready" &&
    listing &&
    listing.status === "available" &&
    listing.quantity > 0 &&
    listing.price > 0 &&
    sellerId &&
    sellerId !== currentUser?.id,
  );

  useEffect(() => {
    if (!shouldCheckSellerStatus || !sellerId) return;
    let active = true;
    void getSellerPaymentStatus(listingId, sellerId)
      .then((status) => {
        if (active) {
          setSellerPaymentState({
            key: sellerStatusKey,
            attempt: sellerStatusRetryCount,
            status,
            error: null,
          });
        }
      })
      .catch((statusError: unknown) => {
        if (active) {
          setSellerPaymentState({
            key: sellerStatusKey,
            attempt: sellerStatusRetryCount,
            status: "unavailable",
            error: statusError instanceof Error ? statusError.message : "Could not verify seller payout setup.",
          });
        }
      });
    return () => { active = false; };
  }, [listingId, sellerId, sellerStatusKey, sellerStatusRetryCount, shouldCheckSellerStatus]);
  const sellerPaymentStatus = !sellerId
    ? "unavailable"
    : sellerPaymentState.key === sellerStatusKey && sellerPaymentState.attempt === sellerStatusRetryCount
        ? sellerPaymentState.status
        : "loading";
  const retrySellerStatus = () => {
    if (!sellerStatusKey) return;
    sellerPaymentStatusCache.delete(sellerStatusKey);
    setSellerStatusRetryCount((count) => count + 1);
  };

  if (snapshot.status === "loading") {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6" aria-busy="true">
        <div className="mx-auto w-full max-w-7xl">
          <MarketplaceDetailSkeleton />
        </div>
      </main>
    );
  }

  if (snapshot.status === "error") {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-4 py-8 sm:px-6">
        <Card className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Marketplace listing could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">{snapshot.error}</p>
          <Button onClick={() => void refreshMarketplaceListings()} className="mt-5 rounded-xl">Try again</Button>
        </Card>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-4 py-8 sm:px-6">
        <Card className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Listing not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This item may have been removed or the link is no longer available.</p>
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="mt-5 rounded-xl"><ArrowLeft className="size-4" />Back </Button>
        </Card>
      </main>
    );
  }

  const isOwnListing = isOwnMarketplaceListing(listing, currentUser?.id);
  const canUseSellerActions = !isUserLoading && Boolean(currentUser) && !isOwnListing && listing.status === "available";
  const canMessageSeller = canUseSellerActions && Boolean(currentUser && listing.sellerId);
  const canCheckout = canUseSellerActions && listing.quantity > 0 && listing.price > 0 && Boolean(listing.sellerId) && sellerPaymentStatus === "connected";
  const checkoutDisabled = canUseSellerActions && listing.status === "available" && listing.quantity > 0 && listing.price > 0 && Boolean(listing.sellerId) && sellerPaymentStatus === "loading";
  const checkoutNotice = !isOwnListing && listing.status === "available" && listing.quantity > 0 && listing.price > 0 && !canCheckout
    ? sellerPaymentStatus === "loading"
      ? undefined
      : sellerPaymentStatus === "unavailable"
        ? !sellerId
          ? "The seller’s Stripe account could not be identified."
          : (
          <>
            Online checkout is temporarily unavailable.{" "}
            <button
              type="button"
              onClick={retrySellerStatus}
              title={sellerPaymentState.error ?? undefined}
              className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Try again
            </button>
          </>
          )
        : "Online checkout will be available after the seller finishes Stripe payout setup."
    : undefined;
  const canViewMessages = !isUserLoading && Boolean(currentUser) && isOwnListing;
  const sellerProfile = allUsers.find((profile) => profile.id === listing.sellerId);
  const selectedQuantity = Number(checkoutQuantity);
  const normalizedBuyerEmail = buyerEmail.trim();
  const isBuyerEmailValid = !normalizedBuyerEmail || isValidMarketplaceEmail(normalizedBuyerEmail);
  const checkoutTotal = listing.price * (
    Number.isSafeInteger(selectedQuantity) && selectedQuantity > 0 ? selectedQuantity : 0
  );
  const listingCategoryDetails = Object.entries(listing.categoryDetails ?? {})
    .filter(([, value]) => value.trim());
  const marketplaceMessageListing = {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    location: listing.location,
    image: listing.photos[0] || listing.image || null,
  };
  const openSellerMessages = () => {
    if (!listing.sellerId) return;
    requestMarketplaceMessaging({
      type: "conversation",
      partnerId: listing.sellerId,
      listing: marketplaceMessageListing,
    });
  };
  const openListingMessages = () => {
    requestMarketplaceMessaging({
      type: "listing-conversations",
      listing: marketplaceMessageListing,
    });
  };
  const completeCheckout = async () => {
    const quantity = Number(checkoutQuantity);
    if (!currentUser || !listing.sellerId) {
      toast.error("Choose a profile before checking out.");
      return;
    }
    const validation = checkoutFormSchema.safeParse({
      listingId: listing.id,
      buyerId: currentUser.id,
      quantity,
      buyerEmail,
      availableQuantity: listing.quantity,
    });
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Check your order and try again.",
      );
      return;
    }

    setIsPurchasing(true);
    try {
      const { checkoutUrl } = await checkoutMarketplaceListing({
        listingId: validation.data.listingId,
        buyerId: validation.data.buyerId,
        quantity: validation.data.quantity,
        buyerEmail: validation.data.buyerEmail,
      });
      window.location.assign(checkoutUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete checkout.");
    } finally {
      setIsPurchasing(false);
    }
  };
  const candidates = listingsSnapshot.listings.filter(
    (item) => item.id !== listing.id && !isOwnMarketplaceListing(item, currentUser?.id),
  );
  const priceScale = Math.max(listing.price, 100);
  const recommendationScore = (item: (typeof candidates)[number]) =>
    (item.category === listing.category ? 100 : 0) +
    (item.location.toLowerCase() === listing.location.toLowerCase() ? 30 : 0) +
    (item.condition === listing.condition ? 10 : 0) -
    (Math.abs(item.price - listing.price) / priceScale) * 20;
  const recommendedListings = candidates
    .slice()
    .sort(
      (first, second) =>
        recommendationScore(second) - recommendationScore(first) ||
        new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
    )
    .slice(0, 4);

  return (
    <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" className="gap-2 rounded-full px-3 text-sm"><ArrowLeft className="size-4" />Back </Button>
        </div>
        <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card p-0 shadow-sm">
          <ListingDetailsView
            listing={listing}
            photos={listing.photos}
            isSaved={canUseSellerActions && savedListingIds.includes(listing.id)}
            onSave={canUseSellerActions ? () => toggleSavedListing(listing.id) : undefined}
            onMessage={canMessageSeller ? openSellerMessages : undefined}
            onViewMessages={canViewMessages ? openListingMessages : undefined}
            managementActions={!isUserLoading && currentUser && isOwnListing ? (
              <MarketplaceListingManagement
                listing={listing}
                sellerId={currentUser.id}
                onDeleted={() => router.push("/marketplace")}
              />
            ) : undefined}
            onCheckout={canCheckout ? () => {
              setCheckoutQuantity("1");
              setBuyerEmail("");
              setCheckoutStep("review");
              setIsCheckoutOpen(true);
            } : undefined}
            checkoutDisabled={checkoutDisabled}
            checkoutNotice={checkoutNotice}
            layoutClassName="grid min-h-0 grid-cols-1 md:h-[min(64dvh,42rem)] md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
            imageClassName="min-h-[min(38dvh,22rem)] md:min-h-0"
          />
        </Card>
        {(listing.status === "available" || listing.status === "sold") && (
          <MarketplaceListingEngagement
            listingId={listing.id}
            listingStatus={listing.status}
          />
        )}

        {recommendedListings.length > 0 && (
          <section
            className="mt-9"
            aria-labelledby="recommended-listings-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2
                  id="recommended-listings-heading"
                  className="text-base font-semibold tracking-tight sm:text-lg"
                >
                  Recommended for you
                </h2>
                <p className="text-xs text-muted-foreground">
                  More items you might like
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {recommendedListings.map((recommendedListing) => (
                <ListingCard
                  key={recommendedListing.id}
                  listing={recommendedListing}
                  isSaved={savedListingIds.includes(recommendedListing.id)}
                  canSaveListing={!isUserLoading && Boolean(currentUser) && recommendedListing.status === "available" && !isOwnMarketplaceListing(recommendedListing, currentUser?.id)}
                  onSaveListing={saveListing}
                />
              ))}
            </div>
          </section>
        )}
      </div>
      <Drawer
        open={isCheckoutOpen}
        onOpenChange={(open) => {
          if (!isPurchasing) setIsCheckoutOpen(open);
        }}
        swipeDirection="right"
      >
        <DrawerContent className="h-dvh! max-h-dvh! w-full! rounded-none sm:w-[min(34rem,100vw)]! sm:rounded-l-2xl">
          <DrawerHeader className="shrink-0 border-b border-border/70 bg-card px-4 py-4 text-left sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Marketplace checkout
                </p>
                <DrawerTitle className="text-xl font-bold tracking-tight">
                  {checkoutStep === "review" ? "Review your order" : "Confirm your order"}
                </DrawerTitle>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                Step {checkoutStep === "review" ? "1" : "2"} of 2
              </span>
            </div>
            <DrawerDescription className="mt-1 text-sm leading-relaxed">
              {checkoutStep === "review"
                ? "Check the item, quantity, and contact details before continuing."
                : "Stripe securely collects payment details. The marketplace confirms the order after Stripe verifies payment."}
            </DrawerDescription>
            <div aria-hidden="true" className="mt-3 flex gap-1.5">
              <span className="h-1 flex-1 rounded-full bg-primary" />
              <span
                className={`h-1 flex-1 rounded-full ${
                  checkoutStep === "confirm" ? "bg-primary" : "bg-muted"
                }`}
              />
            </div>
          </DrawerHeader>
          <div className="scrollbar-hide min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-muted/20 p-3.5 sm:p-5">
            {checkoutStep === "review" ? (
              <>
                <Card className="overflow-hidden rounded-2xl border-border/70 bg-card p-0 shadow-none">
                  <div className="flex gap-3 p-3.5">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {listing.photos[0] ? (
                        <SupabaseImageWithFallback
                          src={listing.photos[0]}
                          alt={`${listing.title} photo`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <ShoppingBag aria-hidden="true" className="size-6" />
                        </div>
                      )}
                      {listing.photos.length > 1 && (
                        <span className="absolute bottom-1 right-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                          +{listing.photos.length - 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {listing.category}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-snug tracking-tight">
                        {listing.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-base font-bold text-primary">
                          {formatPrice(listing.price)}
                        </span>
                        {listing.previousPrice != null && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(listing.previousPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/70 px-3.5 py-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Condition</dt>
                      <dd className="mt-0.5 font-medium">{listing.condition}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Available</dt>
                      <dd className="mt-0.5 font-medium">
                        {listing.quantity} {listing.quantity === 1 ? "item" : "items"}
                      </dd>
                    </div>
                    <div className="col-span-2 flex min-w-0 items-start gap-2">
                      <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Pickup location</dt>
                        <dd className="mt-0.5 break-words font-medium">{listing.location}</dd>
                      </div>
                    </div>
                    {listing.description && (
                      <div className="col-span-2 border-t border-border/70 pt-2.5">
                        <dt className="sr-only">Description</dt>
                        <dd className="line-clamp-2 text-muted-foreground">
                          {listing.description}
                        </dd>
                      </div>
                    )}
                    {listingCategoryDetails.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <div className="grid gap-2.5 min-[420px]:grid-cols-2">
                  <CheckoutPartyCard
                    label="Buyer"
                    name={currentUser?.full_name ?? "Profile unavailable"}
                    role={currentUser?.role}
                    location={currentUser?.location}
                    image={currentUser?.image}
                  />
                  <CheckoutPartyCard
                    label="Seller"
                    name={sellerProfile?.full_name ?? listing.seller}
                    role={sellerProfile?.role}
                    location={sellerProfile?.location}
                    image={sellerProfile?.image}
                  />
                </div>

                <Card className="rounded-2xl border-border/70 bg-card p-4 shadow-none">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Mail aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight">Contact & quantity</h2>
                      <p className="text-xs text-muted-foreground">
                        Stripe Checkout collects payment details securely. Email can prefill Checkout.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_7rem]">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="checkout-buyer-email" className="text-xs font-semibold">
                        Buyer email (optional)
                      </Label>
                      <Input
                        id="checkout-buyer-email"
                        className="h-11 rounded-xl bg-background"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={buyerEmail}
                        aria-invalid={Boolean(normalizedBuyerEmail && !isBuyerEmailValid)}
                        onChange={(event) => setBuyerEmail(event.target.value)}
                        placeholder="buyer@example.com"
                      />
                      {normalizedBuyerEmail && !isBuyerEmailValid ? (
                        <p role="alert" className="text-xs text-destructive">
                          Enter a valid email address.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Optional. Stripe will ask for an email during Checkout if you leave this blank.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="checkout-quantity" className="text-xs font-semibold">
                        Quantity
                      </Label>
                      <Input
                        id="checkout-quantity"
                        className="h-11 rounded-xl bg-background"
                        required
                        type="number"
                        min="1"
                        max={listing.quantity}
                        step="1"
                        value={checkoutQuantity}
                        onChange={(event) => setCheckoutQuantity(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {listing.quantity} available
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3 min-[520px]:col-span-2">
                      <div>
                        <p className="text-sm font-semibold">Payment total</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(listing.price)} ×{" "}
                          {Number.isSafeInteger(selectedQuantity) ? selectedQuantity : 0}
                        </p>
                      </div>
                      <p className="shrink-0 text-lg font-bold tracking-tight text-primary">
                        {formatPrice(checkoutTotal)}
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card className="rounded-2xl border-border/70 bg-card p-4 shadow-none">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Check aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold tracking-tight">Order details</h2>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Review the details before opening secure Stripe Checkout.
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-border/70 pt-3 text-sm min-[420px]:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Item</dt>
                      <dd className="mt-0.5 line-clamp-2 font-semibold">{listing.title}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Quantity</dt>
                      <dd className="mt-0.5 font-medium">
                        {selectedQuantity} × {formatPrice(listing.price)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Buyer</dt>
                      <dd className="mt-0.5 truncate font-medium">
                        {currentUser?.full_name ?? "Profile unavailable"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Seller</dt>
                      <dd className="mt-0.5 truncate font-medium">
                        {sellerProfile?.full_name ?? listing.seller}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Buyer email</dt>
                      <dd className="mt-0.5 break-all font-medium">
                        {normalizedBuyerEmail || "Not provided"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Payment</dt>
                      <dd className="mt-0.5 font-medium">
                        Stripe Checkout · 10% marketplace fee paid by the seller
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Pickup location</dt>
                      <dd className="mt-0.5 break-words font-medium">{listing.location}</dd>
                    </div>
                  </dl>
                </Card>
                <Card className="flex items-center justify-between gap-3 rounded-2xl border-primary/20 bg-primary/5 p-4 shadow-none">
                  <div>
                    <p className="text-sm font-semibold">Amount due in Stripe Checkout</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedQuantity} {selectedQuantity === 1 ? "item" : "items"} · Order saved after webhook confirmation
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-bold tracking-tight text-primary">
                    {formatPrice(checkoutTotal)}
                  </p>
                </Card>
                <div className="flex gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                  <ShoppingBag aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Stripe hosts the payment page. Piecebook records this order only after it receives a verified payment event.
                  </p>
                </div>
              </>
            )}
          </div>
          <DrawerFooter className="shrink-0 gap-2 border-t border-border/70 bg-card/95 p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur sm:p-4">
            {checkoutStep === "review" ? (
              <>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  variant="outline"
                  disabled={isPurchasing}
                  onClick={() => setIsCheckoutOpen(false)}
                >
                  Keep browsing
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  disabled={
                    isPurchasing ||
                    !isBuyerEmailValid ||
                    !Number.isSafeInteger(selectedQuantity) ||
                    selectedQuantity < 1 ||
                    selectedQuantity > listing.quantity
                  }
                  onClick={() => setCheckoutStep("confirm")}
                >
                  Continue to confirmation
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  variant="outline"
                  disabled={isPurchasing}
                  onClick={() => setCheckoutStep("review")}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Edit order
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  disabled={isPurchasing}
                  onClick={() => void completeCheckout()}
                >
                  <Check aria-hidden="true" className="size-4" />
                  {isPurchasing ? "Opening Stripe Checkout…" : `Continue to Stripe · ${formatPrice(checkoutTotal)}`}
                </Button>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
