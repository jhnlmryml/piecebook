"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketplaceDetailSkeleton } from "@/components/shared/LoadingSkeletons";
import { ListingDetailsView } from "./ListingDetailsView";
import { MarketplaceListingEngagement } from "./MarketplaceListingEngagement";
import {
  getMarketplaceOrderRecord,
  marketplaceCategories,
  parseCategoryDetails,
  type Category,
  type Listing,
  type MarketplaceOrder,
} from "./marketplace-data";
import { OrderEngagementHistory } from "./MarketplaceOrderPage";

export default function MarketplaceSoldItemPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getMarketplaceOrderRecord(orderId)
      .then((record) => {
        if (active) setOrder(record);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load this item record.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6" aria-busy="true">
        <div className="mx-auto w-full max-w-7xl">
          <MarketplaceDetailSkeleton />
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-4 py-8 sm:px-6">
        <Card className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace</p>
          <h1 className="mt-2 text-xl font-bold">Sold item unavailable</h1>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            {error ?? "This saved item record could not be found."}
          </p>
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="mt-5 rounded-xl">
            <ArrowLeft className="size-4" />Back
          </Button>
        </Card>
      </main>
    );
  }

  const sourceListingId = order.source_listing_id ?? order.listing_id;
  const category = marketplaceCategories.includes(order.listing_category as Category)
    ? order.listing_category as Category
    : "Classifieds";
  const snapshotListing: Listing = {
    id: sourceListingId ?? order.id,
    title: order.listing_title,
    price: Number(order.unit_price),
    previousPrice: order.listing_previous_price == null
      ? undefined
      : Number(order.listing_previous_price),
    location: order.listing_location,
    category,
    image: order.listing_photos[0] ?? "",
    photos: order.listing_photos,
    sellerImage: order.seller_image,
    quantity: 0,
    condition: order.listing_condition,
    status: "sold",
    color: order.listing_color ?? undefined,
    material: order.listing_material ?? undefined,
    seller: order.seller_name,
    description: order.listing_description,
    listed: "",
    createdAt: order.created_at,
    categoryDetails: parseCategoryDetails(order.listing_category_details),
  };

  return (
    <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" className="mb-4 rounded-full px-3">
          <ArrowLeft className="size-4" />Back 
        </Button>
        <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card p-0 shadow-sm">
          {/* <div className="border-b border-border/70 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {order.listing_id ? "Saved item preview" : "Saved item preview · Read-only"}
          </div> */}
          <ListingDetailsView
            listing={snapshotListing}
            photos={snapshotListing.photos}
            showListed={false}
            layoutClassName="grid min-h-0 grid-cols-1 md:h-[min(64dvh,42rem)] md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
            imageClassName="min-h-[min(38dvh,22rem)] md:min-h-0"
          />
        </Card>
        {order.listing_id ? (
          <MarketplaceListingEngagement
            listingId={order.listing_id}
            listingStatus="sold"
          />
        ) : sourceListingId ? (
          <OrderEngagementHistory sourceListingId={sourceListingId} />
        ) : null}
      </div>
    </main>
  );
}
