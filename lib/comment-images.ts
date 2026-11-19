import { getSupabaseClient } from "@/lib/supabase";

const COMMENT_IMAGE_BUCKET = "post-images";
export const COMMENT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const COMMENT_IMAGE_MAX_COUNT = 5;

export type UploadedCommentImage = {
  path: string;
  url: string;
};

export async function uploadCommentImage(
  file: File,
  profileId: string,
): Promise<UploadedCommentImage> {
  if (!file.type.toLowerCase().startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > COMMENT_IMAGE_MAX_SIZE) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "img";
  const path = `${profileId}/comments/${crypto.randomUUID()}.${extension}`;
  const bucket = getSupabaseClient().storage.from(COMMENT_IMAGE_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Could not upload comment image: ${error.message}`);

  return { path, url: bucket.getPublicUrl(path).data.publicUrl };
}

export async function removeCommentImage(path: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .storage.from(COMMENT_IMAGE_BUCKET)
    .remove([path]);
  if (error) throw new Error(`Could not remove comment image: ${error.message}`);
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

  const { error } = await getSupabaseClient()
    .storage.from(COMMENT_IMAGE_BUCKET)
    .remove(paths);
  if (error) throw new Error(`Could not remove comment images: ${error.message}`);
}
