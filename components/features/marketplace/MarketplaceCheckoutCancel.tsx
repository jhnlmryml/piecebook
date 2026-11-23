"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CancelState = "processing" | "canceled" | "pending" | "paid" | "error";

export function MarketplaceCheckoutCancel({
  orderId,
  cancelToken,
}: {
  orderId: string | null;
  cancelToken: string | null;
}) {
  const [state, setState] = useState<CancelState>("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!orderId || !cancelToken) return;
    void fetch("/api/stripe/cancel-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, cancelToken }),
    }).then(async (response) => {
      const result = (await response.json()) as { paymentStatus?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Could not cancel this Checkout session.");
      if (!active) return;
      setState(result.paymentStatus === "paid" ? "paid" : result.paymentStatus === "pending" ? "pending" : "canceled");
    }).catch((cancelError: unknown) => {
      if (!active) return;
      setState("error");
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel this Checkout session.");
    });
    return () => { active = false; };
  }, [cancelToken, orderId]);

  const missingToken = !orderId || !cancelToken;
  const visibleState: CancelState = missingToken ? "error" : state;
  const visibleError = missingToken ? "The checkout cancellation link is incomplete." : error;
  const isProcessing = visibleState === "processing";
  const heading = visibleState === "canceled"
    ? "Checkout canceled"
    : visibleState === "paid"
      ? "Payment received"
      : visibleState === "pending"
        ? "Payment is being confirmed"
        : visibleState === "error"
          ? "Checkout could not be canceled"
          : "Canceling checkout";
  const description = visibleState === "canceled"
    ? "No paid order was recorded. The listing is available again, and you can return to the marketplace whenever you’re ready."
    : visibleState === "paid"
      ? "Stripe already completed this Checkout session. The order will appear after its verified payment event is processed."
      : visibleState === "pending"
        ? "This Checkout session has completed. Piecebook is waiting for Stripe’s verified payment confirmation."
        : visibleError ?? "We’re closing the Stripe Checkout session and releasing the listing reservation.";

  return (
    <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-6 sm:px-6 sm:py-10">
      <Card className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${visibleState === "canceled" ? "bg-muted text-muted-foreground" : visibleState === "paid" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
            {isProcessing ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : <CircleAlert className="size-6" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace checkout</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{heading}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-6">
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="rounded-xl">Back to marketplace</Button>
        </div>
      </Card>
    </main>
  );
}
