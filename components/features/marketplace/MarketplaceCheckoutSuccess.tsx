"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SupabaseImageWithFallback } from "@/components/shared/SupabaseImageWithFallback";
import { BadgeCheck, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CheckoutDetails = {
  paymentStatus: "pending" | "paid" | "failed" | "canceled" | "refunded";
  currency: string;
  order: {
    id: string;
    listingTitle: string;
    image: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    createdAt: string;
  };
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export function MarketplaceCheckoutSuccess({ sessionId }: { sessionId: string | null }) {
  const [details, setDetails] = useState<CheckoutDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!sessionId) return;

    const loadStatus = async () => {
      try {
        const response = await fetch(`/api/stripe/checkout-status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const result = (await response.json()) as CheckoutDetails | { error?: { message?: string } };
        if (!response.ok) throw new Error("error" in result ? result.error?.message ?? "Could not load the order confirmation." : "Could not load the order confirmation.");
        if (!active || !("order" in result)) return;
        setDetails(result);
        setError(null);
        setIsLoading(false);
        if (result.paymentStatus === "pending") {
          timeout = setTimeout(() => void loadStatus(), 2500);
        }
      } catch (statusError) {
        if (!active) return;
        setError(statusError instanceof Error ? statusError.message : "Could not load the order confirmation.");
        setIsLoading(false);
        // A temporary status API or network error should not leave this page
        // permanently stale. The next request starts only after this one ends.
        timeout = setTimeout(() => void loadStatus(), 5000);
      }
    };

    void loadStatus();
    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [sessionId]);

  const missingSession = !sessionId;
  const visibleError = missingSession ? "The Stripe Checkout session is missing from this link." : error;
  const isPaid = details?.paymentStatus === "paid";
  const isWaiting = !missingSession && (isLoading || details?.paymentStatus === "pending");

  return (
    <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-6 sm:px-6 sm:py-10">
      <Card className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isPaid ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : visibleError || details?.paymentStatus === "failed" || details?.paymentStatus === "canceled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {isPaid ? <BadgeCheck className="size-6" aria-hidden="true" /> : isWaiting ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : <CircleAlert className="size-6" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace order</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {isPaid ? "Payment confirmed" : visibleError ? "Confirmation unavailable" : details?.paymentStatus === "failed" ? "Payment not completed" : details?.paymentStatus === "canceled" ? "Checkout canceled" : "Confirming your payment"}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {isPaid
                ? "Stripe confirmed your payment and the marketplace saved your order."
                : visibleError
                  ? visibleError
                  : details?.paymentStatus === "failed" || details?.paymentStatus === "canceled"
                    ? "No paid order was recorded. You can return to the marketplace and try again."
                    : "Stripe returned you to Piecebook. We’ll show the order as confirmed after the signed payment webhook is processed."}
            </p>
          </div>
        </div>

        {details && (
          <section className="mt-6 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5" aria-label="Order details">
            <div className="flex items-start gap-3">
              {details.order.image && <SupabaseImageWithFallback src={details.order.image} alt="" width={64} height={64} referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-xl bg-muted object-cover" />}
              <div className="min-w-0 flex-1">
                <h2 className="wrap-break-word text-sm font-semibold">{details.order.listingTitle}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Order #{details.order.id.slice(0, 8).toUpperCase()}</p>
                <p className="mt-1 text-xs text-muted-foreground">{details.order.quantity} × {formatCurrency(details.order.unitPrice, details.currency)}</p>
              </div>
              <p className="shrink-0 text-sm font-bold">{formatCurrency(details.order.totalPrice, details.currency)}</p>
            </div>
            {details.paymentStatus === "pending" && <p role="status" className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">This page checks for the verified order confirmation automatically.</p>}
          </section>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="rounded-xl">Back to marketplace</Button>
          {isPaid && details && (
            <Button nativeButton={false} render={<Link href={`/marketplace/orders/${details.order.id}`} />} variant="outline" className="rounded-xl">View order</Button>
          )}
        </div>
      </Card>
    </main>
  );
}
