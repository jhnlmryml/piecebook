import { IMAGE_MAX_SIZE, profileImageFileSchema } from "@/lib/form-schemas";
import { apiRequest, jsonRequest } from "@/lib/api-client";

export const PROFILE_IMAGE_MAX_SIZE = IMAGE_MAX_SIZE;

export async function uploadProfileImage(file: File, profileId: string) {
  const validation = profileImageFileSchema.safeParse(file);
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Choose a valid profile image.",
    );
  }

  const formData = new FormData();
  formData.append("ownerId", profileId);
  formData.append("file", file);
  return apiRequest<{ path: string; url: string }>("uploads/profile", {
    method: "POST",
    body: formData,
  });
}

export async function removeProfileImage(path: string): Promise<void> {
  const profileId = path.split("/")[0];
  if (!profileId) throw new Error("The profile image path is invalid.");
  await apiRequest<void>(
    "uploads/profile",
    jsonRequest("DELETE", { ownerId: profileId, paths: [path] }),
  );
}

export function getOwnedProfileImagePath(
  imageUrl: string,
  profileId: string,
): string | null {
  const bucketMarker = "/storage/v1/object/public/profile-images/";
  const markerIndex = imageUrl.indexOf(bucketMarker);
  if (markerIndex < 0) return null;

  try {
    const path = decodeURIComponent(imageUrl.slice(markerIndex + bucketMarker.length));
    return path.startsWith(`${profileId}/`) ? path : null;
  } catch {
    return null;
  }
}
