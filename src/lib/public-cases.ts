import type { SupabaseClient } from "@supabase/supabase-js";

export type CaseSource = { url: string; media: string };

export type PublicCase = {
  id: string;
  occurred_on: string | null;
  victims: number | null;
  summary: string;
  school: string | null;
  sppg: string | null;
  source_url: string;
  source_media: string;
  region_id: string;
  province: string;
  district: string;
  sources: CaseSource[];
};

// Published cases newest first, each with its extra coverage links from the
// case_sources() RPC. Pass regionId to scope to one district.
// ponytail: no pagination, PostgREST caps at 1000 rows (same as the timeline).
export async function fetchPublicCases(
  supabase: SupabaseClient,
  regionId?: string,
): Promise<PublicCase[]> {
  let query = supabase
    .from("cases")
    .select(
      "id,occurred_on,victims,summary,school,sppg,source_url,source_media,region_id,regions(province,district)",
    )
    .eq("published", true)
    .is("deleted_at", null);
  if (regionId) query = query.eq("region_id", regionId);

  const [{ data: rows, error }, { data: sourceRows }] = await Promise.all([
    query
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    // Extra sources are supplementary: an RPC failure leaves them empty.
    supabase.rpc("case_sources", { p_region_id: regionId ?? null }),
  ]);
  if (error) throw new Error("Failed to load cases");

  const sources = new Map<string, CaseSource[]>();
  for (const s of (sourceRows ?? []) as {
    case_id: string;
    url: string;
    media: string;
  }[]) {
    const list = sources.get(s.case_id) ?? [];
    list.push({ url: s.url, media: s.media });
    sources.set(s.case_id, list);
  }

  return (rows ?? []).map(({ regions, ...c }) => {
    const region = Array.isArray(regions) ? regions[0] : regions;
    return {
      ...c,
      province: region?.province ?? "",
      district: region?.district ?? "",
      sources: sources.get(c.id) ?? [],
    };
  });
}

// "KOTA BANDUNG" -> "kota-bandung". Unique across all 514 districts.
export function regionSlug(district: string): string {
  return district
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Slugs of districts with at least one published case (prebuilt pages + sitemap).
export async function fetchCaseSlugs(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("case_summary")
    .select("district")
    .gt("count", 0);
  return (data ?? []).map((r) => regionSlug(r.district));
}
