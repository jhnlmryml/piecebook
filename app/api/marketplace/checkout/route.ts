import { createHash, randomBytes } from "node:crypto";
import Stripe from "stripe";
import { checkoutRequestSchema } from "@/lib/form-schemas";
import { ApiError, apiErrorResponse, json, readJson } from "@/lib/server/api-utils";
import {
  getPublicAppUrl,
  getSellerStripeStatus,
  getStripeClient,
  getStripeImageUrls,
  getSupabaseAdminClient,
  normalizeSellerEmail,
  syncSellerStripeAccount,
  toSellerStripeAccountSnapshot,
} from "@/lib/server/stripe-marketplace";

type CheckoutRequest = ReturnType<typeof checkoutRequestSchema.parse>;

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

export async function POST(request: Request) {
  let orderId: string | null = null;
  let checkoutSession: Stripe.Checkout.Session | null = null;
  let connectedAccountId: string | null = null;
  let supabase: ReturnType<typeof getSupabaseAdminClient> | null = null;

  try {
    supabase = getSupabaseAdminClient();
    const input: CheckoutRequest = await readJson(request, checkoutRequestSchema);
    const baseUrl = getPublicAppUrl(request);
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listing")
      .select("id,seller_id,seller_email,title,description,photos,price,quantity,status")
      .eq("id", input.listingId)
      .maybeSingle();
    if (listingError) throw new ApiError(500, "DATABASE_ERROR", "Could not load this listing.");
    if (!listing || listing.status !== "available" || listing.quantity < input.quantity) {
      throw new ApiError(409, "LISTING_UNAVAILABLE", "This listing is no longer available.");
    }
    if (listing.seller_id === input.buyerId) {
      throw new ApiError(409, "OWN_LISTING", "You cannot buy your own listing.");
    }
    if (Number(listing.price) <= 0) {
      throw new ApiError(409, "INVALID_PRICE", "This listing cannot be purchased online.");
    }

    const sellerEmail = normalizeSellerEmail(listing.seller_email);
    if (!sellerEmail) {
      throw new ApiError(409, "SELLER_NOT_CONNECTED", "This seller has not set up Stripe payouts yet.");
    }
    const { data: connectedSeller, error: accountError } = await supabase
      .from("marketplace_seller_stripe_accounts")
      .select("seller_email,stripe_account_id")
      .eq("seller_id", listing.seller_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (accountError) throw new ApiError(500, "DATABASE_ERROR", "Could not verify seller payouts.");
    if (!connectedSeller) {
      throw new ApiError(409, "SELLER_NOT_CONNECTED", "This seller has not set up Stripe payouts yet.");
    }

    const stripe = getStripeClient();
    const stripeAccount = await stripe.v2.core.accounts.retrieve(connectedSeller.stripe_account_id, {
      include: ["configuration.merchant", "requirements"],
    });
    const accountSnapshot = toSellerStripeAccountSnapshot(stripeAccount);
    const sellerStatus = getSellerStripeStatus(accountSnapshot);
    await syncSellerStripeAccount(connectedSeller.seller_email, listing.seller_id, accountSnapshot);
    if (sellerStatus !== "connected") {
      throw new ApiError(409, "SELLER_NOT_READY", "This seller is still completing Stripe onboarding.");
    }

    const cancelToken = randomBytes(32).toString("hex");
    const cancelTokenHash = createHash("sha256").update(cancelToken).digest("hex");
    const { data: order, error: orderError } = await supabase.rpc(
      "create_marketplace_payment_order",
      {
        requested_listing_id: input.listingId,
        requested_buyer_id: input.buyerId,
        requested_quantity: input.quantity,
        requested_stripe_account_id: accountSnapshot.id,
        requested_cancel_token_hash: cancelTokenHash,
      },
    );
    if (orderError) {
      if (orderError.code === "P0001" || orderError.code === "23505") {
        throw new ApiError(409, "CHECKOUT_CONFLICT", orderError.message);
      }
      console.error("Could not reserve a marketplace listing for checkout:", orderError.code ?? "UNKNOWN");
      throw new ApiError(500, "CHECKOUT_FAILED", "Could not start checkout right now.");
    }
    if (!order) throw new ApiError(500, "CHECKOUT_FAILED", "Checkout did not create an order.");
    orderId = order.id;
    connectedAccountId = accountSnapshot.id;

    const { data: payment, error: paymentError } = await supabase
      .from("marketplace_order_payments")
      .select("item_price,platform_fee_amount,seller_net_amount,currency,stripe_account_id")
      .eq("marketplace_order_id", order.id)
      .single();
    if (paymentError || !payment) {
      throw new ApiError(500, "CHECKOUT_FAILED", "Could not load the reserved order.");
    }
    const priceInCents = Math.round(Number(order.unit_price) * 100);
    const platformFeeInCents = Math.round(Number(payment.platform_fee_amount) * 100);
    if (!Number.isSafeInteger(priceInCents) || priceInCents <= 0 || !Number.isSafeInteger(platformFeeInCents)) {
      throw new ApiError(409, "INVALID_PRICE", "This listing has an invalid price.");
    }

    const checkoutExpiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      ...(input.buyerEmail ? { customer_email: input.buyerEmail } : {}),
      line_items: [{
        quantity: order.quantity,
        price_data: {
          currency: payment.currency,
          unit_amount: priceInCents,
          product_data: {
            name: order.listing_title,
            description: order.listing_description.slice(0, 500) || undefined,
            images: getStripeImageUrls(order.listing_photos),
          },
        },
      }],
      payment_intent_data: {
        application_fee_amount: platformFeeInCents,
        metadata: {
          piecebook_order_id: order.id,
          piecebook_listing_id: order.source_listing_id,
        },
      },
      metadata: {
        piecebook_order_id: order.id,
        piecebook_listing_id: order.source_listing_id,
      },
      expires_at: checkoutExpiresAt,
      success_url: `${baseUrl}/marketplace/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/marketplace/checkout/cancel?order_id=${encodeURIComponent(order.id)}&cancel_token=${encodeURIComponent(cancelToken)}`,
    }, {
      stripeAccount: payment.stripe_account_id,
      idempotencyKey: `piecebook-marketplace-order-${order.id}`,
    });

    if (!checkoutSession.url) {
      throw new ApiError(502, "STRIPE_CHECKOUT_FAILED", "Stripe did not return a Checkout URL.");
    }
    const { error: updateError } = await supabase
      .from("marketplace_order_payments")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        checkout_cancel_token_hash: cancelTokenHash,
        updated_at: new Date().toISOString(),
      })
      .eq("marketplace_order_id", order.id)
      .eq("payment_status", "pending");
    if (updateError) throw new ApiError(500, "CHECKOUT_FAILED", "Could not prepare the Stripe Checkout session.");

    return json({ checkoutUrl: checkoutSession.url }, 201);
  } catch (error) {
    if (orderId) {
      if (checkoutSession?.status === "open" && connectedAccountId) {
        try {
          await getStripeClient().checkout.sessions.expire(
            checkoutSession.id,
            {},
            { stripeAccount: connectedAccountId },
          );
        } catch {
          console.error("Could not expire an incomplete Stripe Checkout session.");
        }
      }
      await supabase?.rpc("abandon_marketplace_stripe_order", { requested_order_id: orderId });
    }
    if (isStripeError(error)) {
      console.error("Stripe Checkout creation failed:", error.type, error.code ?? "unknown", error.requestId ?? "no-request-id");
      return json({ error: { code: "STRIPE_CHECKOUT_FAILED", message: "Could not start secure checkout. Please try again." } }, 502);
    }
    return apiErrorResponse(error);
  }
}
