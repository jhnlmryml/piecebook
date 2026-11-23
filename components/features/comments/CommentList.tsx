"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  ParticleBurst,
  ParticleDissolve,
} from "@/components/shared/ParticleDissolve";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { MessageGroup } from "@/components/ui/message";
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { getInitials } from "@/lib/get-initials";
import { isSupabasePublicImage } from "@/lib/is-supabase-public-image";
import { type CommentTimelineEntry } from "@/lib/comment-utils";
import type { UserProfile } from "@/types/user-profile";
import { useLongPressMenu } from "@/components/features/messaging/useLongPressMenu";

function RelativeCommentTime({ dateTime }: { dateTime: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const updateLabel = () => {
      setLabel(getRelativeCommentTimeLabel(dateTime));
    };

    updateLabel();
    const timestamp = new Date(dateTime).getTime();
    if (!Number.isFinite(timestamp)) return;

    const elapsed = Math.max(0, Date.now() - timestamp);
    const nextHourBoundary = 60 * 60_000 - (elapsed % (60 * 60_000));
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      updateLabel();
      interval = window.setInterval(updateLabel, 60 * 60_000);
    }, nextHourBoundary);

    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [dateTime]);

  if (!label) return null;

  return (
    <div
      aria-label="Comment time group"
      className="flex items-center gap-3 px-2 py-3 text-[10px] font-medium tracking-wide text-muted-foreground"
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <time dateTime={dateTime}>{label}</time>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

function getRelativeCommentTimeLabel(dateTime: string) {
  const timestamp = new Date(dateTime).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return "";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function areCommentsInSameTimeGroup(
  first: CommentTimelineEntry | undefined,
  second: CommentTimelineEntry | undefined,
) {
  return Boolean(
    first &&
    second &&
      getRelativeCommentTimeLabel(first.created_at) ===
        getRelativeCommentTimeLabel(second.created_at),
  );
}

export type CommentListItem = CommentTimelineEntry & {
  body: string;
  image: string[] | null;
};

type CommentListProps<TComment extends CommentListItem> = {
  comments: readonly TComment[];
  allUsers: readonly UserProfile[];
  currentUserId?: string;
  deletingCommentId: string | null;
  exitingCommentIds: ReadonlySet<string>;
  onDelete?: (comment: TComment) => void;
  onExitComplete: (comment: TComment) => void;
  canDelete?: boolean;
  imageDescription?: string;
};

export function CommentList<TComment extends CommentListItem>({
  comments,
  allUsers,
  currentUserId,
  deletingCommentId,
  exitingCommentIds,
  onDelete,
  onExitComplete,
  canDelete = true,
  imageDescription = "comment",
}: CommentListProps<TComment>) {
  const [openContextCommentId, setOpenContextCommentId] = useState<string | null>(null);
  const longPress = useLongPressMenu();
  const usersById = useMemo(
    () => new Map(allUsers.map((user) => [user.id, user])),
    [allUsers],
  );

  return (
    <MessageGroup role="list" className="gap-0 select-none">
      {comments.map((comment, index) => {
        const author = usersById.get(comment.user_id);
        const isOwnComment = comment.user_id === currentUserId;
        const isRightAligned = isOwnComment;
        const isFirstInTimeGroup =
          index === 0 ||
          !areCommentsInSameTimeGroup(comments[index - 1], comment);
        const canDeleteComment = isOwnComment && canDelete && onDelete;

        return (
          <ParticleDissolve
            key={comment.id}
            isExiting={exitingCommentIds.has(comment.id)}
            onExitComplete={() => onExitComplete(comment)}
            particleCount={0}
          >
            <>
            {isFirstInTimeGroup && (
              <RelativeCommentTime dateTime={comment.created_at} />
            )}
            <ContextMenu
              open={openContextCommentId === comment.id}
              onOpenChange={(isOpen) => {
                setOpenContextCommentId(isOpen ? comment.id : null);
                if (!isOpen) longPress.reset();
              }}
            >
              <ContextMenuTrigger
                onTouchStart={() =>
                  longPress.start(() => setOpenContextCommentId(comment.id), true)
                }
                onTouchMove={longPress.cancel}
                onTouchEnd={(event) => {
                  longPress.cancel();
                  if (longPress.wasLongPress()) event.preventDefault();
                }}
                onTouchCancel={longPress.cancel}
                className="w-full select-text"
              >
                <div
                  role="listitem"
                  className={`group/comment flex w-full min-w-0 items-start gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-muted/40 ${isRightAligned ? "justify-end" : "justify-start"
                    }`}
                >
                  {!isRightAligned && (
                    <div className="flex size-10 shrink-0 items-start justify-center">
                      <Avatar className="size-10 ring-1 ring-border/60 ring-offset-2 ring-offset-background">
                        {author?.image && (
                          <AvatarImage src={author.image} alt={author.full_name} />
                        )}
                        <AvatarFallback className="piecebook-avatar-fallback text-[10px]">
                          {author ? getInitials(author.full_name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div
                    className={`flex min-w-0 max-w-[min(100%,34rem)] flex-col gap-1.5 ${isRightAligned ? "w-full flex-none items-end" : "flex-1 items-start"
                      }`}
                  >
                    <ParticleBurst
                      isExiting={exitingCommentIds.has(comment.id)}
                      className="w-full min-w-0"
                    >
                      <div className={`flex w-full min-w-0 ${isRightAligned ? "justify-end" : "justify-start"}`}>
                        <Bubble variant={isRightAligned ? "default" : "muted"}>
                          <BubbleContent className="min-w-0 max-w-full wrap-anywhere rounded-2xl border-0 px-3.5 py-2.5 text-[13px] leading-[1.45] shadow-sm shadow-black/3">
                            {comment.body && (
                              <p className="whitespace-pre-wrap wrap-anywhere text-pretty">
                                {comment.body}
                              </p>
                            )}
                            {comment.image?.map((imageUrl, imageIndex) => (
                              <Image
                                key={`${comment.id}-${imageIndex}`}
                                src={imageUrl}
                                alt={`Image ${imageIndex + 1} attached to ${imageDescription}`}
                                width={560}
                                height={420}
                                unoptimized={!isSupabasePublicImage(imageUrl)}
                                className="mt-2 max-h-72 w-auto max-w-full rounded-xl object-contain"
                              />
                            ))}
                          </BubbleContent>
                        </Bubble>
                      </div>
                    </ParticleBurst>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-fit min-w-48 rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
                <ContextMenuGroup>
                  <ContextMenuLabel className="max-w-64 wrap-anywhere text-sm font-medium text-foreground">
                    {author?.full_name ?? "Piecebook member"}
                  </ContextMenuLabel>
                  <div className="px-2 pb-2 text-xs text-muted-foreground">
                    <LocalDateTime dateTime={comment.created_at} />
                  </div>
                </ContextMenuGroup>
                {canDeleteComment && (
                  <>
                    <ContextMenuSeparator className="my-1" />
                    <ContextMenuItem
                      variant="destructive"
                      disabled={deletingCommentId !== null}
                      onClick={() => onDelete(comment)}
                      className="rounded-lg px-2.5 py-2 text-sm"
                    >
                      {deletingCommentId === comment.id ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                      Delete comment
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
            </>
          </ParticleDissolve>
        );
      })}
    </MessageGroup>
  );
}
