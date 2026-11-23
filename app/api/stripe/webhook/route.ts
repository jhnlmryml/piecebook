import Stripe from "stripe";
import { z } from "zod";
import { sendMarketplaceOrderEmails } from "@/lib/server/marketplace-order-email";
import { getStripeClient, getSupabaseAdminClient, syncSellerStripeAccount, toSellerStripeAccountSnapshot } from "@/lib/server/stripe-marketplace";

const orderIdSchema = z.string().uuid();

function accepted(message = "Received") {
  return new Response(message, { status: 200 });
}

async function syncConnectedAccount(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: seller, error } = await supabase
    .from("marketplace_seller_stripe_accounts")
    .select("seller_email,seller_id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(`Could not locate a connected seller account (${error.code ?? "unknown"}).`);
  if (!seller) return;

  const account = await getStripeClient().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });
  const saved = await syncSellerStripeAccount(
    seller.seller_email,
    seller.seller_id,
    toSellerStripeAccountSnapshot(account),
  );
  console.info("Synchronized marketplace seller Stripe status:", saved.onboarding_status);
}

async function loadMarketplacePayment(session: Stripe.Checkout.Session, accountId: string) {
  const orderId = orderIdSchema.safeParse(session.metadata?.piecebook_order_id);
  if (!orderId.success) return null;

  const { data: payment, error } = await getSupabaseAdminClient()
    .from("marketplace_order_payments")
    .select("marketplace_order_id,listing_id,stripe_account_id,stripe_checkout_session_id,item_price,platform_fee_amount,seller_net_amount,currency,payment_status,seller_email,buyer_email")
    .eq("marketplace_order_id", orderId.data)
    .maybeSingle();
  if (error) throw new Error(`Could not load marketplace payment details (${error.code ?? "unknown"}).`);
  if (!payment || payment.stripe_account_id !== accountId) {
    return null;
  }
  if (!payment.stripe_checkout_session_id) {
    // Stripe can deliver the event immediately after Session creation, before
    // the checkout request has persisted the Session ID. Do not acknowledge it;
    // a retry after the update can then safely finalize the order.
    throw new Error("Checkout Session ID has not been saved for this order yet.");
  }
  if (payment.stripe_checkout_session_id !== session.id) return null;
  return payment;
}

