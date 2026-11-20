import { getSupabaseClient } from "@/lib/supabase";
import {
  commentPayloadSchema,
  imageFileSchema,
  MARKETPLACE_IMAGE_MAX_COUNT,
} from "@/lib/form-schemas";
import {
  MARKETPLACE_IMAGE_BUCKET,
  marketplaceListingCreateSchema,
  marketplaceListingUpdateSchema,
} from "@/lib/marketplace-validation";
import type { Tables, TablesInsert } from "@/types/supabase";
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
import { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ListingRow = Tables<"marketplace_listing">;
type ListingCommentRow = Tables<"marketplace_listing_comments">;
type ListingLikeRow = Tables<"marketplace_listing_likes">;
type OrderRow = Tables<"marketplace_orders">;
type MessageRow = Tables<"message">;
type MessageReactionRow = Tables<"message_reactions">;

const uuidSchema = z.string().uuid();
const listingCommentSchema = commentPayloadSchema.extend({
  user_id: uuidSchema,
});
const listingUpdateBodySchema = marketplaceListingUpdateSchema;
const listingLikeBodySchema = z.object({ profileId: uuidSchema });
const listingCommentImageBucket = "post-images";
const reactionBodySchema = z.object({
  profileId: uuidSchema,
  reaction: z.string().trim().min(1).max(16),
});

function getListingImagePath(imageUrl: string, sellerId: string): string | null {
  const marker = `/storage/v1/object/public/${MARKETPLACE_IMAGE_BUCKET}/`;
  try {
    const url = new URL(imageUrl);
    const start = url.pathname.indexOf(marker);
    if (start < 0) return null;
    const path = url.pathname
      .slice(start + marker.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    if (
      !path.startsWith(`${sellerId}/`) ||
      path.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

async function removeListingImages(sellerId: string, paths: readonly string[]) {
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) return;
  const { error } = await getSupabaseClient()
    .storage.from(MARKETPLACE_IMAGE_BUCKET)
    .remove(uniquePaths);
  if (error) databaseError("Could not remove listing images", error);
}

function parseListingForm(formData: FormData) {
  const files = formData.getAll("photos");
  if (files.some((file) => !(file instanceof File))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Each listing photo must be a file.");
  }
  const photoFiles = files.filter((file): file is File => file instanceof File);
  const rawDetails = formData.get("categoryDetails");
  let categoryDetails: unknown = {};
  if (typeof rawDetails === "string" && rawDetails) {
    try {
      categoryDetails = JSON.parse(rawDetails) as unknown;
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Listing category details must be valid JSON.");
    }
  }
  const numberField = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  };
  const input = {
    sellerId: formData.get("sellerId"),
    sellerName: formData.get("sellerName"),
    title: formData.get("title"),
    price: numberField("price"),
    quantity: numberField("quantity"),
    location: formData.get("location"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    description: formData.get("description"),
    categoryDetails,
    photoFiles,
  };
  const validation = marketplaceListingCreateSchema.safeParse({
    ...input,
    photoFiles: photoFiles.map(({ name, type, size }) => ({ name, type, size })),
  });
  if (!validation.success) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Listing details are invalid.",
    );
  }
  for (const file of photoFiles) {
    const fileValidation = imageFileSchema.safeParse(file);
    if (!fileValidation.success) {
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        fileValidation.error.issues[0]?.message ?? "Choose a valid listing photo.",
      );
    }
  }
  if (photoFiles.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Listing photos exceed the combined upload limit.");
  }
  if (photoFiles.length > MARKETPLACE_IMAGE_MAX_COUNT) {
    throw new ApiError(422, "VALIDATION_ERROR", "Too many listing photos.");
  }
  return { input: validation.data, photoFiles };
}

async function createListing(request: Request) {
  const formData = await readFormData(request, 51 * 1024 * 1024);
  const { input, photoFiles } = parseListingForm(formData);
  const supabase = getSupabaseClient();
  const bucket = supabase.storage.from(MARKETPLACE_IMAGE_BUCKET);
  const uploadedPaths: string[] = [];

  try {
    const photos: string[] = [];
    for (const [index, file] of photoFiles.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
      const path = `${input.sellerId}/${crypto.randomUUID()}-${index + 1}.${extension}`;
      const { error } = await bucket.upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) databaseError("Could not upload listing photo", error);
      uploadedPaths.push(path);
      photos.push(bucket.getPublicUrl(path).data.publicUrl);
    }

    const categoryDetails = Object.fromEntries(
      Object.entries(input.categoryDetails).filter(([, value]) => value.trim()),
    );
    const row: TablesInsert<"marketplace_listing"> = {
      seller_id: input.sellerId,
      seller_name: input.sellerName,
      title: input.title,
      price: input.price,
      quantity: input.quantity,
      location: input.location,
      category: input.category,
      condition: input.condition,
      description: input.description,
      photos,
      category_details: categoryDetails,
      color: categoryDetails.Color ?? null,
      material: categoryDetails.Material ?? null,
      status: "available",
    };
    const { data, error } = await supabase
      .from("marketplace_listing")
      .insert(row)
      .select("*")
      .single();
    if (error) databaseError("Could not create listing", error);
    return json(data, 201);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      try {
        await removeListingImages(input.sellerId, uploadedPaths);
      } catch (cleanupError) {
        console.error(
          "Could not roll back listing photo uploads:",
          cleanupError instanceof Error ? cleanupError.message : "Unknown storage error.",
        );
      }
    }
    throw error;
  }
}

