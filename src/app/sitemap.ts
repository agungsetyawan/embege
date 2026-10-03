import type { MetadataRoute } from "next";
import { fetchCaseSlugs } from "@/lib/public-cases";
import { createAnonClient } from "@/lib/supabase/anon";

const BASE = "https://embege-poisoning.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only districts with cases: empty pages add nothing for search.
  const slugs = await fetchCaseSlugs(createAnonClient());
  return [
    {
      url: `${BASE}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...slugs.map((slug) => ({
      url: `${BASE}/wilayah/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
