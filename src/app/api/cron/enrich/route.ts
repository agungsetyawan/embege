import { createClient } from "@supabase/supabase-js";
import { enrichWithGemini, fetchArticleText } from "@/lib/enrich";
import { requiredEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH = 5;
const MAX_BATCH = 20;
// LLM hanya boleh auto-reject jika yakin tinggi. Ragu = tetap antre.
const AUTO_REJECT_MIN_CONFIDENCE = 0.8;

// Cocokkan output LLM ke tabel regions (uppercase, toleran prefix KOTA).
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
  for (const item of items) {
    try {
      const article = (await fetchArticleText(item.url)) ?? item.summary ?? "";
      const result = await enrichWithGemini(item.title, article);
      if (!result) {
        failed++;
        continue;
      }
      // Berita bukan keracunan MBG dengan keyakinan tinggi: tolak otomatis.
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
        if (error) failed++;
        else autoRejected++;
        continue;
      }
      const candidate = matchRegion(result.district, regions);
      const update: {
        llm_summary: string;
        llm_is_relevant: boolean;
        guessed_region_id?: string | null;
        geo_confidence?: number | null;
      } = { llm_summary: result.summary, llm_is_relevant: true };
      if (candidate) {
        update.geo_confidence = result.confidence;
        // Overwrite tebakan substring hanya jika: belum ada tebakan, atau LLM yakin.
        if (!item.guessed_region_id || result.confidence >= 0.7) {
          update.guessed_region_id = candidate;
        }
      }
      const { error } = await supabase
        .from("crawl_items")
        .update(update)
        .eq("id", item.id);
      if (error) failed++;
      else enriched++;
    } catch {
      failed++;
    }
  }
  return Response.json({
    processed: items.length,
    enriched,
    autoRejected,
    failed,
  });
}