async function listListings() {
  const rows: ListingRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseClient()
      .from("marketplace_listing")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) databaseError("Could not load marketplace listings", error);
    rows.push(...data);
    if (data.length < 500) break;
  }
  return json(rows);
}

async function getListing(listingId: string) {
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (error) databaseError("Could not load marketplace listing", error);
  if (!data) notFound("The requested listing was not found.");
  return json(data);
}

async function updateListing(request: Request, listingId: string) {
  const body = await readJson(request, listingUpdateBodySchema);
  if (body.id !== listingId) {
    throw new ApiError(422, "VALIDATION_ERROR", "The listing ID does not match the request path.");
  }
  const categoryDetails = Object.fromEntries(
    Object.entries(body.categoryDetails).filter(([, value]) => value.trim()),
  );
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing")
    .update({
      title: body.title,
      price: body.price,
      quantity: body.quantity,
      location: body.location,
      category: body.category,
      condition: body.condition,
      description: body.description,
      status: body.quantity === 0 ? "sold" : body.status,
      category_details: categoryDetails,
      color: categoryDetails.Color ?? null,
      material: categoryDetails.Material ?? null,
    })
    .eq("id", listingId)
    .eq("seller_id", body.sellerId)
    .select("*")
    .maybeSingle();
  if (error) databaseError("Could not update marketplace listing", error);
  if (!data) notFound("The listing was not found or does not belong to this profile.");
  return json(data);
}

async function deleteListing(request: Request, listingId: string) {
  const sellerId = requireUuid(new URL(request.url).searchParams.get("sellerId"), "sellerId");
  const supabase = getSupabaseClient();
  const { data: listing, error: loadError } = await supabase
    .from("marketplace_listing")
    .select("id,photos")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (loadError) databaseError("Could not load marketplace listing", loadError);
  if (!listing) notFound("The listing was not found or does not belong to this profile.");

  const { data: deleted, error } = await supabase
    .from("marketplace_listing")
    .delete()
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .select("id")
    .maybeSingle();
  if (error) databaseError("Could not delete marketplace listing", error);
  if (!deleted) notFound("The listing was not found or does not belong to this profile.");

  const photoPaths = (listing.photos ?? [])
    .map((url) => getListingImagePath(url, sellerId))
    .filter((value): value is string => value !== null);
  const { data: linkedOrder, error: orderLookupError } = await supabase
    .from("marketplace_orders")
    .select("id")
    .eq("source_listing_id", listingId)
    .limit(1)
    .maybeSingle();

  let cleanupWarning: string | null = null;
  if (orderLookupError) {
    cleanupWarning = "The listing was deleted, but its photos were kept because order records could not be checked.";
  } else if (photoPaths.length > 0 && !linkedOrder) {
    try {
      await removeListingImages(sellerId, photoPaths);
    } catch {
      cleanupWarning = "The listing was deleted, but some photos could not be removed.";
    }
  }
  return json({ cleanupWarning });
}

