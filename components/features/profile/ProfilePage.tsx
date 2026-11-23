"use client";

import ProfileCard from "@/components/features/profile/ProfileCard";
import { useProfile } from "@/context/ProfileContext";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { UserRound } from "lucide-react";
import { requestDirectMessage } from "@/lib/messaging-events";
import { ProfileActivity } from "@/components/features/profile/ProfileActivity";

type ProfilePageProps = {
  profileUserId?: string;
};

export default function ProfilePage({
  profileUserId,
}: ProfilePageProps) {
  const { currentUser, allUsers, isLoading } = useProfile();
  const profileUser =
    allUsers.find((user) => user.id === profileUserId) ?? currentUser;

  if (!isLoading && !profileUser) {
    return (
      <main className="mx-auto flex h-full min-h-0 w-full max-w-7xl items-center justify-center bg-linear-to-br from-background via-background to-primary/5 px-4">
        <Empty className="max-w-lg rounded-2xl border border-dashed border-border bg-card shadow-sm">
          <EmptyHeader>
            <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UserRound aria-hidden="true" className="size-5" />
            </div>
            <EmptyTitle>No profile found</EmptyTitle>
            <EmptyDescription>
              No profiles are available. Add a profile to the public.users table in Supabase.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-linear-to-br from-background via-background to-primary/5">
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-hide [-webkit-overflow-scrolling:touch] sm:gap-5 sm:px-5 sm:py-6 md:overflow-hidden lg:px-6">
        <header className="flex shrink-0 items-end justify-between gap-3 border-b border-border/70 px-1 pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Piecebook
            </p>
            <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {profileUser?.id === currentUser?.id
                ? "Your profile"
                : "Member profile"}
            </h1>
          </div>
          {/* <p className="hidden max-w-64 shrink-0 text-right text-xs leading-relaxed text-muted-foreground sm:block">
            {profileUser
              ? `Get to know ${profileUser.full_name} and catch up on their activity.`
              : "Your profile and activity, all in one place."}
          </p> */}
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:gap-5 xl:gap-6">
          <aside className="min-w-0 shrink-0 md:min-h-0">
            <ProfileCard
              user={profileUser}
              expanded
              enableEditing={Boolean(profileUser && profileUser.id === currentUser?.id)}
              messageDisabled={!currentUser}
              onMessage={
                profileUser && profileUser.id !== currentUser?.id
                  ? () => requestDirectMessage(profileUser.id)
                  : undefined
              }
            />
          </aside>

          <section className="flex min-w-0 w-full flex-none flex-col md:min-h-0 md:flex-1 px-2">
            <ProfileActivity
              key={profileUser?.id}
              profile={profileUser ?? null}
              showComments={Boolean(
                profileUser &&
                  currentUser &&
                  profileUser.id === currentUser.id &&
                  (!profileUserId || profileUserId === currentUser.id),
              )}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
