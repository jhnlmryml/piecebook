import { createHash, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import { ApiError, apiErrorResponse, json, readJson } from "@/lib/server/api-utils";
import { getStripeClient, getSupabaseAdminClient } from "@/lib/server/stripe-marketplace";

const cancelRequestSchema = z.object({
  orderId: z.string().uuid(),
  cancelToken: z.string().regex(/^[a-f0-9]{64}$/i),
});

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

export async function POST(request: Request) {
  try {
    const { orderId, cancelToken } = await readJson(request, cancelRequestSchema);
    const supabase = getSupabaseAdminClient();
    const { data: payment, error } = await supabase
      .from("marketplace_order_payments")
      .select("stripe_checkout_session_id,stripe_account_id,payment_status,checkout_cancel_token_hash")
      .eq("marketplace_order_id", orderId)
      .maybeSingle();
    if (error) throw new ApiError(500, "DATABASE_ERROR", "Could not load this checkout.");
    if (!payment || !payment.checkout_cancel_token_hash || !payment.stripe_checkout_session_id) {
      throw new ApiError(404, "CHECKOUT_NOT_FOUND", "This checkout could not be found.");
    }

    const submittedHash = createHash("sha256").update(cancelToken).digest();
    const storedHash = Buffer.from(payment.checkout_cancel_token_hash, "hex");
    if (storedHash.length !== submittedHash.length || !timingSafeEqual(storedHash, submittedHash)) {
      throw new ApiError(404, "CHECKOUT_NOT_FOUND", "This checkout could not be found.");
    }
    if (payment.payment_status !== "pending") return json({ paymentStatus: payment.payment_status });

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id, {}, {
      stripeAccount: payment.stripe_account_id,
    });
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id, {}, { stripeAccount: payment.stripe_account_id });
    } else if (session.status === "complete") {
      return json({ paymentStatus: "pending" });
    }

    const { error: releaseError } = await supabase.rpc("expire_marketplace_stripe_order", {
      requested_event_id: `piecebook_cancel_${session.id}`,
      requested_event_type: "checkout.session.expired",
      requested_order_id: orderId,
      requested_session_id: session.id,
      requested_account_id: payment.stripe_account_id,
    });
    if (releaseError) throw new ApiError(500, "CHECKOUT_CANCEL_FAILED", "Could not release the listing reservation.");
    return json({ paymentStatus: "canceled" });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("Could not cancel the Stripe Checkout session:", error.type, error.code ?? "unknown", error.requestId ?? "no-request-id");
      return json({ error: { code: "CHECKOUT_CANCEL_FAILED", message: "Could not finish canceling checkout. The reservation will expire automatically." } }, 502);
    }
    return apiErrorResponse(error);
  }
}
