"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, ImageOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile } from "@/context/ProfileContext";
import { formatPrice, isOwnMarketplaceListing, type Listing } from "./marketplace-data";

const passthroughImageLoader = ({ src }: { src: string }) => src;

type ListingCardProps = {
  listing: Listing;
  isSaved: boolean;
  onSave: () => void;
};

export function ListingCard({ listing, isSaved, onSave }: ListingCardProps) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const { currentUser, isLoading } = useProfile();
  const listingHref = `/marketplace/${encodeURIComponent(listing.id)}`;
  const canSaveListing = !isLoading && Boolean(currentUser) && !isOwnMarketplaceListing(listing, currentUser?.id);

  return (
    <article className="group relative min-w-0">
      <Card className="h-full min-w-0 overflow-hidden rounded-sm  p-2 shadow-none ring-0">
        <Link href={listingHref} aria-label={`View ${listing.title}`} className="relative block aspect-[4/3] w-full overflow-hidden rounded-sm bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
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
        </Link>
        <CardContent className="min-w-0 px-0 pt-2">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-sm font-bold">{formatPrice(listing.price)}</span>
            {listing.previousPrice != null && <span className="text-xs text-muted-foreground line-through">{formatPrice(listing.previousPrice)}</span>}
          </div>
          <Link href={listingHref} className="mt-0.5 block line-clamp-2 text-sm leading-snug hover:underline">{listing.title}</Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">{listing.location}</p>
          <p className="truncate text-xs text-muted-foreground">{listing.category}</p>
        </CardContent>
      </Card>
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
