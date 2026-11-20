import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceSoldItemPage from "@/components/features/marketplace/MarketplaceSoldItemPage";

export const metadata: Metadata = {
  title: "Sold marketplace item",
  description: "View the saved details and public engagement for a sold Marketplace item.",
};

export default function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<main className="h-full min-h-0 bg-background p-6"><div className="mx-auto h-64 max-w-4xl animate-pulse rounded-sm border border-border bg-card" /></main>}>
      {params.then(({ orderId }) => <MarketplaceSoldItemPage orderId={orderId} />)}
    </Suspense>
  );
}
