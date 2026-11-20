import type { MarketplaceMessageListing } from "@/lib/messaging-events";
import type { Json, Tables } from "@/types/supabase";
import { apiRequest, ApiRequestError, jsonRequest } from "@/lib/api-client";
import {
  marketplaceCategories,
  marketplaceListingCreateSchema,
  marketplaceListingUpdateSchema,
  type Category,
  type ListingStatus,
} from "@/lib/marketplace-validation";

export {
  categoryDetailFields,
  marketplaceCategories,
  marketplaceConditions,
  marketplaceListingCreateFormSchema,
  marketplaceListingUpdateFormSchema,
  MARKETPLACE_IMAGE_BUCKET,
} from "@/lib/marketplace-validation";
export type { Category, ListingStatus } from "@/lib/marketplace-validation";

export type Listing = {
  id: string;
  sellerId?: string | null;
  title: string;
  price: number;
  previousPrice?: number;
  location: string;
  category: Category;
  image: string;
  photos: string[];
  sellerImage?: string | null;
  quantity: number;
  condition: string;
  status: ListingStatus;
  color?: string;
  material?: string;
  seller: string;
  description: string;
  listed: string;
  createdAt: string;
  isSponsored?: boolean;
  categoryDetails?: Record<string, string>;
};

export const formatPrice = (price: number) =>
  price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`;

export const isOwnMarketplaceListing = (
  listing: Pick<Listing, "seller" | "sellerId">,
  currentUserId?: string | null,
) => listing.seller === "You" || Boolean(
  currentUserId && listing.sellerId === currentUserId,
);

export type MarketplaceListingsSnapshot = {
  status: "loading" | "ready" | "error";
  listings: Listing[];
  error: string | null;
};

export type MarketplaceListingSnapshot = {
  status: "loading" | "ready" | "not-found" | "error";
  listing: Listing | null;
  error?: string;
};

type MarketplaceListingRow = Tables<"marketplace_listing">;

const emptyListings: Listing[] = [];
const serverListingsSnapshot: MarketplaceListingsSnapshot = {
  status: "loading",
  listings: emptyListings,
  error: null,
};
const serverListingSnapshot: MarketplaceListingSnapshot = {
  status: "loading",
  listing: null,
};
let listingsSnapshot = serverListingsSnapshot;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();
const listingSnapshotCache = new Map<string, MarketplaceListingSnapshot>();

function notifyListingListeners() {
  listeners.forEach((listener) => listener());
}
function setListingsSnapshot(nextSnapshot: MarketplaceListingsSnapshot) {
  listingsSnapshot = nextSnapshot;
  listingSnapshotCache.clear();
  notifyListingListeners();
}

function getRelativeListedLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "Recently listed";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just listed";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function parseCategoryDetails(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function parseListingStatus(value: string): ListingStatus {
  return value === "pending" || value === "sold" ? value : "available";
}

function mapMarketplaceListing(row: MarketplaceListingRow): Listing {
  const photos = row.photos ?? [];
  const createdAt = row.created_at;
  const category = marketplaceCategories.includes(row.category as Category)
    ? row.category as Category
    : "Classifieds";

  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    price: Number(row.price),
    previousPrice: row.previous_price == null ? undefined : Number(row.previous_price),
    location: row.location,
    category,
    image: photos[0] ?? "",
    photos,
    quantity: row.quantity,
    condition: row.condition,
    status: parseListingStatus(row.status),
    color: row.color ?? undefined,
    material: row.material ?? undefined,
    seller: row.seller_name,
    description: row.description,
    listed: getRelativeListedLabel(createdAt),
    createdAt,
    categoryDetails: parseCategoryDetails(row.category_details),
  };
}

export function getMarketplaceListingsSnapshot() {
  return listingsSnapshot;
}

export function getServerMarketplaceListingsSnapshot() {
  return serverListingsSnapshot;
}

export function getServerMarketplaceListingSnapshot() {
  return serverListingSnapshot;
}

export function getMarketplaceListingSnapshot(listingId: string): MarketplaceListingSnapshot {
  if (listingsSnapshot.status === "loading") return serverListingSnapshot;
  if (listingSnapshotCache.has(listingId)) return listingSnapshotCache.get(listingId)!;

  const snapshot: MarketplaceListingSnapshot = listingsSnapshot.status === "error"
    ? { status: "error", listing: null, error: listingsSnapshot.error ?? "Could not load listings." }
    : {
        status: listingsSnapshot.listings.some((listing) => listing.id === listingId) ? "ready" : "not-found",
        listing: listingsSnapshot.listings.find((listing) => listing.id === listingId) ?? null,
      };
  listingSnapshotCache.set(listingId, snapshot);
  return snapshot;
}

export async function getMarketplaceMessageListing(
  listingId: string,
): Promise<MarketplaceMessageListing | null> {
  return apiRequest<MarketplaceMessageListing | null>(
    `marketplace/listings/${encodeURIComponent(listingId)}/message-card`,
  );
}

export async function refreshMarketplaceListings() {
  if (loadPromise) return loadPromise;

  if (listingsSnapshot.status !== "loading") {
    listingsSnapshot = { ...listingsSnapshot, status: "loading", error: null };
    listingSnapshotCache.clear();
    notifyListingListeners();
  }

  loadPromise = (async () => {
    const rows = await apiRequest<MarketplaceListingRow[]>("marketplace/listings");
    setListingsSnapshot({
      status: "ready",
      listings: rows.map(mapMarketplaceListing),
      error: null,
    });
  })()
    .catch((error: unknown) => {
      setListingsSnapshot({
        status: "error",
        listings: emptyListings,
        error: error instanceof Error ? error.message : "Could not load Marketplace listings.",
      });
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function subscribeToMarketplaceListings(listener: () => void) {
  listeners.add(listener);
  if (listingsSnapshot.status === "loading") void refreshMarketplaceListings();

  return () => {
    listeners.delete(listener);
  };
}

export type CreateMarketplaceListingInput = {
  sellerId: string;
  sellerName: string;
  title: string;
  price: number;
  quantity: number;
  location: string;
  category: Category;
  condition: string;
  description: string;
  categoryDetails: Record<string, string>;
  photoFiles: File[];
};

export type UpdateMarketplaceListingInput = {
  id: string;
  sellerId: string;
  title: string;
  price: number;
  quantity: number;
  location: string;
  category: Category;
  condition: string;
  description: string;
  status: ListingStatus;
  categoryDetails: Record<string, string>;
};

export async function updateMarketplaceListing(input: UpdateMarketplaceListingInput) {
  const validation = marketplaceListingUpdateSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Listing details are invalid.",
    );
  }
  const validatedInput = validation.data;
  const row = await apiRequest<MarketplaceListingRow>(
    `marketplace/listings/${encodeURIComponent(validatedInput.id)}`,
    jsonRequest("PATCH", validatedInput),
  );
  const listing = mapMarketplaceListing(row);
  const currentListings = listingsSnapshot.status === "ready" ? listingsSnapshot.listings : [];
  setListingsSnapshot({
    status: "ready",
    listings: currentListings.map((item) => item.id === listing.id ? listing : item),
    error: null,
  });
  return listing;
}

export async function deleteMarketplaceListing(listing: Listing, sellerId: string) {
  const result = await apiRequest<{ cleanupWarning: string | null }>(
    `marketplace/listings/${encodeURIComponent(listing.id)}?sellerId=${encodeURIComponent(sellerId)}`,
    { method: "DELETE" },
  );
  const currentListings = listingsSnapshot.status === "ready" ? listingsSnapshot.listings : [];
  setListingsSnapshot({
    status: "ready",
    listings: currentListings.filter((item) => item.id !== listing.id),
    error: null,
  });

  return result.cleanupWarning;
}

export async function createMarketplaceListing(input: CreateMarketplaceListingInput) {
  const validation = marketplaceListingCreateSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Listing details are invalid.",
    );
  }
  const validatedInput: CreateMarketplaceListingInput = {
    ...validation.data,
    photoFiles: input.photoFiles,
  };
  const formData = new FormData();
  formData.append("sellerId", validatedInput.sellerId);
  formData.append("sellerName", validatedInput.sellerName);
  formData.append("title", validatedInput.title);
  formData.append("price", String(validatedInput.price));
  formData.append("quantity", String(validatedInput.quantity));
  formData.append("location", validatedInput.location);
  formData.append("category", validatedInput.category);
  formData.append("condition", validatedInput.condition);
  formData.append("description", validatedInput.description);
  formData.append("categoryDetails", JSON.stringify(validatedInput.categoryDetails));
  validatedInput.photoFiles.forEach((photo) => formData.append("photos", photo));

  const row = await apiRequest<MarketplaceListingRow>("marketplace/listings", {
    method: "POST",
    body: formData,
  });
  const listing = mapMarketplaceListing(row);
  const currentListings = listingsSnapshot.status === "ready" ? listingsSnapshot.listings : [];
  setListingsSnapshot({
    status: "ready",
    listings: [listing, ...currentListings.filter((item) => item.id !== listing.id)],
    error: null,
  });
  return listing;
}

export async function getMarketplaceListingEngagementArchive(sourceListingId: string): Promise<{
  likes: MarketplaceListingLikeArchive[];
  comments: MarketplaceListingCommentArchive[];
}> {
  return apiRequest(
    `marketplace/listings/${encodeURIComponent(sourceListingId)}/engagement/archive`,
  );
}

export async function getMarketplaceOrderRecord(orderId: string): Promise<MarketplaceOrder | null> {
  try {
    return await apiRequest<MarketplaceOrder>(
      `marketplace/orders/${encodeURIComponent(orderId)}`,
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export type MarketplaceOrder = Tables<"marketplace_orders">;
export type MarketplaceListingLikeArchive = Tables<"marketplace_listing_like_archive">;
export type MarketplaceListingCommentArchive = Tables<"marketplace_listing_comment_archive">;
export type MarketplaceOrderEmailNotifications = {
  buyerSent: boolean;
  sellerSent: boolean;
  errors: string[];
};

export async function checkoutMarketplaceListing(input: {
  listingId: string;
  buyerId: string;
  quantity: number;
  buyerEmail: string;
}): Promise<{ order: MarketplaceOrder; emailNotifications: MarketplaceOrderEmailNotifications }> {
  const response = await fetch("/api/marketplace/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const result = (await response.json()) as {
    order?: MarketplaceOrder;
    emailNotifications?: MarketplaceOrderEmailNotifications;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.message ?? "Could not complete checkout.");
  }
  if (!result.order || !result.emailNotifications) {
    throw new Error("Checkout returned an incomplete response.");
  }
  return {
    order: result.order,
    emailNotifications: result.emailNotifications,
  };
}

export async function getMarketplaceOrderRecords(
  profileId: string,
  role: "buyer" | "seller",
): Promise<MarketplaceOrder[]> {
  const params = new URLSearchParams({ profileId, role });
  return apiRequest<MarketplaceOrder[]>(`marketplace/orders?${params.toString()}`);
}
