import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

// Per-date aggregation of published cases, newest first. Powers the day
// counters. Accepts an optional ?region_id= filter for a single region's
// history; an invalid id yields an empty timeline.
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
  if (regionId && !isUuid(regionId)) {
    return Response.json({ timeline: [], unknownDate: 0, future: 0 }, CACHE);
  }

  // One row per published case, aggregated per date below.
  // WIB is fixed at UTC+7 (no DST), so "today" can be derived from UTC.
  const today = new Date(Date.now() + 7 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  let query = supabase
    .from("cases")
    .select("occurred_on,victims,regions(province,district)")
    .eq("published", true)
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false, nullsFirst: false });
  if (regionId) query = query.eq("region_id", regionId);
  const { data: rows, error } = await query;
  if (error)
    return Response.json({ error: "gagal memuat data" }, { status: 500 });

  const days = new Map<
    string,
    {
      cases: number;
      victims: number;
      areas: Map<
        string,
        { province: string; district: string; victims: number }
      >;
    }
  >();
  let unknownDate = 0;
  let future = 0;
  for (const row of rows ?? []) {
    const date = row.occurred_on;
    if (!date) {
      unknownDate += 1;
      continue;
    }
    if (date > today) {
      future += 1;
      continue;
    }
    let day = days.get(date);
    if (!day) {
      day = { cases: 0, victims: 0, areas: new Map() };
      days.set(date, day);
    }
    day.cases += 1;
    day.victims += row.victims ?? 0;
    const region = Array.isArray(row.regions) ? row.regions[0] : row.regions;
    const key = `${region?.province ?? "?"}//${region?.district ?? "?"}`;
    const area = day.areas.get(key) ?? {
      province: region?.province ?? "Wilayah tak dikenal",
      district: region?.district ?? "",
      victims: 0,
    };
    area.victims += row.victims ?? 0;
    day.areas.set(key, area);
  }
  const timeline = [...days.entries()].map(([date, day]) => ({
    date,
    cases: day.cases,
    victims: day.victims,
    areas: [...day.areas.values()].sort((a, b) => b.victims - a.victims),
  }));
  return Response.json({ timeline, unknownDate, future }, CACHE);
}
