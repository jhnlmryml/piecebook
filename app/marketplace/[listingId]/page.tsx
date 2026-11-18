import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceListingPage from "@/components/features/marketplace/MarketplaceListingPage";

export const metadata: Metadata = {
  title: "Marketplace listing",
  description: "View photos and full details for a Marketplace listing.",
};

export default function Page({ params }: { params: Promise<{ listingId: string }> }) {
  return (
    <Suspense fallback={<main className="h-full min-h-0 bg-background p-6"><div className="mx-auto h-[60vh] max-w-6xl animate-pulse rounded-sm border border-border bg-card" /></main>}>
      {params.then(({ listingId }) => <MarketplaceListingPage listingId={listingId} />)}
    </Suspense>
  );
}
