import type { FeatureCollection } from "geojson";
import type { CaseRow, SummaryRow } from "./types";

export const CASE_STALE_TIME = 5 * 60 * 1000;

// TODO(future): swap the static GeoJSON for vector tiles once it gets too heavy.
export async function fetchDistricts(): Promise<FeatureCollection> {
  const res = await fetch("/geojson/districts.geojson");
  if (!res.ok) throw new Error("Failed to load district boundaries");
  return res.json();
}

// Per-region summary only (small and stable). Case details are fetched per region when the popup opens.
export async function fetchSummary(): Promise<{ summary: SummaryRow[] }> {
  const res = await fetch("/api/cases");
  if (!res.ok) throw new Error("Failed to load case data");
  return res.json();
}

export async function fetchRegionCases(
  regionId: string,
): Promise<{ cases: CaseRow[] }> {
  const res = await fetch(`/api/cases?region_id=${regionId}`);
  if (!res.ok) throw new Error("Failed to load case data");
  return res.json();
}
