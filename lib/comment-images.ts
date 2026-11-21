import {
  imageFileSchema,
  IMAGE_MAX_COUNT,
  IMAGE_MAX_SIZE,
} from "@/lib/form-schemas";
import { apiRequest, jsonRequest } from "@/lib/api-client";

const COMMENT_IMAGE_BUCKET = "post-images";
export const COMMENT_IMAGE_MAX_SIZE = IMAGE_MAX_SIZE;
export const COMMENT_IMAGE_MAX_COUNT = IMAGE_MAX_COUNT;

export type UploadedCommentImage = {
  path: string;
  url: string;
};

export async function uploadCommentImage(
  file: File,
  profileId: string,
): Promise<UploadedCommentImage> {
  const validation = imageFileSchema.safeParse(file);
  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Choose a valid image.");
  }

  const formData = new FormData();
  formData.append("ownerId", profileId);
  formData.append("file", file);
  return apiRequest<UploadedCommentImage>("uploads/comment", {
    method: "POST",
    body: formData,
  });
}

export async function removeCommentImage(path: string): Promise<void> {
  const profileId = path.split("/")[0];
  if (!profileId) throw new Error("The comment image path is invalid.");
  await apiRequest<void>(
    "uploads/comment",
    jsonRequest("DELETE", { ownerId: profileId, paths: [path] }),
  );
}

export async function removeCommentImages(
  imageUrls: readonly string[],
  profileId: string,
): Promise<void> {
  const publicPath = `/storage/v1/object/public/${COMMENT_IMAGE_BUCKET}/`;
  const profileCommentPrefix = `${profileId}/comments/`;
  const paths = Array.from(
    new Set(
      imageUrls.flatMap((imageUrl) => {
        try {
          const pathname = new URL(imageUrl).pathname;
          const bucketPathStart = pathname.indexOf(publicPath);
          if (bucketPathStart < 0) return [];

          const path = decodeURIComponent(
            pathname.slice(bucketPathStart + publicPath.length),
          );
          if (
            !path.startsWith(profileCommentPrefix) ||
            path.split("/").some((segment) => segment === "." || segment === "..")
          ) {
            return [];
          }
          return [path];
        } catch {
          return [];
        }
      }),
    ),
  );

  if (paths.length === 0) return;
  await apiRequest<void>(
    "uploads/comment",
    jsonRequest("DELETE", { ownerId: profileId, paths }),
  );
}
