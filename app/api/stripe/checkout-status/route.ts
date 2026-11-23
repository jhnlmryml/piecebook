import { z } from "zod";
import { connection } from "next/server";
import { ApiError, apiErrorResponse, json } from "@/lib/server/api-utils";
import { getSupabaseAdminClient } from "@/lib/server/stripe-marketplace";

const sessionIdSchema = z.string().trim().min(10).max(255).startsWith("cs_");

export async function GET(request: Request) {
  await connection();
  try {
    const sessionId = sessionIdSchema.parse(new URL(request.url).searchParams.get("session_id"));
    const supabase = getSupabaseAdminClient();
    const { data: payment, error: paymentError } = await supabase
      .from("marketplace_order_payments")
      .select("marketplace_order_id,payment_status,item_price,currency")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (paymentError) throw new ApiError(500, "DATABASE_ERROR", "Could not load this checkout.");
    if (!payment) throw new ApiError(404, "CHECKOUT_NOT_FOUND", "This checkout could not be found.");

    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("id,listing_title,listing_photos,quantity,unit_price,total_price,created_at")
      .eq("id", payment.marketplace_order_id)
      .maybeSingle();
    if (orderError) throw new ApiError(500, "DATABASE_ERROR", "Could not load this order.");
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "This order could not be found.");

    return json({
      paymentStatus: payment.payment_status,
      currency: payment.currency,
      itemPrice: Number(payment.item_price),
      order: {
        id: order.id,
        listingTitle: order.listing_title,
        image: order.listing_photos[0] ?? null,
        quantity: order.quantity,
        unitPrice: Number(order.unit_price),
        totalPrice: Number(order.total_price),
        createdAt: order.created_at,
      },
    }, 200);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
