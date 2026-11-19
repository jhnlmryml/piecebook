"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/context/ProfileContext";
import { useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { ListingDetailsView } from "./ListingDetailsView";
import { MessageSellerDialog } from "./MessageSellerDialog";
import { MarketplaceListingEngagement } from "./MarketplaceListingEngagement";
import { ListingCard } from "./ListingCard";
import {
  getMarketplaceListingSnapshot,
  isOwnMarketplaceListing,
  getServerMarketplaceListingSnapshot,
  getMarketplaceListingsSnapshot,
  getServerMarketplaceListingsSnapshot,
  refreshMarketplaceListings,
  sendMarketplaceMessage,
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
  const { currentUser, isLoading: isUserLoading } = useProfile();
  const [isMessageOpen, setIsMessageOpen] = useState(false);

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
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="mt-5 rounded-sm"><ArrowLeft className="size-4" />Back to Marketplace</Button>
        </div>
      </main>
    );
  }

  const isOwnListing = isOwnMarketplaceListing(listing, currentUser?.id);
  const canUseSellerActions = !isUserLoading && Boolean(currentUser) && !isOwnListing;
  const canMessageSeller = canUseSellerActions && Boolean(currentUser && listing.sellerId);
  const canViewMessages = !isUserLoading && Boolean(currentUser) && isOwnListing;
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
          <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" className="gap-2 rounded-sm px-2 text-sm"><ArrowLeft className="size-4" />Back to Marketplace</Button>
        </div>
        <Card className="overflow-hidden rounded-sm border border-border bg-card p-0 shadow-sm ring-0">
          <ListingDetailsView
            listing={listing}
            photos={listing.photos}
            isSaved={canUseSellerActions && savedListingIds.includes(listing.id)}
            onSave={canUseSellerActions ? () => toggleSavedListing(listing.id) : undefined}
            onMessage={canMessageSeller ? () => setIsMessageOpen(true) : undefined}
            onViewMessages={canViewMessages ? () => setIsMessageOpen(true) : undefined}
            layoutClassName="grid min-h-0 grid-cols-1 md:h-[min(64dvh,42rem)] md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
            imageClassName="min-h-[min(38dvh,22rem)] md:min-h-0"
          />
        </Card>
        <MarketplaceListingEngagement listingId={listing.id} />

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

      {(canMessageSeller || canViewMessages) && currentUser && (
        <MessageSellerDialog
          listing={listing}
          open={isMessageOpen}
          onOpenChange={setIsMessageOpen}
          canSend={canMessageSeller}
          onSend={async (message) => {
            if (!canMessageSeller) throw new Error("You cannot message your own listing.");
            await sendMarketplaceMessage({ listing, senderId: currentUser.id, body: message });
            toast.success("Message sent to the seller.");
          }}
        />
      )}
    </main>
  );
}
