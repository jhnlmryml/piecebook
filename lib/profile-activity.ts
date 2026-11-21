import { apiRequest } from "@/lib/api-client";
import type { Tables } from "@/types/supabase";

export type ProfileActivity = {
  comments: Tables<"post_comments">[];
  listings: Tables<"marketplace_listing">[];
};

export function getProfileActivity(profileId: string) {
  return apiRequest<ProfileActivity>(
    `profiles/${encodeURIComponent(profileId)}/activity`,
  );
}
