"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PayoutStatus = "not_connected" | "incomplete" | "pending" | "connected" | "unavailable";

type PayoutResponse = {
  status: PayoutStatus;
  paymentEligible?: boolean;
  url?: string | null;
  error?: { message?: string };
};

export function MarketplaceSellerPayoutCard({
  listingId,
  profileId,
}: {
  listingId?: string;
  profileId: string;
}) {
  const statusKey = `${listingId ?? "profile"}:${profileId}`;
  const [payoutState, setPayoutState] = useState<{
    key: string;
    status: PayoutStatus;
    error: string | null;
  }>({ key: "", status: "unavailable", error: null });
  const status = payoutState.key === statusKey ? payoutState.status : "loading";
  const error = payoutState.key === statusKey ? payoutState.error : null;
  const [isConnecting, setIsConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    const query = new URLSearchParams({ profileId });
    if (listingId) query.set("listingId", listingId);
    const response = await fetch(`/api/stripe/connect?${query.toString()}`, { cache: "no-store" });
    const result = (await response.json()) as PayoutResponse;
    if (!response.ok) throw new Error(result.error?.message ?? "Could not check Stripe payout status.");
    return result;
  }, [listingId, profileId]);

  const refreshStatus = async () => {
    try {
      const result = await loadStatus();
      setPayoutState({ key: statusKey, status: result.status, error: null });
    } catch (statusError) {
      setPayoutState({
        key: statusKey,
        status: "unavailable",
        error: statusError instanceof Error ? statusError.message : "Could not check Stripe payout status.",
      });
    }
  };

  useEffect(() => {
    let active = true;
    void loadStatus().then((result) => {
      if (active) setPayoutState({ key: statusKey, status: result.status, error: null });
    }).catch((statusError: unknown) => {
      if (active) {
        setPayoutState({
          key: statusKey,
          status: "unavailable",
          error: statusError instanceof Error ? statusError.message : "Could not check Stripe payout status.",
        });
      }
    });
    return () => { active = false; };
  }, [loadStatus, statusKey]);

  const connect = async () => {
    if (isConnecting || status === "connected") return;
    setIsConnecting(true);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(listingId ? { listingId } : {}), profileId }),
      });
      const result = (await response.json()) as PayoutResponse;
      if (!response.ok) throw new Error(result.error?.message ?? "Could not start Stripe onboarding.");
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setPayoutState({ key: statusKey, status: result.status, error: null });
    } catch (connectError) {
      setPayoutState({
        key: statusKey,
        status: status === "loading" ? "unavailable" : status,
        error: connectError instanceof Error ? connectError.message : "Could not start Stripe onboarding.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const statusCopy = {
    loading: "Checking your Stripe payout setup…",
    not_connected: "Connect a Stripe Express account to accept online payments.",
    incomplete: "Finish the Stripe onboarding steps to make this listing purchasable.",
    pending: "Stripe is reviewing your details. Buyers can pay once charges and payouts are enabled.",
    connected: "Connected. This listing can accept payments through Stripe Checkout.",
    unavailable: "Stripe payout status is unavailable right now.",
  } satisfies Record<PayoutStatus | "loading", string>;

  return (
    <Card className="mt-4 flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${status === "connected" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
          {status === "connected" ? <BadgeCheck className="size-5" aria-hidden="true" /> : status === "unavailable" ? <CircleAlert className="size-5" aria-hidden="true" /> : <RefreshCw className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Seller payouts</h2>
          <p className="mt-1 text-sm text-muted-foreground">{statusCopy[status]}</p>
          {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:justify-end">
        {status === "unavailable" && (
          <Button type="button" variant="outline" disabled={isConnecting} onClick={() => void refreshStatus()} className="h-10 rounded-xl">
            <RefreshCw className="size-4" />Retry
          </Button>
        )}
        <Button type="button" disabled={status === "loading" || status === "connected" || isConnecting} onClick={() => void connect()} className="h-10 rounded-xl font-semibold">
          {isConnecting || status === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {status === "connected" ? "Connected" : status === "not_connected" ? "Connect with Stripe" : "Continue with Stripe"}
        </Button>
      </div>
    </Card>
  );
}
