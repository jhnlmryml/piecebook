"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, MessageCircle, UsersRound } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { requestDirectMessage } from "@/lib/messaging-events";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/get-initials";

export default function FriendsPage() {
  const { currentUser, allUsers, isLoading } = useProfile();
  const router = useRouter();
  const friends = allUsers.filter((user) => user.id !== currentUser?.id);

  function viewProfile(userId: string) {
    router.push(`/profile/${userId}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-linear-to-br from-background via-background to-primary/5">
      <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-3 py-4 scrollbar-hide sm:px-5 sm:py-6 lg:px-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border/70 px-1 pb-4 sm:mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Your community
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Friends
              </h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {friends.length}
              </span>
            </div>
            <p className="piecebook-muted-text mt-1 text-sm">
              Meet the people who make Piecebook yours.
            </p>
          </div>
        </header>

        {isLoading ? (
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
            aria-label="Loading profiles"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <Card
                key={index}
                aria-hidden="true"
                className="gap-0 rounded-2xl border py-0 shadow-sm"
              >
                <CardHeader className="flex flex-row items-center gap-3 p-4">
                  <Skeleton className="size-12 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardHeader>
                <CardContent className="border-t border-border p-3">
                  <Skeleton className="h-8 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <Empty className="min-h-64 rounded-2xl border border-dashed border-border bg-card shadow-sm">
            <EmptyHeader>
              <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <UsersRound aria-hidden="true" className="size-5" />
              </div>
              <EmptyTitle>Your crew is just getting started</EmptyTitle>
              <EmptyDescription>
                No other profiles are available yet. Check back when more people join Piecebook.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {friends.map((friend) => (
              <Card
                key={friend.id}
                className="piecebook-card-surface gap-0 rounded-2xl border py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-center gap-3 p-4 sm:p-5">
                  <Avatar className="size-12 shrink-0 ring-2 ring-primary/10">
                    {friend.image && (
                      <AvatarImage src={friend.image} alt={friend.full_name} />
                    )}
                    <AvatarFallback className="piecebook-avatar-fallback">
                      {getInitials(friend.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold text-foreground">
                      {friend.full_name}
                    </CardTitle>
                    <p className="piecebook-muted-text mt-1 truncate text-xs capitalize">
                      {friend.role} · {friend.location}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:p-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-w-0 rounded-xl"
                    onClick={() => viewProfile(friend.id)}
                  >
                    <span className="truncate">Profile</span>
                    <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="min-w-0 rounded-xl"
                    disabled={!currentUser}
                    onClick={() => requestDirectMessage(friend.id)}
                  >
                    <MessageCircle aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="truncate">Message</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
