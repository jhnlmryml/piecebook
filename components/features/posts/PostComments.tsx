"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  Loader2,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  commentDraftSchema,
  COMMENT_MAX_LENGTH,
  imageFileSchema,
} from "@/lib/form-schemas";
import { Scroller } from "@/components/ui/scroller";
import { useProfile } from "@/context/ProfileContext";
import { PostComposerInput } from "@/components/features/posts/PostComposerInput";
import { CommentList } from "@/components/features/comments/CommentList";
import {
  compareComments,
  scrollToCommentContentBottom,
} from "@/lib/comment-utils";
import { subscribeToRealtimeChanges } from "@/lib/realtime-events";
import {
  createPostComment,
  getPostCommentCount,
  getPostComments,
  deletePostComment,
  POST_COMMENT_PAGE_SIZE,
  type PostComment,
} from "@/lib/post-comments";
import {
  COMMENT_IMAGE_MAX_COUNT,
  COMMENT_IMAGE_MAX_SIZE,
  removeCommentImage,
  uploadCommentImage,
  type UploadedCommentImage,
} from "@/lib/comment-images";

export function PostComments({
  postId,
  initialComments,
  initialCommentCount,
}: {
  postId: string;
  initialComments?: PostComment[];
  initialCommentCount?: number;
}) {
  const { currentUser, allUsers } = useProfile();
  const [hasLoaded, setHasLoaded] = useState(initialComments !== undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [comments, setComments] = useState<PostComment[]>(initialComments ?? []);
  const [exitingCommentIds, setExitingCommentIds] = useState<Set<string>>(new Set());
  const [commentCount, setCommentCount] = useState<number | null>(initialCommentCount ?? null);
  const [previousFeedCount, setPreviousFeedCount] = useState(initialCommentCount);
  const [hasReachedOldestComment, setHasReachedOldestComment] = useState(false);
  const countRequestId = useRef(0);
  const loadRequestedRef = useRef(initialComments !== undefined);
  const lastFeedComments = useRef(initialComments);
  const knownCommentIds = useRef(new Set<string>());
  const deletedCommentIds = useRef(new Set<string>());
  const completedCommentExits = useRef(new Set<string>());
  const commentScrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollToLatestRef = useRef(false);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
  } | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const isLoadingOlderRef = useRef(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  if (initialCommentCount !== previousFeedCount) {
    setPreviousFeedCount(initialCommentCount);
    setCommentCount(initialCommentCount ?? null);
  }
  const beginCommentDissolve = useCallback((commentId: string) => {
    if (completedCommentExits.current.has(commentId)) return;
    setExitingCommentIds((current) => new Set(current).add(commentId));
  }, []);

  const finishCommentDissolve = useCallback((comment: PostComment) => {
    completedCommentExits.current.add(comment.id);
    setComments((current) =>
      current.filter((item) => item.id !== comment.id),
    );
    setExitingCommentIds((current) => {
      const next = new Set(current);
      next.delete(comment.id);
      return next;
    });
  }, []);

  const refreshCommentCount = useCallback(async () => {
    const requestId = ++countRequestId.current;
    try {
      const count = await getPostCommentCount(postId);
      if (requestId === countRequestId.current) setCommentCount(count);
    } catch {
      // Keep the count unknown; opening comments can still show the loaded list count.
    }
  }, [postId]);

  useEffect(() => {
    if (!initialComments) return;
    for (const comment of initialComments) {
      knownCommentIds.current.add(comment.id);
    }
    if (initialComments === lastFeedComments.current) return;
    lastFeedComments.current = initialComments;
    const refreshedIds = new Set(initialComments.map((comment) => comment.id));
    setComments((current) => {
      const refreshed = initialComments.filter(
        (comment) => !deletedCommentIds.current.has(comment.id),
      );
      const older = current.filter(
        (comment) =>
          !refreshedIds.has(comment.id) &&
          !deletedCommentIds.current.has(comment.id),
      );
      return [...older, ...refreshed].sort(compareComments);
    });
    setHasLoaded(true);
    loadRequestedRef.current = true;
  }, [initialCommentCount, initialComments]);

  useEffect(() => {
    if (initialCommentCount !== undefined) return;
    const requestId = ++countRequestId.current;
    let isActive = true;

    void getPostCommentCount(postId)
      .then((count) => {
        if (isActive && requestId === countRequestId.current) {
          setCommentCount(count);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      countRequestId.current += 1;
    };
  }, [initialCommentCount, postId]);

  const loadComments = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const loadedComments = await getPostComments(postId);
      scrollToLatestRef.current = showLoading;
      for (const comment of loadedComments) {
        knownCommentIds.current.add(comment.id);
      }
      setComments((current) => {
        const merged = new Map(loadedComments.map((comment) => [comment.id, comment]));
        for (const comment of current) {
          if (!merged.has(comment.id)) merged.set(comment.id, comment);
        }
        return [...merged.values()].sort(compareComments);
      });
      setCommentCount((count) => count ?? loadedComments.length);
      setHasReachedOldestComment(false);
      setHasLoaded(true);
    } catch (error) {
      loadRequestedRef.current = false;
      if (showLoading) {
        toast.error(
          error instanceof Error ? error.message : "Could not load comments.",
        );
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!hasLoaded && !loadRequestedRef.current) {
      loadRequestedRef.current = true;
      void Promise.resolve().then(() => loadComments());
    }
  }, [hasLoaded, loadComments]);

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

  useEffect(
    () =>
      subscribeToRealtimeChanges((change) => {
        if (change.table !== "post_comments") return;
        const record = (change.eventType === "DELETE"
          ? change.oldRecord
          : change.newRecord) as unknown as PostComment;
        if (!record.id || record.post_id !== postId) return;
        if (change.eventType === "DELETE") {
          const wasKnown = knownCommentIds.current.has(record.id);
          if (!deletedCommentIds.current.has(record.id)) {
            deletedCommentIds.current.add(record.id);
            knownCommentIds.current.delete(record.id);
            setCommentCount((count) =>
              count === null ? count : Math.max(0, count - 1),
            );
          }
          if (wasKnown) beginCommentDissolve(record.id);
          void refreshCommentCount();
          return;
        }
        if (change.eventType === "INSERT") {
          scrollToLatestRef.current = true;
          if (!knownCommentIds.current.has(record.id)) {
            knownCommentIds.current.add(record.id);
            setCommentCount((count) => (count === null ? count : count + 1));
          }
          void refreshCommentCount();
        }

        setComments((current) => {
          return [...current.filter((comment) => comment.id !== record.id), record]
            .sort(compareComments);
        });
      }),
    [beginCommentDissolve, postId, refreshCommentCount],
  );

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
      const olderComments = await getPostComments(postId, {
        created_at: oldestComment.created_at,
        id: oldestComment.id,
      });
      if (olderComments.length === 0) setHasReachedOldestComment(true);
      for (const comment of olderComments) knownCommentIds.current.add(comment.id);
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

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    const validation = commentDraftSchema.safeParse({
      body: draft,
      imageFiles,
    });
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Check your comment and try again.",
      );
      return;
    }
    const { body } = validation.data;
    if (!currentUser) {
      toast.error("Choose a profile before commenting.");
      return;
    }

    setIsSending(true);
    const uploadedImagePaths: string[] = [];
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        const uploadResults = await Promise.allSettled(
          imageFiles.map((file) => uploadCommentImage(file, currentUser.id)),
        );
        const successfulUploads = uploadResults.filter(
          (result): result is PromiseFulfilledResult<UploadedCommentImage> =>
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
            : new Error("Could not upload comment images.");
        }

        imageUrls = successfulUploads.map((result) => result.value.url);
      }
      const comment = await createPostComment({
        post_id: postId,
        user_id: currentUser.id,
        body,
        image: imageUrls.length > 0 ? imageUrls : null,
      });
      if (!knownCommentIds.current.has(comment.id)) {
        knownCommentIds.current.add(comment.id);
        setCommentCount((count) => (count === null ? count : count + 1));
      }
      void refreshCommentCount();
      scrollToLatestRef.current = true;
      setComments((existing) =>
        [...existing.filter((item) => item.id !== comment.id), comment].sort(
          compareComments,
        ),
      );
      setHasLoaded(true);
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
        error instanceof Error ? error.message : "Could not add comment.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteComment(comment: PostComment) {
    if (!currentUser || deletingCommentId) return;
    setDeletingCommentId(comment.id);
    try {
      const result = await deletePostComment(
        postId,
        comment.id,
        currentUser.id,
      );
      if (!deletedCommentIds.current.has(comment.id)) {
        deletedCommentIds.current.add(comment.id);
        knownCommentIds.current.delete(comment.id);
        setCommentCount((count) =>
          count === null ? count : Math.max(0, count - 1),
        );
      }
      beginCommentDissolve(comment.id);
      void refreshCommentCount();
      if (result.storageCleanupError) {
        toast.error(`Comment deleted, but ${result.storageCleanupError}`);
      } else {
        toast.success("Comment deleted.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  const displayedCommentCount = commentCount ?? (hasLoaded ? comments.length : 0);
  const hasOlderComments =
    !hasReachedOldestComment &&
    comments.length > 0 &&
    (commentCount !== null
      ? comments.length < commentCount
      : comments.length >= POST_COMMENT_PAGE_SIZE);
  return (
    <>
      <span className="piecebook-muted-text inline-flex h-8 items-center gap-2 rounded-sm px-2 text-xs">
        <MessageCircle aria-hidden="true" className="size-4" />
        {displayedCommentCount > 0
          ? `Comments ${displayedCommentCount}`
          : "Comment"}
      </span>

      <section
        id={`post-comments-${postId}`}
        aria-label="Comments"
        className="basis-full w-full min-w-0 space-y-3"
      >
          {isLoading ? (
            <p className="piecebook-muted-text text-xs flex my-2 items-center justify-center "><Loader2 className="animate-spin" /> Loading comments</p>
          ) : comments.length === 0 ? (
            <p className="piecebook-muted-text text-xs sr-only">No comments yet.</p>
          ) : (
            <>
              <Scroller
                scrollTriggerMode="press"
                ref={commentScrollerRef}
                withNavigation
                hideScrollbar
                scrollShadows={false}
                onScroll={(event) => {
                  if (event.currentTarget.scrollTop <= 8 && hasOlderComments) {
                    void loadOlderComments();
                  }
                }}
                className="max-h-72 min-w-0 px-1 pt-2 pb-6 sm:px-2"
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
                  exitingCommentIds={exitingCommentIds}
                  onDelete={handleDeleteComment}
                  onExitComplete={finishCommentDissolve}
                />
              </Scroller>
            </>
          )}

          <PostComposerInput
            variant="comment"
            id={"comment-" + postId}
            value={draft}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Write a comment…"
            disabled={!currentUser || isSending}
            canSubmit={
              Boolean(draft.trim() || imageFiles.length > 0) &&
              Boolean(currentUser) &&
              !isSending
            }
            isSubmitting={isSending}
            onChange={setDraft}
            onSubmit={handleSubmit}
            fileUpload={{
              value: imageFiles,
              onValueChange: setImageFiles,
              onFileReject: (file, reason) =>
                toast.error(file.name + ": " + reason),
              onFileValidate: (file) => {
                const fileValidation = imageFileSchema.safeParse(file);
                return fileValidation.success
                  ? null
                  : fileValidation.error.issues[0]?.message ??
                      "Choose a valid image.";
              },
              accept: "image/*",
              maxFiles: COMMENT_IMAGE_MAX_COUNT,
              maxSize: COMMENT_IMAGE_MAX_SIZE,
              multiple: true,
              attachmentLabel: "Attach image to comment",
              dropzoneTitle: "Drag & drop images here",
              dropzoneDescription: `Up to ${COMMENT_IMAGE_MAX_COUNT} images, max ${COMMENT_IMAGE_MAX_SIZE / 1024 / 1024} MB each`,
            }}
            submitButtonSize="icon-lg"
            submitAriaLabel="Send comment"
          />
      </section>
    </>
  );
}
