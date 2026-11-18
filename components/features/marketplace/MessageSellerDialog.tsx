"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Listing } from "./marketplace-data";

const initialMessage = "Hi, is this still available?";

type MessageSellerDialogProps = {
  listing: Listing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (message: string) => void;
};

export function MessageSellerDialog({ listing, open, onOpenChange, onSend }: MessageSellerDialogProps) {
  const [message, setMessage] = useState(initialMessage);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setMessage(initialMessage);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    onSend(trimmedMessage);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Message seller</DialogTitle>
          <DialogDescription>Send a message about this listing to {listing.seller}.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-sm border border-border bg-muted/40 p-3">
            <p className="line-clamp-2 text-sm font-semibold">{listing.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {listing.location} · {listing.price === 0 ? "Free" : `$${listing.price.toLocaleString()}`}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="marketplace-seller-message" className="text-sm font-medium">Your message</label>
            <Textarea
              id="marketplace-seller-message"
              autoFocus
              required
              maxLength={1000}
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask the seller about this item"
              className="min-h-28 resize-y rounded-sm text-sm"
            />
            <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim()} className="rounded-sm">
              Message seller
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