async function listingEngagement(listingId: string, profileId: string) {
  const supabase = getSupabaseClient();
  const [likesResult, commentsResult, listingResult] = await Promise.all([
    supabase
      .from("marketplace_listing_likes")
      .select("*")
      .eq("listing_id", listingId),
    supabase
      .from("marketplace_listing_comments")
      .select("*", { count: "exact" })
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20),
    supabase
      .from("marketplace_listing")
      .select("status,quantity")
      .eq("id", listingId)
      .maybeSingle(),
  ]);
  if (likesResult.error) databaseError("Could not load listing likes", likesResult.error);
  if (commentsResult.error) databaseError("Could not load listing comments", commentsResult.error);
  if (listingResult.error) databaseError("Could not check listing availability", listingResult.error);
  if (!listingResult.data) notFound("The requested listing was not found.");

  const likes: ListingLikeRow[] = likesResult.data;
  const comments: ListingCommentRow[] = commentsResult.data;
  return json({
    comments: comments.reverse(),
    commentCount: commentsResult.count ?? comments.length,
    likes,
    isLiked: likes.some((like) => like.user_id === profileId),
    canEngage:
      listingResult.data.status === "sold" ||
      (listingResult.data.status === "available" && listingResult.data.quantity > 0),
  });
}

async function listingCanEngage(listingId: string) {
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing")
    .select("status,quantity")
    .eq("id", listingId)
    .maybeSingle();
  if (error) databaseError("Could not check listing availability", error);
  return Boolean(
    data &&
      (data.status === "sold" ||
        (data.status === "available" && data.quantity > 0)),
  );
}

async function setListingLike(request: Request, listingId: string, liked: boolean) {
  const { profileId } = await readJson(request, listingLikeBodySchema);
  if (!(await listingCanEngage(listingId))) {
    throw new ApiError(409, "LISTING_CLOSED", "This listing no longer accepts likes.");
  }
  const supabase = getSupabaseClient();
  if (liked) {
    const { error } = await supabase
      .from("marketplace_listing_likes")
      .upsert(
        { listing_id: listingId, user_id: profileId },
        { onConflict: "listing_id,user_id", ignoreDuplicates: true },
      );
    if (error) databaseError("Could not like listing", error);
  } else {
    const { error } = await supabase
      .from("marketplace_listing_likes")
      .delete()
      .eq("listing_id", listingId)
      .eq("user_id", profileId);
    if (error) databaseError("Could not remove listing like", error);
  }
  return json({ liked });
}

