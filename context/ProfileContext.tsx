"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  publishRealtimeChange,
  REALTIME_TABLES,
  type RealtimeEventType,
  type RealtimeTable,
} from "@/lib/realtime-events";
import { getUserProfiles } from "@/lib/user-profiles";
import type { ProfileContextValue } from "@/types/profile-context";
import type { UserProfile } from "@/types/user-profile";

const PROFILE_STORAGE_KEY = "piecebook_profile_id";
const LEGACY_PROFILE_STORAGE_KEY = "piecebook_session_user_id";

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function readSavedProfileId(): string | null {
  try {
    return (
      window.localStorage.getItem(PROFILE_STORAGE_KEY) ??
      window.sessionStorage.getItem(LEGACY_PROFILE_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function saveProfileId(profileId: string): boolean {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
    window.sessionStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
    return true;
  } catch {
    // The app still works for this visit if browser storage is unavailable.
    return false;
  }
}

function chooseInitialProfile(profiles: UserProfile[]): UserProfile | null {
  if (profiles.length === 0) return null;
  const savedId = readSavedProfileId();
  return (
    profiles.find((profile) => profile.id === savedId) ??
    profiles.find((profile) => profile.full_name.trim().toLowerCase() === "monkey d. luffy") ??
    profiles[0]
  );
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [realtimeStatus, setRealtimeStatus] =
    useState<ProfileContextValue["realtimeStatus"]>("error");
  const activeProfileId = currentUser?.id;

  useEffect(() => {
    let active = true;

    void getUserProfiles()
      .then((profiles) => {
        if (!active) return;
        const selectedProfile = chooseInitialProfile(profiles);
        setAllUsers(profiles);
        setCurrentUser(selectedProfile);
        setProfileError(
          selectedProfile ? null : "No profile data found. Add profiles to public.users in Supabase.",
        );
        if (selectedProfile) saveProfileId(selectedProfile.id);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAllUsers([]);
        setCurrentUser(null);
        setProfileError(
          error instanceof Error ? error.message : "Could not load profiles from Supabase.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeProfileId) return;

    const supabase = getSupabaseClient();
    let active = true;
    let channel = supabase.channel(`piecebook-profile-${activeProfileId}`);

    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          publishRealtimeChange({
            table: table as RealtimeTable,
            eventType: payload.eventType as RealtimeEventType,
            newRecord: payload.new as Record<string, unknown>,
            oldRecord: payload.old as Record<string, unknown>,
          });
        },
      );
    }

    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        setRealtimeStatus("connected");
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setRealtimeStatus("error");
        console.warn(`Supabase realtime channel for this profile is ${status.toLowerCase()}.`);
      }
    });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [activeProfileId]);

  const switchProfile = useCallback(
    async (profileId: string) => {
      const target = allUsers.find((user) => user.id === profileId);
      if (!target || target.id === currentUser?.id || isSwitching) return;

      if (!saveProfileId(target.id)) {
        throw new Error("Your browser could not save the selected profile. Enable local storage and try again.");
      }
      setIsSwitching(true);
      window.location.reload();
    },
    [allUsers, currentUser, isSwitching],
  );

  const updateProfile = useCallback((profile: UserProfile) => {
    setAllUsers((users) =>
      users.map((user) => (user.id === profile.id ? profile : user)),
    );
    setCurrentUser((user) => (user?.id === profile.id ? profile : user));
  }, []);

  const contextValue = useMemo(
    () => ({
      currentUser,
      allUsers,
      profileError,
      isLoading,
      isSwitching,
      realtimeStatus,
      switchProfile,
      updateProfile,
    }),
    [
      allUsers,
      currentUser,
      isLoading,
      isSwitching,
      profileError,
      realtimeStatus,
      switchProfile,
      updateProfile,
    ],
  );

  return (
    <ProfileContext.Provider value={contextValue}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within an ProfileProvider");
  }
  return context;
}
