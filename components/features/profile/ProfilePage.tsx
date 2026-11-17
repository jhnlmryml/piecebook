"use client";

import { Suspense } from "react";
import AppHeader from "@/components/layout/AppHeader";
import ProfileCard from "@/components/features/profile/ProfileCard";
import WallFeed from "@/components/features/posts/WallFeed";
import { useAuth } from "@/context/AuthContext";

type ProfilePageProps = {
  profileUserId?: string;
};

export default function ProfilePage({
  profileUserId,
}: ProfilePageProps) {
  const { currentUser, allUsers } = useAuth();
  const profileUser =
    allUsers.find((user) => user.id === profileUserId) ?? currentUser;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Suspense
        fallback={
          <header
            aria-hidden="true"
            className="piecebook-header sticky top-0 z-30 min-h-14 shrink-0"
          />
        }
      >
        <AppHeader />
      </Suspense>
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:gap-5 sm:px-5 sm:py-8 md:grid md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
        <aside className="min-w-0 shrink-0 md:min-h-0">
          <ProfileCard user={profileUser} expanded />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          <WallFeed
            searchTerm=""
            userOnly
            profileUserId={profileUser?.id}
            showComposer={false}
          />
        </section>
      </main>
    </div>
  );
}
