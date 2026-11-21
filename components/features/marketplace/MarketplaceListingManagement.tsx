"use client";

import { useState, type SubmitEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  categoryDetailFields,
  deleteMarketplaceListing,
  marketplaceCategories,
  marketplaceConditions,
  marketplaceListingUpdateFormSchema,
  updateMarketplaceListing,
  type Listing,
  type ListingStatus,
} from "./marketplace-data";

type MarketplaceListingManagementProps = {
  listing: Listing;
  sellerId: string;
  onDeleted: () => void;
};

const listingStatuses: { value: ListingStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

export function MarketplaceListingManagement({
  listing,
  sellerId,
  onDeleted,
}: MarketplaceListingManagementProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(listing.price));
  const [quantity, setQuantity] = useState(String(listing.quantity));
  const [location, setLocation] = useState(listing.location);
  const [category, setCategory] = useState(listing.category);
  const [condition, setCondition] = useState(listing.condition);
  const [status, setStatus] = useState<ListingStatus>(listing.status);
  const [description, setDescription] = useState(listing.description);
  const [categoryDetails, setCategoryDetails] = useState(listing.categoryDetails ?? {});

  const openEditor = () => {
    setTitle(listing.title);
    setPrice(String(listing.price));
    setQuantity(String(listing.quantity));
    setLocation(listing.location);
    setCategory(listing.category);
    setCondition(listing.condition);
    setStatus(listing.status);
    setDescription(listing.description);
    setCategoryDetails(listing.categoryDetails ?? {});
    setIsEditOpen(true);
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = marketplaceListingUpdateFormSchema.safeParse({
      title,
      price,
      quantity,
      location,
      category,
      condition,
      description,
      status,
      categoryDetails,
    });
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Check your listing and try again.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await updateMarketplaceListing({
        id: listing.id,
        sellerId,
        ...validation.data,
      });
      setIsEditOpen(false);
      toast.success("Listing updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this listing.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const cleanupWarning = await deleteMarketplaceListing(listing, sellerId);
      setIsDeleteOpen(false);
      onDeleted();
      if (cleanupWarning) toast.warning(cleanupWarning);
      else toast.success("Listing deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this listing.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={openEditor}
        aria-label="Edit listing"
        title="Edit listing"
        className="h-11 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-semibold sm:text-sm"
      >
          <Pencil className="size-4" />Edit
        </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setIsDeleteOpen(true)}
        aria-label="Delete listing"
        title="Delete listing"
        className="h-11 shrink-0 gap-1.5 rounded-xl px-2.5 text-xs font-semibold sm:text-sm"
      >
          <Trash2 className="size-4" />Delete
        </Button>

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        if (!isSaving) setIsEditOpen(open);
      }}>
        <DialogContent className="flex max-h-[90dvh] min-h-0 w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription>Update your item details and availability.</DialogDescription>
          </DialogHeader>
          <form id="edit-marketplace-listing-form" onSubmit={handleSave} className="scrollbar-hide min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid min-w-0 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <label htmlFor="edit-listing-title" className="text-sm font-medium">Title</label>
                <Input id="edit-listing-title" required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="edit-listing-price" className="text-sm font-medium">Price</label>
                <Input id="edit-listing-price" required min="0" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} className="h-11 w-full rounded-xl" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="edit-listing-quantity" className="text-sm font-medium">Quantity available</label>
                <Input id="edit-listing-quantity" required min="0" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-11 w-full rounded-xl" />
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <label htmlFor="edit-listing-location" className="text-sm font-medium">Location</label>
                <Input id="edit-listing-location" required maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} className="h-11 w-full rounded-xl" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="edit-listing-category" className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={(value) => {
                  const nextCategory = String(value ?? "Classifieds") as Listing["category"];
                  setCategory(nextCategory);
                  setCategoryDetails((current) => Object.fromEntries(
                    Object.entries(current).filter(([field]) => categoryDetailFields[nextCategory].includes(field)),
                  ));
                }}>
                  <SelectTrigger id="edit-listing-category" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64 min-w-48">
                    {marketplaceCategories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="edit-listing-condition" className="text-sm font-medium">Condition</label>
                <Select value={condition} onValueChange={(value) => setCondition(String(value ?? ""))}>
                  <SelectTrigger id="edit-listing-condition" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64 min-w-48">
                  {marketplaceConditions.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <label htmlFor="edit-listing-status" className="text-sm font-medium">Item status</label>
                <Select value={status} onValueChange={(value) => setStatus(value as ListingStatus)}>
                  <SelectTrigger id="edit-listing-status" className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64 min-w-48">
                    {listingStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <label htmlFor="edit-listing-description" className="text-sm font-medium">Description</label>
                <Textarea id="edit-listing-description" maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="field-sizing-fixed min-h-32 min-w-0 w-full max-w-full resize-y wrap-break-word rounded-xl" />
              </div>
              {categoryDetailFields[category].map((field) => {
                const fieldId = `edit-listing-detail-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                return (
                  <div key={field} className="min-w-0 space-y-1.5">
                    <label htmlFor={fieldId} className="text-sm font-medium">{field}</label>
                    <Input id={fieldId} value={categoryDetails[field] ?? ""} onChange={(event) => setCategoryDetails((current) => ({ ...current, [field]: event.target.value }))} className="h-11 w-full rounded-xl" />
                  </div>
                );
              })}
            </div>
          </form>
          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsEditOpen(false)} className="h-10 w-full rounded-xl sm:w-auto">Cancel</Button>
            <Button type="submit" form="edit-marketplace-listing-form" disabled={isSaving} className="h-10 w-full rounded-xl sm:min-w-32 sm:w-auto">
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => {
        if (!isDeleting) setIsDeleteOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the listing and its related messages and comments.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}>
              {isDeleting ? "Deleting…" : "Delete listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
