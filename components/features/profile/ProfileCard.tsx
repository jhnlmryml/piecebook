"use client";

import {
  CalendarDays,
  Gamepad2,
  MapPin,
  Star,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { getInitials } from "@/lib/get-initials";
import { ProfileSkeleton } from "@/components/shared/LoadingSkeletons";
import type { UserProfile } from "@/types/user-profile";

type ProfileCardProps = {
  expanded?: boolean;
  user?: UserProfile | null;
};

export default function ProfileCard({
  expanded = false,
  user,
}: ProfileCardProps) {
  const { currentUser } = useAuth();
  const profileUser = user ?? currentUser;

  if (!profileUser) return <ProfileSkeleton />;

  return (
    <>
      {!expanded && (
        <Card className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none md:hidden">
          <CardContent className="flex items-center gap-3 p-3">
            <Avatar className="size-12 shrink-0 rounded-sm">
              <AvatarImage src={profileUser.image} alt={profileUser.full_name} />
              <AvatarFallback className="piecebook-avatar-fallback rounded-sm">
                {getInitials(profileUser.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="piecebook-brand-text truncate text-sm font-bold">
                {profileUser.full_name}
              </h1>
              <p className="piecebook-muted-text mt-1 truncate text-xs capitalize">
                {profileUser.role} · {profileUser.location}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`${expanded ? "block" : "hidden md:block"} space-y-4`}>
        <Card className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none">
          <CardContent className="p-0">
            <Avatar className="aspect-square h-auto w-full rounded-none border-none bg-muted after:hidden">
              <AvatarImage
                src={profileUser.image}
                alt={profileUser.full_name}
                className="object-contain rounded-none"
              />
              <AvatarFallback className="piecebook-avatar-fallback h-full w-full rounded-none border-none text-3xl">
                {getInitials(profileUser.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="px-3 py-2">
              <h1 className="piecebook-brand-text text-sm font-bold">
                {profileUser.full_name}
              </h1>
              <p className="piecebook-muted-text mt-1 text-xs capitalize">
                {profileUser.role}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none">
          <CardHeader className="piecebook-divider piecebook-secondary-surface border-b px-3 py-2">
            <CardTitle className="text-sm font-bold text-foreground">
              Information
            </CardTitle>
          </CardHeader>
          <CardContent className="piecebook-muted-text space-y-3 p-3 text-xs leading-relaxed">
            <p className="flex gap-2">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{profileUser.location}</span>
            </p>
            <p className="flex gap-2">
              <CalendarDays
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>Birthday: {profileUser.birthdate}</span>
            </p>
            <p className="flex gap-2">
              <Gamepad2
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{profileUser.interests.join(", ")}</span>
            </p>
            <p className="flex gap-2">
              <Star
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{profileUser.dream}</span>
            </p>
            <p className="piecebook-divider flex gap-2 border-t pt-3">
              <UserRound
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{profileUser.about}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
