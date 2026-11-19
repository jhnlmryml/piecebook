import { getSupabaseClient } from "@/lib/supabase";

const PROFILE_IMAGE_BUCKET = "profile-images";
export const PROFILE_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

export async function uploadProfileImage(file: File, profileId: string) {
  if (!file.type.toLowerCase().startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > PROFILE_IMAGE_MAX_SIZE) {
    throw new Error("Profile images must be 5 MB or smaller.");
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "img";
  const path = `${profileId}/avatars/${crypto.randomUUID()}.${extension}`;
  const bucket = getSupabaseClient().storage.from(PROFILE_IMAGE_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Could not upload profile image: ${error.message}`);

  return { path, url: bucket.getPublicUrl(path).data.publicUrl };
}

export async function removeProfileImage(path: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .storage.from(PROFILE_IMAGE_BUCKET)
    .remove([path]);
  if (error) throw new Error(`Could not remove profile image: ${error.message}`);
}

export function getOwnedProfileImagePath(
  imageUrl: string,
  profileId: string,
): string | null {
  const bucketMarker = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(bucketMarker);
  if (markerIndex < 0) return null;

  try {
    const path = decodeURIComponent(imageUrl.slice(markerIndex + bucketMarker.length));
    return path.startsWith(`${profileId}/`) ? path : null;
  } catch {
    return null;
  }
}
