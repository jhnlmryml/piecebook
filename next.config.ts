import type { NextConfig } from "next";

const supabaseImagePattern = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return undefined;

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const pattern = new URL(url.origin);
    pattern.pathname = `${url.pathname.replace(/\/$/, "")}/storage/v1/object/public/message-attachments/**`;
    return pattern;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImagePattern ? [supabaseImagePattern] : [],
  },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "autoplay=(), focus-without-user-activation=()",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
