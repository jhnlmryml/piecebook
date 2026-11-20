"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, Sparkles } from "lucide-react";
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
import { requestMarketplaceMessaging } from "@/lib/messaging-events";
import { useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { ListingDetailsView } from "./ListingDetailsView";
import { MarketplaceListingEngagement } from "./MarketplaceListingEngagement";
import { ListingCard } from "./ListingCard";
import { MarketplaceListingManagement } from "./MarketplaceListingManagement";
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
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutQuantity, setCheckoutQuantity] = useState("1");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"review" | "confirm">("review");
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (snapshot.status === "loading") {
    return <div className="h-full min-h-0 overflow-auto bg-background p-6" aria-busy="true"><Card className="h-[60vh] w-full animate-pulse rounded-sm border-border bg-card shadow-none" /></div>;
  }

  if (snapshot.status === "error") {
    return (
      <main className="h-full min-h-0 overflow-auto bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold">Marketplace listing could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">{snapshot.error}</p>
          <Button onClick={() => void refreshMarketplaceListings()} className="mt-5 rounded-sm">Try again</Button>
        </div>
      </main>
    );
  }

  const listing = snapshot.listing;
  if (!listing) {
    return (
      <main className="h-full min-h-0 overflow-auto bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs text-muted-foreground">Marketplace</p>
          <h1 className="mt-1 text-2xl font-bold">Listing not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This item may have been removed or the link is no longer available.</p>
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="mt-5 rounded-sm"><ArrowLeft className="size-4" />Back </Button>
        </div>
      </main>
    );
  }

  const isOwnListing = isOwnMarketplaceListing(listing, currentUser?.id);
  const canUseSellerActions = !isUserLoading && Boolean(currentUser) && !isOwnListing && listing.status === "available";
  const canMessageSeller = canUseSellerActions && Boolean(currentUser && listing.sellerId);
  const canCheckout = canUseSellerActions && listing.quantity > 0 && Boolean(listing.sellerId);
  const canViewMessages = !isUserLoading && Boolean(currentUser) && isOwnListing;
  const sellerProfile = allUsers.find((profile) => profile.id === listing.sellerId);
  const selectedQuantity = Number(checkoutQuantity);
  const normalizedBuyerEmail = buyerEmail.trim();
  const isBuyerEmailValid = isValidMarketplaceEmail(normalizedBuyerEmail);
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
      const { emailNotifications } = await checkoutMarketplaceListing({
        listingId: validation.data.listingId,
        buyerId: validation.data.buyerId,
        quantity: validation.data.quantity,
        buyerEmail: validation.data.buyerEmail,
      });
      setIsCheckoutOpen(false);
      setCheckoutStep("review");
      if (emailNotifications.buyerSent && emailNotifications.sellerSent) {
        toast.success("Order placed. Confirmation emails were sent to the buyer and seller.");
      } else {
        toast.warning(
          `Order placed, but email notifications were not fully delivered. ${emailNotifications.errors.join(" ")}`,
        );
      }
      await refreshMarketplaceListings();
      router.replace("/marketplace");
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
    <main className="h-full min-h-0 overflow-y-auto bg-background px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" className="gap-2 rounded-sm px-2 text-sm"><ArrowLeft className="size-4" />Back </Button>
        </div>
        {!isUserLoading && currentUser && isOwnListing && (
          <MarketplaceListingManagement
            listing={listing}
            sellerId={currentUser.id}
            onDeleted={() => router.push("/marketplace")}
          />
        )}
        <Card className="overflow-hidden rounded-sm border border-border bg-card p-0 shadow-sm ring-0">
          <ListingDetailsView
            listing={listing}
            photos={listing.photos}
            isSaved={canUseSellerActions && savedListingIds.includes(listing.id)}
            onSave={canUseSellerActions ? () => toggleSavedListing(listing.id) : undefined}
            onMessage={canMessageSeller ? openSellerMessages : undefined}
            onViewMessages={canViewMessages ? openListingMessages : undefined}
            onCheckout={canCheckout ? () => {
              setCheckoutQuantity("1");
              setBuyerEmail("");
              setCheckoutStep("review");
              setIsCheckoutOpen(true);
            } : undefined}
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
            className="mt-8"
            aria-labelledby="recommended-listings-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              <div>
                <h2
                  id="recommended-listings-heading"
                  className="text-base font-bold sm:text-lg"
                >
                  Recommended for you
                </h2>
                <p className="text-xs text-muted-foreground">
                  More items you might like
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {recommendedListings.map((recommendedListing) => (
                <ListingCard
                  key={recommendedListing.id}
                  listing={recommendedListing}
                  isSaved={savedListingIds.includes(recommendedListing.id)}
                  onSave={() => toggleSavedListing(recommendedListing.id)}
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
        <DrawerContent className="h-dvh! max-h-dvh! w-full! sm:w-[min(34rem,100vw)]!">
          <DrawerHeader className="border-b border-border px-5 pb-4 text-left">
            <DrawerTitle className="text-lg font-bold">
              {checkoutStep === "review" ? "Review your order" : "Confirm order"}
            </DrawerTitle>
            <DrawerDescription>
              {checkoutStep === "review"
                ? "Check the item and profile details before continuing."
                  : "Confirm the total amount to place this order and send the email notifications."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {checkoutStep === "review" ? (
              <>
                <Card className="overflow-hidden rounded-md p-0 shadow-none ring-0">
                  {listing.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto p-3">
                      {listing.photos.map((photo, index) => (
                        <div key={`${listing.id}-checkout-photo-${index}`} className="relative size-24 shrink-0 overflow-hidden rounded-sm bg-muted">
                          <Image src={photo} alt={`${listing.title} photo ${index + 1}`} fill unoptimized className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold">{listing.title}</h2>
                        {listing.previousPrice != null && (
                          <p className="text-xs text-muted-foreground line-through">{formatPrice(listing.previousPrice)}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatPrice(listing.price)}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{listing.description}</p>
                    <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                      <div><dt className="font-semibold">Category</dt><dd className="mt-0.5 text-muted-foreground">{listing.category}</dd></div>
                      <div><dt className="font-semibold">Condition</dt><dd className="mt-0.5 text-muted-foreground">{listing.condition}</dd></div>
                      <div className="col-span-2"><dt className="font-semibold">Pickup location</dt><dd className="mt-0.5 text-muted-foreground">{listing.location}</dd></div>
                      {listingCategoryDetails.map(([label, value]) => (
                        <div key={label}><dt className="font-semibold">{label}</dt><dd className="mt-0.5 text-muted-foreground">{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="rounded-md p-3 shadow-none ring-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buyer</p>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar><AvatarImage src={currentUser?.image} alt="" /><AvatarFallback>{getInitials(currentUser?.full_name ?? "Buyer")}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{currentUser?.full_name ?? "Profile unavailable"}</p>
                        <p className="truncate text-xs text-muted-foreground">{currentUser?.role || "Buyer"} · {currentUser?.location || "Location not provided"}</p>
                        {currentUser && <p className="truncate text-[10px] text-muted-foreground">Profile ID: {currentUser.id}</p>}
                      </div>
                    </div>
                  </Card>
                  <Card className="rounded-md p-3 shadow-none ring-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seller</p>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar><AvatarImage src={sellerProfile?.image} alt="" /><AvatarFallback>{getInitials(sellerProfile?.full_name ?? listing.seller)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{sellerProfile?.full_name ?? listing.seller}</p>
                        <p className="truncate text-xs text-muted-foreground">{sellerProfile?.role || "Seller"} · {sellerProfile?.location || "Location not provided"}</p>
                        {sellerProfile && <p className="truncate text-[10px] text-muted-foreground">Profile ID: {sellerProfile.id}</p>}
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="space-y-3 rounded-md p-4 shadow-none ring-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-buyer-email" className="text-sm font-medium">
                      Email for your confirmation
                    </Label>
                    <Input
                      id="checkout-buyer-email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={buyerEmail}
                      aria-invalid={Boolean(buyerEmail && !isBuyerEmailValid)}
                      onChange={(event) => setBuyerEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required. We’ll send your purchase confirmation to this address.
                    </p>
                    {buyerEmail && !isBuyerEmailValid && (
                      <p role="alert" className="text-xs text-destructive">
                        Enter a valid email address.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-quantity" className="text-sm font-medium">
                      Quantity ({listing.quantity} available)
                    </Label>
                    <Input
                      id="checkout-quantity"
                      required
                      type="number"
                      min="1"
                      max={listing.quantity}
                      step="1"
                      value={checkoutQuantity}
                      onChange={(event) => setCheckoutQuantity(event.target.value)}
                    />
                  </div>
                  <div className="flex justify-between border-t border-border pt-3 text-sm">
                    <span>{formatPrice(listing.price)} × {Number.isSafeInteger(selectedQuantity) ? selectedQuantity : 0}</span>
                    <span className="font-bold">{formatPrice(checkoutTotal)}</span>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card className="space-y-3 rounded-md p-4 shadow-none ring-0">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item</p>
                    <p className="mt-1 text-sm font-bold">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedQuantity} × {formatPrice(listing.price)}
                    </p>
                  </div>
                  <div className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                    <p><span className="font-semibold">Buyer:</span> {currentUser?.full_name}</p>
                    <p><span className="font-semibold">Seller:</span> {sellerProfile?.full_name ?? listing.seller}</p>
                    <p className="break-all text-muted-foreground">Confirmation email: {normalizedBuyerEmail}</p>
                    <p className="text-muted-foreground">Pickup: {listing.location}</p>
                    <p className="text-muted-foreground">Quantity: {selectedQuantity}</p>
                  </div>
                </Card>
                <Card className="rounded-md border-primary/30 bg-primary/5 p-5 text-center shadow-none ring-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount to confirm</p>
                  <p className="mt-1 text-3xl font-bold">{formatPrice(checkoutTotal)}</p>
                </Card>
                <p className="text-xs text-muted-foreground">
                  Confirming creates the order and sends email notifications to you and the seller. Payment is not collected in this checkout.
                </p>
              </>
            )}
          </div>
          <DrawerFooter className="border-t border-border p-4 sm:p-5">
            {checkoutStep === "review" ? (
              <>
                <Button type="button" variant="outline" disabled={isPurchasing} onClick={() => setIsCheckoutOpen(false)}>
                  Keep browsing
                </Button>
                <Button
                  type="button"
                  disabled={
                    isPurchasing ||
                    !isBuyerEmailValid ||
                    !Number.isSafeInteger(selectedQuantity) ||
                    selectedQuantity < 1 ||
                    selectedQuantity > listing.quantity
                  }
                  onClick={() => setCheckoutStep("confirm")}
                >
                  Continue to amount confirmation
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={isPurchasing} onClick={() => setCheckoutStep("review")}>
                  <ChevronLeft className="size-4" />Edit order
                </Button>
                <Button
                  type="button"
                  disabled={isPurchasing}
                  onClick={() => void completeCheckout()}
                >
                  <Check className="size-4" />
                  {isPurchasing ? "Placing order…" : `Confirm order · ${formatPrice(checkoutTotal)}`}
                </Button>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
