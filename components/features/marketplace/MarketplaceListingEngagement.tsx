"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  ArrowUp,
  Heart,
  Loader2,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { Scroller } from "@/components/ui/scroller";
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { PostComposerInput } from "@/components/features/posts/PostComposerInput";
import { subscribeToRealtimeChanges } from "@/lib/realtime-events";
import {
  COMMENT_IMAGE_MAX_COUNT,
  COMMENT_IMAGE_MAX_SIZE,
  removeCommentImage,
  uploadCommentImage,
} from "@/lib/comment-images";
import {
  createMarketplaceListingComment,
  deleteMarketplaceListingComment,
  getMarketplaceListingCommentsBefore,
  getMarketplaceListingEngagement,
  MARKETPLACE_LISTING_COMMENT_PAGE_SIZE,
  toggleMarketplaceListingLike,
  type MarketplaceListingComment,
  type MarketplaceListingLike,
} from "@/lib/marketplace-engagement";

const COMMENT_LIMIT = 2000;

function compareComments(
  first: Pick<MarketplaceListingComment, "created_at" | "id">,
  second: Pick<MarketplaceListingComment, "created_at" | "id">,
) {
  return (
    new Date(first.created_at).getTime() -
      new Date(second.created_at).getTime() ||
    first.id.localeCompare(second.id)
  );
}

function areCommentsGrouped(
  first: MarketplaceListingComment | undefined,
  second: MarketplaceListingComment | undefined,
) {
  return Boolean(
    first &&
      second &&
      first.user_id === second.user_id &&
      new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime() <=
        5 * 60 * 1000,
  );
}

