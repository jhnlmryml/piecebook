"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPrice,
  type MarketplaceOrder,
} from "@/components/features/marketplace/marketplace-data";
import type { MarketplaceMessageListing } from "@/lib/messaging-events";

export function MarketplaceListingContextCard({
  listing,
  onViewListing,
}: {
  listing: MarketplaceMessageListing;
  onViewListing: () => void;
}) {
  return (
    <Card className="flex-row items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 shadow-none ring-0">
      {listing.image && (
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          About this listing
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold">{listing.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatPrice(listing.price)} · {listing.location}
        </p>
      </div>
      <Button
        nativeButton={false}
        render={<Link href={`/marketplace/${listing.id}`} />}
        variant="outline"
        size="sm"
        className="h-9 shrink-0 rounded-xl bg-background/80"
        onClick={onViewListing}
      >
        View item
      </Button>
    </Card>
  );
}

export function MarketplaceMessageAttachmentCard({
  listingId,
  orderId,
  listing,
  order,
  onViewListing,
}: {
  listingId: string | null;
  orderId: string | null;
  listing: MarketplaceMessageListing | null | undefined;
  order: MarketplaceOrder | null | undefined;
  onViewListing: () => void;
}) {
  const image = order?.listing_photos[0] ?? listing?.image;
  const isLoading =
    orderId !== null
      ? order === undefined
      : listingId !== null && listing === undefined;
  const href = orderId || order
    ? `/marketplace/items/${orderId ?? order?.id}`
    : listingId && listing !== null
      ? `/marketplace/${listingId}`
      : null;
  const imageElement = isLoading ? (
    <Skeleton className="size-14 shrink-0 rounded-lg" />
  ) : image ? (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
      <Image
        src={image}
        alt=""
        fill
        sizes="56px"
        unoptimized
        className="object-cover"
      />
    </div>
  ) : null;

  return (
    <Card className="mb-2 flex w-full max-w-md min-w-0 flex-row items-center gap-3 rounded-xl border border-border/70 bg-background/85 p-2.5 text-foreground shadow-none ring-0 transition-colors hover:border-primary/25">
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Marketplace item
        </p>
        {isLoading ? (
          <div className="mt-1 space-y-1.5" role="status">
            <span className="sr-only">Loading marketplace listing</span>
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-36" />
          </div>
        ) : (
          <p className="truncate text-xs font-semibold">
            {order?.listing_title ??
              (orderId !== null && order === null
                ? "Order unavailable"
                : listing === null
                  ? "Listing unavailable"
                  : listing?.title)}
          </p>
        )}
        {isLoading ? null : order ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {order.quantity} × {formatPrice(Number(order.unit_price))} · Total {formatPrice(Number(order.total_price))}
          </p>
        ) : listing ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {formatPrice(listing.price)} · {listing.location}
          </p>
        ) : null}
      </div>
      {href && (
        <Button
          nativeButton={false}
          render={<Link href={href} />}
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 rounded-lg px-2.5 text-xs"
          onClick={onViewListing}
        >
          {order ? "View item" : "View listing"}
        </Button>
      )}
    </Card>
  );
}
