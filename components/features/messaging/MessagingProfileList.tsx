"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Search, Trash2 } from "lucide-react";
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
import { getInitials } from "@/lib/get-initials";
import type { UserProfile } from "@/types/user-profile";
import type { MessagingConversation } from "./messaging-types";
import { useLongPressMenu } from "./useLongPressMenu";

type MessagingProfileListProps = {
  profiles: UserProfile[];
  allConversations: MessagingConversation[];
  visibleConversations: MessagingConversation[];
  activeProfileId: string | null;
  isCollapsed: boolean;
  showArchived: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onToggleArchived: () => void;
  onSelectProfile: (profileId: string) => void;
  onArchiveConversation: (profileId: string, archived: boolean) => void | Promise<void>;
  onDeleteConversation: (profileId: string) => void;
};

export function MessagingProfileList({
  profiles,
  allConversations,
  visibleConversations,
  activeProfileId,
  isCollapsed,
  showArchived,
  search,
  onSearchChange,
  onToggleArchived,
  onSelectProfile,
  onArchiveConversation,
  onDeleteConversation,
}: MessagingProfileListProps) {
  const [openContextMenuProfileId, setOpenContextMenuProfileId] = useState<string | null>(null);
  const longPress = useLongPressMenu();
  const allConversationIds = new Set(allConversations.map((conversation) => conversation.profileId));
  const visibleConversationByProfileId = new Map(
    visibleConversations.map((conversation) => [conversation.profileId, conversation]),
  );
  const archivedConversationsExist = allConversations.some((conversation) => conversation.archived);

  return (
    <aside
      className={`${activeProfileId ? "hidden min-[480px]:flex" : "flex"} ${
        activeProfileId
          ? isCollapsed
            ? "min-[480px]:w-16"
            : "sm:w-80"
          : "w-full"
      } w-full shrink-0 flex-col border-r border-border transition-[width] duration-200`}
    >
      {!isCollapsed && (
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="absolute top-2 left-2.5 size-4 text-muted-foreground"
              />
              <Input
                aria-label="Search people to message"
                placeholder="Search people"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              aria-label={showArchived ? "Show conversations" : "Show archived conversations"}
              aria-pressed={showArchived}
              title={showArchived ? "Show conversations" : "Show archived conversations"}
              onClick={onToggleArchived}
              className="relative shrink-0 gap-1.5 px-2"
            >
              {showArchived ? (
                <ArchiveRestore aria-hidden="true" className="size-4" />
              ) : (
                <Archive aria-hidden="true" className="size-4" />
              )}
              <span className="text-xs">{showArchived ? "Messages" : "Archive"}</span>
              {!showArchived && archivedConversationsExist && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
        </div>
      )}
      <Scroller hideScrollbar className="min-h-0 flex-1">
        <div className={isCollapsed ? "flex flex-col items-center gap-1 p-2" : "p-2"}>
          {visibleConversations.length > 0 && !isCollapsed && (
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {showArchived ? "Archived conversations" : "Conversations"}
            </p>
          )}
          {profiles
            .filter((profile) => visibleConversationByProfileId.has(profile.id))
            .map((profile) => {
              const conversation = visibleConversationByProfileId.get(profile.id);
              if (!conversation) return null;

              return (
                <ContextMenu
                  key={profile.id}
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
                      className={`relative h-auto w-full cursor-pointer gap-3 py-2 ${
                        isCollapsed ? "justify-center px-0" : "justify-start px-2 text-left"
                      }`}
                      onClick={() => {
                        if (longPress.consumeLongPress()) return;
                        onSelectProfile(profile.id);
                      }}
                    >
                      <Avatar
                        className={`size-10 shrink-0 ${
                          activeProfileId === profile.id ? "border-3 border-ring" : ""
                        }`}
                      >
                        {profile.image && <AvatarImage src={profile.image} alt="" />}
                        <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                      </Avatar>
                      {conversation.unread > 0 && isCollapsed && (
                        <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
                      )}
                      {!isCollapsed && (
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{profile.full_name}</span>
                            {conversation.unread > 0 && (
                              <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
                                {conversation.unread}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {conversation.latest.listing_id || conversation.latest.marketplace_order_id
                              ? "Marketplace · "
                              : ""}
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
              );
            })}


          {!isCollapsed && !showArchived && (
            <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5">
              {allConversations.length ? "Find people" : "People"}
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
                  className={`h-auto w-full cursor-pointer gap-3 py-2 ${
                    isCollapsed ? "justify-center px-0" : "justify-start px-2 text-left"
                  }`}
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <Avatar
                    className={`size-10 shrink-0 ${
                      activeProfileId === profile.id ? "border-3 border-ring" : ""
                    }`}
                  >
                    {profile.image && <AvatarImage src={profile.image} alt="" />}
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <span className="truncate text-sm font-medium">{profile.full_name}</span>
                  )}
                </Button>
              ))}
          {!showArchived && profiles.length === 0 && !isCollapsed && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No people found.</p>
          )}
          {showArchived && visibleConversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No archived conversations.
            </p>
          )}
        </div>
      </Scroller>
    </aside>
  );
}
