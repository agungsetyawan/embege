import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Public map data. RLS still applies (anon key), results cached 5 minutes
// so the DB is not hit on every visit.
//
// Modes to keep the initial payload small forever:
// - no param: per-region summary (514 short rows, for choropleth + markers)
// - ?region_id=: cases of that region only, fetched when the popup opens
export const dynamic = "force-dynamic";
export const revalidate = 300;

const CACHE = {
  headers: {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  },
};

export async function GET(req: Request) {
  const supabase = await createClient();
  const regionId = new URL(req.url).searchParams.get("region_id");

  if (regionId) {
    if (!isUuid(regionId)) {
      return Response.json({ cases: [] }, CACHE);
    }
    const { data: cases, error } = await supabase
      .from("cases")
      .select(
        "id,occurred_on,victims,summary,source_url,source_media,region_id",
      )
      .eq("published", true)
      .is("deleted_at", null)
      .eq("region_id", regionId)
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error)
      return Response.json({ error: "gagal memuat data" }, { status: 500 });
    return Response.json({ cases: cases ?? [] }, CACHE);
  }

  // Only regions with cases are sent. Client-side, unknown regions = 0 cases.
  const { data: summary, error } = await supabase
    .from("case_summary")
    .select("*")
    .gt("count", 0);
  if (error)
    return Response.json({ error: "gagal memuat data" }, { status: 500 });
  return Response.json({ summary: summary ?? [] }, CACHE);
}
