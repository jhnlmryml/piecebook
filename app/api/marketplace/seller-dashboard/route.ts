import { connection } from "next/server";
import { ApiError, apiErrorResponse, databaseError, json, requireUuid } from "@/lib/server/api-utils";
import { getSellerStripeAccountState, getSupabaseAdminClient } from "@/lib/server/stripe-marketplace";

const pageSize = 500;

async function loadSellerListingMetrics(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const listings: Array<{ status: string; quantity: number }> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("marketplace_listing")
      .select("status,quantity")
      .eq("seller_id", profileId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) databaseError("Could not load seller listings", error);
    listings.push(...data);
    if (data.length < pageSize) break;
  }
  return listings;
}

async function loadRecentSellerListings(profileId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("marketplace_listing")
    .select("id,title,status,price,quantity,photos,created_at")
    .eq("seller_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(5);
  if (error) databaseError("Could not load seller listings", error);
  return data.map((listing) => ({
    id: listing.id,
    title: listing.title,
    status: listing.status,
    price: Number(listing.price),
    quantity: listing.quantity,
    image: listing.photos[0] ?? null,
    createdAt: listing.created_at,
  }));
}

async function loadSellerOrders(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const orders: Array<{
    id: string;
    listing_title: string;
    listing_photos: string[];
    buyer_name: string;
    buyer_location: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    payment_status: string;
    created_at: string;
  }> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("id,listing_title,listing_photos,buyer_name,buyer_location,quantity,unit_price,total_price,payment_status,created_at")
      .eq("seller_id", profileId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) databaseError("Could not load seller orders", error);
    orders.push(...data);
    if (data.length < pageSize) break;
  }
  return orders;
}

export async function GET(request: Request) {
  await connection();
  try {
    const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
    const seller = await getSellerStripeAccountState(profileId);
    if (!seller.profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "The seller profile could not be found.");

    const stripe = {
      status: seller.status,
      paymentEligible: seller.paymentEligible,
      detailsSubmitted: seller.detailsSubmitted,
      chargesEnabled: seller.chargesEnabled,
      payoutsEnabled: seller.payoutsEnabled,
    };
    if (!seller.paymentEligible) {
      return json({ stripe, metrics: null, orders: [], recentListings: [] });
    }

    const [listingMetrics, recentListings, orders] = await Promise.all([
      loadSellerListingMetrics(profileId),
      loadRecentSellerListings(profileId),
      loadSellerOrders(profileId),
    ]);
    let activeListings = 0;
    let soldListings = 0;
    for (const listing of listingMetrics) {
      if (listing.status === "available" && listing.quantity > 0) activeListings += 1;
      if (listing.status === "sold") soldListings += 1;
    }
    let completedSales = 0;
    let verifiedSales = 0;
    let pendingOrders = 0;
    for (const order of orders) {
      if (order.payment_status === "paid" || order.payment_status === "legacy") {
        completedSales += Number(order.total_price);
      }
      if (order.payment_status === "paid") verifiedSales += Number(order.total_price);
      if (order.payment_status === "pending") pendingOrders += 1;
    }
    const metrics = {
      activeListings,
      soldListings,
      totalOrders: orders.length,
      totalSales: completedSales,
      verifiedSales,
      pendingOrders,
    };

    return json({
      stripe,
      metrics,
      orders,
      recentListings,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
