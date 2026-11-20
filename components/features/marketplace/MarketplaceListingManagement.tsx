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
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-border bg-muted/40 p-3">
        <p className="mr-auto text-sm font-medium">Manage your listing</p>
        <Button type="button" variant="outline" size="sm" onClick={openEditor}>
          <Pencil className="size-4" />Edit listing
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
          <Trash2 className="size-4" />Delete
        </Button>
      </div>

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        if (!isSaving) setIsEditOpen(open);
      }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-md">
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription>Update your item details and availability.</DialogDescription>
          </DialogHeader>
          <form id="edit-marketplace-listing-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-listing-title" className="text-sm font-medium">Title</label>
              <Input id="edit-listing-title" required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="edit-listing-price" className="text-sm font-medium">Price</label>
                <Input id="edit-listing-price" required min="0" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-listing-quantity" className="text-sm font-medium">Quantity available</label>
                <Input id="edit-listing-quantity" required min="0" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-listing-location" className="text-sm font-medium">Location</label>
                <Input id="edit-listing-location" required maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="edit-listing-category" className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={(value) => {
                  const nextCategory = String(value ?? "Classifieds") as Listing["category"];
                  setCategory(nextCategory);
                  setCategoryDetails((current) => Object.fromEntries(
                    Object.entries(current).filter(([field]) => categoryDetailFields[nextCategory].includes(field)),
                  ));
                }}>
                  <SelectTrigger id="edit-listing-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {marketplaceCategories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-listing-condition" className="text-sm font-medium">Condition</label>
                <Select value={condition} onValueChange={(value) => setCondition(String(value ?? ""))}>
                  <SelectTrigger id="edit-listing-condition"><SelectValue /></SelectTrigger>
                  <SelectContent>
                  {marketplaceConditions.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-listing-status" className="text-sm font-medium">Item status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as ListingStatus)}>
                <SelectTrigger id="edit-listing-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {listingStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-listing-description" className="text-sm font-medium">Description</label>
              <Textarea id="edit-listing-description" maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            {categoryDetailFields[category].map((field) => {
              const fieldId = `edit-listing-detail-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              return (
                <div key={field} className="space-y-1.5">
                  <label htmlFor={fieldId} className="text-sm font-medium">{field}</label>
                  <Input id={fieldId} value={categoryDetails[field] ?? ""} onChange={(event) => setCategoryDetails((current) => ({ ...current, [field]: event.target.value }))} />
                </div>
              );
            })}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" form="edit-marketplace-listing-form" disabled={isSaving}>
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