async function listListingComments(request: Request, listingId: string) {
  const url = new URL(request.url);
  const beforeCreatedAt = url.searchParams.get("beforeCreatedAt");
  const beforeId = url.searchParams.get("beforeId");
  let query = getSupabaseClient()
    .from("marketplace_listing_comments")
    .select("*")
    .eq("listing_id", listingId);
  if (beforeCreatedAt || beforeId) {
    const createdAt = parseQuery(beforeCreatedAt, z.string().datetime({ offset: true }));
    const cursorId = parseQuery(beforeId, uuidSchema);
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${cursorId})`,
    );
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  if (error) databaseError("Could not load listing comments", error);
  return json(data.reverse());
}

async function createListingComment(request: Request, listingId: string) {
  const body = await readJson(request, listingCommentSchema);
  if (!(await listingCanEngage(listingId))) {
    throw new ApiError(409, "LISTING_CLOSED", "This listing no longer accepts comments.");
  }
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing_comments")
    .insert({ ...body, listing_id: listingId })
    .select("*")
    .single();
  if (error) databaseError("Could not create listing comment", error);
  return json(data, 201);
}

async function deleteListingComment(
  request: Request,
  listingId: string,
  commentId: string,
) {
  if (!(await listingCanEngage(listingId))) {
    throw new ApiError(409, "LISTING_CLOSED", "Comments cannot be changed for this listing.");
  }
  const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing_comments")
    .delete()
    .eq("id", commentId)
    .eq("listing_id", listingId)
    .eq("user_id", profileId)
    .select("image")
    .maybeSingle();
  if (error) databaseError("Could not delete listing comment", error);
  if (!data) notFound("The comment was not found or does not belong to this profile.");

  const marker = `/storage/v1/object/public/${listingCommentImageBucket}/`;
  const paths = (data.image ?? []).flatMap((imageUrl) => {
    try {
      const url = new URL(imageUrl);
      const start = url.pathname.indexOf(marker);
      if (start < 0) return [];
      const imagePath = url.pathname
        .slice(start + marker.length)
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/");
      if (
        !imagePath.startsWith(`${profileId}/comments/`) ||
        imagePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
      ) {
        return [];
      }
      return [imagePath];
    } catch {
      return [];
    }
  });
  let storageCleanupError: string | undefined;
  try {
    if (paths.length > 0) {
      const { error: cleanupError } = await getSupabaseClient()
        .storage.from(listingCommentImageBucket)
        .remove([...new Set(paths)]);
      if (cleanupError) databaseError("Could not remove listing comment images", cleanupError);
    }
  } catch (error) {
    storageCleanupError = error instanceof Error ? error.message : "Could not remove comment images.";
  }
  return json({ storageCleanupError } satisfies { storageCleanupError?: string });
}

async function listingMessages(listingId: string, profileId: string) {
  const supabase = getSupabaseClient();
  const { data: messages, error: messagesError } = await supabase
    .from("message")
    .select("*")
    .eq("listing_id", listingId)
    .or(`sender_id.eq.${profileId},recipient_id.eq.${profileId}`)
    .order("created_at", { ascending: true })
    .limit(100);
  if (messagesError) databaseError("Could not load listing messages", messagesError);
  if (messages.length === 0) return json([]);

  const { data: reactions, error: reactionsError } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", messages.map((message) => message.id));
  if (reactionsError) databaseError("Could not load message reactions", reactionsError);
  const rows: MessageRow[] = messages;
  const reactionRows: MessageReactionRow[] = reactions;
  return json(rows.map((message) => ({
    ...message,
    reactions: reactionRows.filter((reaction) => reaction.message_id === message.id),
  })));
}

async function setMessageReaction(request: Request, messageId: string, remove: boolean) {
  const supabase = getSupabaseClient();
  if (remove) {
    const { profileId } = await readJson(request, z.object({ profileId: uuidSchema }));
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", profileId);
    if (error) databaseError("Could not remove message reaction", error);
    return new Response(null, { status: 204 });
  }
  const { profileId, reaction } = await readJson(request, reactionBodySchema);
  const { data, error } = await supabase
    .from("message_reactions")
    .upsert(
      { message_id: messageId, user_id: profileId, reaction },
      { onConflict: "message_id,user_id" },
    )
    .select("*")
    .single();
  if (error) databaseError("Could not set message reaction", error);
  return json(data);
}

async function orderRecords(request: Request) {
  const url = new URL(request.url);
  const profileId = requireUuid(url.searchParams.get("profileId"), "profileId");
  const role = parseQuery(url.searchParams.get("role"), z.enum(["buyer", "seller"]));
  const rows: OrderRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = getSupabaseClient()
      .from("marketplace_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    query = role === "buyer"
      ? query.eq("buyer_id", profileId)
      : query.eq("seller_id", profileId);
    const { data, error } = await query;
    if (error) databaseError("Could not load marketplace orders", error);
    rows.push(...data);
    if (data.length < 500) break;
  }
  return json(rows);
}

async function orderRecord(orderId: string) {
  const { data, error } = await getSupabaseClient()
    .from("marketplace_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) databaseError("Could not load marketplace order", error);
  return data ? json(data) : notFound("The requested order was not found.");
}

async function archivedEngagement(listingId: string) {
  const supabase = getSupabaseClient();
  const [likes, comments] = await Promise.all([
    supabase
      .from("marketplace_listing_like_archive")
      .select("*")
      .eq("source_listing_id", listingId)
      .order("created_at", { ascending: true }),
    supabase
      .from("marketplace_listing_comment_archive")
      .select("*")
      .eq("source_listing_id", listingId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (likes.error) databaseError("Could not load archived listing likes", likes.error);
  if (comments.error) databaseError("Could not load archived listing comments", comments.error);
  return json({ likes: likes.data, comments: comments.data });
}

async function listingCounts() {
  const rows: Array<{ listing_id: string; like_count: number; comment_count: number }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseClient()
      .from("marketplace_listing_engagement_counts")
      .select("*")
      .order("listing_id", { ascending: true })
      .range(offset, offset + 499);
    if (error) databaseError("Could not load listing activity counts", error);
    rows.push(...data);
    if (data.length < 500) break;
  }
  return json(rows);
}

export async function handleMarketplaceApi(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  if (path[0] !== "marketplace") return null;

  if (path.length === 2 && path[1] === "listing-counts" && method === "GET") {
    return listingCounts();
  }
  if (path.length === 2 && path[1] === "orders" && method === "GET") {
    return orderRecords(request);
  }
  if (path.length === 3 && path[1] === "orders" && method === "GET") {
    return orderRecord(parseQuery(path[2], uuidSchema));
  }
  if (path[1] === "listings" && path.length === 2) {
    if (method === "GET") return listListings();
    if (method === "POST") return createListing(request);
  }
  if (path[1] === "listings" && path.length >= 3) {
    const listingId = parseQuery(path[2], uuidSchema);
    if (path.length === 3) {
      if (method === "GET") return getListing(listingId);
      if (method === "PATCH") return updateListing(request, listingId);
      if (method === "DELETE") return deleteListing(request, listingId);
    }
    if (path.length === 4 && path[3] === "message-card" && method === "GET") {
      const { data, error } = await getSupabaseClient()
        .from("marketplace_listing")
        .select("id,title,price,location,photos")
        .eq("id", listingId)
        .maybeSingle();
      if (error) databaseError("Could not load marketplace listing", error);
      return json(data
        ? {
            id: data.id,
            title: data.title,
            price: Number(data.price),
            location: data.location,
            image: data.photos?.[0] ?? null,
          }
        : null);
    }
    if (path.length === 4 && path[3] === "engagement" && method === "GET") {
      const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
      return listingEngagement(listingId, profileId);
    }
    if (path.length === 4 && path[3] === "availability" && method === "GET") {
      return json({ canEngage: await listingCanEngage(listingId) });
    }
    if (
      path.length === 5 &&
      path[3] === "engagement" &&
      path[4] === "archive" &&
      method === "GET"
    ) {
      return archivedEngagement(listingId);
    }
    if (path.length === 4 && path[3] === "likes") {
      if (method === "PUT") return setListingLike(request, listingId, true);
      if (method === "DELETE") return setListingLike(request, listingId, false);
    }
    if (path.length === 4 && path[3] === "comments") {
      if (method === "GET") return listListingComments(request, listingId);
      if (method === "POST") return createListingComment(request, listingId);
    }
    if (path.length === 5 && path[3] === "comments" && method === "DELETE") {
      return deleteListingComment(
        request,
        listingId,
        parseQuery(path[4], uuidSchema),
      );
    }
    if (path.length === 4 && path[3] === "messages" && method === "GET") {
      const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
      return listingMessages(listingId, profileId);
    }
  }

  if (path[1] === "messages" && path.length === 4 && path[3] === "reactions") {
    const messageId = parseQuery(path[2], uuidSchema);
    if (method === "PUT") return setMessageReaction(request, messageId, false);
    if (method === "DELETE") return setMessageReaction(request, messageId, true);
  }
  return null;
}
