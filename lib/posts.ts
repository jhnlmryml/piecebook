import type { Tables, TablesInsert } from "@/types/supabase";
import { getSupabaseClient } from "@/lib/supabase";

export type WallPost = Tables<"posts">;
export const POST_IMAGE_BUCKET = "post-images";
export const WALL_POST_LIMIT = 50;

function getOwnedPostImagePath(
  imageUrl: string,
  userId: string,
  bucketPublicUrl: string,
): string | null {
  try {
    const image = new URL(imageUrl);
    const bucket = new URL(bucketPublicUrl);
    const bucketPrefix = `${bucket.pathname.replace(/\/+$/, "")}/`;

    if (image.origin !== bucket.origin || !image.pathname.startsWith(bucketPrefix)) {
      return null;
    }

    const encodedPath = image.pathname.slice(bucketPrefix.length);
    const objectPath = encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");

    return objectPath.startsWith(`${userId}/`) ? objectPath : null;
  } catch {
    return null;
  }
}

export async function getWallPosts(): Promise<WallPost[]> {
  const { data, error } = await getSupabaseClient()
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(WALL_POST_LIMIT);

  if (error) throw new Error(`Could not load posts: ${error.message}`);
  return data;
}

export async function createWallPost(
  post: TablesInsert<"posts">,
): Promise<WallPost> {
  const { data, error } = await getSupabaseClient()
    .from("posts")
    .insert(post)
    .select()
    .single();

  if (error) throw new Error(`Could not publish post: ${error.message}`);
  return data;
}

export async function togglePostLike(
  postId: string,
  userId: string,
  currentLikes: string[] | null,
): Promise<string[]> {
  const nextLikes = currentLikes?.includes(userId)
    ? currentLikes.filter((id) => id !== userId)
    : [...(currentLikes ?? []), userId];

  const { data, error } = await getSupabaseClient()
    .from("posts")
    .update({ likes_by: nextLikes })
    .eq("id", postId)
    .select("id")
    .single();

  if (error) throw new Error(`Could not update like: ${error.message}`);
  if (!data) throw new Error("Could not update like: post was not found.");
  return nextLikes;
}

export async function deleteWallPost(
  postId: string,
  profileId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const imageBucket = supabase.storage.from(POST_IMAGE_BUCKET);
  const bucketPublicUrl = imageBucket.getPublicUrl("").data.publicUrl;

  const { data: post, error: loadError } = await supabase
    .from("posts")
    .select("id, image")
    .eq("id", postId)
    .eq("user_id", profileId)
    .single();

  if (loadError) {
    throw new Error(`Could not load post images: ${loadError.message}`);
  }
  if (!post) throw new Error("Could not delete post: it may no longer exist.");

  const imagePaths = Array.from(
    new Set(
      (post.image ?? [])
        .map((imageUrl) =>
          getOwnedPostImagePath(imageUrl, profileId, bucketPublicUrl),
        )
        .filter((path): path is string => path !== null),
    ),
  );

  if (imagePaths.length > 0) {
    const { error: storageError } = await imageBucket.remove(imagePaths);
    if (storageError) {
      throw new Error(`Could not delete post images: ${storageError.message}`);
    }
  }

  const { data: deletedPost, error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", profileId)
    .select("id")
    .single();

  if (deleteError) {
    throw new Error(`Could not delete post: ${deleteError.message}`);
  }
  if (!deletedPost) {
    throw new Error("Could not delete post: it may no longer exist.");
  }
}
