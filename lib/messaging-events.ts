export type MarketplaceMessageListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  image: string | null;
};

export type MarketplaceMessagingRequest = {
  listing: MarketplaceMessageListing;
} & (
  | {
      type: "conversation";
      partnerId: string;
    }
  | {
      type: "listing-conversations";
    }
);

const OPEN_MARKETPLACE_MESSAGING_EVENT = "piecebook:open-marketplace-messaging";

export function requestMarketplaceMessaging(request: MarketplaceMessagingRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<MarketplaceMessagingRequest>(
      OPEN_MARKETPLACE_MESSAGING_EVENT,
      { detail: request },
    ),
  );
}

export function subscribeToMarketplaceMessaging(
  listener: (request: MarketplaceMessagingRequest) => void,
) {
  if (typeof window === "undefined") return () => {};

  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<MarketplaceMessagingRequest>).detail);
  };
  window.addEventListener(OPEN_MARKETPLACE_MESSAGING_EVENT, handleEvent);
  return () =>
    window.removeEventListener(OPEN_MARKETPLACE_MESSAGING_EVENT, handleEvent);
}