export function MarketplaceListingEngagement({
  listingId,
}: {
  listingId: string;
}) {
  const { currentUser, allUsers } = useProfile();
  const [comments, setComments] = useState<MarketplaceListingComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [loadedEngagementKey, setLoadedEngagementKey] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isAtCommentTop, setIsAtCommentTop] = useState(true);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const commentScrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollToLatestRef = useRef(false);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
    stickToTop: boolean;
  } | null>(null);
  const refreshSequence = useRef(0);
  const liveChangeVersion = useRef(0);
  const likeIdsRef = useRef(new Set<string>());
  const knownCommentIdsRef = useRef(new Set<string>());
  const deletedCommentIdsRef = useRef(new Set<string>());
  const loadedEngagementKeyRef = useRef<string | null>(null);
  const profileId = currentUser?.id;
  const engagementKey = profileId ? `${listingId}:${profileId}` : null;
  const isLoading = Boolean(engagementKey && loadedEngagementKey !== engagementKey);

  const refreshEngagement = useCallback(async () => {
    if (!profileId) return;

    const sequence = ++refreshSequence.current;
    const observedVersion = liveChangeVersion.current;
    try {
      const engagement = await getMarketplaceListingEngagement(listingId, profileId);
      if (
        sequence !== refreshSequence.current ||
        observedVersion !== liveChangeVersion.current
      ) {
        return;
      }

      const nextKey = `${listingId}:${profileId}`;
      const isSameEngagement = loadedEngagementKeyRef.current === nextKey;
      likeIdsRef.current = new Set(engagement.likes.map((like) => like.id));
      if (!isSameEngagement) {
        knownCommentIdsRef.current.clear();
        deletedCommentIdsRef.current.clear();
        scrollToLatestRef.current = true;
      }
      for (const comment of engagement.comments) {
        knownCommentIdsRef.current.add(comment.id);
      }
      setComments((current) => {
        const merged = new Map(
          (isSameEngagement ? current : []).map((comment) => [comment.id, comment]),
        );
        for (const comment of engagement.comments) merged.set(comment.id, comment);
        return [...merged.values()].sort(compareComments);
      });
      setCommentCount(engagement.commentCount);
      setLikeCount(engagement.likes.length);
      setIsLiked(engagement.isLiked);
      loadedEngagementKeyRef.current = nextKey;
      setLoadedEngagementKey(nextKey);
    } catch (error) {
      if (
        sequence !== refreshSequence.current ||
        observedVersion !== liveChangeVersion.current
      ) {
        return;
      }
      loadedEngagementKeyRef.current = `${listingId}:${profileId}`;
      setLoadedEngagementKey(`${listingId}:${profileId}`);
      toast.error(
        error instanceof Error ? error.message : "Could not load listing activity.",
      );
    }
  }, [listingId, profileId]);

  useEffect(() => {
    if (!profileId) return;

    void Promise.resolve().then(refreshEngagement);
    const unsubscribe = subscribeToRealtimeChanges((change) => {
      if (change.table === "marketplace_listing_likes") {
        const record = (change.eventType === "DELETE"
          ? change.oldRecord
          : change.newRecord) as unknown as MarketplaceListingLike;

        if (record.listing_id !== listingId) {
          if (change.eventType === "DELETE" && !record.listing_id) {
            liveChangeVersion.current += 1;
            void refreshEngagement();
          }
          return;
        }

        if (loadedEngagementKeyRef.current !== engagementKey) {
          liveChangeVersion.current += 1;
          void refreshEngagement();
          return;
        }

        if (change.eventType === "INSERT") {
          if (!record.id || likeIdsRef.current.has(record.id)) return;
          liveChangeVersion.current += 1;
          likeIdsRef.current.add(record.id);
          setLikeCount((count) => count + 1);
          if (record.user_id === profileId) setIsLiked(true);
          return;
        }

        if (change.eventType === "DELETE") {
          if (!record.id || !likeIdsRef.current.has(record.id)) return;
          liveChangeVersion.current += 1;
          likeIdsRef.current.delete(record.id);
          setLikeCount((count) => Math.max(0, count - 1));
          if (record.user_id === profileId) setIsLiked(false);
        }
        return;
      }

      if (change.table !== "marketplace_listing_comments") return;
      const record = (change.eventType === "DELETE"
        ? change.oldRecord
        : change.newRecord) as unknown as MarketplaceListingComment;

      if (record.listing_id !== listingId) {
        if (change.eventType === "DELETE" && !record.listing_id) {
          liveChangeVersion.current += 1;
          void refreshEngagement();
        }
        return;
      }

      if (!record.id) return;
      if (loadedEngagementKeyRef.current !== engagementKey) {
        liveChangeVersion.current += 1;
        void refreshEngagement();
        return;
      }
      if (change.eventType === "DELETE") {
        if (deletedCommentIdsRef.current.has(record.id)) return;
        liveChangeVersion.current += 1;
        deletedCommentIdsRef.current.add(record.id);
        knownCommentIdsRef.current.delete(record.id);
        setCommentCount((count) => Math.max(0, count - 1));
        setComments((current) => current.filter((comment) => comment.id !== record.id));
        return;
      }
      if (change.eventType === "INSERT") {
        if (knownCommentIdsRef.current.has(record.id)) return;
        liveChangeVersion.current += 1;
        knownCommentIdsRef.current.add(record.id);
        scrollToLatestRef.current = true;
        setCommentCount((count) => count + 1);
      } else {
        if (!knownCommentIdsRef.current.has(record.id)) return;
        liveChangeVersion.current += 1;
      }
      setComments((current) =>
        [...current.filter((comment) => comment.id !== record.id), record].sort(
          compareComments,
        ),
      );
    });

    return () => {
      refreshSequence.current += 1;
      unsubscribe();
    };
  }, [engagementKey, profileId, listingId, refreshEngagement]);

  useEffect(() => {
    const scroller = commentScrollerRef.current;
    if (!scroller) return;

    const previousScroll = preserveScrollRef.current;
    if (previousScroll) {
      scroller.scrollTop = previousScroll.stickToTop
        ? 0
        : previousScroll.top + (scroller.scrollHeight - previousScroll.height);
      preserveScrollRef.current = null;
      return;
    }

    if (scrollToLatestRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
      scrollToLatestRef.current = false;
    }
  }, [comments]);

  async function handleLike() {
    if (!currentUser || isLiking) return;
    setIsLiking(true);
    try {
      const nextLiked = await toggleMarketplaceListingLike(
        listingId,
        currentUser.id,
      );
      setIsLiked(nextLiked);
      await refreshEngagement();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update listing like.",
      );
    } finally {
      setIsLiking(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && imageFiles.length === 0) || !currentUser || isSending) return;

    setIsSending(true);
    const uploadedImagePaths: string[] = [];
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        const uploadResults = await Promise.allSettled(
          imageFiles.map((file) => uploadCommentImage(file, currentUser.id)),
        );
        const successfulUploads = uploadResults.filter(
          (result): result is PromiseFulfilledResult<{ path: string; url: string }> =>
            result.status === "fulfilled",
        );
        uploadedImagePaths.push(
          ...successfulUploads.map((result) => result.value.path),
        );

        if (successfulUploads.length !== uploadResults.length) {
          const failedUpload = uploadResults.find(
            (result) => result.status === "rejected",
          );
          throw failedUpload?.status === "rejected"
            ? failedUpload.reason
            : new Error("Could not upload listing comment images.");
        }

        imageUrls = successfulUploads.map((result) => result.value.url);
      }

      const comment = await createMarketplaceListingComment({
        listing_id: listingId,
        user_id: currentUser.id,
        body,
        image: imageUrls.length > 0 ? imageUrls : null,
      });
      if (!knownCommentIdsRef.current.has(comment.id)) {
        knownCommentIdsRef.current.add(comment.id);
        setCommentCount((count) => count + 1);
      }
      scrollToLatestRef.current = true;
      setComments((existing) =>
        [...existing.filter((item) => item.id !== comment.id), comment].sort(
          compareComments,
        ),
      );
      setDraft("");
      setImageFiles([]);
    } catch (error) {
      if (uploadedImagePaths.length > 0) {
        await Promise.all(
          uploadedImagePaths.map((path) =>
            removeCommentImage(path).catch(() => undefined),
          ),
        );
      }
      toast.error(
        error instanceof Error ? error.message : "Could not add listing comment.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function loadOlderComments() {
    const oldestComment = comments[0];
    const scroller = commentScrollerRef.current;
    if (!oldestComment || !scroller || isLoadingOlder) return;

    preserveScrollRef.current = {
      height: scroller.scrollHeight,
      top: scroller.scrollTop,
      stickToTop: scroller.scrollTop <= 4,
    };
    setIsLoadingOlder(true);
    try {
      const olderComments = await getMarketplaceListingCommentsBefore(
        listingId,
        { created_at: oldestComment.created_at, id: oldestComment.id },
      );
      for (const comment of olderComments) {
        knownCommentIdsRef.current.add(comment.id);
      }
      setComments((current) => {
        const merged = new Map(current.map((comment) => [comment.id, comment]));
        for (const comment of olderComments) merged.set(comment.id, comment);
        return [...merged.values()].sort(compareComments);
      });
    } catch (error) {
      preserveScrollRef.current = null;
      toast.error(
        error instanceof Error ? error.message : "Could not load older comments.",
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function handleDeleteComment(comment: MarketplaceListingComment) {
    if (!currentUser || deletingCommentId) return;
    setDeletingCommentId(comment.id);
    try {
      const result = await deleteMarketplaceListingComment(
        listingId,
        comment.id,
        currentUser.id,
      );
      liveChangeVersion.current += 1;
      if (!deletedCommentIdsRef.current.has(comment.id)) {
        deletedCommentIdsRef.current.add(comment.id);
        knownCommentIdsRef.current.delete(comment.id);
        setCommentCount((count) => Math.max(0, count - 1));
      }
      setComments((existing) =>
        existing.filter((item) => item.id !== comment.id),
      );
      if (result.storageCleanupError) {
        toast.error(`Comment deleted, but ${result.storageCleanupError}`);
      } else {
        toast.success("Comment deleted.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete listing comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  const hasOlderComments =
    comments.length > 0 &&
    (comments.length < commentCount ||
      (commentCount === 0 &&
        comments.length >= MARKETPLACE_LISTING_COMMENT_PAGE_SIZE));
  const showOlderCommentsButton = hasOlderComments || !isAtCommentTop;

  function handleOlderCommentsButton() {
    const scroller = commentScrollerRef.current;
    if (scroller && scroller.scrollTop > 4) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (hasOlderComments) void loadOlderComments();
  }

  return (
    <section className="mt-4 rounded-sm border border-border bg-card p-4 sm:p-5" aria-label="Listing activity">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isLiked ? "secondary" : "outline"}
          aria-pressed={isLiked}
          disabled={!currentUser || isLiking || isLoading}
          onClick={() => void handleLike()}
          className="rounded-sm"
        >
          <Heart className={`size-4 ${isLiked ? "fill-current text-rose-500" : ""}`} />
          {isLiked ? "Liked" : "Like"}
          <span className="tabular-nums">{likeCount}</span>
        </Button>
        <div className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground">
          <MessageCircle className="size-4" />
          Comments <span className="tabular-nums">{commentCount}</span>
        </div>
      </div>

      <div
        id={`listing-comments-${listingId}`}
        className="mt-4 space-y-4 border-t border-border pt-4"
      >
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading listing activity…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
          ) : (
            <>
              {showOlderCommentsButton && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      isAtCommentTop && hasOlderComments
                        ? "Load older comments"
                        : "Scroll to older comments"
                    }
                    title={
                      isAtCommentTop && hasOlderComments
                        ? "Load older comments"
                        : "Scroll to older comments"
                    }
                    disabled={isLoadingOlder}
                    onClick={handleOlderCommentsButton}
                    className="size-8 rounded-full"
                  >
                    <ArrowUp className="size-4" />
                    <span className="sr-only">
                      {isLoadingOlder
                        ? "Loading older comments"
                        : isAtCommentTop && hasOlderComments
                          ? "Load older comments"
                          : "Scroll to older comments"}
                    </span>
                  </Button>
                </div>
              )}
              <Scroller
                ref={commentScrollerRef}
                onScroll={(event) =>
                  setIsAtCommentTop(event.currentTarget.scrollTop <= 4)
                }
                className="max-h-72 pr-2"
              >
                <MessageGroup role="list" className="gap-2">
                  {comments.map((comment, index) => {
                    const author = allUsers.find(
                      (user) => user.id === comment.user_id,
                    );
                    const isOwnComment = comment.user_id === currentUser?.id;
                    const isFirstInGroup = !areCommentsGrouped(
                      comments[index - 1],
                      comment,
                    );
                    const isLastInGroup = !areCommentsGrouped(
                      comment,
                      comments[index + 1],
                    );
                    return (
                      <Message
                        key={comment.id}
                        role="listitem"
                        align={isOwnComment ? "end" : "start"}
                      >
                        <MessageAvatar aria-hidden={!isFirstInGroup}>
                          {isFirstInGroup ? (
                            <Avatar className="size-8 shrink-0">
                              {author?.image && (
                                <AvatarImage
                                  src={author.image}
                                  alt={author.full_name}
                                />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {author ? getInitials(author.full_name) : "?"}
                              </AvatarFallback>
                            </Avatar>
                          ) : null}
                        </MessageAvatar>
                        <MessageContent className="gap-1">
                          {isFirstInGroup && (
                            <MessageHeader className="px-0 text-[11px] font-medium text-muted-foreground">
                              {author?.full_name ?? "Piecebook member"}
                            </MessageHeader>
                          )}
                          <Bubble variant={isOwnComment ? "default" : "muted"}>
                            <BubbleContent className="rounded-2xl border-0 px-3 py-2 text-sm leading-relaxed">
                              {comment.body && (
                                <p className="whitespace-pre-wrap break-words">
                                  {comment.body}
                                </p>
                              )}
                              {comment.image?.map((imageUrl, index) => (
                                <Image
                                  key={`${comment.id}-${imageUrl}`}
                                  src={imageUrl}
                                  alt={`Image ${index + 1} attached to listing comment`}
                                  width={560}
                                  height={420}
                                  unoptimized
                                  className="mt-2 max-h-72 w-auto max-w-full rounded-sm object-contain"
                                />
                              ))}
                            </BubbleContent>
                          </Bubble>
                          {(isLastInGroup || isOwnComment) && (
                            <MessageFooter className="gap-1 px-0 text-[10px] font-normal text-muted-foreground/60">
                              {isLastInGroup && (
                                <LocalDateTime dateTime={comment.created_at} />
                              )}
                              {isOwnComment && (
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
                                  onClick={() => void handleDeleteComment(comment)}
                                  className="size-6 rounded-full text-muted-foreground/70 transition-opacity hover:text-destructive focus-visible:opacity-100 lg:opacity-0 lg:group-hover/message:opacity-100"
                                >
                                  {deletingCommentId === comment.id ? (
                                    <Loader2
                                      aria-hidden="true"
                                      className="size-3.5 animate-spin"
                                    />
                                  ) : (
                                    <Trash2
                                      aria-hidden="true"
                                      className="size-3.5"
                                    />
                                  )}
                                </Button>
                              )}
                            </MessageFooter>
                          )}
                        </MessageContent>
                      </Message>
                    );
                  })}
                </MessageGroup>
              </Scroller>
            </>
          )}

          <PostComposerInput
            variant="comment"
            id={"marketplace-comment-" + listingId}
            value={draft}
            maxLength={COMMENT_LIMIT}
            placeholder="Write a comment…"
            disabled={!currentUser || isSending}
            canSubmit={Boolean(draft.trim() || imageFiles.length > 0) && Boolean(currentUser) && !isSending}
            isSubmitting={isSending}
            onChange={setDraft}
            onSubmit={handleSubmit}
            fileUpload={{
              value: imageFiles,
              onValueChange: setImageFiles,
              onFileReject: (file, reason) =>
                toast.error(file.name + ": " + reason),
              onFileValidate: (file) => {
                if (!file.type.toLowerCase().startsWith("image/")) {
                  return "Choose an image file.";
                }
                if (file.size > COMMENT_IMAGE_MAX_SIZE) {
                  return "Images must be 5 MB or smaller.";
                }
                return null;
              },
              accept: "image/*",
              maxFiles: COMMENT_IMAGE_MAX_COUNT,
              maxSize: COMMENT_IMAGE_MAX_SIZE,
              multiple: true,
              attachmentLabel: "Attach image to listing comment",
              dropzoneTitle: "Drag & drop images here",
              dropzoneDescription: `Up to ${COMMENT_IMAGE_MAX_COUNT} images, max 5MB each`,
            }}
            submitButtonSize="icon-lg"
            submitAriaLabel="Send listing comment"
          />
      </div>
    </section>
  );
}
