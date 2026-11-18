import type { Metadata } from "next";
import { Suspense } from "react";
import ProfilePageView from "@/components/features/profile/ProfilePage";
import {
  ProfileSkeleton,
  WallPostSkeleton,
} from "@/components/shared/LoadingSkeletons";

export const metadata: Metadata = {
  title: "Profile",
  description: "View a Piecebook profile and posts.",
};

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return (
    <Suspense fallback={<UserProfileFallback />}>
      <ResolvedUserProfile params={params} />
    </Suspense>
  );
}

async function ResolvedUserProfile({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <ProfilePageView profileUserId={userId} />;
}

function UserProfileFallback() {
  return (
    <div
      aria-busy="true"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <header
        aria-hidden="true"
        className="piecebook-header sticky top-0 z-30 min-h-14 shrink-0"
      />
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-hide [-webkit-overflow-scrolling:touch] sm:gap-5 sm:px-5 sm:py-8 md:grid md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        <aside className="min-w-0 shrink-0 md:min-h-0">
          <ProfileSkeleton />
        </aside>
        <section className="min-h-0 min-w-0 space-y-3">
          <WallPostSkeleton />
        </section>
      </main>
      <span className="sr-only" role="status">
        Loading profile
      </span>
    </div>
  );
}
