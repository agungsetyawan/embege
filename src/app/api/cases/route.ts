import { createClient } from "@/lib/supabase/server";

// Data publik peta. RLS tetap berlaku (anon key), hasil di-cache 5 menit
// supaya DB tidak kena tembak tiap pengunjung.
export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  const supabase = await createClient();
  const [{ data: cases, error: e1 }, { data: regions, error: e2 }] =
    await Promise.all([
      supabase
        .from("cases")
        .select(
          "id,occurred_on,victims,summary,source_url,source_media,region_id",
        )
        .eq("published", true),
      supabase.from("regions").select("id,province,district,lat,lng"),
    ]);
  if (e1 || e2) {
    return Response.json({ error: "gagal memuat data" }, { status: 500 });
  }
  return Response.json(
    { cases: cases ?? [], regions: regions ?? [] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
