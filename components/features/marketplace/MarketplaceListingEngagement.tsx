"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  Heart,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  commentDraftSchema,
  COMMENT_MAX_LENGTH,
  imageFileSchema,
} from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import { Scroller } from "@/components/ui/scroller";
import { useProfile } from "@/context/ProfileContext";
import { CommentList } from "@/components/features/comments/CommentList";
import {
  compareComments,
  scrollToCommentContentBottom,
} from "@/lib/comment-utils";
import type { ListingStatus } from "./marketplace-data";
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
  canEngageWithMarketplaceListing,
  getMarketplaceListingCommentsBefore,
  getMarketplaceListingEngagement,
  MARKETPLACE_LISTING_COMMENT_PAGE_SIZE,
  toggleMarketplaceListingLike,
  type MarketplaceListingComment,
  type MarketplaceListingLike,
} from "@/lib/marketplace-engagement";

export function MarketplaceListingEngagement({
  listingId,
  listingStatus,
}: {
  listingId: string;
  listingStatus: ListingStatus;
}) {
  const { currentUser, allUsers } = useProfile();
  const [comments, setComments] = useState<MarketplaceListingComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [hasReachedOldestComment, setHasReachedOldestComment] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [serverAllowsEngagement, setServerAllowsEngagement] = useState(false);
  const [loadedEngagementKey, setLoadedEngagementKey] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const isLoadingOlderRef = useRef(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const commentScrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollToLatestRef = useRef(false);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
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
  const canEngage =
    listingStatus !== "pending" && serverAllowsEngagement;

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
        setHasReachedOldestComment(false);
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
      setServerAllowsEngagement(engagement.canEngage);
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
  }, [engagementKey, listingStatus, profileId, listingId, refreshEngagement]);

  useEffect(() => {
    const scroller = commentScrollerRef.current;
    if (!scroller) return;

    const previousScroll = preserveScrollRef.current;
    if (previousScroll) {
      scroller.scrollTop =
        previousScroll.top + (scroller.scrollHeight - previousScroll.height);
      preserveScrollRef.current = null;
      return;
    }

    if (scrollToLatestRef.current) {
      scrollToCommentContentBottom(scroller);
      scrollToLatestRef.current = false;
    }
  }, [comments]);

  async function handleLike() {
    if (!currentUser || isLiking || !canEngage) return;
    setIsLiking(true);
    try {
      const canEngage = await canEngageWithMarketplaceListing(listingId);
      setServerAllowsEngagement(canEngage);
      if (!canEngage) {
        toast.error("This item no longer accepts likes.");
        return;
      }
      const nextLiked = await toggleMarketplaceListingLike(
        listingId,
        currentUser.id,
        isLiked,
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

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || isSending || !canEngage) return;

    const parsedDraft = commentDraftSchema.safeParse({
      body: draft,
      imageFiles,
    });
    if (!parsedDraft.success) {
      toast.error(
        parsedDraft.error.issues[0]?.message ??
          "Check your comment and try again.",
      );
      return;
    }
    const { body } = parsedDraft.data;

    setIsSending(true);
    const uploadedImagePaths: string[] = [];
    try {
      const canEngage = await canEngageWithMarketplaceListing(listingId);
      setServerAllowsEngagement(canEngage);
      if (!canEngage) {
        throw new Error("This item no longer accepts comments.");
      }

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
    if (!oldestComment || !scroller || isLoadingOlderRef.current) return;

    isLoadingOlderRef.current = true;
    preserveScrollRef.current = {
      height: scroller.scrollHeight,
      top: scroller.scrollTop,
    };
    setIsLoadingOlder(true);
    try {
      const olderComments = await getMarketplaceListingCommentsBefore(
        listingId,
        { created_at: oldestComment.created_at, id: oldestComment.id },
      );
      if (olderComments.length === 0) setHasReachedOldestComment(true);
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
      isLoadingOlderRef.current = false;
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
    !hasReachedOldestComment &&
    comments.length > 0 &&
    (comments.length < commentCount ||
      (commentCount === 0 &&
        comments.length >= MARKETPLACE_LISTING_COMMENT_PAGE_SIZE));
  return (
    <section className="mt-4 rounded-sm border border-border bg-card p-4 sm:p-5" aria-label="Listing activity">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isLiked ? "secondary" : "outline"}
          aria-pressed={isLiked}
          disabled={!currentUser || isLiking || isLoading || !canEngage}
          aria-busy={isLiking}
          onClick={() => void handleLike()}
          className="rounded-sm"
        >
          {isLiking ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Heart
              aria-hidden="true"
              className={`size-4 ${isLiked ? "fill-current text-rose-500" : ""}`}
            />
          )}
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
            <Scroller
              ref={commentScrollerRef}
              className="max-h-80 min-w-0 px-1 pt-5 pr-10 pb-6 sm:px-2 sm:pr-10"
              navigationClassName="left-auto right-2 translate-x-0 rounded-full bg-background/90 p-1 shadow-sm"
              hideScrollbar
              withNavigation
              scrollShadows={false}
              scrollTriggerMode="press"
              onScroll={(event) => {
                if (event.currentTarget.scrollTop <= 8 && hasOlderComments) {
                  void loadOlderComments();
                }
              }}
            >
              {isLoadingOlder && (
                <p
                  role="status"
                  className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
                >
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                  Loading older comments
                </p>
              )}
              <CommentList
                comments={comments}
                allUsers={allUsers}
                currentUserId={currentUser?.id}
                deletingCommentId={deletingCommentId}
                onDelete={handleDeleteComment}
                canDelete={canEngage}
                imageDescription="listing comment"
              />
            </Scroller>
          </>
        )}

        {canEngage && <PostComposerInput
          variant="comment"
          id={"marketplace-comment-" + listingId}
          value={draft}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder="Write a comment…"
          disabled={!currentUser || isLoading || isSending || !canEngage}
          canSubmit={Boolean(draft.trim() || imageFiles.length > 0) && Boolean(currentUser) && !isLoading && canEngage && !isSending}
          isSubmitting={isSending}
          onChange={setDraft}
          onSubmit={handleSubmit}
          fileUpload={{
            value: imageFiles,
            onValueChange: setImageFiles,
            onFileReject: (file, reason) =>
              toast.error(file.name + ": " + reason),
            onFileValidate: (file) => {
              const validation = imageFileSchema.safeParse(file);
              return validation.success
                ? null
                : validation.error.issues[0]?.message ?? "Choose a valid image.";
            },
            accept: "image/*",
            maxFiles: COMMENT_IMAGE_MAX_COUNT,
            maxSize: COMMENT_IMAGE_MAX_SIZE,
            multiple: true,
            attachmentLabel: "Attach image to listing comment",
            dropzoneTitle: "Drag & drop images here",
            dropzoneDescription: `Up to ${COMMENT_IMAGE_MAX_COUNT} images, max ${COMMENT_IMAGE_MAX_SIZE / 1024 / 1024} MB each`,
          }}
          submitButtonSize="icon-lg"
          submitAriaLabel="Send listing comment"
        />}
      </div>
    </section>
  );
}
