import type { Tables, TablesInsert } from "@/types/supabase";
import {
  commentPayloadSchema,
  COMMENT_MAX_LENGTH,
} from "@/lib/form-schemas";
import { apiRequest, jsonRequest } from "@/lib/api-client";

export type MarketplaceListingComment = Tables<"marketplace_listing_comments">;
export type MarketplaceListingLike = Tables<"marketplace_listing_likes">;
export type MarketplaceMessage = Tables<"message">;
export type MarketplaceMessageReaction = Tables<"message_reactions">;
export type MarketplaceMessageWithReactions = MarketplaceMessage & {
  reactions: MarketplaceMessageReaction[];
};
export const MARKETPLACE_LISTING_COMMENT_PAGE_SIZE = 20;

export async function canEngageWithMarketplaceListing(
  listingId: string,
): Promise<boolean> {
  const result = await apiRequest<{ canEngage: boolean }>(
    `marketplace/listings/${encodeURIComponent(listingId)}/availability`,
  );
  return result.canEngage;
}

export async function getMarketplaceListingEngagement(
  listingId: string,
  profileId: string,
): Promise<{
  comments: MarketplaceListingComment[];
  commentCount: number;
  likes: MarketplaceListingLike[];
  isLiked: boolean;
  canEngage: boolean;
}> {
  return apiRequest(
    `marketplace/listings/${encodeURIComponent(listingId)}/engagement?profileId=${encodeURIComponent(profileId)}`,
  );
}

export async function getMarketplaceListingCommentsBefore(
  listingId: string,
  before: Pick<MarketplaceListingComment, "created_at" | "id">,
): Promise<MarketplaceListingComment[]> {
  const params = new URLSearchParams({
    beforeCreatedAt: before.created_at,
    beforeId: before.id,
  });
  return apiRequest(
    `marketplace/listings/${encodeURIComponent(listingId)}/comments?${params.toString()}`,
  );
}

export async function toggleMarketplaceListingLike(
  listingId: string,
  profileId: string,
  currentlyLiked: boolean,
): Promise<boolean> {
  const result = await apiRequest<{ liked: boolean }>(
    `marketplace/listings/${encodeURIComponent(listingId)}/likes`,
    jsonRequest(currentlyLiked ? "DELETE" : "PUT", { profileId }),
  );
  return result.liked;
}

export async function createMarketplaceListingComment(
  comment: TablesInsert<"marketplace_listing_comments">,
): Promise<MarketplaceListingComment> {
  const validation = commentPayloadSchema.safeParse({
    body: comment.body,
    image: comment.image,
  });
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ??
        `Comments must be ${COMMENT_MAX_LENGTH} characters or fewer.`,
    );
  }
  return apiRequest(
    `marketplace/listings/${encodeURIComponent(comment.listing_id)}/comments`,
    jsonRequest("POST", { ...comment, ...validation.data }),
  );
}

export async function deleteMarketplaceListingComment(
  listingId: string,
  commentId: string,
  profileId: string,
): Promise<{ storageCleanupError?: string }> {
  return apiRequest(
    `marketplace/listings/${encodeURIComponent(listingId)}/comments/${encodeURIComponent(commentId)}?profileId=${encodeURIComponent(profileId)}`,
    { method: "DELETE" },
  );
}

export async function getMarketplaceMessages(
  listingId: string,
  profileId: string,
): Promise<MarketplaceMessageWithReactions[]> {
  return apiRequest(
    `marketplace/listings/${encodeURIComponent(listingId)}/messages?profileId=${encodeURIComponent(profileId)}`,
  );
}

export async function toggleMarketplaceMessageReaction({
  messageId,
  profileId,
  reaction,
  currentReaction,
}: {
  messageId: string;
  profileId: string;
  reaction: string;
  currentReaction?: string | null;
}): Promise<void> {
  const remove = currentReaction === reaction;
  await apiRequest<void>(
    `marketplace/messages/${encodeURIComponent(messageId)}/reactions`,
    jsonRequest(remove ? "DELETE" : "PUT", { profileId, reaction }),
  );
}
