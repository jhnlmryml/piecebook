import { getSupabaseClient } from "@/lib/supabase";
import type { Json, Tables, TablesInsert } from "@/types/supabase";

export type Category =
  | "Vehicles"
  | "Property Rentals"
  | "Apparel"
  | "Classifieds"
  | "Electronics"
  | "Entertainment"
  | "Family"
  | "Free Stuff"
  | "Garden & Outdoor"
  | "Hobbies"
  | "Home Goods"
  | "Home Improvement Supplies"
  | "Home Sales"
  | "Musical Instruments"
  | "Office Supplies"
  | "Pet Supplies"
  | "Sporting Goods"
  | "Toys & Games";

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
  condition: string;
  color?: string;
  material?: string;
  seller: string;
  description: string;
  listed: string;
  createdAt: string;
  isSponsored?: boolean;
  categoryDetails?: Record<string, string>;
};

export const categoryDetailFields: Record<Category, string[]> = {
  Vehicles: ["Make", "Model", "Year", "Mileage", "Color"],
  "Property Rentals": ["Bedrooms", "Bathrooms", "Square feet", "Lease term"],
  Apparel: ["Brand", "Size", "Color", "Material"],
  Classifieds: ["Brand", "Color", "Material"],
  Electronics: ["Brand", "Model", "Storage", "Color"],
  Entertainment: ["Type", "Brand", "Color"],
  Family: ["Age range", "Brand", "Color"],
  "Free Stuff": ["Color", "Material"],
  "Garden & Outdoor": ["Brand", "Material", "Dimensions"],
  Hobbies: ["Brand", "Model", "Material"],
  "Home Goods": ["Brand", "Material", "Dimensions", "Color"],
  "Home Improvement Supplies": ["Brand", "Material", "Quantity"],
  "Home Sales": ["Bedrooms", "Bathrooms", "Square feet", "Year built"],
  "Musical Instruments": ["Brand", "Instrument type", "Color", "Material"],
  "Office Supplies": ["Brand", "Model", "Quantity"],
  "Pet Supplies": ["Pet type", "Brand", "Size"],
  "Sporting Goods": ["Brand", "Sport type", "Size", "Color"],
  "Toys & Games": ["Brand", "Age range", "Material"],
};

export const marketplaceCategories = Object.keys(categoryDetailFields) as Category[];
export const MARKETPLACE_IMAGE_BUCKET = "marketplace-listing-images";

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

function parseCategoryDetails(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
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
    condition: row.condition,
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

export async function refreshMarketplaceListings() {
  if (loadPromise) return loadPromise;

  if (listingsSnapshot.status !== "loading") {
    listingsSnapshot = { ...listingsSnapshot, status: "loading", error: null };
    listingSnapshotCache.clear();
    notifyListingListeners();
  }

  loadPromise = (async () => {
    const supabase = getSupabaseClient();
    const rows: MarketplaceListingRow[] = [];
    const pageSize = 500;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("marketplace_listing")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) break;
    }

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

function handleMarketplaceWindowFocus() {
  if (listingsSnapshot.status === "ready") void refreshMarketplaceListings();
}

export function subscribeToMarketplaceListings(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("focus", handleMarketplaceWindowFocus);
  }
  if (listingsSnapshot.status === "loading") void refreshMarketplaceListings();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("focus", handleMarketplaceWindowFocus);
    }
  };
}

export type CreateMarketplaceListingInput = {
  sellerId: string;
  sellerName: string;
  title: string;
  price: number;
  location: string;
  category: Category;
  condition: string;
  description: string;
  categoryDetails: Record<string, string>;
  photoFiles: File[];
};

export async function createMarketplaceListing(input: CreateMarketplaceListingInput) {
  const supabase = getSupabaseClient();
  const imageBucket = supabase.storage.from(MARKETPLACE_IMAGE_BUCKET);
  const uploadedPaths: string[] = [];

  try {
    const photos: string[] = [];
    for (const [index, photo] of input.photoFiles.entries()) {
      if (!photo.type.toLowerCase().startsWith("image/")) {
        throw new Error(`${photo.name}: only image files can be uploaded.`);
      }
      const extension = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
      const path = `${input.sellerId}/${crypto.randomUUID()}-${index + 1}.${extension}`;
      const { error: uploadError } = await imageBucket.upload(path, photo, {
        contentType: photo.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      uploadedPaths.push(path);
      photos.push(imageBucket.getPublicUrl(path).data.publicUrl);
    }

    const categoryDetails = Object.fromEntries(
      Object.entries(input.categoryDetails).filter(([, value]) => value.trim()),
    );
    const row: TablesInsert<"marketplace_listing"> = {
      seller_id: input.sellerId,
      seller_name: input.sellerName,
      title: input.title.trim(),
      price: input.price,
      location: input.location,
      category: input.category,
      condition: input.condition,
      description: input.description.trim(),
      photos,
      category_details: categoryDetails,
      color: categoryDetails.Color ?? null,
      material: categoryDetails.Material ?? null,
    };
    const { data, error } = await supabase
      .from("marketplace_listing")
      .insert(row)
      .select("*")
      .single();

    if (error) throw error;

    const listing = mapMarketplaceListing(data);
    const currentListings = listingsSnapshot.status === "ready" ? listingsSnapshot.listings : [];
    setListingsSnapshot({
      status: "ready",
      listings: [listing, ...currentListings.filter((item) => item.id !== listing.id)],
      error: null,
    });
    return listing;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await imageBucket.remove(uploadedPaths).catch(() => undefined);
    }
    throw new Error(error instanceof Error ? error.message : "Could not publish this listing.");
  }
}

export async function sendMarketplaceMessage({
  listing,
  senderId,
  body,
}: {
  listing: Listing;
  senderId: string;
  body: string;
}) {
  if (!listing.sellerId) throw new Error("This seller cannot receive messages yet.");
  if (isOwnMarketplaceListing(listing, senderId)) throw new Error("You cannot message your own listing.");
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new Error("Write a message before sending it.");

  const { error } = await getSupabaseClient().from("message").insert({
    listing_id: listing.id,
    sender_id: senderId,
    recipient_id: listing.sellerId,
    body: trimmedBody,
  });

  if (error) throw new Error(`Could not send your message: ${error.message}`);
}
