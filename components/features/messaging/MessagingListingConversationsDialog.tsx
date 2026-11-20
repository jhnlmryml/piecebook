"use client";

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
      <DialogContent className="max-h-[85dvh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8">Messages about {listing?.title}</DialogTitle>
          <DialogDescription>
            Choose someone who has messaged you about this item to open your conversation.
          </DialogDescription>
        </DialogHeader>
        <Scroller hideScrollbar className="max-h-[60dvh] min-h-0">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground" role="status">
              Loading item conversations…
            </p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : conversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No conversations have started about this item yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations.map(({ profile, latestMessage, unreadCount }) => (
                <Button
                  key={profile.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 px-2 py-3 text-left"
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <Avatar className="size-10 shrink-0">
                    {profile.image && <AvatarImage src={profile.image} alt="" />}
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{profile.full_name}</span>
                      <time
                        dateTime={latestMessage.created_at}
                        className="shrink-0 text-[10px] text-muted-foreground"
                      >
                        {new Date(latestMessage.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {latestMessage.body ||
                        latestMessage.attachments[0]?.name ||
                        "Attachment"}
                    </span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
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
