import { MarketplaceCheckoutSuccess } from "@/components/features/marketplace/MarketplaceCheckoutSuccess";
import { Suspense } from "react";

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-6">Loading order confirmation…</main>}>
      <CheckoutSuccessContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutSuccessContent({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const { session_id: sessionId } = await searchParams;
  return <MarketplaceCheckoutSuccess sessionId={Array.isArray(sessionId) ? sessionId[0] ?? null : sessionId ?? null} />;
}
