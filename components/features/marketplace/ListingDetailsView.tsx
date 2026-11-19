"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageOff,
  MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { formatPrice, isOwnMarketplaceListing, type Listing } from "./marketplace-data";

const passthroughImageLoader = ({ src }: { src: string }) => src;

type ListingPhotoGalleryProps = {
  listing: Listing;
  photos?: string[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
};

export function ListingPhotoGallery({
  listing,
  photos,
  activeIndex: controlledIndex,
  onActiveIndexChange,
  className = "",
}: ListingPhotoGalleryProps) {
  const [localIndex, setLocalIndex] = useState(0);
  const images = (photos?.length ? photos : listing.photos?.length ? listing.photos : [listing.image]).filter(Boolean);
  if (images.length === 0) {
    return (
      <div className={`relative flex min-h-[300px] flex-col items-center justify-center gap-2 overflow-hidden bg-muted text-muted-foreground ${className}`} role="img" aria-label={`${listing.title}: no photos added`}>
        <ImageOff className="size-10" aria-hidden="true" />
        <span className="text-sm font-medium">No photos added</span>
      </div>
    );
  }

  const activeIndex = Math.min(controlledIndex ?? localIndex, images.length - 1);
  const activeImage = images[activeIndex] ?? images[0];

  const selectImage = (index: number) => {
    const nextIndex = (index + images.length) % images.length;
    setLocalIndex(nextIndex);
    onActiveIndexChange?.(nextIndex);
  };

  return (
    <div className={`relative flex min-h-[300px] items-center justify-center overflow-hidden bg-[#111318] ${className}`}>
      <Image
        loader={passthroughImageLoader}
        src={activeImage}
        alt={listing.title}
        fill
        sizes="(max-width: 768px) 100vw, 60vw"
        className="object-contain"
        priority
      />
      {images.length > 1 && (
        <>
          <Button type="button" variant="secondary" size="icon" aria-label="Previous photo" onClick={() => selectImage(activeIndex - 1)} className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-card shadow-md">
            <ChevronLeft className="size-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label="Next photo" onClick={() => selectImage(activeIndex + 1)} className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-card shadow-md">
            <ChevronRight className="size-5" />
          </Button>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-8">
            {images.map((photo, index) => (
              <button
                key={`${listing.id}-photo-${index}`}
                type="button"
                onClick={() => selectImage(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={activeIndex === index}
                className={`relative size-12 overflow-hidden rounded-sm border-2 ${activeIndex === index ? "border-primary" : "border-white/70"}`}
              >
                <Image src={photo} alt="" fill unoptimized className="object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type ListingDetailsPanelProps = {
  listing: Listing;
  isSaved?: boolean;
  onSave?: () => void;
  onMessage?: () => void;
  onViewMessages?: () => void;
  priceLabel?: string;
  className?: string;
};

export function ListingDetailsPanel({
  listing,
  isSaved = false,
  onSave,
  onMessage,
  onViewMessages,
  priceLabel,
  className = "",
}: ListingDetailsPanelProps) {
  const { currentUser, isLoading } = useProfile();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const isOwnListing = isOwnMarketplaceListing(listing, currentUser?.id);
  const canUseSellerActions = !isLoading && Boolean(currentUser) && !isOwnListing;
  const sellerName = isOwnListing ? currentUser?.full_name ?? "You" : listing.seller;
  const sellerImage = isOwnListing ? currentUser?.image : undefined;
  const categoryDetails = Object.entries(listing.categoryDetails ?? {}).filter(([, value]) => value.trim());
  const detailKeys = new Set(categoryDetails.map(([label]) => label.toLowerCase()));
  const additionalDetails = [
    ...(listing.color && !detailKeys.has("color") ? [["Color", listing.color] as const] : []),
    ...(listing.material && !detailKeys.has("material") ? [["Material", listing.material] as const] : []),
  ];
  const allCategoryDetails = [...categoryDetails, ...additionalDetails];

  return (
    <section className={`flex min-h-0 flex-col overflow-y-auto p-4 sm:p-5 ${className}`} aria-label="Listing details">
      <header>
        <h1 className="text-lg font-bold leading-tight sm:text-xl">{listing.title}</h1>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-lg font-semibold">{priceLabel ?? formatPrice(listing.price)}</p>
          {listing.previousPrice != null && <p className="text-sm text-muted-foreground line-through">{formatPrice(listing.previousPrice)}</p>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Listed {listing.listed}</p>
      </header>

      {canUseSellerActions && (onMessage || onSave) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {onMessage && <Button type="button" onClick={onMessage} className="h-9 rounded-md bg-primary font-semibold text-primary-foreground hover:bg-primary/90"><MessageCircle className="size-4" />Message</Button>}
          {onSave && <Button type="button" variant="secondary" onClick={onSave} className="h-9 rounded-md font-semibold"><Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />{isSaved ? "Saved" : "Save"}</Button>}
        </div>
      )}
      {onViewMessages && (
        <Button type="button" variant="secondary" onClick={onViewMessages} className="mt-3 h-9 w-full rounded-md font-semibold">
          <MessageCircle className="size-4" />View messages
        </Button>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <h2 className="text-sm font-bold">Details</h2>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="font-semibold">Category</dt><dd className="text-right text-muted-foreground">{listing.category}</dd></div>
          <div className="flex justify-between gap-4"><dt className="font-semibold">Condition</dt><dd className="text-right text-muted-foreground">{listing.condition}</dd></div>
        </dl>
        {allCategoryDetails.length > 0 && <div className="mt-3 border-t border-border pt-3"><h3 className="text-sm font-semibold">Category details</h3><dl className="mt-2 space-y-2 text-sm">{allCategoryDetails.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="shrink-0 font-medium">{label}</dt><dd className="min-w-0 break-words text-right text-muted-foreground">{value}</dd></div>)}</dl></div>}
        <div className="mt-3">
          <h3 className="text-sm font-semibold">Description</h3>
          <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${isDescriptionExpanded ? "" : "line-clamp-4"}`}>{listing.description}</p>
          {listing.description.length > 240 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={isDescriptionExpanded}
              onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
              className="mt-1 h-7 rounded-md px-1.5 text-xs text-primary"
            >
              {isDescriptionExpanded ? "Show less" : "Read full description"}
              {isDescriptionExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <h2 className="text-sm font-bold">Address</h2>
        <p className="mt-1 text-sm text-muted-foreground">{listing.location}</p>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">Seller information</h2><span className="text-xs font-medium text-primary">Seller details</span></div>
        <div className="mt-2 flex items-center gap-2.5">
          <Avatar className="size-9"><AvatarImage src={sellerImage} alt={sellerName} /><AvatarFallback className="bg-secondary text-primary">{getInitials(sellerName)}</AvatarFallback></Avatar>
          <div><p className="text-sm font-semibold">{sellerName}</p><p className="text-xs text-muted-foreground">Joined Piecebook in 2024</p></div>
        </div>
      </div>
    </section>
  );
}

type ListingDetailsViewProps = ListingDetailsPanelProps & ListingPhotoGalleryProps & {
  imageClassName?: string;
  layoutClassName?: string;
};

export function ListingDetailsView({
  listing,
  photos,
  activeIndex,
  onActiveIndexChange,
  isSaved,
  onSave,
  onMessage,
  onViewMessages,
  priceLabel,
  className,
  imageClassName,
  layoutClassName = "grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]",
}: ListingDetailsViewProps) {
  return (
    <div className={`${layoutClassName} ${className ?? ""}`}>
      <ListingPhotoGallery listing={listing} photos={photos} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} className={imageClassName} />
      <ListingDetailsPanel listing={listing} isSaved={isSaved} onSave={onSave} onMessage={onMessage} onViewMessages={onViewMessages} priceLabel={priceLabel} />
    </div>
  );
}
