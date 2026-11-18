"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { ListingDetailsView } from "./ListingDetailsView";
import { MessageSellerDialog } from "./MessageSellerDialog";
import {
  getMarketplaceListingSnapshot,
  isOwnMarketplaceListing,
  getServerMarketplaceListingSnapshot,
  subscribeToMarketplaceListings,
} from "./marketplace-data";

type MarketplaceListingPageProps = {
  listingId: string;
};

export default function MarketplaceListingPage({ listingId }: MarketplaceListingPageProps) {
  const snapshot = useSyncExternalStore(
    subscribeToMarketplaceListings,
    () => getMarketplaceListingSnapshot(listingId),
    getServerMarketplaceListingSnapshot,
  );
  const { savedListingIds, toggleSavedListing } = useMarketplaceLayout();
  const [isMessageOpen, setIsMessageOpen] = useState(false);

  if (snapshot.status === "loading") {
    return <div className="h-full min-h-0 overflow-auto bg-background p-6" aria-busy="true"><Card className="h-[60vh] w-full animate-pulse rounded-sm border-border bg-card shadow-none" /></div>;
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

  const isOwnListing = isOwnMarketplaceListing(listing);

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-background px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <div className="w-full min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" className="gap-2 rounded-sm px-2 text-sm"><ArrowLeft className="size-4" />Back to Marketplace</Button>
        </div>
        <Card className="overflow-hidden rounded-sm border border-border bg-card p-0 shadow-sm ring-0">
          <ListingDetailsView
            listing={listing}
            photos={listing.photos}
            isSaved={!isOwnListing && savedListingIds.includes(listing.id)}
            onSave={isOwnListing ? undefined : () => toggleSavedListing(listing.id)}
            onMessage={isOwnListing ? undefined : () => setIsMessageOpen(true)}
            layoutClassName="grid min-h-[min(76dvh,56rem)] grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
            imageClassName="min-h-[min(52dvh,38rem)] md:min-h-[min(76dvh,56rem)]"
          />
        </Card>
      </div>

      {!isOwnListing && (
        <MessageSellerDialog
          listing={listing}
          open={isMessageOpen}
          onOpenChange={setIsMessageOpen}
          onSend={() => toast.info("Your message is ready. Seller messaging is not connected yet.")}
        />
      )}
    </main>
  );
}
