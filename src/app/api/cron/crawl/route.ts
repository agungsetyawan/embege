import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";
import { requiredEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const parser = new Parser({ timeout: 15000 });

type Region = { id: string; province: string; district: string };

function guessRegion(text: string, regions: Region[]): string | null {
  const upper = text.toUpperCase();
  // Nama terpanjang dulu supaya "KOTA BANDUNG" menang atas "BANDUNG".
  const sorted = [...regions].sort(
    (a, b) => b.district.length - a.district.length,
  );
  for (const r of sorted) {
    if (upper.includes(r.district)) return r.id;
  }
  return null;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${requiredEnv("CRON_SECRET")}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
  );

  const [{ data: sources }, { data: keywords }, { data: regions }] =
    await Promise.all([
      supabase
        .from("crawl_sources")
        .select("name,rss_url")
        .eq("active", true)
        .not("rss_url", "is", null),
      supabase.from("crawl_keywords").select("keyword").eq("active", true),
      supabase.from("regions").select("id,province,district"),
    ]);
  if (!sources || !keywords || !regions) {
    return Response.json(
      { error: "gagal membaca konfigurasi" },
      { status: 500 },
    );
  }
  const kws = keywords.map((k) => k.keyword.toLowerCase());
  // Kata pendek seperti "MBG" wajib utuh (word boundary) supaya tidak match "lambung", dsb.
  const tests = kws.map((k) =>
    k.length <= 5
      ? (t: string) => new RegExp(`\\b${k.replace(/[^\w\s]/g, "")}\\b`).test(t)
      : (t: string) => t.includes(k),
  );

  let fetched = 0;
  let inserted = 0;
  for (const src of sources) {
    // Satu feed mati tidak menggagalkan yang lain.
    const feed = await parser.parseURL(src.rss_url as string).catch(() => null);
    if (!feed) continue;
    const rows = [];
    for (const item of feed.items ?? []) {
      const title = item.title ?? "";
      const text = `${title} ${item.contentSnippet ?? ""}`;
      const lower = text.toLowerCase();
      if (!tests.some((t) => t(lower))) continue;
      if (!item.link) continue;
      fetched++;
      rows.push({
        url_hash: createHash("sha256").update(item.link).digest("hex"),
        title: title.slice(0, 500),
        summary: (item.contentSnippet ?? "").slice(0, 1000) || null,
        url: item.link,
        media: src.name,
        published_at: item.isoDate
          ? new Date(item.isoDate).toISOString()
          : null,
        guessed_region_id: guessRegion(text, regions),
      });
    }
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("crawl_items")
        .upsert(rows, { onConflict: "url_hash", ignoreDuplicates: true })
        .select("id");
      if (!error) inserted += data?.length ?? 0;
    }
  }
  return Response.json({ sources: sources.length, fetched, inserted });
}
