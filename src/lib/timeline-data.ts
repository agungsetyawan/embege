import { createAnonClient } from "@/lib/supabase/anon";
import {
  type TimelineArea,
  type TimelineDay,
  type TimelineResponse,
  todayWIB,
} from "@/lib/timeline";

// One row per published case, aggregated per date below.
export async function fetchTimeline(): Promise<TimelineResponse> {
  const supabase = createAnonClient();
  const today = todayWIB();
  const { data: rows, error } = await supabase
    .from("cases")
    .select("occurred_on,victims,region_id,regions(province,district)")
    .eq("published", true)
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false, nullsFirst: false });
  if (error) throw new Error("Failed to load day data");

  const days = new Map<
    string,
    { cases: number; victims: number; areas: Map<string, TimelineArea> }
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
    const regionId = row.region_id ?? null;
    const key =
      regionId ?? `${region?.province ?? "?"}//${region?.district ?? "?"}`;
    const area = day.areas.get(key) ?? {
      region_id: regionId,
      province: region?.province ?? "Wilayah tak dikenal",
      district: region?.district ?? "",
      victims: 0,
    };
    area.victims += row.victims ?? 0;
    day.areas.set(key, area);
  }
  const timeline: TimelineDay[] = [...days.entries()].map(([date, day]) => ({
    date,
    cases: day.cases,
    victims: day.victims,
    areas: [...day.areas.values()].sort((a, b) => b.victims - a.victims),
  }));
  return { timeline, unknownDate, future };
}
