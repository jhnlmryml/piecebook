import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceSoldItemPage from "@/components/features/marketplace/MarketplaceSoldItemPage";
import { MarketplaceDetailSkeleton } from "@/components/shared/LoadingSkeletons";

export const metadata: Metadata = {
  title: "Sold marketplace item",
  description: "View the saved details and public engagement for a sold Marketplace item.",
};

export default function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto w-full max-w-7xl"><MarketplaceDetailSkeleton /></div></main>}>
      {params.then(({ orderId }) => <MarketplaceSoldItemPage orderId={orderId} />)}
    </Suspense>
  );
}
