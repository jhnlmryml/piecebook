"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import {
  ArrowUp,
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

const COMMENT_LIMIT = 2000;

function compareComments(
  first: Pick<PostComment, "created_at" | "id">,
  second: Pick<PostComment, "created_at" | "id">,
) {
  return (
    new Date(first.created_at).getTime() -
      new Date(second.created_at).getTime() ||
    first.id.localeCompare(second.id)
  );
}

function areCommentsGrouped(
  first: PostComment | undefined,
  second: PostComment | undefined,
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

export function PostComments({ postId }: { postId: string }) {
  const { currentUser, allUsers } = useProfile();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const countRequestId = useRef(0);
  const loadRequestedRef = useRef(false);
  const knownCommentIds = useRef(new Set<string>());
  const deletedCommentIds = useRef(new Set<string>());
  const commentScrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollToLatestRef = useRef(false);
  const preserveScrollRef = useRef<{
    height: number;
    top: number;
    stickToTop: boolean;
  } | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isAtCommentTop, setIsAtCommentTop] = useState(true);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

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
  }, [postId]);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedComments = await getPostComments(postId);
      scrollToLatestRef.current = true;
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
      setHasLoaded(true);
    } catch (error) {
      loadRequestedRef.current = false;
      toast.error(
        error instanceof Error ? error.message : "Could not load comments.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!hasLoaded && !loadRequestedRef.current) {
      loadRequestedRef.current = true;
      void Promise.resolve().then(loadComments);
    }
  }, [hasLoaded, loadComments]);

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

  useEffect(
    () =>
      subscribeToRealtimeChanges((change) => {
        if (change.table !== "post_comments") return;
        const record = (change.eventType === "DELETE"
          ? change.oldRecord
          : change.newRecord) as unknown as PostComment;
        if (!record.id || record.post_id !== postId) return;
        if (change.eventType === "DELETE") {
          if (!deletedCommentIds.current.has(record.id)) {
            deletedCommentIds.current.add(record.id);
            knownCommentIds.current.delete(record.id);
            setCommentCount((count) =>
              count === null ? count : Math.max(0, count - 1),
            );
          }
          setComments((current) =>
            current.filter((comment) => comment.id !== record.id),
          );
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
    [postId, refreshCommentCount],
  );

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
      const olderComments = await getPostComments(postId, {
        created_at: oldestComment.created_at,
        id: oldestComment.id,
      });
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
      setIsLoadingOlder(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && imageFiles.length === 0) || isSending) return;
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
      setComments((existing) =>
        existing.filter((item) => item.id !== comment.id),
      );
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
    comments.length > 0 &&
    (commentCount !== null
      ? comments.length < commentCount
      : comments.length >= POST_COMMENT_PAGE_SIZE);
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
    <>
      <span className="piecebook-muted-text inline-flex h-8 items-center gap-2 rounded-sm px-2 text-xs">
        <MessageCircle aria-hidden="true" className="size-4" />
        {displayedCommentCount > 0
          ? `Comments · ${displayedCommentCount}`
          : "Comment"}
      </span>

      <section
        id={`post-comments-${postId}`}
        aria-label="Comments"
        className="basis-full w-full min-w-0"
      >
          {isLoading ? (
            <p className="piecebook-muted-text text-xs flex my-2 items-center justify-center "><Loader2 className="animate-spin" /> Loading comments</p>
          ) : comments.length === 0 ? (
            <p className="piecebook-muted-text text-xs sr-only">No comments yet.</p>
          ) : (
            <>
              {showOlderCommentsButton && (
                <div className="mb-2 flex justify-center">
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
                className="mb-5 max-h-72 pr-2"
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
                              <AvatarFallback className="piecebook-avatar-fallback text-[10px]">
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
                                  alt={`Image ${index + 1} attached to comment`}
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
            id={"comment-" + postId}
            value={draft}
            maxLength={COMMENT_LIMIT}
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
              attachmentLabel: "Attach image to comment",
              dropzoneTitle: "Drag & drop images here",
              dropzoneDescription: `Up to ${COMMENT_IMAGE_MAX_COUNT} images, max 5MB each`,
            }}
            submitButtonSize="icon-lg"
            submitAriaLabel="Send comment"
          />
      </section>
    </>
  );
}
