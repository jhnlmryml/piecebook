import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ProfileSkeleton() {
    return (
        <>
            <Card className="piecebook-card-surface gap-0 rounded-2xl border py-0 shadow-sm md:hidden">
                <CardContent className="flex items-center gap-3 p-3">
                    <Skeleton className="size-12 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </CardContent>
            </Card>
            <div className="hidden space-y-4 md:block">
                <Card className="piecebook-card-surface gap-0 rounded-2xl border py-0 shadow-sm">
                    <CardContent className="space-y-2 p-3">
                        <Skeleton className="aspect-square w-full rounded-xl" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                    </CardContent>
                </Card>
                <Card className="piecebook-card-surface gap-0 rounded-2xl border py-0 shadow-sm">
                    <CardHeader className="piecebook-divider border-b px-3 py-2">
                        <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-3 p-3">
                        {Array.from({ length: 7 }, (_, index) => (
                            <Skeleton
                                key={index}
                                className={index === 6 ? "h-36 w-full" : "h-4 w-full"}
                            />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export function HeaderUserSkeleton() {
    return (
        <div className="flex shrink-0 items-center gap-2">
            {/* <Skeleton className="hidden h-4 w-40 shrink-0 sm:block" /> */}
            <Skeleton className="size-10 shrink-0 rounded-full" />
        </div>
    );
}

export function NameSkeleton() {
    return (
        <Skeleton className="h-8 w-40 border-2 sm:w-64" />
    );
}

export function WallPostSkeleton() {
    return (
        <Card className="gap-0 rounded-2xl border border-border py-0 shadow-sm">
            <CardContent className="flex gap-3 p-3 sm:p-4">
                <Avatar className="size-10 shrink-0 rounded-xl">
                    <AvatarFallback>
                        <Skeleton className="size-full rounded-xl" />
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-16" />
                </div>
            </CardContent>
        </Card>
    );
}




export function MarketplaceListingsSkeleton() {
  return (
    <div
      className="grid w-full min-w-0 grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-4"
      aria-label="Loading Marketplace listings"
      aria-busy="true"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <Card
          key={index}
          className="gap-0 overflow-hidden rounded-2xl border bg-card p-2 shadow-sm"
        >
          <Skeleton className="aspect-4/3 w-full rounded-xl" />
          <CardContent className="space-y-2 px-1 pb-1 pt-3">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="h-3 w-2/3 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function MarketplaceDetailSkeleton() {
  return (
    <div
      className="grid overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
      aria-label="Loading listing details"
      aria-busy="true"
    >
      <Skeleton className="aspect-4/3 min-h-64 rounded-none md:aspect-auto md:min-h-[36rem]" />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-4/5 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
        <div className="space-y-3 border-t pt-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
        <div className="space-y-3 border-t pt-4">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function MarketplaceOrderSkeleton() {
  return (
    <Card
      className="mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-card p-0 shadow-sm"
      aria-label="Loading order"
      aria-busy="true"
    >
      <Skeleton className="aspect-video w-full rounded-none sm:aspect-[2/1]" />
      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-36 rounded-md" />
          <Skeleton className="h-7 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="space-y-3 border-t pt-4">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketplaceOrderHistorySkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading order history" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <Card
          key={index}
          className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-5 w-2/3 rounded-md" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <div className="flex gap-3 border-t pt-4">
            <Skeleton className="size-20 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-5/6 rounded-md" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MessagingConversationListSkeleton() {
  return (
    <div className="space-y-1.5" aria-label="Loading conversations" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl px-2.5 py-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-9" />
            </div>
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagingThreadSkeleton() {
  return (
    <div
      className="flex min-h-full flex-col justify-end gap-5 py-5"
      aria-label="Loading messages"
      aria-busy="true"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const isOutgoing = index % 2 === 1;
        return (
          <div
            key={index}
            className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[82%] space-y-2">
              <Skeleton className={`h-3 w-16 ${isOutgoing ? "ml-auto" : ""}`} />
              <Skeleton
                className={`h-12 rounded-2xl ${
                  index % 3 === 0 ? "w-56" : index % 3 === 1 ? "w-44" : "w-64"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
