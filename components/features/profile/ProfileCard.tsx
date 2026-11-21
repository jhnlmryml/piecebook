"use client";

import {
  CalendarDays,
  Gamepad2,
  MessageCircle,
  MapPin,
  Star,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { ProfileSkeleton } from "@/components/shared/LoadingSkeletons";
import { ProfileEditDialog } from "@/components/features/profile/ProfileEditDialog";
import type { UserProfile } from "@/types/user-profile";

type ProfileCardProps = {
  expanded?: boolean;
  enableEditing?: boolean;
  messageDisabled?: boolean;
  onMessage?: () => void;
  user?: UserProfile | null;
};

function formatBirthdate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function ProfileCard({
  expanded = false,
  enableEditing = false,
  messageDisabled = false,
  onMessage,
  user,
}: ProfileCardProps) {
  const { currentUser, isLoading } = useProfile();
  const profileUser = user ?? currentUser;

  if (!profileUser) {
    return isLoading ? (
      <ProfileSkeleton />
    ) : (
      <div className="piecebook-card-surface rounded-sm p-4 text-sm">
        <p className="font-semibold">No profile data found</p>
        <p className="piecebook-muted-text mt-1 text-xs">
          Add a profile to the public.users table in Supabase.
        </p>
      </div>
    );
  }

  return (
    <>
      {!expanded && (
        <Card className="piecebook-card-surface gap-0 rounded-2xl py-0 shadow-sm md:hidden">
          <CardContent className="flex items-center gap-3 p-3">
            <Avatar className="size-12 shrink-0 rounded-xl">
              {profileUser.image && (
                <AvatarImage src={profileUser.image} alt={profileUser.full_name} />
              )}
              <AvatarFallback className="piecebook-avatar-fallback rounded-xl">
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
        <Card className="piecebook-card-surface gap-0 rounded-2xl border py-0 shadow-sm">
          <CardContent className="p-0">
            <Avatar className="aspect-square h-auto w-full rounded-none border-none bg-muted after:hidden">
              {profileUser.image && (
                <AvatarImage
                  src={profileUser.image}
                  alt={profileUser.full_name}
                  className="object-contain rounded-none"
                />
              )}
              <AvatarFallback className="piecebook-avatar-fallback h-full w-full rounded-none border-none text-3xl">
                {getInitials(profileUser.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <h1 className="piecebook-brand-text truncate text-sm font-bold">
                  {profileUser.full_name}
                </h1>
                <p className="piecebook-muted-text mt-1 truncate text-xs capitalize">
                  {profileUser.role}
                </p>
              </div>
              {onMessage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={messageDisabled}
                  onClick={onMessage}
                  className="shrink-0 rounded-full"
                >
                  <MessageCircle aria-hidden="true" className="size-3.5" />
                  Message
                </Button>
              )}
              {enableEditing && <ProfileEditDialog user={profileUser} />}
            </div>
          </CardContent>
        </Card>

        <Card className="piecebook-card-surface gap-0 rounded-2xl border py-0 shadow-sm">
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
              <span>Birthday: {formatBirthdate(profileUser.birthdate)}</span>
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
