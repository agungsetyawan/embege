import { createClient } from "@/lib/supabase/server";

// Data publik peta. RLS tetap berlaku (anon key), hasil di-cache 5 menit
// supaya DB tidak kena tembak tiap pengunjung.
//
// Dua mode agar payload awal tetap kecil selamanya:
// - tanpa param: ringkasan per daerah (514 baris pendek, untuk choropleth + marker)
// - ?region_id=: kasus daerah itu saja, diambil saat popup dibuka
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
    const { data: cases, error } = await supabase
      .from("cases")
      .select(
        "id,occurred_on,victims,summary,source_url,source_media,region_id",
      )
      .eq("published", true)
      .eq("region_id", regionId)
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error)
      return Response.json({ error: "gagal memuat data" }, { status: 500 });
    return Response.json({ cases: cases ?? [] }, CACHE);
  }

  // Hanya daerah berkasus yang dikirim. Di client, daerah tak dikenal = 0 kasus.
  const { data: summary, error } = await supabase
    .from("case_summary")
    .select("*")
    .gt("count", 0);
  if (error)
    return Response.json({ error: "gagal memuat data" }, { status: 500 });
  return Response.json({ summary: summary ?? [] }, CACHE);
}
