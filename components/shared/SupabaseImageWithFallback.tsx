"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { isSupabasePublicImage } from "@/lib/is-supabase-public-image";

export function SupabaseImageWithFallback(props: ImageProps) {
  const { src, alt, unoptimized, onError, ...imageProps } = props;
  const source = typeof src === "string" ? src : "src" in src ? src.src : src.default.src;
  const isPublicSupabaseImage = typeof src === "string" && isSupabasePublicImage(src);
  const [fallbackSource, setFallbackSource] = useState<string | null>(null);
  const useOriginalSource = fallbackSource === source;
  const usesOptimizer = isPublicSupabaseImage && unoptimized !== true && !useOriginalSource;

  return (
    <Image
      key={`${source}:${useOriginalSource ? "original" : "optimized"}`}
      {...imageProps}
      src={src}
      alt={alt}
      unoptimized={unoptimized ?? (typeof src === "string" && (!isPublicSupabaseImage || useOriginalSource))}
      onError={(event) => {
        if (usesOptimizer) {
          setFallbackSource(source);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
