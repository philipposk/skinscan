import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skin photos are Article 9 health data. Nothing about this app should be
  // cached by a CDN or indexed, and no third-party can be allowed to frame it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // camera is needed for capture; everything else off
            value: "camera=(self), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
      {
        // Never let an intermediary cache a page that can render lesion photos.
        source: "/(app|doctor)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
