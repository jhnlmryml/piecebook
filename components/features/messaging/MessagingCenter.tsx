"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  messageDraftSchema,
  messageEditSchema,
} from "@/lib/form-schemas";
import { MessagingComposer } from "@/components/features/messaging/MessagingComposer";
import { MessagingDialogs } from "@/components/features/messaging/MessagingDialogs";
import {
  MessagingListingConversationsDialog,
  type ListingConversationPreview,
} from "@/components/features/messaging/MessagingListingConversationsDialog";
import { MessagingProfileList } from "@/components/features/messaging/MessagingProfileList";
import { MessagingThread } from "@/components/features/messaging/MessagingThread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import {
  deleteConversationForMe,
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  getMessageConversationPreferences,
  getMessages,
  getUnreadMessageCount,
  markMessagesRead,
  setConversationArchived,
  sendMessage,
  toMessageWithReactions,
  type Message,
  type MessageConversationPreference,
  type MessageReaction,
  type MessageWithReactions,
} from "@/lib/messaging";
import {
  subscribeToDirectMessages,
  subscribeToMarketplaceMessaging,
  type MarketplaceMessageListing,
} from "@/lib/messaging-events";
import { toggleMarketplaceMessageReaction } from "@/lib/marketplace-engagement";
import { subscribeToRealtimeChanges } from "@/lib/realtime-events";
import {
  getMarketplaceMessageListing,
  getMarketplaceOrderRecord,
  type MarketplaceOrder,
} from "@/components/features/marketplace/marketplace-data";
import { MARKETPLACE_MESSAGE_PREFILL } from "./messaging-constants";
import type {
  MessageDeleteTarget,
  MessageSenderGroup,
  MessagingConversation,
} from "./messaging-types";
import type { UserProfile } from "@/types/user-profile";

function getListingConversationPreviews(
  messages: MessageWithReactions[],
  listingId: string,
  currentUserId: string,
  profiles: UserProfile[],
): ListingConversationPreview[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const messagesByPartner = new Map<string, MessageWithReactions[]>();

  for (const message of messages) {
    if (message.listing_id !== listingId) continue;
    const partnerId =
      message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    if (partnerId === currentUserId) continue;
    messagesByPartner.set(partnerId, [
      ...(messagesByPartner.get(partnerId) ?? []),
      message,
    ]);
  }

  return [...messagesByPartner.entries()]
    .flatMap(([profileId, partnerMessages]) => {
      const profile = profilesById.get(profileId);
      if (!profile) return [];
      return [
        {
          profile,
          latestMessage: partnerMessages[partnerMessages.length - 1],
          unreadCount: partnerMessages.filter(
            (message) =>
              message.sender_id === profileId &&
              message.recipient_id === currentUserId &&
              !message.read_at,
          ).length,
        },
      ];
    })
    .sort(
      (first, second) =>
        second.latestMessage.created_at.localeCompare(first.latestMessage.created_at),
    );
}

