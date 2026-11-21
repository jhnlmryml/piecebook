import { apiRequest } from "@/lib/api-client";
import {
  subscribeToRealtimeChanges,
  type PiecebookRealtimeChange,
} from "@/lib/realtime-events";

type ListingEngagementCount = {
  status: "loading" | "ready" | "error";
  likeCount: number | null;
  commentCount: number | null;
  error?: string;
};

type ListingEngagementCountsSnapshot = {
  status: "loading" | "ready" | "error";
  counts: Record<string, { likeCount: number; commentCount: number }>;
  error: string | null;
};

type ListingEngagementCountRow = {
  listing_id: string;
  like_count: number;
  comment_count: number;
};

const serverSnapshot: ListingEngagementCountsSnapshot = {
  status: "loading",
  counts: {},
  error: null,
};
const loadingCount: ListingEngagementCount = {
  status: "loading",
  likeCount: null,
  commentCount: null,
};
const zeroCount: ListingEngagementCount = {
  status: "ready",
  likeCount: 0,
  commentCount: 0,
};
const listeners = new Set<() => void>();
const countCache = new Map<string, ListingEngagementCount>();
let snapshot = serverSnapshot;
let loadPromise: Promise<void> | null = null;
let realtimeUnsubscribe: (() => void) | null = null;
let realtimeChangeVersion = 0;
let errorCountSnapshot: ListingEngagementCount | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function handleRealtimeChange(change: PiecebookRealtimeChange) {
  if (
    (change.table !== "marketplace_listing_likes" &&
      change.table !== "marketplace_listing_comments") ||
    (change.eventType !== "INSERT" && change.eventType !== "DELETE")
  ) {
    return;
  }

  realtimeChangeVersion += 1;
  const record =
    change.eventType === "DELETE" ? change.oldRecord : change.newRecord;
  const listingId =
    typeof record.listing_id === "string" ? record.listing_id : null;
  if (!listingId || snapshot.status !== "ready") return;

  const current = snapshot.counts[listingId] ?? { likeCount: 0, commentCount: 0 };
  const changeAmount = change.eventType === "INSERT" ? 1 : -1;
  const next = {
    likeCount:
      Math.max(
        0,
        current.likeCount +
          (change.table === "marketplace_listing_likes" ? changeAmount : 0),
      ),
    commentCount:
      Math.max(
        0,
        current.commentCount +
          (change.table === "marketplace_listing_comments" ? changeAmount : 0),
      ),
  };

  snapshot = {
    ...snapshot,
    counts: { ...snapshot.counts, [listingId]: next },
  };
  countCache.delete(listingId);
  notifyListeners();
}

async function loadCounts() {
  if (loadPromise) return loadPromise;

  snapshot = { ...snapshot, status: "loading", error: null };
  countCache.clear();

  loadPromise = (async () => {
    for (;;) {
      const observedChangeVersion = realtimeChangeVersion;
      let rows: ListingEngagementCountRow[];
      try {
        rows = await apiRequest<ListingEngagementCountRow[]>(
          "marketplace/listing-counts",
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load listing activity counts.";
        snapshot = { ...snapshot, status: "error", error: message };
        errorCountSnapshot = {
          status: "error",
          likeCount: null,
          commentCount: null,
          error: message,
        };
        countCache.clear();
        notifyListeners();
        return;
      }

      if (observedChangeVersion !== realtimeChangeVersion) continue;

      snapshot = {
        status: "ready",
        error: null,
        counts: Object.fromEntries(
          rows.map((row) => [
            row.listing_id,
            { likeCount: row.like_count, commentCount: row.comment_count },
          ]),
        ),
      };
      errorCountSnapshot = null;
      countCache.clear();
      notifyListeners();
      return;
    }
  })().finally(() => {
    loadPromise = null;
  });

  notifyListeners();
  return loadPromise;
}

export function subscribeToMarketplaceListingCounts(listener: () => void) {
  listeners.add(listener);
  if (!realtimeUnsubscribe) {
    realtimeUnsubscribe = subscribeToRealtimeChanges(handleRealtimeChange);
  }
  if (snapshot.status === "loading" || snapshot.status === "error") {
    void loadCounts();
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getMarketplaceListingCountSnapshot(
  listingId: string,
): ListingEngagementCount {
  if (snapshot.status === "loading") return loadingCount;
  if (snapshot.status === "error") {
    return errorCountSnapshot ?? loadingCount;
  }
  if (countCache.has(listingId)) return countCache.get(listingId)!;

  const counts = snapshot.counts[listingId];
  if (!counts) return zeroCount;

  const countSnapshot: ListingEngagementCount = {
    status: "ready",
    ...counts,
  };
  countCache.set(listingId, countSnapshot);
  return countSnapshot;
}

export function getServerMarketplaceListingCountSnapshot() {
  return loadingCount;
}
