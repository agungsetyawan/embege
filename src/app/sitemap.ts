import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://embege-poisoning.vercel.app/",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
