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
let crossTabChannel: BroadcastChannel | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRealtimeChange(value: unknown): value is PiecebookRealtimeChange {
  if (
    !isRecord(value) ||
    !isRecord(value.newRecord) ||
    !isRecord(value.oldRecord)
  ) {
    return false;
  }
  return (
    REALTIME_TABLES.some((table) => table === value.table) &&
    (value.eventType === "INSERT" ||
      value.eventType === "UPDATE" ||
      value.eventType === "DELETE")
  );
}

function getCrossTabChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!crossTabChannel) {
    crossTabChannel = new BroadcastChannel("piecebook-realtime");
    crossTabChannel.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (isRealtimeChange(event.data)) publishRealtimeChange(event.data);
    });
  }
  return crossTabChannel;
}

export function subscribeToRealtimeChanges(listener: RealtimeListener) {
  getCrossTabChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishRealtimeChange(change: PiecebookRealtimeChange) {
  for (const listener of listeners) listener(change);
}

export function broadcastRealtimeChange(change: PiecebookRealtimeChange) {
  getCrossTabChannel()?.postMessage(change);
}
