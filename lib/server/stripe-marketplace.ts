import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database, Json, Tables } from "@/types/supabase";

let stripeClient: Stripe | undefined;
let supabaseAdminClient: SupabaseClient<Database> | undefined;

export type SellerStripeStatus = "not_connected" | "incomplete" | "pending" | "connected" | "unavailable";
export type SellerStripeAccount = Tables<"marketplace_seller_stripe_accounts">;
type SellerStripeAccountLookup = Pick<SellerStripeAccount, "seller_email" | "stripe_account_id">;
export type SellerStripeProfile = Pick<
  Tables<"users">,
  "id" | "email" | "full_name" | "role" | "location" | "created_at"
>;
export type SellerStripeAccountSnapshot = {
  id: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  capabilities: Json;
};

export function getStripeClient() {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getSupabaseAdminClient() {
  if (supabaseAdminClient) return supabaseAdminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Server-side Supabase access is not configured.");
  }
  supabaseAdminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return supabaseAdminClient;
}

export function normalizeSellerEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function toSellerStripeAccountSnapshot(account: Stripe.V2.Core.Account): SellerStripeAccountSnapshot {
  const merchant = account.configuration?.merchant;
  const cardPaymentsStatus = merchant?.capabilities?.card_payments?.status;
  const payoutsStatus = merchant?.capabilities?.stripe_balance?.payouts?.status;
  const requirements = account.requirements?.entries;
  const detailsSubmitted = Boolean(requirements && !requirements.some((entry) => entry.awaiting_action_from === "user"));

  return {
    id: account.id,
    detailsSubmitted,
    chargesEnabled: cardPaymentsStatus === "active",
    payoutsEnabled: payoutsStatus === "active",
    capabilities: {
      card_payments: cardPaymentsStatus ?? "pending",
      stripe_balance: { payouts: payoutsStatus ?? "pending" },
    },
  };
}

export function getSellerStripeStatus(account: SellerStripeAccountSnapshot): SellerStripeStatus {
  if (!account.detailsSubmitted) return "incomplete";
  if (account.chargesEnabled && account.payoutsEnabled) {
    return "connected";
  }
  return "pending";
}

export async function syncSellerStripeAccount(
  sellerEmail: string,
  sellerId: string,
  stripeAccount: SellerStripeAccountSnapshot,
  knownAccount?: SellerStripeAccountLookup,
) {
  const supabase = getSupabaseAdminClient();
  const status = getSellerStripeStatus(stripeAccount);
  let existing: SellerStripeAccountLookup | null | undefined = knownAccount;
  if (!existing) {
    const { data, error } = await supabase
      .from("marketplace_seller_stripe_accounts")
      .select("seller_email,stripe_account_id")
      .eq("seller_id", sellerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not load the seller's Stripe account (${error.code ?? "unknown"}).`);
    existing = data;
  }

  const accountValues = {
    seller_email: existing?.seller_email ?? sellerEmail,
    seller_id: sellerId,
    stripe_account_id: stripeAccount.id,
    onboarding_status: status,
    details_submitted: stripeAccount.detailsSubmitted,
    charges_enabled: stripeAccount.chargesEnabled,
    payouts_enabled: stripeAccount.payoutsEnabled,
    capabilities: stripeAccount.capabilities,
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? supabase
      .from("marketplace_seller_stripe_accounts")
      .update(accountValues)
      .eq("seller_id", sellerId)
      .eq("stripe_account_id", existing.stripe_account_id)
    : supabase
      .from("marketplace_seller_stripe_accounts")
      .insert(accountValues);
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(`Could not save the seller's Stripe account state (${error.code ?? "unknown"}).`);
  return data;
}

export async function getSellerStripeAccountState(profileId: string, fallbackEmail?: string | null) {
  const supabase = getSupabaseAdminClient();
  const [profileResult, accountResult] = await Promise.all([
    supabase
      .from("users")
      .select("id,email,full_name,role,location,created_at")
      .eq("id", profileId)
      .maybeSingle(),
    supabase
      .from("marketplace_seller_stripe_accounts")
      .select("seller_email,stripe_account_id")
      .eq("seller_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: profile, error: profileError } = profileResult;
  if (profileError) throw new Error(`Could not load seller profile (${profileError.code ?? "unknown"}).`);
  if (!profile) {
    return {
      profile: null,
      sellerEmail: null,
      status: "unavailable" as const,
      paymentEligible: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  const { data: storedAccount, error: accountError } = accountResult;
  if (accountError) throw new Error(`Could not load seller Stripe account (${accountError.code ?? "unknown"}).`);

  const sellerEmail = normalizeSellerEmail(profile.email)
    ?? normalizeSellerEmail(storedAccount?.seller_email)
    ?? normalizeSellerEmail(fallbackEmail);
  if (!sellerEmail) {
    return {
      profile,
      sellerEmail: null,
      status: "unavailable" as const,
      paymentEligible: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }
  if (!storedAccount) {
    return {
      profile,
      sellerEmail,
      status: "not_connected" as const,
      paymentEligible: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  const stripeAccount = await getStripeClient().v2.core.accounts.retrieve(storedAccount.stripe_account_id, {
    include: ["configuration.merchant", "requirements"],
  });
  const snapshot = toSellerStripeAccountSnapshot(stripeAccount);
  const status = getSellerStripeStatus(snapshot);
  await syncSellerStripeAccount(sellerEmail, profileId, snapshot, storedAccount);
  return {
    profile,
    sellerEmail,
    status,
    paymentEligible: status === "connected",
    detailsSubmitted: snapshot.detailsSubmitted,
    chargesEnabled: snapshot.chargesEnabled,
    payoutsEnabled: snapshot.payoutsEnabled,
  };
}

export function getPublicAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    let parsed: URL;
    try {
      parsed = new URL(configuredUrl);
    } catch {
      throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
    }
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) {
      throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
    }
    return parsed.origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the deployed site URL.");
  }
  return new URL(request.url).origin;
}

export function getStripeConnectCountry() {
  const country = (process.env.STRIPE_CONNECT_ACCOUNT_COUNTRY ?? "US").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("STRIPE_CONNECT_ACCOUNT_COUNTRY must be a two-letter country code.");
  }
  return country;
}

export function getStripeImageUrls(photos: string[]) {
  return photos.flatMap((photo) => {
    try {
      const url = new URL(photo);
      return url.protocol === "https:" ? [url.toString()] : [];
    } catch {
      return [];
    }
  }).slice(0, 8);
}

