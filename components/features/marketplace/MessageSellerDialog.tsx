"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { subscribeToRealtimeChanges } from "@/lib/realtime-events";
import {
  getMarketplaceMessages,
  toggleMarketplaceMessageReaction,
  type MarketplaceMessage,
  type MarketplaceMessageReaction,
  type MarketplaceMessageWithReactions,
} from "@/lib/marketplace-engagement";
import type { Listing } from "./marketplace-data";

const initialMessage = "Hi, is this still available?";

type MessageSellerDialogProps = {
  listing: Listing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canSend: boolean;
  onSend?: (message: string) => Promise<void>;
};

const MESSAGE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageSellerDialog({ listing, open, onOpenChange, canSend, onSend }: MessageSellerDialogProps) {
  const { currentUser, allUsers } = useProfile();
  const [message, setMessage] = useState(initialMessage);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<MarketplaceMessageWithReactions[]>([]);
  const [loadedConversationKey, setLoadedConversationKey] = useState<string | null>(null);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const conversationKey = `${listing.id}:${currentUser?.id ?? ""}`;
  const isLoadingMessages = open && loadedConversationKey !== conversationKey;

  useEffect(() => {
    if (!open || !currentUser) return;
    let active = true;
    void getMarketplaceMessages(listing.id, currentUser.id)
      .then((loadedMessages) => {
        if (active) {
          setMessages((current) => {
            const merged = new Map(loadedMessages.map((item) => [item.id, item]));
            for (const item of current) {
              if (item.listing_id === listing.id && !merged.has(item.id)) {
                merged.set(item.id, item);
              }
            }
            return [...merged.values()].sort(
              (first, second) =>
                new Date(first.created_at).getTime() -
                new Date(second.created_at).getTime(),
            );
          });
          setLoadedConversationKey(conversationKey);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadedConversationKey(conversationKey);
          setSendError(
            error instanceof Error ? error.message : "Could not load messages.",
          );
        }
      });

    const unsubscribe = subscribeToRealtimeChanges((change) => {
      if (change.table === "message") {
        const row = (change.eventType === "DELETE"
          ? change.oldRecord
          : change.newRecord) as unknown as MarketplaceMessage;
        if (!row.id) return;
        if (change.eventType === "DELETE") {
          setMessages((current) => current.filter((item) => item.id !== row.id));
          return;
        }
        if (row.listing_id !== listing.id) return;
        setMessages((current) => {
          const previous = current.find((item) => item.id === row.id);
          return [
            ...current.filter((item) => item.id !== row.id),
            { ...row, reactions: previous?.reactions ?? [] },
          ].sort(
            (first, second) =>
              new Date(first.created_at).getTime() -
              new Date(second.created_at).getTime(),
          );
        });
        return;
      }

      if (change.table !== "message_reactions") return;
      const row = (change.eventType === "DELETE"
        ? change.oldRecord
        : change.newRecord) as unknown as MarketplaceMessageReaction;
      if (!row.id) return;
      setMessages((current) =>
        current.map((item) => {
          if (change.eventType === "DELETE") {
            return {
              ...item,
              reactions: item.reactions.filter((reaction) => reaction.id !== row.id),
            };
          }
          if (item.id !== row.message_id) return item;
          return {
            ...item,
            reactions: [
              ...item.reactions.filter((reaction) => reaction.id !== row.id),
              row,
            ],
          };
        }),
      );
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationKey, currentUser, listing.id, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || !canSend || !onSend) return;

    setIsSending(true);
    setSendError(null);
    try {
      await onSend(trimmedMessage);
      if (currentUser) setMessages(await getMarketplaceMessages(listing.id, currentUser.id));
      setMessage(initialMessage);
      setSendError(null);
      return;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not send your message.");
    } finally {
      setIsSending(false);
    }
  };

  async function handleReaction(messageId: string, reaction: string) {
    if (!currentUser || reactingMessageId) return;
    setReactingMessageId(messageId);
    try {
      await toggleMarketplaceMessageReaction({
        messageId,
        profileId: currentUser.id,
        reaction,
      });
      setMessages(await getMarketplaceMessages(listing.id, currentUser.id));
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not update reaction.");
    } finally {
      setReactingMessageId(null);
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setMessage(initialMessage);
      setSendError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {canSend ? "Message seller" : "Listing messages"}
          </DialogTitle>
          <DialogDescription>
            {canSend
              ? `Send a message about this listing to ${listing.seller}.`
              : `Messages about ${listing.title}. You can react to each message.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-sm border border-border bg-muted/40 p-3">
          <p className="line-clamp-2 text-sm font-semibold">{listing.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {listing.location} · {listing.price === 0 ? "Free" : `$${listing.price.toLocaleString()}`}
          </p>
        </div>

        <section aria-label="Message conversation" className="max-h-[min(40dvh,24rem)] space-y-3 overflow-y-auto rounded-sm border border-border p-3">
          {isLoadingMessages ? (
            <p className="text-sm text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              No messages yet. {canSend ? "Send the seller a message to start." : "Messages will appear here."}
            </p>
          ) : (
            messages.map((item) => {
              const author = allUsers.find((user) => user.id === item.sender_id);
              const isOwnMessage = item.sender_id === currentUser?.id;
              return (
                <article key={item.id} className={`flex items-start gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                  <Avatar className="size-8 shrink-0">
                    {author?.image && <AvatarImage src={author.image} alt={author.full_name} />}
                    <AvatarFallback className="text-[10px]">{author ? getInitials(author.full_name) : "?"}</AvatarFallback>
                  </Avatar>
                  <div className={`min-w-0 max-w-[85%] ${isOwnMessage ? "text-right" : ""}`}>
                    <div className={`rounded-md px-3 py-2 text-left ${isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[10px] opacity-75">
                        <span className="font-semibold">{author?.full_name ?? "Piecebook member"}</span>
                        <LocalDateTime dateTime={item.created_at} />
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.body}</p>
                    </div>
                    <div className={`mt-1 flex flex-wrap gap-1 ${isOwnMessage ? "justify-end" : ""}`}>
                      {MESSAGE_REACTIONS.map((emoji) => {
                        const matching = item.reactions.filter((reaction) => reaction.reaction === emoji);
                        const reacted = matching.some((reaction) => reaction.user_id === currentUser?.id);
                        return (
                          <Button
                            key={emoji}
                            type="button"
                            size="xs"
                            variant={reacted ? "secondary" : "ghost"}
                            aria-label={`${reacted ? "Remove" : "Add"} ${emoji} reaction`}
                            aria-pressed={reacted}
                            disabled={!currentUser || reactingMessageId === item.id}
                            onClick={() => void handleReaction(item.id, emoji)}
                            className="h-6 min-w-7 rounded-full px-1.5 text-xs"
                          >
                            {emoji}{matching.length > 0 && <span>{matching.length}</span>}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {canSend && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="marketplace-seller-message" className="text-sm font-medium">Your message</label>
              <Textarea
                id="marketplace-seller-message"
                required
                maxLength={1000}
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask the seller about this item"
                className="min-h-20 resize-y rounded-sm text-sm"
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
            </div>
            {sendError && <p role="alert" className="text-sm text-destructive">{sendError}</p>}

            <DialogFooter className="sm:justify-end">
              <Button type="button" variant="secondary" disabled={isSending} onClick={() => handleOpenChange(false)} className="rounded-sm">Close</Button>
              <Button type="submit" disabled={isSending || !message.trim()} className="rounded-sm">
                {isSending ? "Sending…" : "Send message"}
              </Button>
            </DialogFooter>
          </form>
        )}
        {!canSend && (
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} className="rounded-sm">Close</Button>
          </DialogFooter>
        )}
        {sendError && !canSend && <p role="alert" className="text-sm text-destructive">{sendError}</p>}
      </DialogContent>
    </Dialog>
  );
}
