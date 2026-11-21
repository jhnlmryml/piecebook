import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceListingPage from "@/components/features/marketplace/MarketplaceListingPage";
import { MarketplaceDetailSkeleton } from "@/components/shared/LoadingSkeletons";

export const metadata: Metadata = {
  title: "Marketplace listing",
  description: "View photos and full details for a Marketplace listing.",
};

export default function Page({ params }: { params: Promise<{ listingId: string }> }) {
  return (
    <Suspense fallback={<main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto w-full max-w-7xl"><MarketplaceDetailSkeleton /></div></main>}>
      {params.then(({ listingId }) => <MarketplaceListingPage listingId={listingId} />)}
    </Suspense>
  );
}
