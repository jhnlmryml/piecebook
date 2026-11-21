"use client";

import { CircleAlert, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scroller } from "@/components/ui/scroller";
import { MessagingConversationListSkeleton } from "@/components/shared/LoadingSkeletons";
import { getInitials } from "@/lib/get-initials";
import type { MessageWithReactions } from "@/lib/messaging";
import type { MarketplaceMessageListing } from "@/lib/messaging-events";
import type { UserProfile } from "@/types/user-profile";

export type ListingConversationPreview = {
  profile: UserProfile;
  latestMessage: MessageWithReactions;
  unreadCount: number;
};

type MessagingListingConversationsDialogProps = {
  listing: MarketplaceMessageListing | null;
  conversations: ListingConversationPreview[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onSelectProfile: (profileId: string) => void;
};

export function MessagingListingConversationsDialog({
  listing,
  conversations,
  isLoading,
  error,
  onClose,
  onSelectProfile,
}: MessagingListingConversationsDialogProps) {
  return (
    <Dialog open={listing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-3xl border-border/70 bg-card p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-5 py-5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Marketplace inbox
          </p>
          <DialogTitle className="pr-8 text-xl font-semibold tracking-tight">
            Messages about {listing?.title}
          </DialogTitle>
          <DialogDescription className="leading-5">
            Choose someone who has messaged you about this item to open your conversation.
          </DialogDescription>
        </DialogHeader>
        <Scroller hideScrollbar className="max-h-[60dvh] min-h-0 p-3 sm:p-4">
          {isLoading ? (
            <MessagingConversationListSkeleton />
          ) : error ? (
            <div
              className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-8 text-center"
              role="alert"
            >
              <CircleAlert aria-hidden="true" className="size-6 text-destructive" />
              <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-background/70 px-5 py-9 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle aria-hidden="true" className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold">No conversations yet</p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                Messages from interested buyers about this item will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {conversations.map(({ profile, latestMessage, unreadCount }) => (
                <Button
                  key={profile.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 rounded-2xl px-2.5 py-3 text-left transition-colors hover:bg-muted/70"
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <Avatar className="size-11 shrink-0 rounded-2xl ring-1 ring-border/70">
                    {profile.image && <AvatarImage src={profile.image} alt="" />}
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span                       className="truncate text-sm font-semibold">{profile.full_name}</span>
                      <time
                        dateTime={latestMessage.created_at}
                        className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                      >
                        {new Date(latestMessage.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {latestMessage.body ||
                        latestMessage.attachments[0]?.name ||
                        "Attachment"}
                    </span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold leading-5 text-primary-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </Scroller>
      </DialogContent>
    </Dialog>
  );
}
