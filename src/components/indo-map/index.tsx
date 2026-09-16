"use client";

import { useQuery } from "@tanstack/react-query";
import L, { type Map as LeafletMap } from "leaflet";
import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMediaQuery } from "@/hooks/use-media-query";
import { IndoMapSkeleton } from "../indo-map-skeleton";
import { Alert, AlertAction, AlertTitle } from "../reui/alert";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CASE_STALE_TIME, fetchKabupaten, fetchSummary } from "./api";
import { MapLegend } from "./legend";
import {
  FitToCases,
  MapAttributionControl,
  MapToolbar,
  MapZoomControl,
  resolveBasemap,
} from "./map-helpers";
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
  // Elemen kartu: container portal search + drawer agar keduanya ikut
  // terlihat saat mode peta penuh.
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  // Pseudo-fullscreen via CSS class: works on iOS Safari (no Fullscreen API
  // on iPhone) and Esc reaches the page so the drawer closes first.
  const [expanded, setExpanded] = useState(false);
  // Esc order: drawer open = let it close itself, otherwise exit expanded.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected === null) setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, selected]);
  // Lock background scroll while expanded.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);
  const { resolvedTheme } = useTheme();
  const tiles = resolveBasemap(resolvedTheme === "dark");
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

  // Search: drawer menunggu animasi flyTo selesai (moveend + fallback
  // timeout bila moveend tidak tembak, mis. sudah di lokasi).
  const flightCleanupRef = useRef<(() => void) | null>(null);

  const handleSelectSearch = useCallback(
    (s: SummaryRow) => {
      const map = mapRef.current;
      if (!map) {
        setSelected(s);
        return;
      }
      flightCleanupRef.current?.();
      const open = () => {
        flightCleanupRef.current?.();
        flightCleanupRef.current = null;
        setSelected(s);
      };
      map.once("moveend", open);
      // ponytail: durasi flyTo 0.8 dtk + margin, bukan debounce generik.
      const timer = setTimeout(open, 1000);
      flightCleanupRef.current = () => {
        map.off("moveend", open);
        clearTimeout(timer);
      };
      // Zoom mengikuti poligon kabupaten/kota; fallback ke titik bila
      // feature tidak ketemu.
      const feature = geo.data?.features.find(
        (f) => f.properties?.id === `${s.province}/${s.district}`,
      );
      if (feature) {
        map.flyToBounds(L.geoJSON(feature).getBounds(), {
          // Geser tengah semu keluar dari area drawer: kanan di desktop,
          // bawah di mobile. Angka drawer: sm:max-w-md (448px) + margin.
          paddingTopLeft: [32, 32],
          paddingBottomRight: isDesktop ? [480, 48] : [32, 360],
          maxZoom: 11,
          duration: 0.8,
        });
      } else {
        map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 9), {
          duration: 0.8,
        });
      }
    },
    [geo.data, isDesktop],
  );

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
      <Card
        ref={setCardEl}
        className={`mbg-map-card relative overflow-hidden p-0 ${
          expanded ? "mbg-map-card--expanded" : ""
        }`}
      >
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
          attributionControl={false}
          className="mbg-map h-[60vh] md:h-[70vh] w-full"
        >
          <TileLayer
            key={tiles.id}
            attribution={tiles.attribution}
            url={tiles.url}
          />
          <TileLayer url={tiles.overlayUrl} />
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
          <MapToolbar
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
          />
          <MapAttributionControl />
        </MapContainer>
        {!selected && (
          <RegionSearch
            rows={allSummary}
            container={cardEl ?? undefined}
            onSelect={handleSelectSearch}
          />
        )}
      </Card>
      <RegionDetailDrawer
        selected={selected}
        geo={geo.data}
        isDesktop={isDesktop}
        container={cardEl ?? undefined}
        onClose={() => setSelected(null)}
      />
      <MapLegend />
    </div>
  );
}
