"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Copy, Mail, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Message as MessagePrimitive,
  MessageContent,
  MessageFooter,
  MessageGroup as MessageGroupList,
} from "@/components/ui/message";
import { Scroller } from "@/components/ui/scroller";
import {
  ParticleBurst,
  ParticleDissolve,
} from "@/components/shared/ParticleDissolve";
import { MessagingThreadSkeleton } from "@/components/shared/LoadingSkeletons";
import { MessageAttachments } from "@/components/features/messaging/MessageAttachments";
import { MarketplaceMessageAttachmentCard } from "@/components/features/messaging/MarketplaceMessageCards";
import { getInitials } from "@/lib/get-initials";
import type { MessageWithReactions } from "@/lib/messaging";
import type { MarketplaceMessageListing } from "@/lib/messaging-events";
import type { MarketplaceOrder } from "@/components/features/marketplace/marketplace-data";
import type { UserProfile } from "@/types/user-profile";
import { isWithinEditWindow, MESSAGE_REACTIONS } from "./messaging-constants";
import type { MessageDeleteTarget, MessageSenderGroup } from "./messaging-types";
import { useLongPressMenu } from "./useLongPressMenu";

type MessagingThreadProps = {
  activeProfile: UserProfile;
  currentUserId: string | null;
  now: number;
  isLoading: boolean;
  isOpen: boolean;
  messageGroups: MessageSenderGroup[];
  marketplaceListings: Record<string, MarketplaceMessageListing | null>;
  marketplaceOrders: Record<string, MarketplaceOrder | null>;
  exitingMessageIds: ReadonlySet<string>;
  onViewListing: () => void;
  onReact: (messageId: string, reaction: string) => void | Promise<void>;
  reactingMessageIds: ReadonlySet<string>;
  onCopy: (body: string) => void | Promise<void>;
  onEdit: (message: MessageWithReactions) => void;
  onDelete: (target: MessageDeleteTarget) => void;
  onMessageExitComplete: (messageId: string) => void;
};

type MessageBubbleProps = {
  message: MessageWithReactions;
  isExiting: boolean;
  isOwnMessage: boolean;
  currentUserId: string | null;
  now: number;
  marketplaceListing: MarketplaceMessageListing | null | undefined;
  marketplaceOrder: MarketplaceOrder | null | undefined;
  onViewListing: () => void;
  onReact: (messageId: string, reaction: string) => void | Promise<void>;
  reactingMessageIds: ReadonlySet<string>;
  onCopy: (body: string) => void | Promise<void>;
  onEdit: (message: MessageWithReactions) => void;
  onDelete: (target: MessageDeleteTarget) => void;
};

