"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  MessageCircle,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Scroller } from "@/components/ui/scroller";
import { ParticleDissolve } from "@/components/shared/ParticleDissolve";
import { MessagingConversationListSkeleton } from "@/components/shared/LoadingSkeletons";
import { getInitials } from "@/lib/get-initials";
import type { UserProfile } from "@/types/user-profile";
import type { MessagingConversation } from "./messaging-types";
import { useLongPressMenu } from "./useLongPressMenu";

function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

type ExitingConversation = {
  profile: UserProfile;
  conversation: MessagingConversation;
};

type MessagingProfileListProps = {
  profiles: UserProfile[];
  allConversations: MessagingConversation[];
  visibleConversations: MessagingConversation[];
  activeProfileId: string | null;
  isCollapsed: boolean;
  isLoadingConversations: boolean;
  showArchived: boolean;
  exitingConversationIds: ReadonlySet<string>;
  exitingConversations: ExitingConversation[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggleArchived: () => void;
  onSelectProfile: (profileId: string) => void;
  onArchiveConversation: (profileId: string, archived: boolean) => void | Promise<void>;
  onDeleteConversation: (profileId: string) => void;
  onConversationExitComplete: (profileId: string) => void;
};

export function MessagingProfileList({
  profiles,
  allConversations,
  visibleConversations,
  activeProfileId,
  isCollapsed,
  isLoadingConversations,
  showArchived,
  exitingConversationIds,
  exitingConversations,
  search,
  onSearchChange,
  onToggleArchived,
  onSelectProfile,
  onArchiveConversation,
  onDeleteConversation,
  onConversationExitComplete,
}: MessagingProfileListProps) {
  const [openContextMenuProfileId, setOpenContextMenuProfileId] = useState<string | null>(null);
  const longPress = useLongPressMenu();
  const conversationsLoaded = !isLoadingConversations;
  const allConversationIds = new Set(
    conversationsLoaded
      ? [
          ...allConversations.map((conversation) => conversation.profileId),
          ...exitingConversations.map(({ profile }) => profile.id),
        ]
      : [],
  );
  const visibleConversationByProfileId = new Map(
    conversationsLoaded
      ? visibleConversations.map((conversation) => [conversation.profileId, conversation])
      : [],
  );
  const archivedConversationsExist =
    conversationsLoaded && allConversations.some((conversation) => conversation.archived);
  const conversationRows = [
    ...profiles.flatMap((profile) => {
      const conversation = visibleConversationByProfileId.get(profile.id);
      return conversation ? [{ profile, conversation }] : [];
    }),
    ...exitingConversations.filter(
      ({ profile }) => !visibleConversationByProfileId.has(profile.id),
    ),
  ];

  return (
    <aside
      className={`${activeProfileId ? "hidden min-[480px]:flex" : "flex"} ${
        activeProfileId
          ? isCollapsed
            ? "min-[480px]:w-16"
            : "min-[480px]:w-80"
          : "w-full min-[480px]:w-80"
      } shrink-0 flex-col border-r border-border/70 bg-card/70 transition-[width] duration-200 motion-reduce:transition-none`}
    >
      {!isCollapsed && (
        <div className="shrink-0 space-y-3 border-b border-border/70 bg-card/95 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                {showArchived ? "Archive" : "Inbox"}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tracking-tight">
                {showArchived ? "Past conversations" : "Your messages"}
              </p>
            </div>
            <Button
              type="button"
              variant={showArchived ? "secondary" : "outline"}
              size="icon-sm"
              aria-label={showArchived ? "Show conversations" : "Show archived conversations"}
              aria-pressed={showArchived}
              title={showArchived ? "Show conversations" : "Show archived conversations"}
              onClick={onToggleArchived}
              className="relative size-9 shrink-0 rounded-xl border-border/70"
            >
              {showArchived ? (
                <ArchiveRestore aria-hidden="true" className="size-4" />
              ) : (
                <Archive aria-hidden="true" className="size-4" />
              )}
              {!showArchived && archivedConversationsExist && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-card" />
              )}
            </Button>
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search people to message"
              placeholder="Search people"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-10 rounded-xl border-border/70 bg-background pl-9 text-sm shadow-none transition-colors focus-visible:border-primary/40"
            />
          </div>
        </div>
      )}
      <Scroller hideScrollbar className="min-h-0 flex-1">
        <div className={isCollapsed ? "flex flex-col items-center gap-1 p-2" : "p-2"}>
          {isLoadingConversations && !isCollapsed && (
            <MessagingConversationListSkeleton />
          )}
          {conversationsLoaded && visibleConversations.length > 0 && !isCollapsed && (
            <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {showArchived ? "Archived conversations" : "Conversations"}
            </p>
          )}
          {conversationsLoaded &&
            conversationRows.map(({ profile, conversation }) => {
              return (
                <ParticleDissolve
                  key={profile.id}
                  isExiting={exitingConversationIds.has(profile.id)}
                  onExitComplete={() => onConversationExitComplete(profile.id)}
                >
                  <ContextMenu
                    open={openContextMenuProfileId === profile.id}
                    onOpenChange={(isOpen) => {
                      setOpenContextMenuProfileId(isOpen ? profile.id : null);
                      if (!isOpen) longPress.reset();
                    }}
                  >
                  <ContextMenuTrigger
                    onTouchStart={() => longPress.start(() => setOpenContextMenuProfileId(profile.id), true)}
                    onTouchMove={longPress.cancel}
                    onTouchEnd={(event) => {
                      longPress.cancel();
                      if (longPress.wasLongPress()) event.preventDefault();
                    }}
                    onTouchCancel={longPress.cancel}
                    className="select-text"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Open conversation with ${profile.full_name}${conversation.unread ? `, ${conversation.unread} unread` : ""}`}
                      title={isCollapsed ? profile.full_name : undefined}
                      className={`relative h-auto w-full cursor-pointer gap-3 rounded-xl px-2.5 py-3 text-left transition-colors duration-150 motion-reduce:transition-none ${
                        isCollapsed
                          ? "justify-center px-0"
                          : activeProfileId === profile.id
                            ? "justify-start bg-primary/8 ring-1 ring-primary/15 hover:bg-primary/10"
                            : "justify-start hover:bg-muted/70"
                      }`}
                      onClick={() => {
                        if (longPress.consumeLongPress()) return;
                        onSelectProfile(profile.id);
                      }}
                    >
                      <Avatar
                        className="size-11 shrink-0 rounded-2xl ring-1 ring-border/70"
                      >
                        {profile.image && <AvatarImage src={profile.image} alt="" />}
                        <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                      </Avatar>
                      {conversation.unread > 0 && isCollapsed && (
                        <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-card" />
                      )}
                      {!isCollapsed && (
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {profile.full_name}
                            </span>
                            <time
                              dateTime={conversation.latest.created_at}
                              className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                            >
                              {formatConversationTime(conversation.latest.created_at)}
                            </time>
                            {conversation.unread > 0 && (
                              <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold leading-5 text-primary-foreground">
                                {conversation.unread}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-xs leading-5 text-muted-foreground">
                            {(conversation.latest.listing_id ||
                              conversation.latest.marketplace_order_id) && (
                              <span className="font-medium text-primary">Marketplace · </span>
                            )}
                            {conversation.latest.body ||
                              conversation.latest.attachments[0]?.name ||
                              "Attachment"}
                          </span>
                        </span>
                      )}
                    </Button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-fit rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
                    <ContextMenuGroup>
                      <ContextMenuLabel>{profile.full_name}</ContextMenuLabel>
                      <ContextMenuItem
                        onClick={() =>
                          void onArchiveConversation(profile.id, !conversation.archived)
                        }
                      >
                        {conversation.archived ? (
                          <ArchiveRestore aria-hidden="true" />
                        ) : (
                          <Archive aria-hidden="true" />
                        )}
                        {conversation.archived ? "Restore to inbox" : "Archive"}
                      </ContextMenuItem>
                    </ContextMenuGroup>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => onDeleteConversation(profile.id)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                  </ContextMenu>
                </ParticleDissolve>
              );
            })}


          {conversationsLoaded &&
            !isCollapsed &&
            !showArchived &&
            visibleConversations.length === 0 && (
              <div className="mx-1 mb-3 rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">No conversations yet</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Choose someone below to start a conversation.
                </p>
              </div>
            )}
          {!isCollapsed && !showArchived && profiles.length > 0 && (
            <p className="px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {conversationsLoaded && allConversations.length
                ? "People to message"
                : "People"}
            </p>
          )}
          {!showArchived &&
            profiles
              .filter((profile) => !allConversationIds.has(profile.id))
              .map((profile) => (
                <Button
                  key={profile.id}
                  type="button"
                  variant="ghost"
                  aria-label={`Start a conversation with ${profile.full_name}`}
                  title={isCollapsed ? profile.full_name : undefined}
                  className={`h-auto w-full cursor-pointer gap-3 rounded-xl px-2.5 py-3 text-left transition-colors duration-150 hover:bg-muted/70 motion-reduce:transition-none ${
                    isCollapsed ? "justify-center px-0" : "justify-start"
                  }`}
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <Avatar
                    className="size-11 shrink-0 rounded-2xl ring-1 ring-border/70"
                  >
                    {profile.image && <AvatarImage src={profile.image} alt="" />}
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {profile.full_name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {profile.role}
                      </span>
                    </span>
                  )}
                </Button>
              ))}
          {!showArchived && profiles.length === 0 && !isCollapsed && (
            <div className="px-3 py-8 text-center">
              <UsersRound
                aria-hidden="true"
                className="mx-auto size-6 text-muted-foreground/70"
              />
              <p className="mt-2 text-sm font-medium">
                {search.trim() ? "No people found" : "No other profiles yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search.trim()
                  ? "Try a different name."
                  : "People you can message will appear here."}
              </p>
            </div>
          )}
          {conversationsLoaded && showArchived && visibleConversations.length === 0 && (
            <div className="px-3 py-8 text-center">
              <Archive aria-hidden="true" className="mx-auto size-6 text-muted-foreground/70" />
              <p className="mt-2 text-sm font-medium">No archived conversations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Archived conversations will show up here.
              </p>
            </div>
          )}
        </div>
      </Scroller>
    </aside>
  );
}
