"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  imageFileSchema,
  MARKETPLACE_IMAGE_MAX_COUNT,
} from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Scroller } from "@/components/ui/scroller";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/context/ProfileContext";
import { ListingCard } from "./ListingCard";
import { ListingDetailsView } from "./ListingDetailsView";
import { MarketplaceOrderHistory } from "./MarketplaceOrderHistory";

import { useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { MarketplaceSearchFilters } from "./MarketplaceSearchFilters";
import {
  categoryDetailFields,
  createMarketplaceListing,
  formatPrice,
  getMarketplaceListingsSnapshot,
  getServerMarketplaceListingsSnapshot,
  marketplaceCategories,
  marketplaceConditions,
  marketplaceListingCreateFormSchema,
  refreshMarketplaceListings,
  subscribeToMarketplaceListings,
  type Listing,
} from "./marketplace-data";
import { MarketplaceListingsSkeleton, MarketplaceOrderHistorySkeleton } from "@/components/shared/LoadingSkeletons";

type NewListingPhoto = {
  file: File;
  previewUrl: string;
};

export default function MarketplacePage() {
  const { currentUser, isLoading: isProfileLoading } = useProfile();
  const {
    activeView,
    activeCategory,
    isCreateOpen,
    savedListingIds,
    setIsCreateOpen,
    chooseView,
    chooseFilterCategory,
    toggleSavedListing,
  } = useMarketplaceLayout();
  const listingsSnapshot = useSyncExternalStore(
    subscribeToMarketplaceListings,
    getMarketplaceListingsSnapshot,
    getServerMarketplaceListingsSnapshot,
  );
  const listings = listingsSnapshot.listings;
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [conditionFilter, setConditionFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newSellerEmailDraft, setNewSellerEmailDraft] = useState(() => ({
    profileId: currentUser?.id ?? null,
    value: "",
  }));
  const newSellerEmail =
    newSellerEmailDraft.profileId === currentUser?.id
      ? newSellerEmailDraft.value
      : "";
  const setNewSellerEmail = (value: string) => {
    setNewSellerEmailDraft({ profileId: currentUser?.id ?? null, value });
  };
  const [newLocationDraft, setNewLocationDraft] = useState(() => ({
    profileId: currentUser?.id ?? null,
    value: currentUser?.location ?? "",
  }));
  const newLocation =
    newLocationDraft.profileId === currentUser?.id
      ? newLocationDraft.value
      : currentUser?.location ?? "";
  const setNewLocation = (value: string) => {
    setNewLocationDraft({ profileId: currentUser?.id ?? null, value });
  };
  const [newDescription, setNewDescription] = useState("");
  const [newPhotos, setNewPhotos] = useState<NewListingPhoto[]>([]);
  const previewPhotoUrls = useRef(new Set<string>());
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [newCategory, setNewCategory] = useState<Listing["category"]>("Classifieds");
  const [newCondition, setNewCondition] = useState("Used - good");
  const [newCategoryDetails, setNewCategoryDetails] = useState<Record<string, string>>({});
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => () => {
    previewPhotoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewPhotoUrls.current.clear();
  }, []);
  const filteredListings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let results = listings.filter((listing) => {
      const matchesSearch =
        !normalizedSearch ||
        `${listing.title} ${listing.category} ${listing.location} ${listing.condition} ${listing.description} ${Object.values(listing.categoryDetails ?? {}).join(" ")}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesCategory = !activeCategory || listing.category === activeCategory;
      const matchesCondition = !conditionFilter || listing.condition === conditionFilter;
      const matchesMinPrice = !minPriceFilter || listing.price >= Number(minPriceFilter);
      const matchesMaxPrice = !maxPriceFilter || listing.price <= Number(maxPriceFilter);
      const matchesView =
        activeView === "saved"
          ? savedListingIds.includes(listing.id)
          : activeView === "selling"
            ? listing.sellerId === currentUser?.id
            : true;
      return matchesSearch && matchesCategory && matchesCondition && matchesMinPrice && matchesMaxPrice && matchesView;
    });

    if (sortOrder === "price-low") results = [...results].sort((a, b) => a.price - b.price);
    if (sortOrder === "price-high") results = [...results].sort((a, b) => b.price - a.price);
    if (sortOrder === "newest") results = [...results].reverse();
    return results;
  }, [activeCategory, activeView, conditionFilter, currentUser?.id, listings, maxPriceFilter, minPriceFilter, savedListingIds, searchTerm, sortOrder]);

  const createListing = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      toast.error("Choose a profile before listing an item.");
      return;
    }

    const validation = marketplaceListingCreateFormSchema.safeParse({
      title: newTitle,
      price: newPrice,
      quantity: newQuantity,
      sellerEmail: newSellerEmail,
      location: newLocation,
      category: newCategory,
      condition: newCondition,
      description: newDescription,
      categoryDetails: newCategoryDetails,
      photoFiles: newPhotos.map(({ file }) => file),
    });
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Check your listing and try again.",
      );
      return;
    }

    setIsPublishing(true);
    try {
      await createMarketplaceListing({
        sellerId: currentUser.id,
        sellerName: currentUser.full_name,
        ...validation.data,
        photoFiles: newPhotos.map(({ file }) => file),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish this listing.");
      setIsPublishing(false);
      return;
    }

    chooseView("selling");
    setIsCreateOpen(false);
    setNewTitle("");
    setNewPrice("");
    setNewQuantity("1");
    setNewSellerEmail("");
    setNewLocation(currentUser.location ?? "");
    setNewDescription("");
    newPhotos.forEach(({ previewUrl }) => {
      URL.revokeObjectURL(previewUrl);
      previewPhotoUrls.current.delete(previewUrl);
    });
    setNewPhotos([]);
    setActivePhotoIndex(0);
    setNewCondition("Used - good");
    setNewCategory("Classifieds");
    setNewCategoryDetails({});
    setIsPublishing(false);
    toast.success("Your listing was published.");
  };

  const handlePhotoUpload = (files?: FileList | null) => {
    if (!files?.length) return;
    const remainingSlots = Math.max(
      0,
      MARKETPLACE_IMAGE_MAX_COUNT - newPhotos.length,
    );
    if (remainingSlots === 0) {
      toast.error(`You can add up to ${MARKETPLACE_IMAGE_MAX_COUNT} photos.`);
      return;
    }

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      const validation = imageFileSchema.safeParse(file);
      if (!validation.success) {
        toast.error(
          `${file.name}: ${validation.error.issues[0]?.message ?? "Choose a valid image."}`,
        );
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      previewPhotoUrls.current.add(previewUrl);
      setNewPhotos((current) => current.length >= MARKETPLACE_IMAGE_MAX_COUNT
        ? current
        : [...current, { file, previewUrl }]);
    });
  };

  const removePhoto = (index: number) => {
    const removedPhoto = newPhotos[index];
    if (removedPhoto) {
      URL.revokeObjectURL(removedPhoto.previewUrl);
      previewPhotoUrls.current.delete(removedPhoto.previewUrl);
    }
    setNewPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setActivePhotoIndex((current) => current > index ? current - 1 : current >= newPhotos.length - 1 ? Math.max(0, current - 1) : current);
  };

  const previewPhoto = newPhotos[activePhotoIndex]?.previewUrl ?? "";

  const saveListingDraft = () => {
    try {
      window.localStorage.setItem(
        "piecebook_marketplace_draft",
        JSON.stringify({
          title: newTitle,
          price: newPrice,
          quantity: newQuantity,
          sellerEmail: newSellerEmail,
          description: newDescription,
          location: newLocation,
          category: newCategory,
          condition: newCondition,
          categoryDetails: newCategoryDetails,
        }),
      );
      toast.success("Draft saved on this device.");
    } catch {
      toast.error("This browser could not save the draft.");
    }
  };

  const pageTitle =
    activeView === "selling"
      ? "Manage your listings"
      : activeView === "saved"
        ? "Saved items"
        : searchTerm
          ? "Search results"
          : activeCategory || "Browse All";
  const previewListing: Listing = {
    id: "listing-preview",
    sellerId: currentUser?.id,
    title: newTitle.trim() || "Your item title",
    price: Number(newPrice) || 0,
    quantity: Number(newQuantity) || 1,
    location: newLocation.trim() || "Add a pickup location",
    category: newCategory,
    image: previewPhoto,
    photos: newPhotos.map(({ previewUrl }) => previewUrl),
    condition: newCondition,
    status: "available",
    categoryDetails: newCategoryDetails,
    seller: "You",
    description: newDescription.trim() || "Your description will appear here.",
    listed: "a few seconds ago",
    createdAt: "",
  };
  const filterCategories = marketplaceCategories;
  const filterConditions = Array.from(new Set(listings.map(({ condition }) => condition))).sort();
  const hasActiveMarketplaceView =
    activeView !== "browse" ||
    Boolean(activeCategory);

  const showAllListings = () => {
    setSearchTerm("");
    chooseView("browse");
    chooseFilterCategory(null);
    setConditionFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
  };

  const historyContent =
    activeView === "purchases" || activeView === "sales"
      ? isProfileLoading
        ? (
          <main className="scrollbar-hide h-full min-h-0 overflow-y-auto bg-background px-3 py-4 sm:px-5 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <MarketplaceOrderHistorySkeleton />
            </div>
          </main>
        )
        : !currentUser
          ? (
        <main className="flex h-full items-center justify-center bg-background p-4">
          <Card className="max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Choose a profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a profile to view order history.</p>
          </Card>
        </main>
          )
          : (
            <MarketplaceOrderHistory
              key={`${currentUser.id}-${activeView}`}
              profileId={currentUser.id}
              role={activeView === "purchases" ? "buyer" : "seller"}
            />
          )
      : null;

  return (
    <>
      {historyContent ?? (
      <div className="relative flex h-full min-h-0 min-w-0 flex-col text-foreground">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 sm:px-5 sm:pt-5 lg:px-6 xl:px-8">
        <header className="mb-3 w-full min-w-0 shrink-0 sm:mb-5">
          <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-primary sm:block">Marketplace</p>
              <h1 className="truncate text-xl font-bold leading-tight tracking-tight sm:mt-1 sm:text-3xl">
                {activeCategory ?? (searchTerm ? "Search results" : pageTitle)}
              </h1>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                Find something useful from people in your community.
              </p>
            </div>
            {hasActiveMarketplaceView && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={showAllListings}
                className="mt-1 shrink-0 rounded-xl bg-card/80"
              >
                <ArrowLeft className="size-4" />
                <span>All listings</span>
              </Button>
            )}
          </div>
          <MarketplaceSearchFilters
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            category={activeCategory}
            onCategoryChange={chooseFilterCategory}
            condition={conditionFilter}
            onConditionChange={setConditionFilter}
            minPrice={minPriceFilter}
            onMinPriceChange={setMinPriceFilter}
            maxPrice={maxPriceFilter}
            onMaxPriceChange={setMaxPriceFilter}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            categories={filterCategories}
            conditions={filterConditions}
          />
        </header>

        <div className="mb-3 flex min-w-0 shrink-0 items-baseline justify-between gap-2">
          <h2 className="min-w-0 text-base font-semibold tracking-tight sm:text-lg">
            {activeView === "selling" ? "Your listings" : activeView === "saved" ? "Saved items" : "Marketplace listings"}
          </h2>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
          </span>
        </div>

        <Scroller hideScrollbar className="scrollbar-hide min-h-0 min-w-0 w-full flex-1 px-0.5 pb-6 pt-1">
          {listingsSnapshot.status === "loading" ? (
            <MarketplaceListingsSkeleton />
          ) : listingsSnapshot.status === "error" ? (
            <Card className="rounded-2xl border bg-card px-5 py-12 text-center shadow-sm">
              <h3 className="text-lg font-semibold">Marketplace listings could not load</h3>
              <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{listingsSnapshot.error}</p>
              <Button onClick={() => void refreshMarketplaceListings()} className="mt-5 rounded-xl">Try again</Button>
            </Card>
          ) : filteredListings.length > 0 ? (
            <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-4">
              {filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} isSaved={savedListingIds.includes(listing.id)} onSave={() => toggleSavedListing(listing.id)} />)}
            </div>
          ) : (
            <Card className="rounded-2xl border bg-card px-5 py-12 text-center shadow-sm">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Search className="size-6" /></span>
              <h3 className="mt-4 text-lg font-semibold">No listings found</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Try another search or category, or create a listing of your own.</p>
              <Button onClick={showAllListings} variant="secondary" className="mt-5 rounded-xl self-center px-10 max-w-md">Reset filters</Button>
            </Card>
          )}
        </Scroller>
      </main>
      </div>
      )}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent showCloseButton={false} className="h-[min(92dvh,60rem)]! max-h-[92dvh]! w-[calc(100vw-1rem)]! max-w-[min(76rem,calc(100vw-1rem))]! overflow-hidden rounded-2xl bg-card p-0 shadow-2xl">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-0 flex-1">
              <section className="flex min-h-0 w-full flex-col border-r border-border/70 bg-card xl:w-[32%] xl:shrink-0" aria-label="New listing details">
                <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-4 text-left sm:px-5">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DialogClose
                        render={<Button type="button" variant="ghost" size="icon" aria-label="Close listing form" className="size-9 shrink-0 rounded-full" />}
                      >
                        <X className="size-4" />
                      </DialogClose>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Marketplace</p>
                        <DialogTitle className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Item for sale</DialogTitle>
                      </div>
                    </div>
                    <Button type="button" variant="link" onClick={saveListingDraft} className="h-auto shrink-0 px-1 pb-1 text-sm font-semibold text-primary">Save draft</Button>
                  </div>
                  <DialogDescription className="sr-only">Add photos and details for your Marketplace listing, with a live preview.</DialogDescription>
                </DialogHeader>

                <form id="create-listing-form" onSubmit={createListing} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-5">
                  <section aria-labelledby="listing-photos-heading">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 id="listing-photos-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos ({newPhotos.length} / {MARKETPLACE_IMAGE_MAX_COUNT})</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
                      {newPhotos.map((photo, index) => (
                        <div key={`${index}-${photo.file.name}-${photo.file.lastModified}`} className="relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted">
                          <button type="button" onClick={() => setActivePhotoIndex(index)} aria-label={`Preview photo ${index + 1}`} className="absolute inset-0 z-0">
                            <Image src={photo.previewUrl} alt={`Listing photo ${index + 1}`} fill unoptimized className="object-cover" />
                          </button>
                          <Button type="button" variant="secondary" size="icon" aria-label={`Remove photo ${index + 1}`} onClick={() => removePhoto(index)} className="absolute right-1.5 top-1.5 z-10 size-7 rounded-full bg-card shadow-sm">
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                      {newPhotos.length < MARKETPLACE_IMAGE_MAX_COUNT && (
                        <div className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-2 text-center text-muted-foreground transition-colors hover:bg-primary/10">
                          <Plus className="size-5" />
                          <span className="text-sm">Add photo</span>
                          <Input id="listing-photo" type="file" multiple accept="image/*" aria-label="Choose listing photos" onChange={(event) => { handlePhotoUpload(event.target.files); event.currentTarget.value = ""; }} className="sr-only" />
                          <label htmlFor="listing-photo" className="absolute inset-0 cursor-pointer" />
                        </div>
                      )}
                    </div>
                  </section>

                  <section aria-labelledby="required-fields-heading" className="mt-6 space-y-3.5">
                    <div>
                      <h2 id="required-fields-heading" className="text-lg font-semibold">Required</h2>
                      <p className="text-sm text-muted-foreground">Be as descriptive as possible.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label htmlFor="listing-title" className="text-sm font-medium">Title</label>
                        <Input id="listing-title" required maxLength={80} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What are you selling?" className="h-12 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="listing-price" className="text-sm font-medium">Price</label>
                        <Input id="listing-price" required min="0" step="1" type="number" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} placeholder="$ Price" className="h-12 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="listing-quantity" className="text-sm font-medium">Quantity available</label>
                        <Input id="listing-quantity" required min="1" step="1" type="number" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} className="h-12 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="listing-location" className="text-sm font-medium">Pickup location</label>
                        <Input id="listing-location" required maxLength={120} value={newLocation} onChange={(event) => setNewLocation(event.target.value)} placeholder="City or neighborhood" className="h-12 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="listing-category" className="text-sm font-medium">Category</label>
                        <Select value={newCategory} onValueChange={(value) => {
                          const category = String(value ?? "Classifieds") as Listing["category"];
                          setNewCategory(category);
                          setNewCategoryDetails((current) => Object.fromEntries(Object.entries(current).filter(([field]) => categoryDetailFields[category].includes(field))));
                        }}>
                          <SelectTrigger id="listing-category" className="h-12 w-full rounded-xl text-sm">
                            <SelectValue placeholder="Choose a category" />
                          </SelectTrigger>
                          <SelectContent>
                      {marketplaceCategories.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="listing-condition" className="text-sm font-medium">Condition</label>
                        <Select value={newCondition} onValueChange={(value) => setNewCondition(String(value ?? "Used - good"))}>
                          <SelectTrigger id="listing-condition" className="h-12 w-full rounded-xl text-sm">
                            <SelectValue placeholder="Choose a condition" />
                          </SelectTrigger>
                          <SelectContent>
                            {marketplaceConditions.map((condition) => <SelectItem key={condition} value={condition}>{condition}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="listing-description" className="text-sm font-medium">Description</label>
                        <Textarea id="listing-description" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Share details about condition, pickup, and more" rows={5} className="w-full resize-y rounded-xl text-sm" />
                      </div>
                    </div>
                  </section>

                  <section aria-labelledby="listing-seller-email-heading" className="mt-6 space-y-3">
                    <div>
                      <h2 id="listing-seller-email-heading" className="text-base font-semibold">
                        Seller contact email
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Optional. We’ll use this for order notifications to you.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="listing-seller-email" className="text-sm font-medium">
                        Seller email (use to send an email)
                      </label>
                      <Input
                        id="listing-seller-email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={newSellerEmail}
                        onChange={(event) => setNewSellerEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="h-12 rounded-xl text-sm"
                      />
                    </div>
                  </section>

                  <details className="group mt-6 border-t border-border/70 py-4">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <span><span className="block text-base font-semibold">{newCategory} details</span><span className="text-sm text-muted-foreground">Add the details buyers need for this category.</span></span>
                      <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {categoryDetailFields[newCategory].map((field) => {
                        const fieldId = `listing-detail-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                        return (
                          <div key={field} className="space-y-1.5">
                            <label htmlFor={fieldId} className="text-sm font-medium">{field}</label>
                            <Input id={fieldId} value={newCategoryDetails[field] ?? ""} onChange={(event) => setNewCategoryDetails((current) => ({ ...current, [field]: event.target.value }))} placeholder={field} className="h-11 rounded-xl text-sm" />
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </form>

                <div className="shrink-0 border-t border-border/70 bg-card px-4 py-3 sm:px-5">
                  <Button form="create-listing-form" type="submit" disabled={isPublishing || !newTitle.trim() || !newPrice} className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm">{isPublishing ? "Publishing…" : "Publish listing"}</Button>
                </div>
              </section>

              <section className="hidden min-h-0 min-w-0 flex-1 flex-col bg-muted/20 p-5 xl:flex 2xl:p-7" aria-label="Listing preview">
                <Card className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card p-0 shadow-sm">
                  <ListingDetailsView
                    listing={previewListing}
                    photos={newPhotos.map(({ previewUrl }) => previewUrl)}
                    activeIndex={activePhotoIndex}
                    onActiveIndexChange={setActivePhotoIndex}
                    priceLabel={newPrice ? formatPrice(Number(newPrice)) : "Set a price"}
                    onMessage={() => toast.info("Publish your listing to start receiving messages.")}
                    onSave={saveListingDraft}
                    layoutClassName="grid h-full min-h-0 grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]"
                    imageClassName="min-h-0"
                  />
                </Card>
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
