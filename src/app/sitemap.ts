import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://skinscan.6x7.gr", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://skinscan.6x7.gr/legal", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
