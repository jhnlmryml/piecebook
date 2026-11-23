"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Ellipsis, Heart, Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PostComposer } from "@/components/features/posts/PostComposer";
import { PostComments } from "@/components/features/posts/PostComments";
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { useProfile } from "@/context/ProfileContext";
import {
  getWallPosts,
  deleteWallPost,
  togglePostLike,
  WALL_POST_LIMIT,
  type WallPost,
  type WallPostFeedItem,
} from "@/lib/posts";
import { getInitials } from "@/lib/get-initials";
import { isSupabasePublicImage } from "@/lib/is-supabase-public-image";
import { WallPostSkeleton } from "@/components/shared/LoadingSkeletons";
import { ParticleDissolve } from "@/components/shared/ParticleDissolve";
import { subscribeToRealtimeChanges } from "@/lib/realtime-events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type WallFeedProps = {
  searchTerm: string;
  userOnly?: boolean;
  profileUserId?: string;
  showComposer?: boolean;
  mobilePageScroll?: boolean;
};

function sortPosts<T extends WallPost>(posts: T[]) {
  return [...posts]
    .sort(
    (first, second) =>
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime(),
    )
    .slice(0, WALL_POST_LIMIT);
}

export default function WallFeed({
  searchTerm,
  userOnly = false,
  profileUserId,
  showComposer = true,
  mobilePageScroll = false,
}: WallFeedProps) {
  const { currentUser, allUsers, realtimeStatus } = useProfile();
  const pathname = usePathname();
  const [posts, setPosts] = useState<WallPostFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [likingPostIds, setLikingPostIds] = useState<string[]>([]);
  const [postToDelete, setPostToDelete] = useState<WallPost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [exitingPostIds, setExitingPostIds] = useState<Set<string>>(new Set());
  const postsRef = useRef(posts);
  const completedPostExits = useRef(new Set<string>());
  const deletedPostIds = useRef(new Set<string>());

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const loadPosts = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const loadedPosts = await getWallPosts();
      setPosts((currentPosts) => {
        const mergedPosts = new Map(
          loadedPosts
            .filter((post) => !deletedPostIds.current.has(post.id))
            .map((post) => [post.id, post]),
        );
        for (const post of currentPosts) {
          if (
            !deletedPostIds.current.has(post.id) &&
            !mergedPosts.has(post.id)
          ) {
            mergedPosts.set(post.id, post);
          }
        }
        return sortPosts(Array.from(mergedPosts.values()));
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load wall posts.";
      setLoadError(message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Refresh cached feed state after route changes, such as returning from a profile.
    let isCurrent = true;
    const unsubscribe = subscribeToRealtimeChanges((change) => {
      if (change.table !== "posts") return;
      if (change.eventType === "DELETE") {
        const deletedId = String(change.oldRecord.id ?? "");
        if (!deletedId) return;
        deletedPostIds.current.add(deletedId);
        if (
          postsRef.current.some((post) => post.id === deletedId) &&
          !completedPostExits.current.has(deletedId)
        ) {
          setExitingPostIds((current) => new Set(current).add(deletedId));
        }
        return;
      }

      const changedPost = change.newRecord as unknown as WallPost;
      if (!changedPost.id) return;
      deletedPostIds.current.delete(changedPost.id);
      setPosts((currentPosts) => {
        const existingPost = currentPosts.find((post) => post.id === changedPost.id);
        if (change.eventType === "UPDATE" && !existingPost) return currentPosts;
        const nextPost = existingPost
          ? { ...existingPost, ...changedPost }
          : { ...changedPost, comments: [], commentCount: 0 };
        return sortPosts([
          nextPost,
          ...currentPosts.filter((post) => post.id !== changedPost.id),
        ]);
      });
    });

    getWallPosts()
      .then((loadedPosts) => {
        if (!isCurrent) return;
        setLoadError(null);
        setPosts((currentPosts) => {
          const mergedPosts = new Map(
            loadedPosts
              .filter((post) => !deletedPostIds.current.has(post.id))
              .map((post) => [post.id, post]),
          );
          for (const post of currentPosts) {
            if (
              !deletedPostIds.current.has(post.id) &&
              !mergedPosts.has(post.id)
            ) {
              mergedPosts.set(post.id, post);
            }
          }
          return sortPosts(Array.from(mergedPosts.values()));
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not load wall posts.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [pathname]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadPosts(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [loadPosts]);

  const visiblePosts = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    const targetUserId = profileUserId ?? currentUser?.id;
    const scopedPosts = userOnly
      ? posts.filter((post) => post.user_id === targetUserId)
      : posts;
    if (!query) return scopedPosts;

    return scopedPosts.filter((post) => {
      const author = allUsers.find((user) => user.id === post.user_id);
      return (
        post.post?.toLocaleLowerCase().includes(query) ||
        author?.full_name.toLocaleLowerCase().includes(query)
      );
    });
  }, [allUsers, currentUser?.id, posts, profileUserId, searchTerm, userOnly]);

  const targetUserId = profileUserId ?? currentUser?.id;
  const targetUserName = allUsers.find((user) => user.id === targetUserId)?.full_name;
  const isOwnProfile = targetUserId === currentUser?.id;
  const postsHeading = isOwnProfile
    ? "Your posts"
    : `${targetUserName ?? "Profile"}'s posts`;
  const isViewLoading = isLoading || (userOnly && !targetUserId && allUsers.length > 0);

  const addPost = useCallback((post: WallPost) => {
    setPosts((currentPosts) =>
      sortPosts([
        { ...post, comments: [], commentCount: 0 },
        ...currentPosts.filter((item) => item.id !== post.id),
      ]),
    );
  }, []);

  async function handleLike(post: WallPost) {
    if (!currentUser) return;
    setLikingPostIds((ids) => [...ids, post.id]);
    try {
      const likes = await togglePostLike(
        post.id,
        currentUser.id,
        post.likes_by?.includes(currentUser.id) ?? false,
      );
      setPosts((currentPosts) =>
        currentPosts.map((item) =>
          item.id === post.id ? { ...item, likes_by: likes } : item,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the like.",
      );
    } finally {
      setLikingPostIds((ids) => ids.filter((id) => id !== post.id));
    }
  }

  async function handleDelete() {
    const post = postToDelete;
    if (
      !currentUser ||
      !post ||
      post.user_id !== currentUser.id ||
      isDeletingPost
    ) {
      return;
    }

    setIsDeletingPost(true);
    try {
      const result = await deleteWallPost(post.id, currentUser.id);
      if (result.cleanupWarning) toast.warning(result.cleanupWarning);
      deletedPostIds.current.add(post.id);
      if (!completedPostExits.current.has(post.id)) {
        setExitingPostIds((current) => new Set(current).add(post.id));
      }
      setPostToDelete(null);
      toast.success("Post deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete post.",
      );
    } finally {
      setIsDeletingPost(false);
    }
  }

  function finishPostDissolve(postId: string) {
    completedPostExits.current.add(postId);
    setPosts((currentPosts) =>
      currentPosts.filter((post) => post.id !== postId),
    );
    setExitingPostIds((current) => {
      const next = new Set(current);
      next.delete(postId);
      return next;
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 sm:gap-4 ${
        mobilePageScroll ? "flex-none md:min-h-0 md:flex-1" : "min-h-0 flex-1"
      }`}
      id="wall"
    >
      {showComposer && <PostComposer onPostCreated={addPost} />}

      <div className="piecebook-divider flex shrink-0 items-center justify-between border-b pb-2">
        <h2 className="piecebook-brand-text text-sm font-bold">
          {userOnly ? postsHeading : "Recent posts"}
        </h2>
        <div className="flex items-center gap-2">
          {!isViewLoading && !loadError && (
            <span className="piecebook-muted-text text-xs">
              {userOnly ? visiblePosts.length : posts.length}{" "}
              {(userOnly ? visiblePosts.length : posts.length) === 1
                ? "post"
                : "posts"}
            </span>
          )}
          <span
            aria-label={
              realtimeStatus === "connected"
                ? "Live updates connected"
                : realtimeStatus === "error"
                  ? "Live updates unavailable"
                  : "Live updates connecting"
            }
            title={
              realtimeStatus === "connected"
                ? "Live updates connected"
                : realtimeStatus === "error"
                  ? "Live updates unavailable"
                  : "Live updates connecting"
            }
            className={`size-2 rounded-full ${realtimeStatus === "connected" ? "bg-green-500" : realtimeStatus === "error" ? "bg-red-500" : "bg-border"}`}
          />
        </div>
      </div>

      {realtimeStatus === "error" && (
        <p
          role="status"
          className="rounded-sm border hidden border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
        >
          Live updates could not connect. Check the Supabase Realtime
          configuration in the setup guide.
        </p>
      )}

      <div
        className={
          mobilePageScroll
            ? "flex-none overflow-visible md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:scrollbar-hide"
            : "min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
        }
      >
        {isViewLoading ? (
          <div className="space-y-3" aria-label="Loading wall posts">
            <WallPostSkeleton />
            <WallPostSkeleton />
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="piecebook-card-surface rounded-xl border border-red-200 p-5 text-sm dark:border-red-400/30"
          >
            <p className="text-red-700 dark:text-red-300">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
               disabled={isLoading}
              onClick={() => void loadPosts()}
              className="mt-3 rounded-sm"
            >
               {isLoading ? (
                 <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
               ) : (
                 <RefreshCw aria-hidden="true" className="size-3.5" />
               )}
               {isLoading ? "Loading..." : "Try again"}
            </Button>
          </div>
        ) : (
          <>
            {visiblePosts.length === 0 && (
              <div className="piecebook-card-surface rounded-2xl border px-5 py-10 text-center">
                <MessageCircle
                  aria-hidden="true"
                  className="piecebook-muted-text mx-auto size-7"
                />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {searchTerm.trim()
                    ? "No posts match your search."
                    : userOnly
                      ? !targetUserId
                        ? "No profile is available."
                        : isOwnProfile
                          ? "You haven't posted yet."
                          : `${targetUserName ?? "This user"} hasn't posted yet.`
                      : "Your wall is quiet."}
                </p>
                <p className="piecebook-muted-text mt-1 text-xs">
                  {searchTerm.trim()
                    ? "Try another name or keyword."
                    : userOnly
                      ? !targetUserId
                        ? "Add a profile to public.users in Supabase to view profile posts."
                        : isOwnProfile
                          ? "Your posts will appear here when you share them."
                          : `${targetUserName ?? "This user"}'s posts will appear here when they share them.`
                      : "Share a thought to start the conversation."}
                </p>
              </div>
            )}
            <div className="space-y-3 pb-1">
              {visiblePosts.map((post) => {
                const author = allUsers.find((user) => user.id === post.user_id);
                const isLiked = Boolean(
                  currentUser && post.likes_by?.includes(currentUser.id),
                );

                return (
                  <ParticleDissolve
                    key={post.id}
                    isExiting={exitingPostIds.has(post.id)}
                    onExitComplete={() => finishPostDissolve(post.id)}
                  >
                    <article className="piecebook-card-surface rounded-2xl border shadow-sm transition-shadow duration-200 hover:shadow-md [content-visibility:auto] [contain-intrinsic-size:auto_32rem]">
                  <div className="flex items-start gap-3 p-3 sm:p-4">

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-4 items-center">
                          <Avatar className="size-10 shrink-0 ">
                          {author?.image && (
                            <AvatarImage src={author.image} alt={author.full_name} />
                          )}
                          <AvatarFallback className="piecebook-avatar-fallback">
                            {author ? getInitials(author.full_name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="piecebook-brand-text text-sm font-bold">
                            {author?.full_name ?? "Piecebook member"}
                          </h3>
                          <LocalDateTime
                            className="piecebook-muted-text mt-0.5 block text-xs"
                            dateTime={post.created_at}
                          />
                        </div>
                        </div>

                        {currentUser?.id === post.user_id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Post options"
                                  className="piecebook-muted-text -mt-1 -mr-1 shrink-0"
                                >
                                  <Ellipsis aria-hidden="true" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent
                              align="end"
                              className="piecebook-card-surface rounded-sm border"
                            >
                              <DropdownMenuItem
                                onClick={() => setPostToDelete(post)}
                                className="cursor-pointer rounded-sm text-destructive focus:text-destructive"
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                                Delete post
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {post.post && (
                        <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground">
                          {post.post}
                        </p>
                      )}
                      {post.image?.map((imageUrl, index) => (
                        <div
                          key={`${post.id}-${imageUrl}`}
                          className="relative mt-3 aspect-16/10 w-full overflow-hidden rounded-xl bg-muted"
                        >
                          <Image
                            src={imageUrl}
                            alt={`Photo ${index + 1} shared by ${author?.full_name ?? "a Piecebook member"}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 680px"
                            unoptimized={!isSupabasePublicImage(imageUrl)}
                            className="object-contain"
                          />
                        </div>
                      ))}
                      <div className="piecebook-divider mt-4 flex flex-wrap items-start gap-2 border-t pt-2 text-xs">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!currentUser || likingPostIds.includes(post.id)}
                           aria-busy={likingPostIds.includes(post.id)}
                          aria-pressed={isLiked}
                          onClick={() => void handleLike(post)}
                          className={`h-8 rounded-sm px-2 text-xs cursor-pointer ${isLiked ? "piecebook-brand-text" : "piecebook-muted-text"}`}
                        >
                           <Heart
                             aria-hidden="true"
                             className={`size-4 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`}
                           />
                          Like
                          {(post.likes_by?.length ?? 0) > 0 &&
                            ` ${post.likes_by?.length}`}
                        </Button>
                        <PostComments
                          postId={post.id}
                          initialComments={post.comments}
                          initialCommentCount={post.commentCount}
                        />
                      </div>
                    </div>
                  </div>
                    </article>
                  </ParticleDissolve>
                );
              })}
            </div>
          </>
        )}
      </div>
      <AlertDialog
        open={postToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingPost) setPostToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The post will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPost}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingPost}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeletingPost ? "Deleting..." : "Delete post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
