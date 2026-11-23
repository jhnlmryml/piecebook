"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, ImageOff, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { Scroller } from "@/components/ui/scroller";
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { MarketplaceOrderSkeleton } from "@/components/shared/LoadingSkeletons";
import { SupabaseImageWithFallback } from "@/components/shared/SupabaseImageWithFallback";
import { MarketplaceOrderParty } from "./MarketplaceOrderParty";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import {
  formatPrice,
  getMarketplaceListingEngagementArchive,
  getMarketplaceOrderRecord,
  type MarketplaceListingCommentArchive,
  type MarketplaceListingLikeArchive,
  parseCategoryDetails,
  type MarketplaceOrder,
} from "./marketplace-data";

export default function MarketplaceOrderPage({ orderId }: { orderId: string }) {
  const { currentUser, isLoading: isProfileLoading } = useProfile();
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    void getMarketplaceOrderRecord(orderId, currentUser.id)
      .then((record) => {
        if (active) setOrder(record);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load this order record.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser, orderId]);

  const hasAccess = Boolean(
    order && currentUser && (order.buyer_id === currentUser.id || order.seller_id === currentUser.id),
  );
  const categoryDetails = order
    ? Object.entries(parseCategoryDetails(order.listing_category_details))
    : [];

  if (!isProfileLoading && !currentUser) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-4 py-8 sm:px-6">
        <Card className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-xl font-bold">Choose a profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose the buyer or seller profile for this order record.</p>
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="mt-5 rounded-xl"><ArrowLeft className="size-4" />Back</Button>
        </Card>
      </main>
    );
  }

  if (isLoading || isProfileLoading) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6" aria-busy="true">
        <MarketplaceOrderSkeleton />
      </main>
    );
  }

  if (error || !order || !hasAccess) {
    return (
      <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-4 py-8 sm:px-6">
        <Card className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Marketplace</p>
          <h1 className="mt-2 text-xl font-bold">Order record unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? (order ? "Switch to the buyer or seller profile for this order." : "This order record could not be found.")}
          </p>
          <Button nativeButton={false} render={<Link href="/marketplace" />} className="mt-5 rounded-xl">
            <ArrowLeft className="size-4" />Back 
          </Button>
        </Card>
      </main>
    );
  }

  const photos = order.listing_photos;

  return (
    <main className="scrollbar-hide h-full min-h-0 overflow-y-auto px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button nativeButton={false} render={<Link href="/marketplace" />} variant="ghost" className="rounded-full px-3">
            <ArrowLeft className="size-4" />Back 
          </Button>
        </div>
        <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card p-0 shadow-sm">
          {photos.length > 0 ? (
            <div className="grid gap-2 bg-muted p-2 sm:grid-cols-2">
              {photos.map((photo, index) => (
                <div
                  key={`${order.id}-snapshot-${index}`}
                  className={`relative aspect-4/3 overflow-hidden rounded-xl bg-background ${
                    photos.length % 2 === 1 && index === photos.length - 1
                      ? "sm:col-span-2 sm:mx-auto sm:w-1/2"
                      : ""
                  }`}
                >
                  <SupabaseImageWithFallback src={photo} alt={`${order.listing_title} photo ${index + 1}`} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center bg-muted text-muted-foreground">
              <ImageOff className="size-8" aria-hidden="true" />
              <span className="ml-2 text-sm">No item photos in this order record</span>
            </div>
          )}

          <div className="space-y-6 p-4 sm:p-6">
            <header>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Order record · #{order.id.slice(0, 8)}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{order.listing_title}</h1>
              <time className="mt-1 block text-sm text-muted-foreground" dateTime={order.created_at}>
                Placed {new Date(order.created_at).toLocaleString()}
              </time>
            </header>

            <section aria-label="Buyer and seller" className="grid gap-3 sm:grid-cols-2">
              <MarketplaceOrderParty label="Buyer" id={order.buyer_id} name={order.buyer_name} role={order.buyer_role} location={order.buyer_location} image={order.buyer_image} />
              <MarketplaceOrderParty label="Seller" id={order.seller_id} name={order.seller_name} role={order.seller_role} location={order.seller_location} image={order.seller_image} />
            </section>

            <section aria-label="Item details" className="space-y-3 border-t border-border/70 pt-4">
              <h2 className="text-base font-semibold">Item details at checkout</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.listing_description || "No description provided."}</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <OrderDetail label="Category" value={order.listing_category || "Not recorded"} />
                <OrderDetail label="Condition" value={order.listing_condition || "Not recorded"} />
                <OrderDetail label="Pickup location" value={order.listing_location || "Not recorded"} />
                {order.listing_color && <OrderDetail label="Color" value={order.listing_color} />}
                {order.listing_material && <OrderDetail label="Material" value={order.listing_material} />}
                {categoryDetails.map(([label, value]) => <OrderDetail key={label} label={label} value={value} />)}
              </dl>
            </section>

            <section aria-label="Order amount" className="space-y-2 border-t border-border/70 pt-4">
              <h2 className="text-base font-semibold">Order amount</h2>
              <div className="flex justify-between gap-3 text-sm text-muted-foreground">
                <span>{order.quantity} × {formatPrice(Number(order.unit_price))}</span>
                <span>{formatPrice(Number(order.total_price))}</span>
              </div>
              {order.listing_previous_price != null && (
                <p className="text-xs text-muted-foreground">Previous listed price: {formatPrice(Number(order.listing_previous_price))}</p>
              )}
              <div className="flex justify-between border-t border-border/70 pt-2 text-base font-bold">
                <span>Total</span><span>{formatPrice(Number(order.total_price))}</span>
              </div>
            </section>

          </div>
        </Card>
      </div>
    </main>
  );
}

export function OrderEngagementHistory({ sourceListingId }: { sourceListingId: string }) {
  const { currentUser } = useProfile();
  const [likes, setLikes] = useState<MarketplaceListingLikeArchive[]>([]);
  const [comments, setComments] = useState<MarketplaceListingCommentArchive[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLiked = Boolean(currentUser && likes.some((like) => like.user_id === currentUser.id));

  useEffect(() => {
    let active = true;
    void getMarketplaceListingEngagementArchive(sourceListingId)
      .then((history) => {
        if (!active) return;
        setLikes(history.likes);
        setComments(history.comments);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load saved item likes and comments.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sourceListingId]);

  return (
    <section
      className="mt-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"
      aria-label="Listing activity"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isLiked ? "secondary" : "outline"}
          disabled
          aria-pressed={isLiked}
          aria-label={`${isLiked ? "Liked" : "Like"}; ${likes.length} likes. Liking is disabled for this saved item.`}
          title="Likes are disabled for this saved item."
          className="rounded-xl"
        >
          <Heart className={`size-4 ${isLiked ? "fill-current text-rose-500" : ""}`} />
          {isLiked ? "Liked" : "Like"} <span className="tabular-nums">{likes.length}</span>
        </Button>
        <div className="inline-flex h-10 items-center gap-2 rounded-xl bg-muted/50 px-3 text-sm text-muted-foreground">
          <MessageCircle aria-hidden="true" className="size-4" />
          Comments <span className="tabular-nums">{comments.length}</span>
        </div>
      </div>
      <div
        id={`listing-comments-${sourceListingId}`}
        className="mt-4 space-y-4 border-t border-border/70 pt-4"
      >
        {isLoading ? (
          <div className="space-y-3" aria-label="Loading saved item activity" aria-busy="true">
            <Skeleton className="h-4 w-36 rounded-md" />
            <div className="flex items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
            </div>
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <Scroller className="max-h-80 py-5 pr-2" hideScrollbar withNavigation scrollShadows={false} scrollTriggerMode="press">
            <MessageGroup role="list" className="gap-2">
              {comments.map((comment, index) => {
                const previousComment = comments[index - 1];
                const nextComment = comments[index + 1];
                const isOwnComment = comment.user_id === currentUser?.id;
                const isFirstInGroup = !areArchivedCommentsGrouped(previousComment, comment);
                const isLastInGroup = !areArchivedCommentsGrouped(comment, nextComment);

                return (
                  <Message
                    key={comment.id}
                    role="listitem"
                    align={isOwnComment ? "end" : "start"}
                  >
                    <MessageAvatar aria-hidden={!isFirstInGroup}>
                      {isFirstInGroup ? (
                        <Avatar className="size-8 shrink-0">
                          <AvatarImage src={comment.user_image ?? undefined} alt={comment.user_name} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(comment.user_name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </MessageAvatar>
                    <MessageContent className="gap-1">
                      {isFirstInGroup && (
                        <MessageHeader className="px-0 text-[11px] font-medium text-muted-foreground">
                          {comment.user_name}
                        </MessageHeader>
                      )}
                      <Bubble variant={isOwnComment ? "default" : "muted"}>
                        <BubbleContent className="rounded-2xl border-0 px-3 py-2 text-sm leading-relaxed">
                          {comment.body && (
                            <p className="whitespace-pre-wrap wrap-break-word">{comment.body}</p>
                          )}
                          {comment.image?.map((imageUrl, imageIndex) => (
                            <SupabaseImageWithFallback
                              key={`${comment.id}-${imageUrl}`}
                              src={imageUrl}
                              alt={`Image ${imageIndex + 1} attached to listing comment`}
                              width={560}
                              height={420}
                              className="mt-2 max-h-72 w-auto max-w-full rounded-sm object-contain"
                            />
                          ))}
                        </BubbleContent>
                      </Bubble>
                      {isLastInGroup && (
                        <MessageFooter className="gap-1 px-0 text-[10px] font-normal text-muted-foreground/60">
                          <LocalDateTime dateTime={comment.created_at} />
                        </MessageFooter>
                      )}
                    </MessageContent>
                  </Message>
                );
              })}
            </MessageGroup>
          </Scroller>
        )}
      </div>
    </section>
  );
}

function areArchivedCommentsGrouped(
  first: MarketplaceListingCommentArchive | undefined,
  second: MarketplaceListingCommentArchive | undefined,
) {
  return Boolean(
    first &&
      second &&
      first.user_id === second.user_id &&
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime() <=
        5 * 60 * 1000,
  );
}

function OrderDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-0.5 wrap-break-word text-muted-foreground">{value}</dd>
    </div>
  );
}
