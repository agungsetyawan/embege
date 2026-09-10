"use client";

import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { TriangleAlert } from "lucide-react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CaseRow = {
  id: string;
  occurred_on: string | null;
  victims: number | null;
  summary: string;
  source_url: string;
  source_media: string;
  region_id: string;
};

type RegionRow = {
  id: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
};

// TODO(future): ganti GeoJSON statis dengan vector tiles kalau sudah terlalu berat.
async function fetchKabupaten(): Promise<FeatureCollection> {
  const res = await fetch("/geojson/kabupaten.geojson");
  if (!res.ok) throw new Error("Gagal memuat batas kab/kota");
  return res.json();
}

async function fetchCases(): Promise<{
  cases: CaseRow[];
  regions: RegionRow[];
}> {
  const res = await fetch("/api/cases");
  if (!res.ok) throw new Error("Gagal memuat data kasus");
  return res.json();
}

function fillColor(count: number): string {
  if (count >= 5) return "#dc2626";
  if (count >= 2) return "#f97316";
  if (count >= 1) return "#eab308";
  return "transparent";
}

export function IndoMap() {
  const geo = useQuery({
    queryKey: ["batas-kabupaten"],
    queryFn: fetchKabupaten,
    staleTime: Infinity,
  });
  const data = useQuery({ queryKey: ["cases"], queryFn: fetchCases });

  if (geo.isLoading || data.isLoading)
    return (
      <output
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label="Memuat peta"
      >
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-[70vh] w-full" />
      </output>
    );
  if (geo.isError || data.isError || !geo.data || !data.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <TriangleAlert className="size-8 text-destructive" />
          <p className="font-medium">Peta gagal dimuat.</p>
          <p className="text-sm text-muted-foreground">
            Periksa koneksi internet, lalu coba lagi.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void geo.refetch();
              void data.refetch();
            }}
          >
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { cases, regions } = data.data;
  const byId = new Map(regions.map((r) => [r.id, r]));
  const counts = new Map<string, number>();
  for (const c of cases)
    counts.set(c.region_id, (counts.get(c.region_id) ?? 0) + 1);
  const totalVictims = cases.reduce((s, c) => s + (c.victims ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-sm">
          {cases.length} kasus
        </Badge>
        <Badge variant="secondary" className="text-sm">
          {totalVictims} korban
        </Badge>
      </div>
      <Card className="overflow-hidden p-0">
        <MapContainer
          center={[-2.5, 118]}
          zoom={5}
          scrollWheelZoom
          className="h-[70vh] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            key="kabupaten"
            data={geo.data}
            style={(feature) => {
              const id = feature?.properties?.id as string | undefined;
              const region = regions.find(
                (r) => `${r.province}/${r.district}` === id,
              );
              const n = region ? (counts.get(region.id) ?? 0) : 0;
              return {
                color: "#2563eb",
                weight: 0.5,
                fillColor: fillColor(n),
                fillOpacity: n > 0 ? 0.5 : 0.05,
              };
            }}
          />
          {[...counts.entries()].map(([regionId, n]) => {
            const r = byId.get(regionId);
            if (!r) return null;
            const list = cases.filter((c) => c.region_id === regionId);
            const victims = list.reduce((s, c) => s + (c.victims ?? 0), 0);
            return (
              <CircleMarker
                key={regionId}
                center={[r.lat, r.lng]}
                radius={6 + Math.min(n * 4 + victims / 20, 14)}
                pathOptions={{ color: "#dc2626", fillOpacity: 0.7 }}
              >
                <Popup>
                  <div className="text-sm leading-relaxed">
                    <strong>
                      {r.district}, {r.province} ({n} kasus)
                    </strong>
                    {list.map((c) => (
                      <div key={c.id} className="mt-2 border-t pt-2">
                        {c.occurred_on ?? "Tanggal belum diketahui"}
                        {c.victims !== null && ` · ${c.victims} korban`}
                        <br />
                        {c.summary}
                        <br />
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline"
                        >
                          Sumber: {c.source_media}
                        </a>
                      </div>
                    ))}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </Card>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          <i className="mr-1 inline-block h-2 w-2 bg-[#eab308]" />1 kasus
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 bg-[#f97316]" />
          2-4 kasus
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 bg-[#dc2626]" />
          5+ kasus
        </span>
      </div>
    </div>
  );
}
