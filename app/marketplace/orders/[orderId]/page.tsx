import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceOrderPage from "@/components/features/marketplace/MarketplaceOrderPage";

export const metadata: Metadata = {
  title: "Marketplace order",
  description: "View the saved details for a Marketplace order.",
};

export default function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<main className="h-full min-h-0 bg-background p-6"><div className="mx-auto h-64 max-w-4xl animate-pulse rounded-sm border border-border bg-card" /></main>}>
      {params.then(({ orderId }) => <MarketplaceOrderPage orderId={orderId} />)}
    </Suspense>
  );
}
