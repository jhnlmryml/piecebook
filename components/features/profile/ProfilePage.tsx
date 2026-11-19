"use client";

import ProfileCard from "@/components/features/profile/ProfileCard";
import WallFeed from "@/components/features/posts/WallFeed";
import { useProfile } from "@/context/ProfileContext";

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
      <main className="mx-auto flex h-full min-h-0 w-full max-w-5xl items-center justify-center px-4">
        <p className="piecebook-muted-text text-center text-sm">
          No profiles are available. Add a profile to the public.users table in Supabase.
        </p>
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-hide [-webkit-overflow-scrolling:touch] sm:gap-5 sm:px-5 sm:py-8 md:grid md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        <aside className="min-w-0 shrink-0 md:min-h-0">
          <ProfileCard
            user={profileUser}
            expanded
            enableEditing={Boolean(profileUser && profileUser.id === currentUser?.id)}
          />
        </aside>

        <section className="flex min-w-0 flex-none flex-col gap-3 sm:gap-4 md:min-h-0 md:flex-1">
          <WallFeed
            searchTerm=""
            userOnly
            profileUserId={profileUser?.id}
            showComposer={false}
            mobilePageScroll
          />
        </section>
      </main>
    </div>
  );
}
