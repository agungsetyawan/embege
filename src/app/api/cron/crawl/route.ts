import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";
import { titleHash } from "@/lib/enrich";
import { requiredEnv } from "@/lib/env";
import { isHttpUrl } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const parser = new Parser({
  timeout: 15000,
  // <source> carries the publisher name; rss-parser does not expose it by default.
  customFields: { item: ["source"] },
});

// Fixed search window. The crawl runs hourly and url_hash dedup makes the
// overlap free, so a wide window only protects against missed runs and slow
// indexing. One-line change if the window ever needs tuning.
const GOOGLE_NEWS_WINDOW = "3d";

function googleNewsUrl(keyword: string): string {
  const params = new URLSearchParams({
    q: `${keyword} when:${GOOGLE_NEWS_WINDOW}`,
    hl: "id",
    gl: "ID",
    ceid: "ID:id",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

// Google wraps the publisher URL in a redirect link
// (news.google.com/rss/articles/CBMi...). The link is stable per article, so
// it dedups by url_hash like any other URL, and browsers follow it to the
// publisher when a visitor clicks "Sumber". No server-side resolve: the page
// is a JS app with an encrypted payload, so fetch can never see the target.

type Region = { id: string; province: string; district: string };

function guessRegion(text: string, regions: Region[]): string | null {
  const upper = text.toUpperCase();
  // Longest names first so "KOTA BANDUNG" wins over "BANDUNG".
  const sorted = [...regions].sort(
    (a, b) => b.district.length - a.district.length,
  );
  for (const r of sorted) {
    if (upper.includes(r.district)) return r.id;
  }
  return null;
}

// Split "Title - Publisher" using the exact <source> value, so only a real
// publisher suffix is trimmed — never a lookalike tail like " - Update Terkini".
function splitPublisher(
  title: string,
  source: string | null,
): { title: string; media: string } {
  const name = source?.trim();
  if (!name) return { title, media: "Google News" };
  const suffix = ` - ${name}`;
  return {
    title: title.endsWith(suffix) ? title.slice(0, -suffix.length) : title,
    media: name,
  };
}

type Candidate = {
  title: string;
  source: string | null;
  snippet: string;
  isoDate: string | null;
};

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${requiredEnv("CRON_SECRET")}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_KEY"),
  );

  const [{ data: keywords }, { data: regions }] = await Promise.all([
    supabase.from("crawl_keywords").select("keyword").eq("active", true),
    supabase.from("regions").select("id,province,district"),
  ]);
  if (!keywords || !regions) {
    return Response.json(
      { error: "gagal membaca konfigurasi" },
      { status: 500 },
    );
  }
  const kws = keywords.map((k) => k.keyword.toLowerCase());
  // Short words like "MBG" must match whole (word boundary) to avoid matching e.g. "lambung".
  const tests = kws.map((k) =>
    k.length <= 5
      ? (t: string) => new RegExp(`\\b${k.replace(/[^\w\s]/g, "")}\\b`).test(t)
      : (t: string) => t.includes(k),
  );

  // One query per keyword. Each feed caps at 100 items; the same article
  // carries an identical link across queries, so dedup by link here.
  const seen = new Map<string, Candidate>();
  for (const kw of keywords) {
    // One dead feed must not fail the others.
    const feed = await parser
      .parseURL(googleNewsUrl(kw.keyword))
      .catch(() => null);
    if (!feed) continue;
    for (const item of feed.items ?? []) {
      const title = item.title ?? "";
      const text = `${title} ${item.contentSnippet ?? ""}`;
      if (!tests.some((t) => t(text.toLowerCase()))) continue;
      if (!item.link || !isHttpUrl(item.link)) continue;
      if (!seen.has(item.link)) {
        const rawSource = (item as { source?: unknown }).source;
        seen.set(item.link, {
          title,
          source: typeof rawSource === "string" ? rawSource : null,
          snippet: item.contentSnippet ?? "",
          isoDate: item.isoDate ?? null,
        });
      }
    }
  }

  const rows = [...seen.entries()]
    .map(([link, item]) => {
      // Filter and region guess ran on the raw title above; only storage is trimmed.
      const { title, media } = splitPublisher(item.title, item.source);
      const text = `${item.title} ${item.snippet}`;
      return {
        url_hash: createHash("sha256").update(link).digest("hex"),
        title: title.slice(0, 500),
        title_hash: titleHash(title),
        summary: item.snippet.slice(0, 1000) || null,
        url: link,
        media,
        published_at: item.isoDate
          ? new Date(item.isoDate).toISOString()
          : null,
        guessed_region_id: guessRegion(text, regions),
      };
    })
    // Same normalized headline, different URL (subdomain/AMP/syndication):
    // keep the earliest published, skip the rest.
    .sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));

  let skippedTitleDupes = 0;
  const hashes = rows.map((r) => r.title_hash).filter((h): h is string => !!h);
  const taken = new Set<string>();
  if (hashes.length > 0) {
    const { data: existing } = await supabase
      .from("crawl_items")
      .select("title_hash")
      .in("title_hash", hashes);
    for (const e of existing ?? []) if (e.title_hash) taken.add(e.title_hash);
  }
  const fresh = rows.filter((r) => {
    const h = r.title_hash;
    if (!h) return true;
    if (taken.has(h)) {
      skippedTitleDupes++;
      return false;
    }
    taken.add(h);
    return true;
  });

  let inserted = 0;
  if (fresh.length > 0) {
    const { data, error } = await supabase
      .from("crawl_items")
      .upsert(fresh, { onConflict: "url_hash", ignoreDuplicates: true })
      .select("id");
    if (!error) inserted = data?.length ?? 0;
  }
  return Response.json({
    keywords: keywords.length,
    fetched: seen.size,
    inserted,
    skippedTitleDupes,
  });
}
