import { getSupabaseClient } from "@/lib/supabase";
import type { Tables, TablesUpdate } from "@/types/supabase";
import type { UserProfile } from "@/types/user-profile";

type UserRow = Pick<
  Tables<"users">,
  | "id"
  | "full_name"
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
  | "role"
  | "birthdate"
  | "location"
  | "interests"
  | "dream"
  | "about"
  | "image"
>;

const PROFILE_COLUMNS =
  "id,full_name,role,birthdate,location,interests,dream,about,image,created_at";
const PROFILE_COLUMNS_WITHOUT_IMAGE =
  "id,full_name,role,birthdate,location,interests,dream,about,created_at";

function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    full_name: row.full_name?.trim() || "Piecebook member",
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
  const supabase = getSupabaseClient();
  const withImage = await supabase
    .from("users")
    .select(PROFILE_COLUMNS)
    .order("full_name", { ascending: true });

  if (!withImage.error) return withImage.data.map(toUserProfile);
  if (
    !(
      withImage.error.code === "42703" ||
      withImage.error.code === "PGRST204" ||
      /column users\.image.*does not exist|image.*schema cache/i.test(
        withImage.error.message,
      )
    )
  ) {
    throw new Error(`Could not load profiles: ${withImage.error.message}`);
  }

  const withoutImage = await supabase
    .from("users")
    .select(PROFILE_COLUMNS_WITHOUT_IMAGE)
    .order("full_name", { ascending: true });

  if (withoutImage.error) {
    throw new Error(`Could not load profiles: ${withoutImage.error.message}`);
  }
  return withoutImage.data.map(toUserProfile);
}

export async function saveUserProfile({
  profileId,
  fields,
}: {
  profileId: string;
  fields: UserProfileFields;
}): Promise<UserProfile> {
  const values: TablesUpdate<"users"> = fields;
  const { data, error } = await getSupabaseClient()
    .from("users")
    .update(values)
    .eq("id", profileId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error(`Could not save profile: ${error.message}`);
  return toUserProfile(data);
}