export function MessagingCenter() {
  const { currentUser, allUsers } = useProfile();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MessageWithReactions[]>([]);
  const [exitingMessageIds, setExitingMessageIds] = useState<Set<string>>(new Set());
  const [exitingConversationIds, setExitingConversationIds] = useState<Set<string>>(new Set());
  const [exitingConversations, setExitingConversations] = useState<
    { profile: UserProfile; conversation: MessagingConversation }[]
  >([]);
  const [conversationPreferences, setConversationPreferences] = useState<
    MessageConversationPreference[]
  >([]);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isPeopleListCollapsed, setIsPeopleListCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [marketplaceContext, setMarketplaceContext] =
    useState<MarketplaceMessageListing | null>(null);
  const [marketplaceContextRecipientId, setMarketplaceContextRecipientId] =
    useState<string | null>(null);
  const [marketplaceListings, setMarketplaceListings] = useState<
    Record<string, MarketplaceMessageListing | null>
  >({});
  const [marketplaceOrders, setMarketplaceOrders] = useState<
    Record<string, MarketplaceOrder | null>
  >({});
  const [showArchivedConversations, setShowArchivedConversations] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MessageDeleteTarget | null>(null);
  const [deleteConversationTarget, setDeleteConversationTarget] = useState<string | null>(null);
  const [listingConversationsListing, setListingConversationsListing] =
    useState<MarketplaceMessageListing | null>(null);
  const [listingConversationPreviews, setListingConversationPreviews] = useState<
    ListingConversationPreview[]
  >([]);
  const [isLoadingListingConversations, setIsLoadingListingConversations] = useState(false);
  const [listingConversationsLoadError, setListingConversationsLoadError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const requestedMarketplaceListingsRef = useRef(new Set<string>());
  const requestedMarketplaceOrdersRef = useRef(new Set<string>());
  const messagesRef = useRef(messages);
  const completedMessageExitsRef = useRef(new Set<string>());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const beginMessageDissolve = useCallback((messageId: string) => {
    if (
      completedMessageExitsRef.current.has(messageId) ||
      !messagesRef.current.some((message) => message.id === messageId)
    ) {
      return;
    }
    setExitingMessageIds((current) => new Set(current).add(messageId));
  }, []);

  const finishMessageDissolve = useCallback((messageId: string) => {
    completedMessageExitsRef.current.add(messageId);
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );
    setExitingMessageIds((current) => {
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }, []);

  const activeProfile = allUsers.find((profile) => profile.id === activeProfileId) ?? null;
  const activeMarketplaceContext =
    marketplaceContextRecipientId === activeProfileId ? marketplaceContext : null;
  const editingMessage = editingMessageId
    ? messages.find((message) => message.id === editingMessageId) ?? null
    : null;
  const listingConversationsError =
    listingConversationsListing && !currentUser
      ? "Choose a profile to view item conversations."
      : listingConversationsLoadError;
  const isListingConversationsLoading = Boolean(
    listingConversationsListing && currentUser && isLoadingListingConversations,
  );
  const isLoadingConversations = Boolean(
    open && currentUser && loadedProfileId !== currentUser.id,
  );

  const refreshUnreadCount = useCallback(async (profileId: string) => {
    try {
      setUnreadCount(await getUnreadMessageCount(profileId));
    } catch (loadError) {
      toast.error(
        loadError instanceof Error ? loadError.message : "Could not load unread messages.",
      );
    }
  }, []);

  useEffect(
    () =>
      subscribeToMarketplaceMessaging((request) => {
        if (request.type === "listing-conversations") {
          setMarketplaceContext(null);
          setMarketplaceContextRecipientId(null);
          setListingConversationsListing(request.listing);
          setListingConversationPreviews([]);
          setListingConversationsLoadError(null);
          setIsLoadingListingConversations(true);
          return;
        }

        setDraft((currentDraft) => {
          if (request.partnerId !== activeProfileId) {
            return request.partnerId ? MARKETPLACE_MESSAGE_PREFILL : "";
          }
          return request.partnerId && !currentDraft.trim()
            ? MARKETPLACE_MESSAGE_PREFILL
            : currentDraft;
        });
        if (request.partnerId !== activeProfileId) {
          setFiles([]);
        }
        setEditingMessageId(null);
        setEditDraft("");
        setError(null);
        setMarketplaceContext(request.listing);
        setMarketplaceContextRecipientId(request.partnerId);
        setMarketplaceListings((current) => ({
          ...current,
          [request.listing.id]: request.listing,
        }));
        setActiveProfileId(request.partnerId);
        setIsPeopleListCollapsed(true);
        setShowArchivedConversations(false);
        setOpen(true);
      }),
    [activeProfileId],
  );

  useEffect(
    () =>
      subscribeToDirectMessages((recipientId) => {
        if (!recipientId || recipientId === currentUser?.id) return;

        setListingConversationsListing(null);
        setListingConversationPreviews([]);
        setListingConversationsLoadError(null);
        setIsLoadingListingConversations(false);
        setMarketplaceContext(null);
        setMarketplaceContextRecipientId(null);
        if (recipientId !== activeProfileId) {
          setDraft("");
          setFiles([]);
        }
        setEditingMessageId(null);
        setEditDraft("");
        setError(null);
        setActiveProfileId(recipientId);
        setIsPeopleListCollapsed(true);
        setShowArchivedConversations(false);
        setOpen(true);
      }),
    [activeProfileId, currentUser?.id],
  );

  useEffect(() => {
    const listingIds = new Set(
      messages.flatMap((message) => (message.listing_id ? [message.listing_id] : [])),
    );
    for (const listingId of listingIds) {
      if (
        marketplaceListings[listingId] !== undefined ||
        requestedMarketplaceListingsRef.current.has(listingId)
      ) {
        continue;
      }

      requestedMarketplaceListingsRef.current.add(listingId);
      void getMarketplaceMessageListing(listingId)
        .then((listing) => {
          setMarketplaceListings((current) => ({ ...current, [listingId]: listing }));
        })
        .catch((loadError: unknown) => {
          requestedMarketplaceListingsRef.current.delete(listingId);
          toast.error(
            loadError instanceof Error
              ? loadError.message
              : "Could not load marketplace listing details.",
          );
        });
    }
  }, [marketplaceListings, messages]);

  useEffect(() => {
    const orderIds = new Set(
      messages.flatMap((message) =>
        message.marketplace_order_id ? [message.marketplace_order_id] : [],
      ),
    );
    for (const orderId of orderIds) {
      if (
        marketplaceOrders[orderId] !== undefined ||
        requestedMarketplaceOrdersRef.current.has(orderId)
      ) {
        continue;
      }

      requestedMarketplaceOrdersRef.current.add(orderId);
      void getMarketplaceOrderRecord(orderId)
        .then((order) => {
          setMarketplaceOrders((current) => ({ ...current, [orderId]: order }));
        })
        .catch((loadError: unknown) => {
          requestedMarketplaceOrdersRef.current.delete(orderId);
          toast.error(
            loadError instanceof Error
              ? loadError.message
              : "Could not load marketplace order details.",
          );
        });
    }
  }, [marketplaceOrders, messages]);

  useEffect(() => {
    if (!listingConversationsListing || !currentUser) return;

    let active = true;
    void getMessages(currentUser.id)
      .then((listingMessages) => {
        if (!active) return;
        setListingConversationPreviews(
          getListingConversationPreviews(
            listingMessages,
            listingConversationsListing.id,
            currentUser.id,
            allUsers,
          ),
        );
      })
      .catch((loadError: unknown) => {
        if (active) {
          setListingConversationsLoadError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load item conversations.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingListingConversations(false);
      });

    return () => {
      active = false;
    };
  }, [allUsers, currentUser, listingConversationsListing]);

  useEffect(() => {
    if (!currentUser) return;

    const profileId = currentUser.id;
    void getUnreadMessageCount(profileId)
      .then(setUnreadCount)
      .catch((loadError: unknown) => {
        toast.error(
          loadError instanceof Error ? loadError.message : "Could not load unread messages.",
        );
      });

    return subscribeToRealtimeChanges((change) => {
      if (change.table === "message") {
        const row = (
          change.eventType === "DELETE" ? change.oldRecord : change.newRecord
        ) as unknown as Message;

        if (change.eventType === "DELETE") {
          // Postgres DELETE payloads may contain only the primary key.
          if (!messagesRef.current.some((message) => message.id === row.id)) return;
          beginMessageDissolve(row.id);
        } else if (row.sender_id !== profileId && row.recipient_id !== profileId) {
          return;
        }

        setMessages((current) => {
          if (change.eventType === "DELETE") {
            return current;
          }
          const previous = current.find((message) => message.id === row.id);
          if (change.eventType !== "INSERT" && !previous) return current;
          return [
            ...current.filter((message) => message.id !== row.id),
            toMessageWithReactions(row, previous?.reactions ?? []),
          ].sort(
            (first, second) =>
              new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
          );
        });
        if (change.eventType === "INSERT" && row.sender_id !== profileId) {
          void setConversationArchived(profileId, row.sender_id, false)
            .then((preference) => {
              setConversationPreferences((current) => [
                ...current.filter((item) => item.partner_id !== row.sender_id),
                preference,
              ]);
            })
            .catch((archiveError: unknown) => {
              toast.error(
                archiveError instanceof Error
                  ? archiveError.message
                  : "Could not restore the conversation to your inbox.",
              );
            });
        }
        void refreshUnreadCount(profileId);
        return;
      }

      if (change.table !== "message_reactions") return;
      const row = (
        change.eventType === "DELETE" ? change.oldRecord : change.newRecord
      ) as unknown as MessageReaction;
      setMessages((current) =>
        current.map((message) => {
          if (change.eventType === "DELETE") {
            return {
              ...message,
              reactions: message.reactions.filter((reaction) => reaction.id !== row.id),
            };
          }
          if (message.id !== row.message_id) return message;
          return {
            ...message,
            reactions: [
              ...message.reactions.filter((reaction) => reaction.user_id !== row.user_id),
              row,
            ],
          };
        }),
      );
    });
  }, [beginMessageDissolve, currentUser, refreshUnreadCount]);

  useEffect(() => {
    if (!open || !currentUser) return;
    let active = true;
    void Promise.all([
      getMessages(currentUser.id),
      getMessageConversationPreferences(currentUser.id),
    ])
      .then(([loadedMessages, preferences]) => {
        if (active) {
          setError(null);
          setMessages(loadedMessages);
          setConversationPreferences(preferences);
          setLoadedProfileId(currentUser.id);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load messages.");
          setLoadedProfileId(currentUser.id);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser, open]);

  useEffect(() => {
    if (
      !open ||
      !activeProfileId ||
      !currentUser ||
      !messages.some(
        (message) =>
          message.sender_id === activeProfileId &&
          message.recipient_id === currentUser.id &&
          !message.read_at,
      )
    ) {
      return;
    }
    let active = true;
    void markMessagesRead(currentUser.id, activeProfileId)
      .then(() => {
        if (!active) return;
        const readAt = new Date().toISOString();
        setMessages((current) =>
          current.map((message) =>
            message.sender_id === activeProfileId &&
            message.recipient_id === currentUser.id &&
            !message.read_at
              ? { ...message, read_at: readAt }
              : message,
          ),
        );
        void refreshUnreadCount(currentUser.id);
      })
      .catch((readError: unknown) => {
        if (active) {
          toast.error(
            readError instanceof Error ? readError.message : "Could not mark messages as read.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [activeProfileId, currentUser, messages, open, refreshUnreadCount]);

  useEffect(() => {
    let timer: number;
    const updateClock = () => {
      setClock(Date.now());
      timer = window.setTimeout(updateClock, 60_000);
    };
    timer = window.setTimeout(updateClock, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const conversations = useMemo(() => {
    if (!currentUser) return [];
    const grouped = new Map<string, MessageWithReactions[]>();
    for (const message of messages) {
      const partnerId =
        message.sender_id === currentUser.id ? message.recipient_id : message.sender_id;
      grouped.set(partnerId, [...(grouped.get(partnerId) ?? []), message]);
    }
    return [...grouped.entries()]
      .map(([profileId, threadMessages]) => ({
        profileId,
        messages: threadMessages,
        latest: threadMessages[threadMessages.length - 1],
        unread: threadMessages.filter(
          (message) => message.recipient_id === currentUser.id && !message.read_at,
        ).length,
        archived:
          conversationPreferences.find((preference) => preference.partner_id === profileId)
            ?.archived ?? false,
      }))
      .sort((first, second) => second.latest.created_at.localeCompare(first.latest.created_at));
  }, [conversationPreferences, currentUser, messages]);

  const visibleConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) => conversation.archived === showArchivedConversations,
      ),
    [conversations, showArchivedConversations],
  );

  const filteredPeople = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return allUsers.filter(
      (profile) =>
        profile.id !== currentUser?.id &&
        (!normalizedSearch || profile.full_name.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [allUsers, currentUser, search]);

  const activeMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.sender_id === activeProfileId || message.recipient_id === activeProfileId,
      ),
    [activeProfileId, messages],
  );

  const messageGroups = useMemo<MessageSenderGroup[]>(() => {
    const groups: MessageSenderGroup[] = [];
    for (const message of activeMessages) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.senderId === message.sender_id) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ senderId: message.sender_id, messages: [message] });
      }
    }
    return groups;
  }, [activeMessages]);

  function cancelMessageEdit() {
    setEditingMessageId(null);
    setEditDraft("");
  }

  function startEditingMessage(message: MessageWithReactions) {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
  }

  function selectProfile(profileId: string) {
    cancelMessageEdit();
    if (profileId === activeProfileId && isPeopleListCollapsed) {
      setActiveProfileId(null);
      setIsPeopleListCollapsed(false);
      setDraft("");
      setFiles([]);
      return;
    }
    if (profileId !== activeProfileId) {
      setDraft("");
      setFiles([]);
    }
    setActiveProfileId(profileId);
    setIsPeopleListCollapsed(true);
  }

  function clearActiveProfile() {
    cancelMessageEdit();
    setActiveProfileId(null);
    setIsPeopleListCollapsed(false);
    setDraft("");
    setFiles([]);
  }

  function handleSheetOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMarketplaceContext(null);
      setMarketplaceContextRecipientId(null);
      setExitingConversationIds(new Set());
      setExitingConversations([]);
    }
  }

  function openListingConversation(profileId: string) {
    setListingConversationsListing(null);
    setMarketplaceContext(null);
    setMarketplaceContextRecipientId(null);
    setError(null);
    cancelMessageEdit();
    if (profileId !== activeProfileId) {
      setDraft("");
      setFiles([]);
    }
    setActiveProfileId(profileId);
    setIsPeopleListCollapsed(true);
    setShowArchivedConversations(false);
    setOpen(true);
  }

  async function handleSend(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !activeProfile || isSending) return;
    const validation = messageDraftSchema.safeParse({ body: draft, files });
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ?? "Check your message and try again.",
      );
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await sendMessage({
        senderId: currentUser.id,
        recipientId: activeProfile.id,
        body: validation.data.body,
        files,
        listingId: activeMarketplaceContext?.id,
      });
      setMarketplaceContext(null);
      setMarketplaceContextRecipientId(null);
      setDraft("");
      setFiles([]);
      setMessages(await getMessages(currentUser.id));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleReaction(messageId: string, reaction: string) {
    if (!currentUser) return;
    try {
      const currentReaction =
        messages
          .find((message) => message.id === messageId)
          ?.reactions.find((item) => item.user_id === currentUser.id)?.reaction ??
        null;
      await toggleMarketplaceMessageReaction({
        messageId,
        profileId: currentUser.id,
        reaction,
        currentReaction,
      });
      setMessages(await getMessages(currentUser.id));
    } catch (reactionError) {
      toast.error(
        reactionError instanceof Error ? reactionError.message : "Could not update reaction.",
      );
    }
  }

  async function handleCopyMessage(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Message copied.");
    } catch (copyError) {
      toast.error(copyError instanceof Error ? copyError.message : "Could not copy message.");
    }
  }

  async function handleEdit(messageId: string) {
    if (!currentUser || isSending) return;
    const validation = messageEditSchema.safeParse(editDraft);
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Check your message and try again.",
      );
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await editMessage(messageId, currentUser.id, editDraft);
      cancelMessageEdit();
      setMessages(await getMessages(currentUser.id));
    } catch (editError) {
      toast.error(editError instanceof Error ? editError.message : "Could not edit message.");
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerSubmit(event: SubmitEvent<HTMLFormElement>) {
    if (editingMessageId) {
      event.preventDefault();
      void handleEdit(editingMessageId);
      return;
    }
    void handleSend(event);
  }

  async function handleDelete() {
    if (!currentUser || !deleteTarget) return;
    try {
      let cleanupWarning: string | null = null;
      if (deleteTarget.mode === "everyone") {
        const result = await deleteMessageForEveryone(
          deleteTarget.messageId,
          currentUser.id,
        );
        cleanupWarning = result.cleanupWarning;
      } else {
        await deleteMessageForMe(deleteTarget.messageId, currentUser.id);
      }
      beginMessageDissolve(deleteTarget.messageId);
      if (editingMessageId === deleteTarget.messageId) cancelMessageEdit();
      setDeleteTarget(null);
      void refreshUnreadCount(currentUser.id);
      if (cleanupWarning) toast.warning(cleanupWarning);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Could not delete message.",
      );
    }
  }

  async function handleArchiveConversation(profileId: string, archived: boolean) {
    if (!currentUser) return;
    try {
      const preference = await setConversationArchived(currentUser.id, profileId, archived);
      setConversationPreferences((current) => [
        ...current.filter((item) => item.partner_id !== profileId),
        preference,
      ]);
      if (activeProfileId === profileId) clearActiveProfile();
      toast.success(
        archived ? "Conversation archived." : "Conversation restored to your inbox.",
      );
    } catch (archiveError) {
      toast.error(
        archiveError instanceof Error ? archiveError.message : "Could not update conversation.",
      );
    }
  }

  async function handleDeleteConversation() {
    if (!currentUser || !deleteConversationTarget) return;
    const profileId = deleteConversationTarget;
    try {
      const preference = await deleteConversationForMe(currentUser.id, profileId);
      const conversation = conversations.find(
        (item) => item.profileId === profileId,
      );
      const profile = allUsers.find((item) => item.id === profileId);
      if (conversation && profile) {
        setExitingConversations((current) => [
          ...current.filter((item) => item.profile.id !== profileId),
          { profile, conversation },
        ]);
        setExitingConversationIds((current) => new Set(current).add(profileId));
      }
      setConversationPreferences((current) => [
        ...current.filter((item) => item.partner_id !== profileId),
        preference,
      ]);
      setMessages((current) =>
        current.filter(
          (message) => message.sender_id !== profileId && message.recipient_id !== profileId,
        ),
      );
      if (activeProfileId === profileId) clearActiveProfile();
      setDeleteConversationTarget(null);
      void refreshUnreadCount(currentUser.id);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Could not delete conversation.",
      );
    }
  }

  function finishConversationDissolve(profileId: string) {
    setExitingConversations((current) =>
      current.filter((item) => item.profile.id !== profileId),
    );
    setExitingConversationIds((current) => {
      const next = new Set(current);
      next.delete(profileId);
      return next;
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative size-9 shrink-0 rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        aria-label={`Messages${unreadCount ? `, ${unreadCount} unread` : ""}`}
        title="Messages"
        onClick={() => {
          setMarketplaceContext(null);
          setMarketplaceContextRecipientId(null);
          setOpen(true);
        }}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          className="w-full bg-background p-0 text-foreground shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
          showCloseButton
        >
          <SheetHeader className="shrink-0 flex-row items-center gap-3 border-b border-border/70 bg-card/95 px-4 py-4 pr-14 sm:px-6 sm:py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircle aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl font-semibold tracking-tight">Messages</SheetTitle>
              <SheetDescription className="mt-0.5">
                Conversations with people on Piecebook.
              </SheetDescription>
            </div>
            {unreadCount > 0 && (
              <span className="hidden shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary sm:inline-flex">
                {unreadCount > 99 ? "99+" : unreadCount} unread
              </span>
            )}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
            <MessagingProfileList
              profiles={filteredPeople}
              allConversations={conversations}
              visibleConversations={visibleConversations}
              activeProfileId={activeProfileId}
              isCollapsed={isPeopleListCollapsed}
              isLoadingConversations={isLoadingConversations}
              showArchived={showArchivedConversations}
              exitingConversationIds={exitingConversationIds}
              exitingConversations={exitingConversations}
              search={search}
              onSearchChange={setSearch}
              onToggleArchived={() =>
                setShowArchivedConversations((current) => !current)
              }
              onSelectProfile={selectProfile}
              onArchiveConversation={handleArchiveConversation}
              onDeleteConversation={setDeleteConversationTarget}
              onConversationExitComplete={finishConversationDissolve}
            />

            <section
              className={`${activeProfileId ? "flex" : "hidden min-[480px]:flex"} min-w-0 flex-1 flex-col bg-background`}
            >
              {activeProfile && (
                <>
                  <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-border/70 bg-card/70 px-3 sm:px-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Back to conversations"
                      onClick={clearActiveProfile}
                      className="shrink-0 rounded-full"
                    >
                      <ArrowLeft aria-hidden="true" className="size-4" />
                    </Button>
                    <Avatar className="size-10 shrink-0 rounded-xl ring-1 ring-border/70">
                      {activeProfile.image && <AvatarImage src={activeProfile.image} alt="" />}
                      <AvatarFallback>{getInitials(activeProfile.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold sm:text-base">
                        {activeProfile.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeProfile.role}
                        {activeProfile.location ? ` · ${activeProfile.location}` : ""}
                      </p>
                    </div>
                  </header>

                  <MessagingThread
                    activeProfile={activeProfile}
                    currentUserId={currentUser?.id ?? null}
                    now={clock}
                    isLoading={isLoadingConversations}
                    isOpen={open}
                    messageGroups={messageGroups}
                    marketplaceListings={marketplaceListings}
                    marketplaceOrders={marketplaceOrders}
                    exitingMessageIds={exitingMessageIds}
                    onViewListing={() => handleSheetOpenChange(false)}
                    onReact={handleReaction}
                    onCopy={handleCopyMessage}
                    onEdit={startEditingMessage}
                    onDelete={setDeleteTarget}
                    onMessageExitComplete={finishMessageDissolve}
                  />

                  <MessagingComposer
                    profileId={activeProfile.id}
                    canSend={Boolean(currentUser)}
                    draft={draft}
                    files={files}
                    isSending={isSending}
                    error={error}
                    marketplaceContext={activeMarketplaceContext}
                    editingMessageId={editingMessageId}
                    editingMessage={editingMessage}
                    editDraft={editDraft}
                    onDraftChange={(value) => {
                      setDraft(value);
                      if (value.trim()) setIsPeopleListCollapsed(true);
                    }}
                    onFilesChange={setFiles}
                    onEditDraftChange={setEditDraft}
                    onSubmit={handleComposerSubmit}
                    onCancelEdit={cancelMessageEdit}
                    onViewListing={() => handleSheetOpenChange(false)}
                  />
                </>
              )}
              {!activeProfile && (
                <div className="hidden flex-1 flex-col items-center justify-center px-6 text-center min-[480px]:flex">
                  <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                    <MessageCircle aria-hidden="true" className="size-7" />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold tracking-tight">
                    Your conversations, in one place
                  </h2>
                  <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                    Choose a person from your inbox to pick up where you left off.
                  </p>
                </div>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <MessagingListingConversationsDialog
        listing={listingConversationsListing}
        conversations={listingConversationPreviews}
        isLoading={isListingConversationsLoading}
        error={listingConversationsError}
        onClose={() => setListingConversationsListing(null)}
        onSelectProfile={openListingConversation}
      />

      <MessagingDialogs
        deleteTarget={deleteTarget}
        deleteConversationTarget={deleteConversationTarget}
        onCloseMessageDialog={() => setDeleteTarget(null)}
        onDeleteMessage={handleDelete}
        onCloseConversationDialog={() => setDeleteConversationTarget(null)}
        onDeleteConversation={handleDeleteConversation}
      />
    </>
  );
}
