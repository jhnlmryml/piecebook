import { getSupabaseClient } from "@/lib/supabase";
import type { Tables, TablesInsert } from "@/types/supabase";
import { removeCommentImages } from "@/lib/comment-images";

export type MarketplaceListingComment = Tables<"marketplace_listing_comments">;
export type MarketplaceListingLike = Tables<"marketplace_listing_likes">;
export type MarketplaceMessage = Tables<"message">;
export type MarketplaceMessageReaction = Tables<"message_reactions">;
export type MarketplaceMessageWithReactions = MarketplaceMessage & {
  reactions: MarketplaceMessageReaction[];
};
export const MARKETPLACE_LISTING_COMMENT_PAGE_SIZE = 20;

export async function getMarketplaceListingEngagement(
  listingId: string,
  profileId: string,
): Promise<{
  comments: MarketplaceListingComment[];
  commentCount: number;
  likes: MarketplaceListingLike[];
  isLiked: boolean;
}> {
  const supabase = getSupabaseClient();
  const [likesResult, commentsResult] = await Promise.all([
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
      .limit(MARKETPLACE_LISTING_COMMENT_PAGE_SIZE),
  ]);

  if (likesResult.error) {
    throw new Error(`Could not load listing likes: ${likesResult.error.message}`);
  }
  if (commentsResult.error) {
    throw new Error(`Could not load listing comments: ${commentsResult.error.message}`);
  }

  return {
    comments: commentsResult.data.reverse(),
    commentCount: commentsResult.count ?? commentsResult.data.length,
    likes: likesResult.data,
    isLiked: likesResult.data.some((like) => like.user_id === profileId),
  };
}

export async function getMarketplaceListingCommentsBefore(
  listingId: string,
  before: Pick<MarketplaceListingComment, "created_at" | "id">,
): Promise<MarketplaceListingComment[]> {
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing_comments")
    .select("*")
    .eq("listing_id", listingId)
    .or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MARKETPLACE_LISTING_COMMENT_PAGE_SIZE);

  if (error) {
    throw new Error(`Could not load older listing comments: ${error.message}`);
  }
  return data.reverse();
}

export async function toggleMarketplaceListingLike(
  listingId: string,
  profileId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: existingLike, error: lookupError } = await supabase
    .from("marketplace_listing_likes")
    .select("id")
    .eq("listing_id", listingId)
    .eq("user_id", profileId)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not check listing like: ${lookupError.message}`);

  if (existingLike) {
    const { error } = await supabase
      .from("marketplace_listing_likes")
      .delete()
      .eq("id", existingLike.id);
    if (error) throw new Error(`Could not remove listing like: ${error.message}`);
    return false;
  }

  const { error } = await supabase
    .from("marketplace_listing_likes")
    .insert({ listing_id: listingId, user_id: profileId });
  if (error) throw new Error(`Could not like this listing: ${error.message}`);
  return true;
}

export async function createMarketplaceListingComment(
  comment: TablesInsert<"marketplace_listing_comments">,
): Promise<MarketplaceListingComment> {
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing_comments")
    .insert(comment)
    .select("*")
    .single();

  if (error) throw new Error(`Could not add listing comment: ${error.message}`);
  return data;
}

export async function deleteMarketplaceListingComment(
  listingId: string,
  commentId: string,
  profileId: string,
): Promise<{ storageCleanupError?: string }> {
  const { data, error } = await getSupabaseClient()
    .from("marketplace_listing_comments")
    .delete()
    .eq("id", commentId)
    .eq("listing_id", listingId)
    .eq("user_id", profileId)
    .select("image")
    .maybeSingle();

  if (error) throw new Error(`Could not delete listing comment: ${error.message}`);
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

export async function getMarketplaceMessages(
  listingId: string,
  profileId: string,
): Promise<MarketplaceMessageWithReactions[]> {
  const supabase = getSupabaseClient();
  const { data: messages, error: messagesError } = await supabase
    .from("message")
    .select("*")
    .eq("listing_id", listingId)
    .or(`sender_id.eq.${profileId},recipient_id.eq.${profileId}`)
    .order("created_at", { ascending: true })
    .limit(100);

  if (messagesError) {
    throw new Error(`Could not load listing messages: ${messagesError.message}`);
  }
  if (messages.length === 0) return [];

  const { data: reactions, error: reactionsError } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", messages.map((message) => message.id));

  if (reactionsError) {
    throw new Error(`Could not load message reactions: ${reactionsError.message}`);
  }

  return messages.map((message) => ({
    ...message,
    reactions: reactions.filter((reaction) => reaction.message_id === message.id),
  }));
}

export async function toggleMarketplaceMessageReaction({
  messageId,
  profileId,
  reaction,
}: {
  messageId: string;
  profileId: string;
  reaction: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", profileId)
    .eq("reaction", reaction)
    .maybeSingle();

  if (lookupError) throw new Error(`Could not check reaction: ${lookupError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(`Could not remove reaction: ${error.message}`);
    return;
  }

  const row: TablesInsert<"message_reactions"> = {
    message_id: messageId,
    user_id: profileId,
    reaction,
  };
  const { error } = await supabase.from("message_reactions").insert(row);
  if (error) throw new Error(`Could not add reaction: ${error.message}`);
}
