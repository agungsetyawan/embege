"use server";

import { requireAdmin } from "./actions";

// Chrome advises tool output under ~1.5K chars, so pages stay small.
const PAGE_SIZE = 5;

// Strip PostgREST OR-syntax chars, same as /admin and /admin/cases.
const clean = (q: string) =>
  String(q ?? "")
    .slice(0, 200)
    .replace(/[%(),]/g, " ")
    .trim();

export async function listQueue(tab: string, page: number) {
  const { supabase } = await requireAdmin();
  const from = (Number.isInteger(page) && page > 0 ? page - 1 : 0) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  if (tab === "reports") {
    const { data } = await supabase
      .from("case_reports")
      .select(
        "id,reason,reported_victims,reported_date,note,evidence_url,created_at,case:cases!inner(id,region_id,summary,victims,occurred_on,source_url)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(from, to);
    return data ?? [];
  }
  const { data } = await supabase
    .from("crawl_items")
    .select(
      "id,title,url,media,published_at,guessed_region_id,llm_summary,llm_victims,llm_school,llm_sppg,llm_occurred_on,llm_reject_reason,geo_confidence,enrich_source,duplicate_of_case_id,duplicate_confidence,duplicate_reason",
    )
    .eq("status", tab === "rejected" ? "rejected" : "pending")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);
  return data ?? [];
}

export async function findRegions(q: string) {
  const { supabase } = await requireAdmin();
  const s = clean(q);
  if (!s) return [];
  const { data } = await supabase
    .from("regions")
    .select("id,province,district,centroid_ok")
    .or(`district.ilike.%${s}%,province.ilike.%${s}%`)
    .order("province")
    .order("district")
    .limit(20);
  return data ?? [];
}

export async function findCases(q: string, deleted: boolean) {
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("cases")
    .select(
      "id,region_id,summary,school,sppg,victims,occurred_on,source_media,source_url,published,deleted_at,region:regions(province,district)",
    );
  query = deleted
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);
  const s = clean(q);
  if (s)
    query = query.or(
      `summary.ilike.%${s}%,school.ilike.%${s}%,sppg.ilike.%${s}%,source_media.ilike.%${s}%,source_url.ilike.%${s}%`,
    );
  const { data } = await query
    .order("occurred_on", { ascending: false, nullsFirst: false })
    .limit(10);
  return data ?? [];
}

export async function getSettings() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: keywords }] = await Promise.all([
    supabase.from("app_settings").select("key,value").order("key"),
    supabase
      .from("crawl_keywords")
      .select("id,keyword,active")
      .order("keyword"),
  ]);
  return { settings: settings ?? [], keywords: keywords ?? [] };
}
