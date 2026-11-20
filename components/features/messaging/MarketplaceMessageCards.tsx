"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MarketplaceMessageListing } from "@/lib/messaging-events";
import type { MarketplaceOrder } from "@/components/features/marketplace/marketplace-data";

export function MarketplaceListingContextCard({
  listing,
  onViewListing,
}: {
  listing: MarketplaceMessageListing;
  onViewListing: () => void;
}) {
  return (
    <Card className="shrink-0 rounded-none border-x-0 border-t-0 p-3 shadow-none">
      <div className="flex min-w-0 items-center gap-3">
        {listing.image && (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={listing.image}
              alt=""
              fill
              sizes="56px"
              unoptimized
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Marketplace listing
          </p>
          <p className="truncate text-sm font-semibold">{listing.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {listing.price === 0 ? "Free" : `$${listing.price.toLocaleString()}`} · {listing.location}
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href={`/marketplace/${listing.id}`} />}
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={onViewListing}
        >
          View item
        </Button>
      </div>
    </Card>
  );
}

export function MarketplaceMessageAttachmentCard({
  listingId,
  listing,
  order,
  onViewListing,
}: {
  listingId: string | null;
  listing: MarketplaceMessageListing | null | undefined;
  order: MarketplaceOrder | null | undefined;
  onViewListing: () => void;
}) {
  const image = order?.listing_photos[0] ?? listing?.image;
  const href = order
    ? `/marketplace/items/${order.id}`
    : listingId && listing !== null
      ? `/marketplace/${listingId}`
      : null;
  const imageElement = image ? (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      <Image
        src={image}
        alt=""
        fill
        sizes="48px"
        unoptimized
        className="object-cover"
      />
    </div>
  ) : null;

  return (
    <Card className="mb-2 flex w-full max-w-sm min-w-0 items-center gap-2 rounded-lg border border-border bg-background p-2 text-foreground shadow-none">
      {imageElement && href ? (
        <Link
          href={href}
          aria-label={`View ${order?.listing_title ?? listing?.title ?? "marketplace item"}`}
          onClick={onViewListing}
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {imageElement}
        </Link>
      ) : (
        imageElement
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Marketplace item
        </p>
        <p className="truncate text-xs font-semibold">
          {order?.listing_title ?? (listing === null ? "Listing unavailable" : listing?.title ?? "Loading listing…")}
        </p>
        {order ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {order.quantity} × ${Number(order.unit_price).toLocaleString()} · Total ${Number(order.total_price).toLocaleString()}
          </p>
        ) : listing ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {listing.price === 0 ? "Free" : `$${listing.price.toLocaleString()}`} · {listing.location}
          </p>
        ) : null}
      </div>
      {href && (
        <Button
          nativeButton={false}
          render={<Link href={href} />}
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={onViewListing}
        >
          {order ? "View item" : "View listing"}
        </Button>
      )}
    </Card>
  );
}
