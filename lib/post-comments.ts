import type { Tables, TablesInsert } from "@/types/supabase";
import { getSupabaseClient } from "@/lib/supabase";
import { removeCommentImages } from "@/lib/comment-images";

export type PostComment = Tables<"post_comments">;
export const POST_COMMENT_PAGE_SIZE = 20;

export async function getPostCommentCount(postId: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("post_comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) throw new Error(`Could not load comment count: ${error.message}`);
  return count ?? 0;
}

export async function getPostComments(
  postId: string,
  before?: Pick<PostComment, "created_at" | "id">,
): Promise<PostComment[]> {
  let query = getSupabaseClient()
    .from("post_comments")
    .select("*")
    .eq("post_id", postId);

  if (before) {
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(POST_COMMENT_PAGE_SIZE);

  if (error) throw new Error(`Could not load comments: ${error.message}`);
  return data.reverse();
}

export async function createPostComment(
  comment: TablesInsert<"post_comments">,
): Promise<PostComment> {
  const { data, error } = await getSupabaseClient()
    .from("post_comments")
    .insert(comment)
    .select("*")
    .single();

  if (error) throw new Error(`Could not add comment: ${error.message}`);
  return data;
}

export async function deletePostComment(
  postId: string,
  commentId: string,
  profileId: string,
): Promise<{ storageCleanupError?: string }> {
  const { data, error } = await getSupabaseClient()
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("post_id", postId)
    .eq("user_id", profileId)
    .select("image")
    .maybeSingle();

  if (error) throw new Error(`Could not delete comment: ${error.message}`);
  if (!data) {
    throw new Error("This comment could not be found or does not belong to you.");
  }

  try {
    await removeCommentImages(data.image ?? [], profileId);
    return {};
  } catch (cleanupError) {
    return {
      storageCleanupError:
        cleanupError instanceof Error
          ? cleanupError.message
          : "Could not remove attached images from storage.",
    };
  }
}
