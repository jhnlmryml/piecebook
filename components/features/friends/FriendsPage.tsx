"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile } from "@/context/ProfileContext";
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
import { getInitials } from "@/lib/get-initials";

export default function FriendsPage() {
  const { currentUser, allUsers, isLoading } = useProfile();
  const router = useRouter();
  const friends = allUsers.filter((user) => user.id !== currentUser?.id);

  function viewProfile(userId: string) {
    router.push(`/profile/${userId}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-3 py-5 scrollbar-hide sm:px-5 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="piecebook-brand-text text-xl font-bold">
              Friends
            </h1>
            <p className="piecebook-muted-text mt-1 text-sm">
              {friends.length} profiles in Piecebook
            </p>
          </div>
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="outline"
            className="rounded-sm"
          >
            Back to wall
          </Button>
        </div>

        {isLoading ? (
          <p className="piecebook-muted-text text-sm">Loading profiles…</p>
        ) : friends.length === 0 ? (
          <p className="piecebook-muted-text rounded-sm border border-border p-5 text-sm">
            No other profiles are available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((friend) => (
            <Card
              key={friend.id}
              className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center gap-3 p-4">
                <Avatar className="size-14 shrink-0 rounded-sm">
                  {friend.image && (
                    <AvatarImage src={friend.image} alt={friend.full_name} />
                  )}
                  <AvatarFallback className="piecebook-avatar-fallback rounded-sm">
                    {getInitials(friend.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="piecebook-brand-text truncate text-sm font-bold">
                    {friend.full_name}
                  </CardTitle>
                  <p className="piecebook-muted-text mt-1 truncate text-xs capitalize">
                    {friend.role} · {friend.location}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="piecebook-divider border-t p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-sm"
                  onClick={() => viewProfile(friend.id)}
                >
                  View profile
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
