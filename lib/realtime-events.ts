export const REALTIME_TABLES = [
  "posts",
  "post_comments",
  "marketplace_listing_likes",
  "marketplace_listing_comments",
  "message",
  "message_reactions",
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];
export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export type PiecebookRealtimeChange = {
  table: RealtimeTable;
  eventType: RealtimeEventType;
  newRecord: Record<string, unknown>;
  oldRecord: Record<string, unknown>;
};

type RealtimeListener = (change: PiecebookRealtimeChange) => void;

const listeners = new Set<RealtimeListener>();

export function subscribeToRealtimeChanges(listener: RealtimeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishRealtimeChange(change: PiecebookRealtimeChange) {
  for (const listener of listeners) listener(change);
}
