"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageOff,
  MessageCircle,
  ShoppingBag,
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
  onActiveIndexChange?: (
    index: number | ((currentIndex: number) => number),
  ) => void;
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
      <div className={`relative flex min-h-72 flex-col items-center justify-center gap-2 overflow-hidden bg-muted/50 text-muted-foreground ${className}`} role="img" aria-label={`${listing.title}: no photos added`}>
        <ImageOff className="size-10" aria-hidden="true" />
        <span className="text-sm font-medium">No photos added</span>
      </div>
    );
  }

  const activeIndex = Math.min(controlledIndex ?? localIndex, images.length - 1);
  const activeImage = images[activeIndex] ?? images[0];
  const isControlled = controlledIndex !== undefined;

  const selectImage = (index: number) => {
    const nextIndex = (index + images.length) % images.length;
    if (!isControlled) setLocalIndex(nextIndex);
    onActiveIndexChange?.(nextIndex);
  };

  const selectRelativeImage = (direction: -1 | 1) => {
    if (isControlled && onActiveIndexChange) {
      onActiveIndexChange(
        (currentIndex) => (currentIndex + direction + images.length) % images.length,
      );
      return;
    }
    selectImage((controlledIndex ?? localIndex) + direction);
  };

  return (
    <div className={`pointer-events-none relative flex min-h-72 items-center justify-center overflow-hidden bg-muted/40 ${className}`}>
      <div className="pointer-events-none absolute inset-0">
        <Image
          loader={passthroughImageLoader}
          src={activeImage}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 100vw, 60vw"
          className="object-contain"
          priority
        />
      </div>
      {images.length > 1 && (
        <>
          <Button type="button" variant="secondary" size="icon" aria-label="Previous photo" onClick={() => selectRelativeImage(-1)} className="pointer-events-auto absolute left-3 top-1/2 z-10 size-12 -translate-y-1/2 touch-manipulation rounded-xl border border-border/70 bg-card/95 shadow-md backdrop-blur transition-colors">
            <ChevronLeft className="size-5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label="Next photo" onClick={() => selectRelativeImage(1)} className="pointer-events-auto absolute right-3 top-1/2 z-10 size-12 -translate-y-1/2 touch-manipulation rounded-xl border border-border/70 bg-card/95 shadow-md backdrop-blur transition-colors">
            <ChevronRight className="size-5" />
          </Button>
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 bg-linear-to-t from-black/65 to-transparent px-4 pb-4 pt-8">
            {images.map((photo, index) => (
              <button
                key={`${listing.id}-photo-${index}`}
                type="button"
                onClick={() => selectImage(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={activeIndex === index}
                className={`relative size-12 touch-manipulation overflow-hidden rounded-xl border-2 shadow-sm transition ${activeIndex === index ? "border-primary" : "border-white/70"}`}
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
  managementActions?: ReactNode;
  onCheckout?: () => void;
  priceLabel?: string;
  showListed?: boolean;
  className?: string;
};

export function ListingDetailsPanel({
  listing,
  isSaved = false,
  onSave,
  onMessage,
  onViewMessages,
  managementActions,
  onCheckout,
  priceLabel,
  showListed = true,
  className = "",
}: ListingDetailsPanelProps) {
  const { currentUser, isLoading } = useProfile();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const isOwnListing = isOwnMarketplaceListing(listing, currentUser?.id);
  const canUseSellerActions = !isLoading && Boolean(currentUser) && !isOwnListing;
  const sellerName = isOwnListing ? currentUser?.full_name ?? "You" : listing.seller;
  const sellerImage = isOwnListing ? currentUser?.image : listing.sellerImage ?? undefined;
  const categoryDetails = Object.entries(listing.categoryDetails ?? {}).filter(([, value]) => value.trim());
  const detailKeys = new Set(categoryDetails.map(([label]) => label.toLowerCase()));
  const additionalDetails = [
    ...(listing.color && !detailKeys.has("color") ? [["Color", listing.color] as const] : []),
    ...(listing.material && !detailKeys.has("material") ? [["Material", listing.material] as const] : []),
  ];
  const allCategoryDetails = [...categoryDetails, ...additionalDetails];

  return (
    <section className={`scrollbar-hide flex min-h-0 min-w-0 flex-col overflow-y-auto p-4 sm:p-6 ${className}`} aria-label="Listing details">
      <header>
        <h1 className="min-w-0 wrap-break-word text-xl font-bold leading-tight tracking-tight sm:text-2xl">{listing.title}</h1>
        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${listing.status === "available" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300" : listing.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
          {listing.status}
        </span>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight text-primary">{priceLabel ?? formatPrice(listing.price)}</p>
          {listing.previousPrice != null && <p className="text-sm text-muted-foreground line-through">{formatPrice(listing.previousPrice)}</p>}
        </div>
        {showListed && <p className="mt-1 text-xs text-muted-foreground">Listed {listing.listed}</p>}
      </header>

      {canUseSellerActions && (onMessage || onSave) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {onMessage && <Button type="button" onClick={onMessage} className="h-11 rounded-xl font-semibold shadow-sm"><MessageCircle className="size-4" />Message</Button>}
          {onSave && <Button type="button" variant="secondary" onClick={onSave} className="h-11 rounded-xl font-semibold"><Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />{isSaved ? "Saved" : "Save"}</Button>}
        </div>
      )}
      {(onViewMessages || managementActions) && (
        <div className="mt-3 flex min-w-0 items-center gap-2">
          {onViewMessages && (
            <Button
              type="button"
              variant="secondary"
              onClick={onViewMessages}
              className="h-11 min-w-0 flex-1 rounded-xl px-2.5 text-xs font-semibold sm:text-sm"
            >
              <MessageCircle className="size-4 shrink-0" />
              <span className="truncate">View messages</span>
            </Button>
          )}
          {managementActions}
        </div>
      )}
      {listing.status === "available" && listing.quantity > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {listing.quantity} {listing.quantity === 1 ? "item" : "items"} available
        </p>
      )}
      {onCheckout && (
        <Button type="button" onClick={onCheckout} className="mt-3 h-11 w-full rounded-xl font-semibold shadow-sm">
          <ShoppingBag className="size-4" />Checkout
        </Button>
      )}

      <div className="mt-5 border-t border-border/70 pt-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Category</dt><dd className="text-right font-medium">{listing.category}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Condition</dt><dd className="text-right font-medium">{listing.condition}</dd></div>
        </dl>
        {allCategoryDetails.length > 0 && <div className="mt-4 border-t border-border/70 pt-4"><h3 className="text-sm font-semibold">Category details</h3><dl className="mt-3 space-y-2 text-sm">{allCategoryDetails.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 wrap-break-word text-right font-medium">{value}</dd></div>)}</dl></div>}
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Description</h3>
          <p className={`mt-1 min-w-0 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed ${isDescriptionExpanded ? "" : "line-clamp-4"}`}>{listing.description}</p>
          {listing.description.length > 240 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={isDescriptionExpanded}
              onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
              className="mt-1 h-8 rounded-lg px-2 text-xs text-primary"
            >
              {isDescriptionExpanded ? "Show less" : "Read full description"}
              {isDescriptionExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-border/70 pt-4">
        <h2 className="text-sm font-semibold">Pickup location</h2>
        <p className="mt-1 wrap-break-word text-sm text-muted-foreground">{listing.location}</p>
      </div>

      <div className="mt-5 border-t border-border/70 pt-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Seller information</h2><span className="text-xs font-medium text-primary">Seller details</span></div>
        <div className="mt-3 flex items-center gap-2.5">
          <Avatar className="size-10 ring-2 ring-primary/10"><AvatarImage src={sellerImage} alt={sellerName} /><AvatarFallback className="bg-primary/10 text-primary">{getInitials(sellerName)}</AvatarFallback></Avatar>
          <div className="min-w-0"><p className="wrap-break-word text-sm font-semibold">{sellerName}</p><p className="text-xs text-muted-foreground">Piecebook member</p></div>
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
  managementActions,
  onCheckout,
  priceLabel,
  showListed,
  className,
  imageClassName,
  layoutClassName = "grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]",
}: ListingDetailsViewProps) {
  return (
    <div className={`${layoutClassName} ${className ?? ""}`}>
      <ListingPhotoGallery listing={listing} photos={photos} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} className={imageClassName} />
      <ListingDetailsPanel listing={listing} isSaved={isSaved} onSave={onSave} onMessage={onMessage} onViewMessages={onViewMessages} managementActions={managementActions} onCheckout={onCheckout} priceLabel={priceLabel} showListed={showListed} />
    </div>
  );
}
