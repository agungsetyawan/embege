import type { FeatureCollection } from "geojson";
import type { CaseRow, SummaryRow } from "./types";

export const CASE_STALE_TIME = 5 * 60 * 1000;

// TODO(future): swap the static GeoJSON for vector tiles once it gets too heavy.
export async function fetchKabupaten(): Promise<FeatureCollection> {
  const res = await fetch("/geojson/kabupaten.geojson");
  if (!res.ok) throw new Error("Gagal memuat batas kab/kota");
  return res.json();
}

// Per-region summary only (small and stable). Case details are fetched per region when the popup opens.
export async function fetchSummary(): Promise<{ summary: SummaryRow[] }> {
  const res = await fetch("/api/cases");
  if (!res.ok) throw new Error("Gagal memuat data kasus");
  return res.json();
}

export async function fetchRegionCases(
  regionId: string,
): Promise<{ cases: CaseRow[] }> {
  const res = await fetch(`/api/cases?region_id=${regionId}`);
  if (!res.ok) throw new Error("Gagal memuat data kasus");
  return res.json();
}
