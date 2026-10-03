import { createClient } from "@supabase/supabase-js";
import {
  checkDuplicateWithGemini,
  DEFAULT_MAX_HTML,
  DEFAULT_MAX_TEXT,
  enrichWithGemini,
  fetchArticleText,
  type LlmResult,
  sha256OrNull,
} from "@/lib/enrich";
import { requiredEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH = 5;
const MAX_BATCH = 20;
// The LLM may only auto-reject when highly confident. In doubt = keep queued.
const AUTO_REJECT_MIN_CONFIDENCE = 0.8;
// Duplicates auto-reject on a stricter bar: a wrong reject hides a victim update.
const DEDUP_MIN_CONFIDENCE = 0.9;
const DEDUP_CANDIDATES = 5;
const DEFAULT_DEDUP_WINDOW_DAYS = 7;
// Snippet-only items retry the article fetch a few times, an hour apart, so a
// transient 403/timeout does not leave them on the RSS snippet for good.
const MAX_FETCH_RETRIES = 3;
const FETCH_RETRY_GAP_MS = 60 * 60 * 1000;

// Match the LLM output against the regions table (uppercase, KOTA-prefix tolerant).
function matchRegion(
  district: string | null,
  regions: { id: string; district: string }[],
): string | null {
  if (!district) return null;
  const norm = district.toUpperCase().trim();
  const hits = regions.filter(
    (r) => r.district === norm || r.district === `KOTA ${norm}`,
  );
  return hits.length === 1 ? hits[0].id : null;
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

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", [
      "enrich_batch",
      "dedup_window_days",
      "enrich_max_text",
      "enrich_max_html",
    ]);
  const settingValue = (k: string) =>
    settings?.find((s) => s.key === k)?.value ?? "";
  const clampInt = (raw: string, def: number, max: number, min = 1) => {
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) || n < min ? def : Math.min(n, max);
  };
  const batch = clampInt(
    settingValue("enrich_batch"),
    DEFAULT_BATCH,
    MAX_BATCH,
  );
  const windowDays = clampInt(
    settingValue("dedup_window_days"),
    DEFAULT_DEDUP_WINDOW_DAYS,
    30,
  );
  const maxText = clampInt(
    settingValue("enrich_max_text"),
    DEFAULT_MAX_TEXT,
    30000,
    1000,
  );
  const maxHtml = clampInt(
    settingValue("enrich_max_html"),
    DEFAULT_MAX_HTML,
    5000000,
    100000,
  );

  const columns =
    "id,title,summary,url,published_at,guessed_region_id,fetch_retries";
  const [{ data: fresh }, { data: regions }] = await Promise.all([
    supabase
      .from("crawl_items")
      .select(columns)
      .eq("status", "pending")
      .is("llm_summary", null)
      .order("created_at", { ascending: true })
      .limit(batch),
    supabase.from("regions").select("id,district"),
  ]);
  if (!fresh || !regions) {
    return Response.json({ error: "gagal membaca data" }, { status: 500 });
  }
  // Leftover batch slots go to snippet-only items due for another fetch.
  // Google News links are left to the crawl decode catch-up.
  let retries: typeof fresh = [];
  if (fresh.length < batch) {
    const due = new Date(Date.now() - FETCH_RETRY_GAP_MS).toISOString();
    const { data } = await supabase
      .from("crawl_items")
      .select(columns)
      .eq("status", "pending")
      .eq("enrich_source", "rss")
      .not("url", "like", "https://news.google.com/%")
      .lt("fetch_retries", MAX_FETCH_RETRIES)
      .or(`last_fetch_at.is.null,last_fetch_at.lt.${due}`)
      .order("created_at", { ascending: true })
      .limit(batch - fresh.length);
    retries = data ?? [];
  }
  const now = new Date().toISOString();

  let enriched = 0;
  let autoRejected = 0;
  let duplicateRejected = 0;
  let failed = 0;

  // Fetch article texts in parallel (I/O bound), then enrich each item in
  // its own isolated Gemini call, all in parallel.
  const all = [...fresh, ...retries];
  const allFetches = await Promise.all(
    all.map((item) => fetchArticleText(item.url, { maxText, maxHtml })),
  );
  // A retry that still gets no article keeps its snippet enrichment: count
  // the attempt and skip Gemini.
  const keep = all.map((_, i) => i < fresh.length || !!allFetches[i].text);
  const items = all.filter((_, i) => keep[i]);
  const fetches = allFetches.filter((_, i) => keep[i]);
  const stillThin = all.filter((_, i) => !keep[i]);
  const refetchFailed = stillThin.length;
  await Promise.all(
    stillThin.map((item) =>
      supabase
        .from("crawl_items")
        .update({ fetch_retries: item.fetch_retries + 1, last_fetch_at: now })
        .eq("id", item.id),
    ),
  );
  const inputs = fetches.map((f, i) => ({
    text: f.text ?? items[i].summary ?? "",
    source: (f.text ? "article" : items[i].summary ? "rss" : "empty") as
      | "article"
      | "rss"
      | "empty",
    fetchedLen: f.text?.length ?? null,
    canonical: f.canonical,
  }));
  const results = new Map<string, LlmResult>();
  await Promise.all(
    items.map(async (item, i) => {
      const anchor = item.published_at ? item.published_at.slice(0, 10) : null;
      const result = await enrichWithGemini(item.title, inputs[i].text, anchor);
      if (result) results.set(item.id, result);
    }),
  );

  const handleItem = async (
    item: (typeof items)[number],
    result: LlmResult | undefined,
    canonical: string | null,
    source: "article" | "rss" | "empty",
    fetchedLen: number | null,
  ): Promise<"enriched" | "rejected" | "duplicate" | "failed"> => {
    try {
      if (!result) return "failed";
      const anchor = item.published_at ? item.published_at.slice(0, 10) : null;
      // The event date cannot be after the news date: cap hallucinations/future dates.
      const cap = anchor ?? new Date().toISOString().slice(0, 10);
      const occurredOn =
        result.occurredOn && result.occurredOn <= cap
          ? result.occurredOn
          : null;
      const cHash = sha256OrNull(canonical);
      const rejectedBase = {
        status: "rejected",
        llm_summary: result.summary,
        llm_is_relevant: false,
        llm_school: result.school,
        llm_sppg: result.sppg,
        llm_occurred_on: occurredOn,
        canonical_hash: cHash,
        enrich_source: source,
        fetched_len: fetchedLen,
        last_fetch_at: now,
      };
      // High-confidence non-MBG-poisoning news: auto-reject.
      if (
        !result.isPoisonRelated &&
        result.relevanceConfidence >= AUTO_REJECT_MIN_CONFIDENCE
      ) {
        const { error } = await supabase
          .from("crawl_items")
          .update({
            ...rejectedBase,
            llm_reject_reason: result.rejectReason,
          })
          .eq("id", item.id);
        return error ? "failed" : "rejected";
      }
      // Same canonical URL as another item: same article, no LLM needed.
      if (cHash) {
        const { data: same } = await supabase
          .from("crawl_items")
          .select("id")
          .eq("canonical_hash", cHash)
          .neq("id", item.id)
          .limit(1);
        if (same && same.length > 0) {
          const { error } = await supabase
            .from("crawl_items")
            .update({
              ...rejectedBase,
              llm_reject_reason:
                "Duplikat: URL kanonis sama dengan berita lain.",
            })
            .eq("id", item.id);
          return error ? "failed" : "duplicate";
        }
      }
      const candidate = matchRegion(result.district, regions);
      const update: {
        llm_summary: string;
        llm_is_relevant: boolean;
        llm_victims: number | null;
        llm_school?: string | null;
        llm_sppg?: string | null;
        llm_occurred_on?: string | null;
        guessed_region_id?: string | null;
        geo_confidence?: number | null;
        canonical_hash?: string | null;
        enrich_source?: string | null;
        fetched_len?: number | null;
        last_fetch_at?: string;
        duplicate_of_case_id?: string | null;
        duplicate_confidence?: number | null;
        duplicate_reason?: string | null;
      } = {
        llm_summary: result.summary,
        llm_is_relevant: true,
        llm_victims: result.victims,
        llm_school: result.school,
        llm_sppg: result.sppg,
        llm_occurred_on: occurredOn,
        canonical_hash: cHash,
        enrich_source: source,
        fetched_len: fetchedLen,
        last_fetch_at: now,
        // Cleared so a re-enrich (fetch retry) drops stale values.
        geo_confidence: null,
        duplicate_of_case_id: null,
        duplicate_confidence: null,
        duplicate_reason: null,
      };
      if (candidate) {
        update.geo_confidence = result.confidence;
        // Overwrite the substring guess only when: no guess yet, or the LLM is confident.
        if (!item.guessed_region_id || result.confidence >= 0.7) {
          update.guessed_region_id = candidate;
        }
      }
      // Dedup against published cases: same region, occurred_on near the
      // item date. LLM verifies; confident same-event (not an update) rejects.
      const regionId = update.guessed_region_id ?? item.guessed_region_id;
      if (regionId && anchor) {
        const from = new Date(anchor);
        from.setDate(from.getDate() - windowDays);
        const to = new Date(anchor);
        to.setDate(to.getDate() + windowDays);
        const { data: published } = await supabase
          .from("cases")
          .select("id,summary,victims,occurred_on,source_media")
          .eq("region_id", regionId)
          .eq("published", true)
          .is("deleted_at", null)
          .gte("occurred_on", from.toISOString().slice(0, 10))
          .lte("occurred_on", to.toISOString().slice(0, 10))
          .order("occurred_on", { ascending: false })
          .limit(DEDUP_CANDIDATES);
        if (published && published.length > 0) {
          const dup = await checkDuplicateWithGemini(
            item.title,
            result.summary,
            published,
            anchor,
          );
          if (dup?.isDuplicate && dup.duplicateOfCaseId) {
            update.duplicate_of_case_id = dup.duplicateOfCaseId;
            update.duplicate_confidence = dup.confidence;
            update.duplicate_reason = dup.reason;
            if (!dup.isUpdate && dup.confidence >= DEDUP_MIN_CONFIDENCE) {
              const { error } = await supabase
                .from("crawl_items")
                .update({
                  ...update,
                  status: "rejected",
                  llm_is_relevant: false,
                  llm_reject_reason: dup.reason
                    ? `Duplikat: ${dup.reason}`.slice(0, 500)
                    : "Duplikat dari kasus yang sudah terbit.",
                })
                .eq("id", item.id);
              return error ? "failed" : "duplicate";
            }
          }
        }
      }
      const { error } = await supabase
        .from("crawl_items")
        .update(update)
        .eq("id", item.id);
      return error ? "failed" : "enriched";
    } catch {
      return "failed";
    }
  };

  // DB updates in parallel; count outcomes.
  const outcomes = await Promise.all(
    items.map((item, i) =>
      handleItem(
        item,
        results.get(item.id),
        inputs[i].canonical,
        inputs[i].source,
        inputs[i].fetchedLen,
      ),
    ),
  );
  for (const o of outcomes) {
    if (o === "enriched") enriched++;
    else if (o === "rejected") autoRejected++;
    else if (o === "duplicate") duplicateRejected++;
    else failed++;
  }
  return Response.json({
    processed: all.length,
    enriched,
    autoRejected,
    duplicateRejected,
    failed,
    refetchFailed,
  });
}