function MessageBubble({
  message,
  isExiting,
  isOwnMessage,
  currentUserId,
  now,
  marketplaceListing,
  marketplaceOrder,
  onViewListing,
  onReact,
  reactingMessageIds,
  onCopy,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const longPress = useLongPressMenu();
  const canEdit =
    isOwnMessage && Boolean(message.body.trim()) && isWithinEditWindow(message, now);
  const currentReaction = message.reactions.find(
    (reaction) => reaction.user_id === currentUserId,
  );
  const reactionCounts = new Map<string, number>();

  for (const reaction of message.reactions) {
    reactionCounts.set(
      reaction.reaction,
      (reactionCounts.get(reaction.reaction) ?? 0) + 1,
    );
  }

  return (
    <ContextMenu
      open={isContextMenuOpen}
      onOpenChange={(isOpen) => {
        setIsContextMenuOpen(isOpen);
        if (!isOpen) longPress.reset();
      }}
    >
      <ContextMenuTrigger
        onTouchStart={() => longPress.start(() => setIsContextMenuOpen(true))}
        onTouchMove={longPress.cancel}
        onTouchEnd={(event) => {
          longPress.cancel();
          if (longPress.wasLongPress()) event.preventDefault();
        }}
        onTouchCancel={longPress.cancel}
        className="w-full select-text"
      >
        <div className={`relative flex w-full flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
          <ParticleBurst isExiting={isExiting} className="w-full min-w-0">
            <Bubble
              variant={isOwnMessage ? "default" : "tinted"}
              align={isOwnMessage ? "end" : "start"}
              className={`w-fit max-w-[min(34rem,88%)] ${
                isOwnMessage ? "ml-auto self-end" : "self-start"
              } ${reactionCounts.size > 0 ? "mb-4" : ""}`}
            >
            <BubbleContent
              title="Right-click or press and hold for message actions"
              className="w-fit max-w-full rounded-2xl border border-border/30 px-3.5 py-2.5 text-sm leading-6 shadow-sm sm:px-4"
            >
              {message.body && (
                <p className="whitespace-pre-wrap wrap-anywhere">{message.body}</p>
              )}
              {(message.listing_id || message.marketplace_order_id) && (
                <MarketplaceMessageAttachmentCard
                  listingId={message.listing_id}
                  orderId={message.marketplace_order_id}
                  listing={marketplaceListing}
                  order={marketplaceOrder}
                  onViewListing={onViewListing}
                />
              )}
              <MessageAttachments attachments={message.attachments} />
              <time
                dateTime={message.created_at}
                className={`mt-1 block text-[10px] opacity-70 ${isOwnMessage ? "text-right" : "text-left"}`}
              >
                {new Date(message.created_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {message.edited_at && " · edited"}
                {(message.listing_id || message.marketplace_order_id) && " · Marketplace"}
              </time>
            </BubbleContent>
            {reactionCounts.size > 0 && (
              <BubbleReactions
                aria-label={`Reactions: ${Array.from(reactionCounts.keys()).join(", ")}`}
                align={isOwnMessage ? "start" : "end"}
                className="flex-nowrap rounded-full border border-border/70 bg-card/95 shadow-sm"
              >
                {Array.from(reactionCounts.entries()).map(([emoji, count]) => (
                  <Button
                    key={emoji}
                    type="button"
                    size="xs"
                    variant={currentReaction?.reaction === emoji ? "secondary" : "ghost"}
                    aria-label={`${count} ${emoji} reactions${
                      currentReaction?.reaction === emoji ? ", remove your reaction" : ""
                    }`}
                    aria-pressed={currentReaction?.reaction === emoji}
                    onClick={() => void onReact(message.id, emoji)}
                    disabled={reactingMessageIds.has(message.id)}
                    className="h-6 min-w-7 shrink-0 rounded-full px-1.5 text-xs"
                  >
                    {emoji}
                  </Button>
                ))}
              </BubbleReactions>
            )}
            </Bubble>
          </ParticleBurst>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-fit min-w-48 rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
        <ContextMenuGroup>
          <div
            role="group"
            aria-label="Choose a reaction"
            className="flex items-center gap-1 rounded-full border border-border bg-muted/70 px-1.5 py-1"
          >
            {MESSAGE_REACTIONS.map((emoji) => (
              <ContextMenuItem
                key={emoji}
                aria-label={`${currentReaction?.reaction === emoji ? "Remove" : "React with"} ${emoji}`}
                aria-pressed={currentReaction?.reaction === emoji}
                onClick={() => void onReact(message.id, emoji)}
                disabled={reactingMessageIds.has(message.id)}
                className={`size-8 justify-center rounded-full px-0 py-1 text-lg ${
                  currentReaction?.reaction === emoji
                    ? "bg-accent text-accent-foreground"
                    : ""
                }`}
              >
                {emoji}
              </ContextMenuItem>
            ))}
          </div>
        </ContextMenuGroup>
        <ContextMenuSeparator className="my-1" />
        {Boolean(message.body.trim()) && (
          <ContextMenuItem
            onClick={() => void onCopy(message.body)}
            className="rounded-lg px-2.5 py-2 text-sm"
          >
            <Copy aria-hidden="true" />
            Copy message
          </ContextMenuItem>
        )}
        {canEdit && (
          <ContextMenuItem
            onClick={() => onEdit(message)}
            className="rounded-lg px-2.5 py-2 text-sm"
          >
            <Pencil aria-hidden="true" />
            Edit message
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => onDelete({ messageId: message.id, mode: "me" })}
          className="rounded-lg px-2.5 py-2 text-sm"
        >
          <Trash2 aria-hidden="true" />
          Delete for me
        </ContextMenuItem>
        {isOwnMessage && (
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDelete({ messageId: message.id, mode: "everyone" })}
            className="rounded-lg px-2.5 py-2 text-sm"
          >
            <Trash2 aria-hidden="true" />
            Delete for everyone
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function MessagingThread({
  activeProfile,
  currentUserId,
  now,
  isLoading,
  isOpen,
  messageGroups,
  marketplaceListings,
  marketplaceOrders,
  exitingMessageIds,
  onViewListing,
  onReact,
  reactingMessageIds,
  onCopy,
  onEdit,
  onDelete,
  onMessageExitComplete,
}: MessagingThreadProps) {
  const messagesScrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !messagesScrollerRef.current) return;
    messagesScrollerRef.current.scrollTo({
      top: messagesScrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeProfile.id, isOpen, messageGroups]);

  return (
    <Scroller
      ref={messagesScrollerRef}
      hideScrollbar
      className="min-h-0 flex-1 bg-background px-3 sm:px-5"
    >
      {isLoading ? (
        <MessagingThreadSkeleton />
      ) : messageGroups.length === 0 ? (
        <div className="flex min-h-full flex-col items-center justify-center px-3 py-8">
          <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-dashed border-border/70 bg-card/70 px-6 py-8 text-center sm:px-8 sm:py-10">
            <Avatar className="size-20 rounded-3xl ring-4 ring-primary/10">
              {activeProfile.image && <AvatarImage src={activeProfile.image} alt="" />}
              <AvatarFallback>{getInitials(activeProfile.full_name)}</AvatarFallback>
            </Avatar>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Start a conversation
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              {activeProfile.full_name}
            </h3>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Mail aria-hidden="true" className="size-3.5" />
              {activeProfile.email}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              {activeProfile.about.slice(0, 1000) +
                (activeProfile.about.length > 1000 ? "…" : "")}
            </p>
            <p className="mt-5 rounded-full bg-primary/5 px-4 py-2 text-xs font-medium text-primary">
              Say hello to {activeProfile.full_name}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-full w-full min-w-0 flex-col justify-end py-4 sm:py-6">
          <MessageGroupList className="w-full min-w-0 gap-4">
            {messageGroups.map((group) => {
              const isOwnMessage = group.senderId === currentUserId;
              const lastMessage = group.messages[group.messages.length - 1];

              return (
                <MessagePrimitive
                  key={group.messages[0].id}
                  align={isOwnMessage ? "end" : "start"}
                  className="group/message items-end gap-2"
                >
                  <MessageContent className="min-w-0 flex-1 gap-1">
                    <BubbleGroup
                      className={`w-full min-w-0 gap-1.5 ${
                        isOwnMessage ? "items-end" : "items-start"
                      }`}
                    >
                      {group.messages.map((message) => (
                        <ParticleDissolve
                          key={message.id}
                          isExiting={exitingMessageIds.has(message.id)}
                          onExitComplete={() => onMessageExitComplete(message.id)}
                          particleCount={0}
                          className={`w-full min-w-0 ${
                            isOwnMessage ? "self-end" : "self-start"
                          }`}
                        >
                          <MessageBubble
                            message={message}
                            isExiting={exitingMessageIds.has(message.id)}
                            isOwnMessage={isOwnMessage}
                            currentUserId={currentUserId}
                            now={now}
                            marketplaceListing={
                              message.listing_id
                                ? marketplaceListings[message.listing_id]
                                : undefined
                            }
                            marketplaceOrder={
                              message.marketplace_order_id
                                ? marketplaceOrders[message.marketplace_order_id]
                                : undefined
                            }
                            onViewListing={onViewListing}
                            onReact={onReact}
                            reactingMessageIds={reactingMessageIds}
                            onCopy={onCopy}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        </ParticleDissolve>
                      ))}
                    </BubbleGroup>
                    <MessageFooter
                      className={`gap-1 px-1 text-[10px] font-normal text-muted-foreground/70 ${
                        isOwnMessage ? "justify-end" : ""
                      }`}
                    >
                      {lastMessage.read_at && isOwnMessage ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCheck aria-hidden="true" className="size-3" />
                          Read
                        </span>
                      ) : isOwnMessage ? (
                        "Sent"
                      ) : null}
                    </MessageFooter>
                  </MessageContent>
                </MessagePrimitive>
              );
            })}
          </MessageGroupList>
        </div>
      )}
    </Scroller>
  );
}
