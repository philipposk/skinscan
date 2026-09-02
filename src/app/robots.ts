import type { MetadataRoute } from "next";

/**
 * The signed-in app is behind auth anyway, but a health app should say out loud
 * that none of it is for indexing — including the API surface, which is where an
 * over-eager crawler would otherwise burn quota against the vision providers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/legal", "/login"], disallow: ["/app/", "/doctor/", "/api/", "/onboarding"] }],
    sitemap: "https://skinscan.6x7.gr/sitemap.xml",
    host: "https://skinscan.6x7.gr",
  };
}
