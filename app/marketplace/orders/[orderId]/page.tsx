import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceOrderPage from "@/components/features/marketplace/MarketplaceOrderPage";
import { MarketplaceOrderSkeleton } from "@/components/shared/LoadingSkeletons";

export const metadata: Metadata = {
  title: "Marketplace order",
  description: "View the saved details for a Marketplace order.",
};

export default function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"><MarketplaceOrderSkeleton /></main>}>
      {params.then(({ orderId }) => <MarketplaceOrderPage orderId={orderId} />)}
    </Suspense>
  );
}
