"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Message, MessageGroup } from "@/components/ui/message";
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { getInitials } from "@/lib/get-initials";
import type { CommentTimelineEntry } from "@/lib/comment-utils";
import type { UserProfile } from "@/types/user-profile";

export type CommentListItem = CommentTimelineEntry & {
  body: string;
  image: string[] | null;
};

type CommentListProps<TComment extends CommentListItem> = {
  comments: readonly TComment[];
  allUsers: readonly UserProfile[];
  currentUserId?: string;
  deletingCommentId: string | null;
  onDelete?: (comment: TComment) => void;
  canDelete?: boolean;
  imageDescription?: string;
};

export function CommentList<TComment extends CommentListItem>({
  comments,
  allUsers,
  currentUserId,
  deletingCommentId,
  onDelete,
  canDelete = true,
  imageDescription = "comment",
}: CommentListProps<TComment>) {
  const usersById = useMemo(
    () => new Map(allUsers.map((user) => [user.id, user])),
    [allUsers],
  );

  return (
    <MessageGroup role="list" className="gap-3">
      {comments.map((comment) => {
        const author = usersById.get(comment.user_id);
        const isOwnComment = comment.user_id === currentUserId;
        const canDeleteComment = isOwnComment && canDelete && onDelete;

        return (
          <Message
            key={comment.id}
            role="listitem"
            className="group/comment items-start gap-2.5"
          >
            <Avatar className="mt-0.5 size-8 shrink-0">
              {author?.image && (
                <AvatarImage src={author.image} alt={author.full_name} />
              )}
              <AvatarFallback className="piecebook-avatar-fallback text-[10px]">
                {author ? getInitials(author.full_name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5 sm:px-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="min-w-0 flex-1 wrap-anywhere text-xs font-semibold text-foreground">
                  {author?.full_name ?? "Piecebook member"}
                </span>
                <LocalDateTime
                  dateTime={comment.created_at}
                  className="shrink-0 text-[10px] text-muted-foreground"
                />
                {canDeleteComment && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={
                      deletingCommentId === comment.id
                        ? "Deleting comment"
                        : "Delete your comment"
                    }
                    title="Delete comment"
                    disabled={deletingCommentId !== null}
                    onClick={() => onDelete(comment)}
                    className="ml-auto size-6 shrink-0 rounded-full text-muted-foreground/70 transition-opacity hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100"
                  >
                    {deletingCommentId === comment.id ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                    ) : (
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
              {comment.body && (
                <p className="mt-1.5 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-foreground/90">
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
                  unoptimized
                  className="mt-2 max-h-72 w-auto max-w-full rounded-lg object-contain"
                />
              ))}
            </div>
          </Message>
        );
      })}
    </MessageGroup>
  );
}
