"use client";

import { useQuery } from "@tanstack/react-query";
import type { Map as LeafletMap } from "leaflet";
import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMediaQuery } from "@/hooks/use-media-query";
import { IndoMapSkeleton } from "../indo-map-skeleton";
import { Alert, AlertAction, AlertTitle } from "../reui/alert";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CASE_STALE_TIME, fetchKabupaten, fetchSummary } from "./api";
import { MapLegend } from "./legend";
import { FitToCases, MapZoomControl } from "./map-helpers";
import { DimOutsideIndonesia } from "./mask-layer";
import { KabupatenLayer } from "./region-layer";
import { RegionMarkers } from "./region-markers";
import { RegionSearch } from "./region-search";
import type { SummaryRow } from "./types";

const RegionDetailDrawer = dynamic(
  () => import("./region-detail-drawer").then((m) => m.RegionDetailDrawer),
  { ssr: false },
);

export function IndoMap() {
  const [selected, setSelected] = useState<SummaryRow | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const geo = useQuery({
    queryKey: ["batas-kabupaten"],
    queryFn: fetchKabupaten,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const data = useQuery({
    queryKey: ["case-summary"],
    queryFn: fetchSummary,
    staleTime: CASE_STALE_TIME,
  });

  const allSummary = useMemo(() => data.data?.summary ?? [], [data.data]);
  const summary = useMemo(
    () => allSummary.filter((s) => s.count > 0),
    [allSummary],
  );
  const byKey = useMemo(
    () => new Map(summary.map((s) => [`${s.province}/${s.district}`, s])),
    [summary],
  );
  const countByLatLng = useMemo(
    () => new Map(summary.map((s) => [`${s.lat},${s.lng}`, s.count])),
    [summary],
  );

  const handleSelectDot = useCallback((s: SummaryRow) => {
    setSelected(s);
    mapRef.current?.panTo([s.lat, s.lng]);
  }, []);

  const handleSelectSearch = useCallback((s: SummaryRow) => {
    setSelected(s);
    mapRef.current?.flyTo(
      [s.lat, s.lng],
      Math.max(mapRef.current.getZoom(), 9),
    );
  }, []);

  if (geo.isLoading || data.isLoading) return <IndoMapSkeleton />;
  if (geo.isError || data.isError || !geo.data || !data.data) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Peta gagal dimuat.</AlertTitle>
        <AlertAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void geo.refetch();
              void data.refetch();
            }}
          >
            Coba lagi
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="relative overflow-hidden p-0">
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
          zoomControl={false}
          className="h-[60vh] md:h-[70vh] w-full"
        >
          {/* Esri WorldStreetMap: English labels, no API key. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          />
          <DimOutsideIndonesia geo={geo.data} />
          <FitToCases summary={summary} />
          <KabupatenLayer
            geo={geo.data}
            byKey={byKey}
            onSelect={handleSelectDot}
          />
          <RegionMarkers
            summary={summary}
            countByLatLng={countByLatLng}
            onSelect={handleSelectDot}
          />
          <MapZoomControl />
        </MapContainer>
        {!selected && (
          <RegionSearch rows={allSummary} onSelect={handleSelectSearch} />
        )}
      </Card>
      <RegionDetailDrawer
        selected={selected}
        geo={geo.data}
        isDesktop={isDesktop}
        onClose={() => setSelected(null)}
      />
      <MapLegend />
    </div>
  );
}
