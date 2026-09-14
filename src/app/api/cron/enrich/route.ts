import { createClient } from "@supabase/supabase-js";
import {
  enrichWithGemini,
  fetchArticleText,
  type LlmResult,
} from "@/lib/enrich";
import { requiredEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH = 5;
const MAX_BATCH = 20;
// The LLM may only auto-reject when highly confident. In doubt = keep queued.
const AUTO_REJECT_MIN_CONFIDENCE = 0.8;

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

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "enrich_batch")
    .single();
  const parsed = Number.parseInt(setting?.value ?? "", 10);
  const batch =
    Number.isNaN(parsed) || parsed < 1
      ? DEFAULT_BATCH
      : Math.min(parsed, MAX_BATCH);

  const [{ data: items }, { data: regions }] = await Promise.all([
    supabase
      .from("crawl_items")
      .select("id,title,summary,url,guessed_region_id")
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
  let failed = 0;

  // Fetch article texts in parallel (I/O bound), then enrich each item in
  // its own isolated Gemini call, all in parallel.
  const texts = await Promise.all(
    items.map((item) =>
      fetchArticleText(item.url).then((t) => t ?? item.summary ?? ""),
    ),
  );
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
  ): Promise<"enriched" | "rejected" | "failed"> => {
    try {
      if (!result) return "failed";
      // High-confidence non-MBG-poisoning news: auto-reject.
      if (
        !result.isPoisonRelated &&
        result.relevanceConfidence >= AUTO_REJECT_MIN_CONFIDENCE
      ) {
        const { error } = await supabase
          .from("crawl_items")
          .update({
            status: "rejected",
            llm_summary: result.summary,
            llm_is_relevant: false,
            llm_reject_reason: result.rejectReason,
          })
          .eq("id", item.id);
        return error ? "failed" : "rejected";
      }
      const candidate = matchRegion(result.district, regions);
      const update: {
        llm_summary: string;
        llm_is_relevant: boolean;
        llm_victims: number | null;
        guessed_region_id?: string | null;
        geo_confidence?: number | null;
      } = {
        llm_summary: result.summary,
        llm_is_relevant: true,
        llm_victims: result.victims,
      };
      if (candidate) {
        update.geo_confidence = result.confidence;
        // Overwrite the substring guess only when: no guess yet, or the LLM is confident.
        if (!item.guessed_region_id || result.confidence >= 0.7) {
          update.guessed_region_id = candidate;
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
    items.map((item) => handleItem(item, results.get(item.id))),
  );
  for (const o of outcomes) {
    if (o === "enriched") enriched++;
    else if (o === "rejected") autoRejected++;
    else failed++;
  }
  return Response.json({
    processed: items.length,
    enriched,
    autoRejected,
    failed,
  });
}
