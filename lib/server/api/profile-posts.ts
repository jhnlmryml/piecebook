import { getSupabaseClient } from "@/lib/supabase";
import {
  commentPayloadSchema,
  imageFileSchema,
  profileFieldsSchema,
  profileImageFileSchema,
  wallPostPayloadSchema,
} from "@/lib/form-schemas";
import {
  ApiError,
  databaseError,
  json,
  notFound,
  parseQuery,
  readFormData,
  readJson,
  requireUuid,
} from "@/lib/server/api-utils";
import { marketplaceListingPublicColumns } from "@/lib/marketplace-validation";
import { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const uuidSchema = z.string().uuid();
const postLikeSchema = z.object({ profileId: uuidSchema });
const postCommentSchema = commentPayloadSchema.extend({
  user_id: uuidSchema,
});
const profileColumns =
  "id,full_name,email,role,birthdate,location,interests,dream,about,image,created_at";
const imageBuckets = {
  profile: "profile-images",
  post: "post-images",
  comment: "post-images",
} as const;
const PROFILE_ACTIVITY_LIMIT = 30;
type ImagePurpose = keyof typeof imageBuckets;

function getImagePurpose(value: string): ImagePurpose {
  if (value === "profile" || value === "post" || value === "comment") {
    return value;
  }
  throw new ApiError(404, "NOT_FOUND", "The requested upload resource was not found.");
}

function safeExtension(name: string) {
  return name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
}

function parseOwnedPath(path: string, ownerId: string, purpose: ImagePurpose): string {
  const segments = path.split("/");
  if (
    segments.length < 2 ||
    segments[0] !== ownerId ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new ApiError(422, "INVALID_PATH", "The upload path is invalid.");
  }
  if (purpose === "profile" && segments[1] !== "avatars") {
    throw new ApiError(422, "INVALID_PATH", "The profile image path is invalid.");
  }
  if (purpose === "comment" && segments[1] !== "comments") {
    throw new ApiError(422, "INVALID_PATH", "The comment image path is invalid.");
  }
  if (purpose === "post" && segments[1] === "comments") {
    throw new ApiError(422, "INVALID_PATH", "The post image path is invalid.");
  }
  return path;
}

function getOwnedImagePath(
  imageUrl: string,
  ownerId: string,
  purpose: ImagePurpose,
): string | null {
  const bucket = imageBuckets[purpose];
  const marker = `/storage/v1/object/public/${bucket}/`;
  try {
    const url = new URL(imageUrl);
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const path = url.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return parseOwnedPath(path, ownerId, purpose);
  } catch {
    return null;
  }
}

async function removeOwnedObjects(
  purpose: ImagePurpose,
  ownerId: string,
  paths: readonly string[],
) {
  const uniquePaths = [...new Set(paths.map((path) => parseOwnedPath(path, ownerId, purpose)))];
  if (uniquePaths.length === 0) return;
  const { error } = await getSupabaseClient()
    .storage.from(imageBuckets[purpose])
    .remove(uniquePaths);
  if (error) databaseError("Could not remove uploaded images", error);
}

async function uploadImage(
  request: Request,
  purpose: ImagePurpose,
): Promise<Response> {
  const formData = await readFormData(request, 6 * 1024 * 1024);
  const ownerId = parseQuery(formData.get("ownerId"), uuidSchema);
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Choose a file to upload.");
  }

  const validation = (purpose === "profile" ? profileImageFileSchema : imageFileSchema)
    .safeParse(file);
  if (!validation.success) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Choose a valid image.",
    );
  }

  const suffix = safeExtension(file.name);
  const id = crypto.randomUUID();
  const path = purpose === "profile"
    ? `${ownerId}/avatars/${id}.${suffix}`
    : purpose === "comment"
      ? `${ownerId}/comments/${id}.${suffix}`
      : `${ownerId}/${id}.${suffix}`;
  const bucket = getSupabaseClient().storage.from(imageBuckets[purpose]);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) databaseError("Could not upload image", error);

  return json({ path, url: bucket.getPublicUrl(path).data.publicUrl }, 201);
}

async function deleteUploadedImages(
  request: Request,
  purpose: ImagePurpose,
): Promise<Response> {
  const body = await readJson(
    request,
    z.object({
      ownerId: uuidSchema,
      paths: z.array(z.string().min(1).max(1024)).min(1).max(20),
    }),
  );
  await removeOwnedObjects(purpose, body.ownerId, body.paths);
  return new Response(null, { status: 204 });
}

async function handleProfiles(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  if (
    path.length === 3 &&
    path[0] === "profiles" &&
    path[2] === "activity" &&
    method === "GET"
  ) {
    const profileId = parseQuery(path[1], uuidSchema);
    const supabase = getSupabaseClient();
    const [comments, listings] = await Promise.all([
      supabase
        .from("post_comments")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(PROFILE_ACTIVITY_LIMIT),
      supabase
        .from("marketplace_listing")
        .select(marketplaceListingPublicColumns)
        .eq("seller_id", profileId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(PROFILE_ACTIVITY_LIMIT),
    ]);
    if (comments.error) databaseError("Could not load profile comments", comments.error);
    if (listings.error) databaseError("Could not load profile marketplace listings", listings.error);
    return json({ comments: comments.data, listings: listings.data });
  }

  if (path.length === 1 && path[0] === "profiles" && method === "GET") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select(profileColumns)
      .order("full_name", { ascending: true });
    if (error) databaseError("Could not load profiles", error);
    return json(data);
  }

  if (path.length === 2 && path[0] === "profiles" && method === "PATCH") {
    const supabase = getSupabaseClient();
    const profileId = parseQuery(path[1], uuidSchema);
    const fields = await readJson(request, profileFieldsSchema);
    const { data, error } = await supabase
      .from("users")
      .update(fields)
      .eq("id", profileId)
      .select(profileColumns)
      .maybeSingle();
    if (error) databaseError("Could not save profile", error);
    if (!data) notFound("The requested profile was not found.");
    return json(data);
  }
  return null;
}