async function processPaidCheckout(event: Stripe.Event, eventSession: Stripe.Checkout.Session) {
  const accountId = event.account;
  if (!accountId) {
    console.warn(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, result: "ignored", reason: "missing_connected_account" }));
    return accepted("Ignored platform event without a connected account.");
  }

  const payment = await loadMarketplacePayment(eventSession, accountId);
  if (!payment) {
    console.info(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, connectedAccountId: accountId, result: "ignored", reason: "missing_order_metadata_or_unmatched_session" }));
    return accepted("Ignored unrelated or unmatched Checkout Session.");
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {}, { stripeAccount: accountId });
  if (session.status !== "complete" || session.payment_status !== "paid") {
    console.info(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, connectedAccountId: accountId, result: "awaiting_payment", sessionStatus: session.status, paymentStatus: session.payment_status }));
    return accepted("Checkout is not paid yet.");
  }
  const orderId = payment.marketplace_order_id;
  const totalInCents = Math.round(Number(payment.item_price) * 100);
  const feeInCents = Math.round(Number(payment.platform_fee_amount) * 100);
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  if (session.amount_total !== totalInCents || session.currency !== payment.currency || !paymentIntentId) {
    throw new Error("Stripe Checkout amount or currency does not match the marketplace order.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, { stripeAccount: accountId });
  if (paymentIntent.status !== "succeeded"
    || paymentIntent.amount !== totalInCents
    || paymentIntent.application_fee_amount !== feeInCents
    || paymentIntent.currency !== payment.currency
    || paymentIntent.metadata.piecebook_order_id !== orderId) {
    throw new Error("Stripe PaymentIntent does not match the marketplace order.");
  }

  const { data: finalized, error: finalizeError } = await getSupabaseAdminClient().rpc(
    "complete_marketplace_stripe_order",
    {
      requested_event_id: event.id,
      requested_event_type: event.type,
      requested_order_id: orderId,
      requested_session_id: session.id,
      requested_account_id: accountId,
      requested_payment_intent_id: paymentIntentId,
      requested_buyer_email: session.customer_details?.email ?? session.customer_email ?? null,
    },
  );
  if (finalizeError) throw new Error(`Could not finalize the marketplace order (${finalizeError.code ?? "unknown"}).`);
  if (!finalized) return accepted("Checkout event was already processed.");

  const supabase = getSupabaseAdminClient();
  const [orderResult, paymentResult] = await Promise.all([
    supabase.from("marketplace_orders")
      .select("id,buyer_name,seller_name,listing_title,quantity,total_price")
      .eq("id", orderId)
      .single(),
    supabase.from("marketplace_order_payments")
      .select("buyer_email,seller_email,currency")
      .eq("marketplace_order_id", orderId)
      .single(),
  ]);
  if (orderResult.error || paymentResult.error) {
    console.error("Paid marketplace order was saved, but receipt details could not be loaded.");
  } else {
    await sendMarketplaceOrderEmails(
      orderResult.data,
      paymentResult.data.buyer_email,
      paymentResult.data.seller_email,
      paymentResult.data.currency,
    );
  }
  return accepted();
}

async function processExpiredCheckout(event: Stripe.Event, eventSession: Stripe.Checkout.Session) {
  const accountId = event.account;
  if (!accountId) return accepted("Ignored platform event without a connected account.");
  const payment = await loadMarketplacePayment(eventSession, accountId);
  if (!payment) return accepted("Ignored unrelated or unmatched Checkout Session.");

  const { error } = await getSupabaseAdminClient().rpc("expire_marketplace_stripe_order", {
    requested_event_id: event.id,
    requested_event_type: event.type,
    requested_order_id: payment.marketplace_order_id,
    requested_session_id: eventSession.id,
    requested_account_id: accountId,
  });
  if (error) throw new Error(`Could not release the marketplace listing reservation (${error.code ?? "unknown"}).`);
  return accepted();
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("Stripe webhook is not configured: STRIPE_WEBHOOK_SECRET is missing.");
    return new Response("Webhook is not configured.", { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.warn(JSON.stringify({ scope: "stripe_webhook", result: "rejected", reason: "missing_signature" }));
    return new Response("Missing Stripe signature.", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.warn(JSON.stringify({
      scope: "stripe_webhook",
      result: "rejected",
      reason: "signature_or_payload_invalid",
      errorType: error instanceof Error ? error.name : "unknown",
    }));
    return new Response("Invalid webhook signature.", { status: 400 });
  }

  const eventAccountId = event.account ?? null;
  console.info(JSON.stringify({
    scope: "stripe_webhook",
    result: "received",
    eventId: event.id,
    eventType: event.type,
    connectedAccountId: eventAccountId,
    apiVersion: event.api_version,
  }));
  try {
    if (event.type === "account.updated") {
      if (!eventAccountId) {
        console.warn(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, result: "ignored", reason: "missing_connected_account" }));
        return accepted("Ignored account.updated event without a connected account.");
      }
      await syncConnectedAccount(eventAccountId);
      console.info(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, connectedAccountId: eventAccountId, result: "account_synchronized" }));
      return accepted();
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const response = await processPaidCheckout(event, event.data.object as Stripe.Checkout.Session);
      console.info(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, connectedAccountId: eventAccountId, result: "checkout_processed", httpStatus: response.status }));
      return response;
    }
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const response = await processExpiredCheckout(event, event.data.object as Stripe.Checkout.Session);
      console.info(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, connectedAccountId: eventAccountId, result: "checkout_expiration_processed", httpStatus: response.status }));
      return response;
    }
    console.info(JSON.stringify({ scope: "stripe_webhook", eventId: event.id, eventType: event.type, connectedAccountId: eventAccountId, result: "ignored", reason: "unsupported_event" }));
    return accepted("Ignored unrelated Stripe event.");
  } catch (error) {
    console.error(JSON.stringify({
      scope: "stripe_webhook",
      eventId: event.id,
      eventType: event.type,
      connectedAccountId: eventAccountId,
      result: "failed",
      error: error instanceof Error ? error.message : "unknown error",
    }));
    return new Response("Webhook processing failed.", { status: 500 });
  }
}
