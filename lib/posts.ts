import type { Tables, TablesInsert } from "@/types/supabase";
import { imageFileSchema, wallPostPayloadSchema } from "@/lib/form-schemas";
import { apiRequest, jsonRequest } from "@/lib/api-client";
import { broadcastRealtimeChange } from "@/lib/realtime-events";

export type WallPost = Tables<"posts">;
export type WallPostFeedItem = WallPost & {
  comments?: Tables<"post_comments">[];
  commentCount?: number;
};
export const POST_IMAGE_BUCKET = "post-images";
export const WALL_POST_LIMIT = 50;
let wallPostsRequest: Promise<WallPostFeedItem[]> | null = null;

export async function uploadPostImage(file: File, profileId: string) {
  const validation = imageFileSchema.safeParse(file);
  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Choose a valid image.");
  }
  const formData = new FormData();
  formData.append("ownerId", profileId);
  formData.append("file", file);
  return apiRequest<{ path: string; url: string }>("uploads/post", {
    method: "POST",
    body: formData,
  });
}

export async function removePostImages(
  profileId: string,
  paths: readonly string[],
): Promise<void> {
  if (paths.length === 0) return;
  await apiRequest<void>(
    "uploads/post",
    jsonRequest("DELETE", { ownerId: profileId, paths }),
  );
}

export function getWallPosts(): Promise<WallPostFeedItem[]> {
  if (wallPostsRequest) return wallPostsRequest;
  wallPostsRequest = apiRequest<WallPostFeedItem[]>("posts").finally(() => {
    wallPostsRequest = null;
  });
  return wallPostsRequest;
}

export async function createWallPost(
  post: TablesInsert<"posts">,
): Promise<WallPost> {
  const validation = wallPostPayloadSchema.safeParse(post);
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Post details are invalid.",
    );
  }
  return apiRequest<WallPost>("posts", jsonRequest("POST", validation.data));
}

export async function togglePostLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<string[]> {
  const result = await apiRequest<{ likes_by: string[] }>(
    `posts/${encodeURIComponent(postId)}/likes`,
    jsonRequest(currentlyLiked ? "DELETE" : "PUT", { profileId: userId }),
  );
  broadcastRealtimeChange({
    table: "posts",
    eventType: "UPDATE",
    newRecord: { id: postId, likes_by: result.likes_by },
    oldRecord: {},
  });
  return result.likes_by;
}

export async function deleteWallPost(
  postId: string,
  profileId: string,
): Promise<{ cleanupWarning: string | null }> {
  return apiRequest<{ cleanupWarning: string | null }>(
    `posts/${encodeURIComponent(postId)}?profileId=${encodeURIComponent(profileId)}`,
    { method: "DELETE" },
  );
}
