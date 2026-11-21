import type { Tables, TablesInsert } from "@/types/supabase";
import { commentPayloadSchema } from "@/lib/form-schemas";
import { apiRequest, jsonRequest } from "@/lib/api-client";
import { broadcastRealtimeChange } from "@/lib/realtime-events";

export type PostComment = Tables<"post_comments">;
export const POST_COMMENT_PAGE_SIZE = 20;

export async function getPostCommentCount(postId: string): Promise<number> {
  const result = await apiRequest<{ count: number }>(
    `posts/${encodeURIComponent(postId)}/comments/count`,
  );
  return result.count;
}

export async function getPostComments(
  postId: string,
  before?: Pick<PostComment, "created_at" | "id">,
): Promise<PostComment[]> {
  const params = new URLSearchParams();
  if (before) {
    params.set("beforeCreatedAt", before.created_at);
    params.set("beforeId", before.id);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiRequest<PostComment[]>(
    `posts/${encodeURIComponent(postId)}/comments${query}`,
  );
}

export async function createPostComment(
  comment: TablesInsert<"post_comments">,
): Promise<PostComment> {
  const validation = commentPayloadSchema.safeParse({
    body: comment.body,
    image: comment.image,
  });
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Comment details are invalid.",
    );
  }
  const createdComment = await apiRequest<PostComment>(
    `posts/${encodeURIComponent(comment.post_id)}/comments`,
    jsonRequest("POST", { ...comment, ...validation.data }),
  );
  broadcastRealtimeChange({
    table: "post_comments",
    eventType: "INSERT",
    newRecord: createdComment,
    oldRecord: {},
  });
  return createdComment;
}

export async function deletePostComment(
  postId: string,
  commentId: string,
  profileId: string,
): Promise<{ storageCleanupError?: string }> {
  const result = await apiRequest<{ storageCleanupError?: string }>(
    `posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}?profileId=${encodeURIComponent(profileId)}`,
    { method: "DELETE" },
  );
  broadcastRealtimeChange({
    table: "post_comments",
    eventType: "DELETE",
    newRecord: {},
    oldRecord: { id: commentId, post_id: postId, user_id: profileId },
  });
  return result;
}
