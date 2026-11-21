import { apiRequest, jsonRequest } from "@/lib/api-client";
import { profileFieldsSchema } from "@/lib/form-schemas";
import type { Tables, TablesUpdate } from "@/types/supabase";
import type { UserProfile } from "@/types/user-profile";

type UserRow = Pick<
  Tables<"users">,
  | "id"
  | "full_name"
  | "email"
  | "role"
  | "birthdate"
  | "location"
  | "interests"
  | "dream"
  | "about"
  | "created_at"
> & Partial<Pick<Tables<"users">, "image">>;

export type UserProfileFields = Pick<
  UserProfile,
  | "full_name"
  | "email"
  | "role"
  | "birthdate"
  | "location"
  | "interests"
  | "dream"
  | "about"
  | "image"
>;

function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    full_name: row.full_name?.trim() || "Piecebook member",
    email: row.email?.trim() || "",
    role: row.role?.trim() || "Member",
    birthdate: row.birthdate?.trim() || "",
    location: row.location?.trim() || "",
    interests: row.interests ?? [],
    dream: row.dream?.trim() || "",
    about: row.about?.trim() || "",
    image: row.image?.trim() || "",
    created_at: row.created_at,
  };
}

export async function getUserProfiles(): Promise<UserProfile[]> {
  const rows = await apiRequest<UserRow[]>("profiles");
  return rows.map(toUserProfile);
}

export async function saveUserProfile({
  profileId,
  fields,
}: {
  profileId: string;
  fields: UserProfileFields;
}): Promise<UserProfile> {
  const validation = profileFieldsSchema.safeParse(fields);
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Profile details are invalid.",
    );
  }
  const values: TablesUpdate<"users"> = validation.data;
  const data = await apiRequest<UserRow>(
    `profiles/${encodeURIComponent(profileId)}`,
    jsonRequest("PATCH", values),
  );
  return toUserProfile(data);
}
