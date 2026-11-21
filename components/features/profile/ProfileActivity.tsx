"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import WallFeed from "@/components/features/posts/WallFeed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LocalDateTime } from "@/components/shared/LocalDateTime";
import { getInitials } from "@/lib/get-initials";
import { getProfileActivity, type ProfileActivity as ProfileActivityData } from "@/lib/profile-activity";
import {
  formatPrice,
  mapMarketplaceListing,
  type Listing,
} from "@/components/features/marketplace/marketplace-data";
import type { UserProfile } from "@/types/user-profile";

const imageLoader = ({ src }: { src: string }) => src;

type ActivityRequestState =
  | {
      profileId: string;
      retryCount: number;
      status: "success";
      activity: ProfileActivityData;
    }
  | {
      profileId: string;
      retryCount: number;
      status: "error";
      error: string;
    };

function ActivityLoadingState() {
  return (
    <div className="space-y-3" aria-label="Loading profile activity" role="status">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="gap-0 rounded-2xl border py-0 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ActivityErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/30 bg-card p-5 text-sm shadow-sm"
    >
      <p className="font-medium text-foreground">
        Profile activity couldn&apos;t be loaded.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-3 rounded-xl"
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}

function ActivityEmptyState({
  icon,
  title,
  description,
}: {
  icon: "comments" | "listings";
  title: string;
  description: string;
}) {
  const Icon = icon === "comments" ? MessageCircle : ShoppingBag;

  return (
    <Empty className="min-h-56 rounded-2xl border border-dashed border-border bg-card shadow-sm">
      <EmptyHeader>
        <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CommentActivity({
  comments,
  profile,
}: {
  comments: ProfileActivityData["comments"];
  profile: UserProfile;
}) {
  if (comments.length === 0) {
    return (
      <ActivityEmptyState
        icon="comments"
        title="No comments yet"
        description="Comments this member shares on the wall will appear here."
      />
    );
  }

  return (
    <div className="space-y-3 pb-2">
      {comments.map((comment) => (
        <Card
          key={comment.id}
          className="gap-0 rounded-2xl py-0 shadow-sm transition-shadow duration-200 hover:shadow-md"
        >
          <CardContent className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
            <Avatar className="size-10 shrink-0 ring-2 ring-primary/10">
              {profile.image && (
                <AvatarImage src={profile.image} alt={profile.full_name} />
              )}
              <AvatarFallback className="piecebook-avatar-fallback">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {profile.full_name}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    commented on a post
                  </span>
                </p>
                <LocalDateTime
                  dateTime={comment.created_at}
                  className="text-xs text-muted-foreground"
                />
              </div>
              {comment.body && (
                <p className="mt-3 whitespace-pre-wrap wrap-break-word rounded-xl bg-muted/70 px-3.5 py-3 text-sm leading-relaxed text-foreground">
                  {comment.body}
                </p>
              )}
              {comment.image?.map((imageUrl, index) => (
                <Image
                  key={`${comment.id}-${index}`}
                  loader={imageLoader}
                  src={imageUrl}
                  alt={`Photo ${index + 1} in ${profile.full_name}'s comment`}
                  width={560}
                  height={420}
                  unoptimized
                  className="mt-3 max-h-80 w-auto max-w-full rounded-xl object-contain"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ListingActivityCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/marketplace/${encodeURIComponent(listing.id)}`}
      aria-label={`View marketplace listing: ${listing.title}`}
      className="group min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="h-full gap-0 overflow-hidden rounded-2xl  py-0 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
        <div className="relative aspect-4/3 overflow-hidden bg-muted">
          {listing.image ? (
            <Image
              loader={imageLoader}
              src={listing.image}
              alt={listing.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ShoppingBag aria-hidden="true" className="size-8" />
            </div>
          )}
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize shadow-sm ${
              listing.status === "available"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-card/95 text-muted-foreground"
            }`}
          >
            {listing.status}
          </span>
        </div>
        <CardContent className="min-w-0 space-y-1.5 p-4">
          <p className="text-sm font-bold text-foreground">
            {formatPrice(listing.price)}
          </p>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {listing.title}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {listing.category} · {listing.location}
          </p>
          <span className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary">
            View listing
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProfileActivity({
  profile,
  showComments = true,
}: {
  profile: UserProfile | null;
  showComments?: boolean;
}) {
  const [requestState, setRequestState] =
    useState<ActivityRequestState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const profileId = profile?.id;

  useEffect(() => {
    let active = true;
    if (!profileId) {
      return;
    }

    getProfileActivity(profileId)
      .then((result) => {
        if (active) {
          setRequestState({
            profileId,
            retryCount,
            status: "success",
            activity: result,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRequestState({
            profileId,
            retryCount,
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Could not load profile activity.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [profileId, retryCount]);

  const currentRequestState =
    requestState &&
    requestState.profileId === profileId &&
    requestState.retryCount === retryCount
      ? requestState
      : null;
  const isLoading = Boolean(profileId) && !currentRequestState;
  const activity =
    currentRequestState?.status === "success"
      ? currentRequestState.activity
      : null;
  const activityError =
    currentRequestState?.status === "error"
      ? currentRequestState.error
      : null;
  const listings = useMemo(
    () => activity?.listings.map(mapMarketplaceListing) ?? [],
    [activity],
  );
  const comments = activity?.comments ?? [];

  return (
    <Tabs
      defaultValue="posts"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4 p-2"
    >
      <TabsList
        className={`grid h-11 w-full ${
          showComments ? "grid-cols-3" : "grid-cols-2"
        } gap-1 rounded-xl border border-border/70 bg-card shadow-sm`}
      >
        <TabsTrigger
          value="posts"
          className="w-full min-w-0 justify-center rounded-lg px-1 text-center text-[9px] data-active:bg-primary/10 data-active:text-primary sm:px-3 sm:text-xs"
        >
          Posts
        </TabsTrigger>
        {showComments && (
          <TabsTrigger
            value="comments"
            className="w-full min-w-0 justify-center rounded-lg px-1 text-center text-[9px] data-active:bg-primary/10 data-active:text-primary sm:px-3 sm:text-xs"
          >
            <MessageCircle aria-hidden="true" className="size-3.5" />
            Comments{!isLoading && !activityError ? ` ${comments.length}` : ""}
          </TabsTrigger>
        )}
        <TabsTrigger
          value="listings"
          className="w-full min-w-0 justify-center rounded-lg px-1 text-center text-[9px] data-active:bg-primary/10 data-active:text-primary sm:px-3 sm:text-xs"
        >
          <ShoppingBag aria-hidden="true" className="size-3.5" />
          Listings{!isLoading && !activityError ? ` ${listings.length}` : ""}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="min-h-0 min-w-0 flex-1">
        <WallFeed
          searchTerm=""
          userOnly
          profileUserId={profile?.id}
          showComposer={false}
          mobilePageScroll
        />
      </TabsContent>

      {showComments && (
        <TabsContent
          value="comments"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-1 scrollbar-hide"
        >
          {isLoading ? (
            <ActivityLoadingState />
          ) : activityError ? (
            <ActivityErrorState
              error={activityError}
              onRetry={() => setRetryCount((count) => count + 1)}
            />
          ) : !profile ? (
            <ActivityEmptyState
              icon="comments"
              title="No profile selected"
              description="Select a profile to see their comment activity."
            />
          ) : (
            <CommentActivity comments={comments} profile={profile} />
          )}
        </TabsContent>
      )}

      <TabsContent
        value="listings"
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-1 scrollbar-hide"
      >
        {isLoading ? (
          <ActivityLoadingState />
        ) : activityError ? (
          <ActivityErrorState
            error={activityError}
            onRetry={() => setRetryCount((count) => count + 1)}
          />
        ) : listings.length === 0 ? (
          <ActivityEmptyState
            icon="listings"
            title="No marketplace listings yet"
            description="Items this member lists in the marketplace will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingActivityCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
