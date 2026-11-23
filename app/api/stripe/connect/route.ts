import Stripe from "stripe";
import { connection } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, json, readJson, requireUuid } from "@/lib/server/api-utils";
import {
  getPublicAppUrl,
  getSellerStripeAccountState,
  getSellerStripeStatus,
  getStripeClient,
  getStripeConnectCountry,
  getSupabaseAdminClient,
  syncSellerStripeAccount,
  toSellerStripeAccountSnapshot,
} from "@/lib/server/stripe-marketplace";

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

const connectRequestSchema = z.object({
  profileId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
});

async function resolveSeller(profileId: string, listingId?: string) {
  let fallbackEmail: string | null = null;
  if (listingId) {
    const { data: listing, error } = await getSupabaseAdminClient()
      .from("marketplace_listing")
      .select("id,seller_id,seller_email")
      .eq("id", listingId)
      .maybeSingle();
    if (error) throw new ApiError(500, "DATABASE_ERROR", "Could not load the seller listing.");
    if (!listing || listing.seller_id !== profileId) {
      throw new ApiError(404, "LISTING_NOT_FOUND", "The listing could not be found.");
    }
    fallbackEmail = listing.seller_email;
  }

  const seller = await getSellerStripeAccountState(profileId, fallbackEmail);
  if (!seller.profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "The seller profile could not be found.");
  return seller;
}

export async function GET(request: Request) {
  await connection();
  try {
    const url = new URL(request.url);
    const profileId = requireUuid(url.searchParams.get("profileId"), "profileId");
    const listingIdValue = url.searchParams.get("listingId");
    const listingId = listingIdValue ? requireUuid(listingIdValue, "listingId") : undefined;
    const seller = await resolveSeller(profileId, listingId);
    return json({
      status: seller.status,
      paymentEligible: seller.paymentEligible,
      detailsSubmitted: seller.detailsSubmitted,
      chargesEnabled: seller.chargesEnabled,
      payoutsEnabled: seller.payoutsEnabled,
    });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("Could not verify the connected seller account:", error.type, error.code ?? "unknown", error.statusCode ?? "no-status", error.requestId ?? "no-request-id");
      return json({ error: { code: "STRIPE_STATUS_UNAVAILABLE", message: "Seller payout status is temporarily unavailable." } }, 503);
    }
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await readJson(request, connectRequestSchema);
    const seller = await resolveSeller(input.profileId, input.listingId);
    const sellerEmail = seller.sellerEmail;
    if (!sellerEmail) {
      throw new ApiError(409, "SELLER_EMAIL_REQUIRED", "Add an email address to the seller profile before connecting payouts.");
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: lookupError } = await supabase
      .from("marketplace_seller_stripe_accounts")
      .select("stripe_account_id")
      .eq("seller_id", input.profileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new ApiError(500, "DATABASE_ERROR", "Could not load the seller payout account.");

    const stripe = getStripeClient();
    const account = existing
      ? await stripe.v2.core.accounts.retrieve(existing.stripe_account_id, {
          include: ["configuration.merchant", "requirements"],
        })
      : await stripe.v2.core.accounts.create({
          contact_email: sellerEmail,
          display_name: seller.profile.full_name || sellerEmail,
          dashboard: "express",
          identity: {
            country: getStripeConnectCountry().toLowerCase(),
            entity_type: "individual",
          },
          configuration: {
            merchant: {
              capabilities: { card_payments: { requested: true } },
            },
          },
          defaults: {
            currency: "usd",
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          metadata: {
            piecebook_seller_email: sellerEmail,
            piecebook_seller_id: input.profileId,
          },
          include: ["configuration.merchant", "identity", "requirements"],
        }, { idempotencyKey: `piecebook-connect-v2-${input.profileId}` });

    const accountSnapshot = toSellerStripeAccountSnapshot(account);
    const status = getSellerStripeStatus(accountSnapshot);
    await syncSellerStripeAccount(sellerEmail, input.profileId, accountSnapshot);
    if (status === "connected") return json({ status, url: null });

    const baseUrl = getPublicAppUrl(request);
    const returnBase = input.listingId
      ? `${baseUrl}/marketplace/${encodeURIComponent(input.listingId)}`
      : `${baseUrl}/marketplace?seller_dashboard=1&section=payments`;
    const returnSeparator = returnBase.includes("?") ? "&" : "?";
    const link = await stripe.v2.core.accountLinks.create({
      account: accountSnapshot.id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          collection_options: { fields: "eventually_due" },
          return_url: `${returnBase}${returnSeparator}stripe_connect=return`,
          refresh_url: `${returnBase}${returnSeparator}stripe_connect=refresh`,
        },
      },
    });
    return json({ status, url: link.url }, 201);
  } catch (error) {
    if (isStripeError(error)) {
      console.error("Stripe Connect onboarding failed:", error.type, error.code ?? "unknown", error.param ?? "no-param", error.statusCode ?? "no-status", error.requestId ?? "no-request-id");
      const message = error.code === "account_creation_losses_collector_unavailable"
        ? "Stripe has not enabled this platform to take responsibility for Express account losses. Complete Connect platform activation in the Stripe Dashboard, then retry."
        : error.code === "connect_profile_not_submitted" || error.code === "connect_identity_not_verified"
          ? "Complete your platform profile and verification in Stripe Dashboard before creating connected accounts."
          : "Could not start Stripe onboarding. Please try again.";
      const debugDetails = process.env.NODE_ENV === "production" ? {} : {
        stripeCode: error.code ?? null,
        parameter: error.param ?? null,
        requestId: error.requestId ?? null,
        statusCode: error.statusCode ?? null,
      };
      return json({ error: { code: "STRIPE_CONNECT_FAILED", message, ...debugDetails } }, 502);
    }
    return apiErrorResponse(error);
  }
}
