const publicImageBuckets = new Set([
  "message-attachments",
  "marketplace-listing-images",
  "post-images",
  "profile-images",
]);

const storageOriginAndPrefix = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    return {
      origin: url.origin,
      pathPrefix: `${url.pathname.replace(/\/$/, "")}/storage/v1/object/public/`,
    };
  } catch {
    return null;
  }
})();

export function isSupabasePublicImage(src: string) {
  if (!storageOriginAndPrefix) return false;

  try {
    const imageUrl = new URL(src);
    if (
      imageUrl.origin !== storageOriginAndPrefix.origin ||
      !imageUrl.pathname.startsWith(storageOriginAndPrefix.pathPrefix)
    ) {
      return false;
    }

    const bucket = imageUrl.pathname
      .slice(storageOriginAndPrefix.pathPrefix.length)
      .split("/", 1)[0];
    return publicImageBuckets.has(bucket);
  } catch {
    return false;
  }
}