async function handlePosts(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  if (path.length === 1 && path[0] === "posts" && method === "GET") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) databaseError("Could not load posts", error);
    return json(data);
  }

  if (path.length === 1 && path[0] === "posts" && method === "POST") {
    const supabase = getSupabaseClient();
    const post = await readJson(request, wallPostPayloadSchema);
    const { data, error } = await supabase
      .from("posts")
      .insert(post)
      .select("*")
      .single();
    if (error) databaseError("Could not create post", error);
    return json(data, 201);
  }

  if (path.length === 2 && path[0] === "posts" && method === "GET") {
    const supabase = getSupabaseClient();
    const postId = parseQuery(path[1], uuidSchema);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();
    if (error) databaseError("Could not load post", error);
    if (!data) notFound("The requested post was not found.");
    return json(data);
  }

  if (path.length === 2 && path[0] === "posts" && method === "DELETE") {
    const supabase = getSupabaseClient();
    const postId = parseQuery(path[1], uuidSchema);
    const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
    const { data: post, error: loadError } = await supabase
      .from("posts")
      .select("id,image")
      .eq("id", postId)
      .eq("user_id", profileId)
      .maybeSingle();
    if (loadError) databaseError("Could not load post", loadError);
    if (!post) notFound("The requested post was not found or does not belong to this profile.");

    const paths = (post.image ?? [])
      .map((url) => getOwnedImagePath(url, profileId, "post"))
      .filter((value): value is string => value !== null);
    const { data: deletedPost, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", profileId)
      .select("id")
      .maybeSingle();
    if (error) databaseError("Could not delete post", error);
    if (!deletedPost) notFound("The requested post was not found or does not belong to this profile.");
    let cleanupWarning: string | null = null;
    try {
      await removeOwnedObjects("post", profileId, paths);
    } catch {
      cleanupWarning = "The post was deleted, but some photos could not be removed.";
    }
    return json({ cleanupWarning });
  }

  if (
    path.length === 3 &&
    path[0] === "posts" &&
    path[2] === "likes" &&
    (method === "PUT" || method === "DELETE")
  ) {
    const supabase = getSupabaseClient();
    const postId = parseQuery(path[1], uuidSchema);
    const { profileId } = await readJson(request, postLikeSchema);
    const { data, error } = await supabase.rpc("set_post_like", {
      requested_post_id: postId,
      requested_profile_id: profileId,
      should_like: method === "PUT",
    });
    if (error) databaseError("Could not update post likes", error);
    if (data === null) notFound("The requested post was not found.");
    return json({ likes_by: data });
  }
  return null;
}

async function handlePostComments(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  if (path[0] !== "posts" || !path[1] || path[2] !== "comments") return null;
  const supabase = getSupabaseClient();
  const postId = parseQuery(path[1], uuidSchema);

  if (path.length === 4 && path[3] === "count" && method === "GET") {
    const { count, error } = await supabase
      .from("post_comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    if (error) databaseError("Could not load post comment count", error);
    return json({ count: count ?? 0 });
  }

  if (path.length === 3 && method === "GET") {
    const url = new URL(request.url);
    const beforeCreatedAt = url.searchParams.get("beforeCreatedAt");
    const beforeId = url.searchParams.get("beforeId");
    let query = supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId);
    if (beforeCreatedAt || beforeId) {
      const createdAt = parseQuery(
        beforeCreatedAt,
        z.string().datetime({ offset: true }),
      );
      const cursorId = parseQuery(beforeId, uuidSchema);
      query = query.or(
        `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${cursorId})`,
      );
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20);
    if (error) databaseError("Could not load post comments", error);
    return json(data.reverse());
  }

  if (path.length === 3 && method === "POST") {
    const input = await readJson(request, postCommentSchema);
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ ...input, post_id: postId })
      .select("*")
      .single();
    if (error) databaseError("Could not create post comment", error);
    return json(data, 201);
  }

  if (path.length === 4 && method === "DELETE") {
    const commentId = parseQuery(path[3], uuidSchema);
    const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
    const { data, error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId)
      .eq("post_id", postId)
      .eq("user_id", profileId)
      .select("image")
      .maybeSingle();
    if (error) databaseError("Could not delete post comment", error);
    if (!data) notFound("The comment was not found or does not belong to this profile.");

    const paths = (data.image ?? [])
      .map((url) => getOwnedImagePath(url, profileId, "comment"))
      .filter((value): value is string => value !== null);
    let storageCleanupError: string | undefined;
    try {
      await removeOwnedObjects("comment", profileId, paths);
    } catch (error) {
      storageCleanupError = error instanceof Error ? error.message : "Could not remove comment images.";
    }
    return json({ storageCleanupError } satisfies { storageCleanupError?: string });
  }
  return null;
}

async function handleUploads(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  if (path[0] !== "uploads" || path.length !== 2) return null;
  const purpose = getImagePurpose(path[1]);
  if (method === "POST") return uploadImage(request, purpose);
  if (method === "DELETE") return deleteUploadedImages(request, purpose);
  return null;
}

export async function handleProfilePostsApi(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  return (
    await handleProfiles(request, method, path) ??
    await handlePosts(request, method, path) ??
    await handlePostComments(request, method, path) ??
    await handleUploads(request, method, path)
  );
}
