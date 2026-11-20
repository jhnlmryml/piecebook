"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Heart, ImageOff, MessageCircle } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile } from "@/context/ProfileContext";
import { formatPrice, isOwnMarketplaceListing, type Listing } from "./marketplace-data";
import {
  getMarketplaceListingCountSnapshot,
  getServerMarketplaceListingCountSnapshot,
  subscribeToMarketplaceListingCounts,
} from "@/lib/marketplace-listing-counts";

const passthroughImageLoader = ({ src }: { src: string }) => src;

type ListingCardProps = {
  listing: Listing;
  isSaved: boolean;
  onSave: () => void;
};

export function ListingCard({ listing, isSaved, onSave }: ListingCardProps) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const { currentUser, isLoading } = useProfile();
  const engagementCount = useSyncExternalStore(
    subscribeToMarketplaceListingCounts,
    () => getMarketplaceListingCountSnapshot(listing.id),
    getServerMarketplaceListingCountSnapshot,
  );
  const listingHref = `/marketplace/${encodeURIComponent(listing.id)}`;
  const canSaveListing = !isLoading && Boolean(currentUser) && listing.status === "available" && !isOwnMarketplaceListing(listing, currentUser?.id);

  return (
    <article className="group relative min-w-0">
      <Link href={listingHref} aria-label={`View ${listing.title}`} className="block h-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <Card className="h-full min-w-0 overflow-hidden rounded-sm p-2 shadow-none ring-0">
          <div className="relative block aspect-4/3 w-full overflow-hidden rounded-sm bg-secondary">
            {listing.status !== "available" && (
              <span className="absolute left-2 top-2 z-10 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold capitalize text-foreground shadow-sm">
                {listing.status}
              </span>
            )}
            <div className="mt-2 flex absolute bottom-0 right-0 bg-primary/50 gap-2 rounded-full mr-2 mb-2 p-2 text-xs text-primary-foreground" aria-label="Listing activity">
              <span className="inline-flex items-center gap-1" aria-label={engagementCount.status === "ready" ? `${engagementCount.likeCount} likes` : engagementCount.status === "error" ? `Like count unavailable: ${engagementCount.error}` : "Loading likes"}>
                <Heart className="size-3.5" aria-hidden="true" />
                {engagementCount.likeCount ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1" aria-label={engagementCount.status === "ready" ? `${engagementCount.commentCount} comments` : engagementCount.status === "error" ? `Comment count unavailable: ${engagementCount.error}` : "Loading comments"}>
                <MessageCircle className="size-3.5" aria-hidden="true" />
                {engagementCount.commentCount ?? "—"}
              </span>
            </div>
            {imageUnavailable || !listing.image ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                <ImageOff aria-hidden="true" className="size-7" />
                <span className="text-xs">{listing.image ? "Photo unavailable" : "No photo added"}</span>
              </span>
            ) : (
              <Image
                loader={passthroughImageLoader}
                src={listing.image}
                alt={listing.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 16vw"
                onError={() => setImageUnavailable(true)}
                className="object-cover transition duration-300 group-hover:scale-[1.025]"
              />
            )}
          </div>
          <CardContent className="min-w-0 px-0 pt-2">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-sm font-bold">{formatPrice(listing.price)}</span>
              {listing.previousPrice != null && <span className="text-xs text-muted-foreground line-through">{formatPrice(listing.previousPrice)}</span>}
            </div>
            <span className="mt-0.5 block line-clamp-2 text-sm leading-snug">{listing.title}</span>
            <p className="mt-1 truncate text-xs text-muted-foreground">{listing.location}</p>
            <p className="truncate text-xs text-muted-foreground">{listing.category}</p>
            {listing.status === "available" && (
              <p className="mt-1 text-xs text-muted-foreground">
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
          onClick={onSave}
          className={`absolute right-2 top-2 size-9 rounded-sm bg-card shadow-sm hover:bg-card ${isSaved ? "text-primary" : "text-foreground"}`}
        >
          <Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />
        </Button>
      )}
    </article>
  );
}
