import type { UserProfile } from "@/types/user-profile";

export type AuthContextValue = {
  currentUser: UserProfile | null;
  isLoading: boolean;
  switchUser: (userId: string) => void;
  allUsers: UserProfile[];
};
