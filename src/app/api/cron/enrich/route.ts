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

  const [{ data: items }, { data: regions }] = await Promise.all([
    supabase
      .from("crawl_items")
      .select("id,title,summary,url,published_at,guessed_region_id")
      .eq("status", "pending")
      .is("llm_summary", null)
      .order("created_at", { ascending: true })
      .limit(batch),
    supabase.from("regions").select("id,district"),
  ]);
  if (!items || !regions) {
    return Response.json({ error: "gagal membaca data" }, { status: 500 });
  }

  let enriched = 0;
  let autoRejected = 0;
  let duplicateRejected = 0;
  let failed = 0;

  // Fetch article texts in parallel (I/O bound), then enrich each item in
  // its own isolated Gemini call, all in parallel.
  const fetches = await Promise.all(
    items.map((item) => fetchArticleText(item.url, { maxText, maxHtml })),
  );
  const texts = fetches.map((f, i) => f.text ?? items[i].summary ?? "");
  const results = new Map<string, LlmResult>();
  await Promise.all(
    items.map(async (item, i) => {
      const result = await enrichWithGemini(item.title, texts[i]);
      if (result) results.set(item.id, result);
    }),
  );

  const handleItem = async (
    item: (typeof items)[number],
    result: LlmResult | undefined,
    canonical: string | null,
  ): Promise<"enriched" | "rejected" | "duplicate" | "failed"> => {
    try {
      if (!result) return "failed";
      const cHash = sha256OrNull(canonical);
      const rejectedBase = {
        status: "rejected",
        llm_summary: result.summary,
        llm_is_relevant: false,
        llm_school: result.school,
        llm_sppg: result.sppg,
        canonical_hash: cHash,
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
        guessed_region_id?: string | null;
        geo_confidence?: number | null;
        canonical_hash?: string | null;
        duplicate_of_case_id?: string | null;
        duplicate_confidence?: number | null;
        duplicate_reason?: string | null;
      } = {
        llm_summary: result.summary,
        llm_is_relevant: true,
        llm_victims: result.victims,
        llm_school: result.school,
        llm_sppg: result.sppg,
        canonical_hash: cHash,
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
      const anchor = item.published_at ? item.published_at.slice(0, 10) : null;
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
      handleItem(item, results.get(item.id), fetches[i].canonical),
    ),
  );
  for (const o of outcomes) {
    if (o === "enriched") enriched++;
    else if (o === "rejected") autoRejected++;
    else if (o === "duplicate") duplicateRejected++;
    else failed++;
  }
  return Response.json({
    processed: items.length,
    enriched,
    autoRejected,
    duplicateRejected,
    failed,
  });
}
