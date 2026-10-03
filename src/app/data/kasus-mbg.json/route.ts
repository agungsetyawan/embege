import { fetchPublicCases } from "@/lib/public-cases";
import { createAnonClient } from "@/lib/supabase/anon";

// Public dataset download. Static, regenerated every 5 minutes.
export const revalidate = 300;

export async function GET() {
  const cases = await fetchPublicCases(createAnonClient()).catch(() => null);
  if (!cases)
    return Response.json({ error: "failed to load data" }, { status: 500 });
  return Response.json({
    generated_at: new Date().toISOString(),
    source: "https://embege-poisoning.vercel.app/",
    note: "Data ini bukan data resmi pemerintah.",
    cases,
  });
}
