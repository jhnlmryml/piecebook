import type { UserProfile } from "@/types/user-profile";

export type ProfileContextValue = {
  currentUser: UserProfile | null;
  profileError: string | null;
  isLoading: boolean;
  isSwitching: boolean;
  realtimeStatus: "connecting" | "connected" | "error";
  switchProfile: (profileId: string) => Promise<void>;
  updateProfile: (profile: UserProfile) => void;
  allUsers: UserProfile[];
};
