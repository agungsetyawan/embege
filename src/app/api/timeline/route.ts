import { fetchTimeline } from "@/lib/timeline-data";

// Poisoning-days timeline for the map dialog. Kept separate from /api/cases
// so the dialog chunk + its data only load when the user opens Timeline.
export const dynamic = "force-dynamic";
export const revalidate = 300;

const CACHE = {
  headers: {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  },
};

export async function GET() {
  try {
    const data = await fetchTimeline();
    return Response.json(data, CACHE);
  } catch {
    return Response.json({ error: "failed to load data" }, { status: 500 });
  }
}
