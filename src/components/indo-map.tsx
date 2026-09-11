"use client";

import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import type { Map as LeafletMap } from "leaflet";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type SummaryRow = {
  region_id: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
  count: number;
  victims: number;
};

// TODO(future): ganti GeoJSON statis dengan vector tiles kalau sudah terlalu berat.
async function fetchKabupaten(): Promise<FeatureCollection> {
  const res = await fetch("/geojson/kabupaten.geojson");
  if (!res.ok) throw new Error("Gagal memuat batas kab/kota");
  return res.json();
}

// Ringkasan per daerah saja (kecil dan tetap). Detail kasus diambil per daerah saat popup dibuka.
async function fetchSummary(): Promise<{ summary: SummaryRow[] }> {
  const res = await fetch("/api/cases");
  if (!res.ok) throw new Error("Gagal memuat data kasus");
  return res.json();
}

async function fetchRegionCases(
  regionId: string,
): Promise<{ cases: CaseRow[] }> {
  const res = await fetch(`/api/cases?region_id=${regionId}`);
  if (!res.ok) throw new Error("Gagal memuat data kasus");
  return res.json();
}

function fillColor(count: number): string {
  if (count >= 5) return "#dc2626";
  if (count >= 2) return "#f97316";
  if (count >= 1) return "#eab308";
  return "transparent";
}

// Terbang ke kotak daerah berkasus. Nol kasus = biarkan default se-Indonesia.
function FitToCases({ summary }: { summary: SummaryRow[] }) {
  const map = useMap();
  useEffect(() => {
    const active = summary.filter((s) => s.count > 0);
    if (active.length === 0) return;
    const lats = active.map((s) => s.lat);
    const lngs = active.map((s) => s.lng);
    const pad = active.length === 1 ? 1.5 : 0.5;
    map.fitBounds(
      [
        [Math.min(...lats) - pad, Math.min(...lngs) - pad],
        [Math.max(...lats) + pad, Math.max(...lngs) + pad],
      ],
      { padding: [20, 20], animate: false },
    );
  }, [map, summary]);
  return null;
}

function CaseList({ regionId }: { regionId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cases", regionId],
    queryFn: () => fetchRegionCases(regionId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <p className="text-sm">Memuat daftar kasus</p>;
  if (isError || !data)
    return <p className="text-sm">Daftar kasus gagal dimuat.</p>;

  return (
    <div className="flex flex-col">
      {data.cases.map((c) => (
        <div key={c.id} className="border-t py-3 first:border-t-0 first:pt-0">
          <p className="text-xs text-muted-foreground">
            {c.occurred_on ?? "Tanggal belum diketahui"}
            {c.victims !== null && ` · ${c.victims} korban`}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{c.summary}</p>
          <a
            href={c.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm font-medium underline underline-offset-4"
          >
            Sumber: {c.source_media}
          </a>
        </div>
      ))}
    </div>
  );
}

export function IndoMap() {
  const [selected, setSelected] = useState<SummaryRow | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geo = useQuery({
    queryKey: ["batas-kabupaten"],
    queryFn: fetchKabupaten,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const data = useQuery({
    queryKey: ["case-summary"],
    queryFn: fetchSummary,
    staleTime: 5 * 60 * 1000,
  });

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

  const summary = data.data.summary.filter((s) => s.count > 0);
  const byKey = new Map(summary.map((s) => [`${s.province}/${s.district}`, s]));
  const totalCases = summary.reduce((t, s) => t + s.count, 0);
  const totalVictims = summary.reduce((t, s) => t + s.victims, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-sm">
          {totalCases} kasus
        </Badge>
        <Badge variant="secondary" className="text-sm">
          {totalVictims} korban
        </Badge>
      </div>
      <Card className="overflow-hidden p-0">
        <MapContainer
          ref={mapRef}
          center={[-2.5, 118]}
          zoom={5}
          minZoom={5}
          maxZoom={12}
          maxBounds={[
            [-11, 94],
            [6.5, 142],
          ]}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          className="h-[70vh] w-full"
        >
          {/* Esri WorldStreetMap: label Inggris, tanpa API key. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          />
          <FitToCases summary={summary} />
          <GeoJSON
            key="kabupaten"
            data={geo.data}
            style={(feature) => {
              const id = feature?.properties?.id as string | undefined;
              const n = id ? (byKey.get(id)?.count ?? 0) : 0;
              return {
                color: "#2563eb",
                weight: 0.5,
                fillColor: fillColor(n),
                fillOpacity: n > 0 ? 0.5 : 0.05,
              };
            }}
          />
          {summary.map((s) => (
            <CircleMarker
              key={s.region_id}
              center={[s.lat, s.lng]}
              radius={4 + Math.min(s.count * 1.5 + s.victims / 60, 6)}
              pathOptions={{ color: "#dc2626", fillOpacity: 0.7 }}
              eventHandlers={{
                click: () => {
                  setSelected(s);
                  mapRef.current?.panTo([s.lat, s.lng]);
                },
              }}
            />
          ))}
        </MapContainer>
      </Card>
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && (
          <SheetContent className="z-[1001] w-full overflow-y-auto sm:max-w-md">
            <SheetHeader className="text-left">
              <SheetTitle>
                {selected.district}, {selected.province}
              </SheetTitle>
              <SheetDescription>
                {selected.count} kasus · {selected.victims} korban
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <CaseList regionId={selected.region_id} />
            </div>
          </SheetContent>
        )}
      </Sheet>
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
