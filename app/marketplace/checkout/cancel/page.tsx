import { MarketplaceCheckoutCancel } from "@/components/features/marketplace/MarketplaceCheckoutCancel";
import { Suspense } from "react";

export default function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string | string[]; cancel_token?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-6">Closing Stripe Checkout…</main>}>
      <CheckoutCancelContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutCancelContent({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string | string[]; cancel_token?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderId = Array.isArray(params.order_id) ? params.order_id[0] : params.order_id;
  const cancelToken = Array.isArray(params.cancel_token) ? params.cancel_token[0] : params.cancel_token;
  return <MarketplaceCheckoutCancel orderId={orderId ?? null} cancelToken={cancelToken ?? null} />;
}
