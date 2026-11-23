"use client";

import Link from "next/link";
import { Bookmark, Heart, ImageOff, Loader2, MessageCircle } from "lucide-react";
import { memo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SupabaseImageWithFallback } from "@/components/shared/SupabaseImageWithFallback";
import { formatPrice, type Listing } from "./marketplace-data";
import {
  getMarketplaceListingCountSnapshot,
  getServerMarketplaceListingCountSnapshot,
  subscribeToMarketplaceListingCounts,
} from "@/lib/marketplace-listing-counts";

type ListingCardProps = {
  listing: Listing;
  isSaved: boolean;
  canSaveListing: boolean;
  onSaveListing: (listingId: string) => void;
};

export const ListingCard = memo(function ListingCard({
  listing,
  isSaved,
  canSaveListing,
  onSaveListing,
}: ListingCardProps) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const engagementCount = useSyncExternalStore(
    subscribeToMarketplaceListingCounts,
    () => getMarketplaceListingCountSnapshot(listing.id),
    getServerMarketplaceListingCountSnapshot,
  );
  const listingHref = `/marketplace/${encodeURIComponent(listing.id)}`;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveListing(listing.id);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="group relative min-w-0">
      <Link
        href={listingHref}
        aria-label={`View ${listing.title}`}
        className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Card className="h-full min-w-0 gap-0 overflow-hidden rounded-2xl border-border/70 bg-card p-1.5 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/40">
          <div className="relative block aspect-4/3 w-full overflow-hidden rounded-xl bg-muted">
            {listing.status !== "available" && (
              <span className="absolute left-2 top-2 z-10 rounded-full bg-card/95 px-2.5 py-1 text-[10px] font-semibold capitalize text-foreground shadow-sm backdrop-blur">
                {listing.status}
              </span>
            )}
            <div className="absolute bottom-2 right-2 z-10 flex gap-2 rounded-full bg-black/55 px-2.5 py-1.5 text-xs text-white shadow-sm backdrop-blur-md" aria-label="Listing activity">
              <span className="inline-flex items-center gap-1" aria-label={engagementCount.status === "ready" ? `${engagementCount.likeCount} likes` : engagementCount.status === "error" ? `Like count unavailable: ${engagementCount.error}` : "Loading likes"}>
                <Heart className="size-3.5" aria-hidden="true" />
                {engagementCount.status === "loading" ? (
                  <Skeleton className="h-3 w-3 rounded-sm bg-white/40" />
                ) : engagementCount.likeCount ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1" aria-label={engagementCount.status === "ready" ? `${engagementCount.commentCount} comments` : engagementCount.status === "error" ? `Comment count unavailable: ${engagementCount.error}` : "Loading comments"}>
                <MessageCircle className="size-3.5" aria-hidden="true" />
                {engagementCount.status === "loading" ? (
                  <Skeleton className="h-3 w-3 rounded-sm bg-white/40" />
                ) : engagementCount.commentCount ?? "—"}
              </span>
            </div>
            {imageUnavailable || !listing.image ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                <ImageOff aria-hidden="true" className="size-7" />
                <span className="text-xs">{listing.image ? "Photo unavailable" : "No photo added"}</span>
              </span>
            ) : (
              <SupabaseImageWithFallback
                src={listing.image}
                alt={listing.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 16vw"
                onError={() => setImageUnavailable(true)}
                className="object-cover transition duration-300 group-hover:scale-[1.025]"
              />
            )}
          </div>
          <CardContent className="min-w-0 px-1 pb-1 pt-2.5">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">{formatPrice(listing.price)}</span>
              {listing.previousPrice != null && <span className="text-xs text-muted-foreground line-through">{formatPrice(listing.previousPrice)}</span>}
            </div>
            <span className="mt-0.5 block line-clamp-2 text-sm font-medium leading-snug text-foreground">{listing.title}</span>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{listing.location}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{listing.category}</p>
            {listing.status === "available" && (
              <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                {listing.quantity} available
              </p>
            )}

          </CardContent>
        </Card>
      </Link>
      {canSaveListing && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isSaved ? `Remove ${listing.title} from saved items` : `Save ${listing.title}`}
          aria-pressed={isSaved}
          disabled={isSaving}
          aria-busy={isSaving}
          onClick={() => void handleSave()}
          className={`absolute right-2.5 top-2.5 size-9 rounded-full border border-border/70 bg-card/95 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-card ${isSaved ? "text-primary" : "text-foreground"}`}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />}
        </Button>
      )}
    </article>
  );
});
