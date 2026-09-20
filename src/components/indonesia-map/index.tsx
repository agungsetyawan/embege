"use client";

import { useQuery } from "@tanstack/react-query";
import L, { type Map as LeafletMap } from "leaflet";
import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useMediaQuery } from "@/hooks/use-media-query";
import { isDateString, isUuid } from "@/lib/validate";
import { IndonesiaMapSkeleton } from "../indonesia-map-skeleton";
import { Alert, AlertAction, AlertTitle } from "../reui/alert";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CASE_STALE_TIME, fetchDistricts, fetchSummary } from "./api";
import { MapLegend } from "./legend";
import {
  FitToCases,
  MapAttributionControl,
  MapReadyProbe,
  MapToolbar,
  MapZoomControl,
  resolveBasemap,
} from "./map-helpers";
import { DimOutsideIndonesia } from "./mask-layer";
import { DistrictLayer } from "./region-layer";
import { RegionMarkers } from "./region-markers";
import { RegionSearch } from "./region-search";
import type { SummaryRow } from "./types";

const RegionDetailDrawer = dynamic(
  () => import("./region-detail-drawer").then((m) => m.RegionDetailDrawer),
  { ssr: false },
);

// Timeline pill + dialog content (DataGrid, chart) outside the map first paint.
const TimelineHistoryDialog = dynamic(
  () =>
    import("./timeline-history-dialog").then((m) => m.TimelineHistoryDialog),
  { ssr: false },
);

function isDateParam(value: string | null): value is string {
  if (!value || !isDateString(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

// Reports ?region_id=&date= changes (set by the timeline dialog, or by a
// shared link). useSearchParams needs a Suspense boundary, hence the split.
function MapUrlSync({
  onParams,
}: {
  onParams: (regionId: string | null, date: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const regionId = searchParams.get("region_id");
  const date = searchParams.get("date");
  useEffect(() => {
    onParams(regionId, date);
  }, [regionId, date, onParams]);
  return null;
}

export function IndonesiaMap() {
  const [selected, setSelected] = useState<SummaryRow | null>(null);
  // Date from ?date= whose cases are highlighted in the drawer.
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  // Last ?region_id=&date= combo already applied; prevents re-flying.
  const appliedUrlRef = useRef<string | null>(null);
  // The forwarded MapContainer ref only resolves a commit after mount, so
  // the URL flight waits for this probe instead of gambling on ref timing.
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => setMapReady(true), []);
  const mapRef = useRef<LeafletMap | null>(null);
  // Card element: portal container for search + drawer so both stay
  // visible in full-map mode.
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  // Pseudo-fullscreen via CSS class: works on iOS Safari (no Fullscreen API
  // on iPhone) and Esc reaches the page so the drawer closes first.
  const [expanded, setExpanded] = useState(false);
  // Esc order: drawer/dialog open = let them close themselves, otherwise
  // exit expanded.
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected === null && !historyOpen)
        setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, selected, historyOpen]);
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
    queryKey: ["district-boundaries"],
    queryFn: fetchDistricts,
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

  const handleSelectDot = useCallback(
    (s: SummaryRow) => {
      // Manual picks own the drawer: drop any URL-driven highlight.
      setHighlightDate(null);
      appliedUrlRef.current = null;
      router.replace(pathname, { scroll: false });
      setSelected(s);
      mapRef.current?.panTo([s.lat, s.lng]);
    },
    [router, pathname],
  );

  // Search: drawer waits for the flyTo animation to finish (moveend +
  // fallback timeout when moveend never fires, e.g. already at the location).
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
      // ponytail: 0.8s flyTo duration + margin, not a generic debounce.
      const timer = setTimeout(open, 1000);
      flightCleanupRef.current = () => {
        map.off("moveend", open);
        clearTimeout(timer);
      };
      // Zoom follows the district polygon; fall back to the point when
      // the feature is not found.
      const feature = geo.data?.features.find(
        (f) => f.properties?.id === `${s.province}/${s.district}`,
      );
      if (feature) {
        map.flyToBounds(L.geoJSON(feature).getBounds(), {
          // Shift the apparent center out of the drawer area: right on
          // desktop, bottom on mobile. Drawer size: sm:max-w-md (448px) + margin.
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

  // Timeline dialog (or a shared link) drives the map through the URL.
  // Same flight as search, plus the highlight date for the drawer.
  const applyFromUrl = useCallback(
    (regionId: string | null, date: string | null) => {
      // No retry mark before the map exists: the flight needs the instance.
      if (!mapReady) return;
      if (!regionId || !isUuid(regionId)) {
        appliedUrlRef.current = null;
        return;
      }
      const validDate = isDateParam(date) ? date : null;
      const key = `${regionId}//${validDate ?? ""}`;
      if (appliedUrlRef.current === key) return;
      const row = allSummary.find((s) => s.region_id === regionId);
      if (!row) return;
      appliedUrlRef.current = key;
      setHighlightDate(validDate);
      handleSelectSearch(row);
      // The click happened up in the stats cards; bring the map into view.
      cardEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [allSummary, handleSelectSearch, cardEl, mapReady],
  );

  const handleCloseDrawer = useCallback(() => {
    setSelected(null);
    setHighlightDate(null);
    appliedUrlRef.current = null;
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  if (geo.isLoading || data.isLoading) return <IndonesiaMapSkeleton />;
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
    <div className="flex flex-col gap-3 lg:h-full">
      <Suspense fallback={null}>
        <MapUrlSync onParams={applyFromUrl} />
      </Suspense>
      <Card
        ref={setCardEl}
        className={`mbg-map-card relative gap-0 overflow-hidden rounded-none p-0 md:rounded-xl lg:flex-1 lg:min-h-0 ${
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
          className="mbg-map h-[72vh] md:h-[75vh] lg:h-full w-full"
        >
          <TileLayer
            key={tiles.id}
            attribution={tiles.attribution}
            url={tiles.url}
          />
          <TileLayer url={tiles.overlayUrl} />
          <DimOutsideIndonesia geo={geo.data} />
          <FitToCases summary={summary} />
          <MapReadyProbe onReady={handleMapReady} />
          <DistrictLayer
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
        <TimelineHistoryDialog
          container={cardEl ?? undefined}
          onOpenChange={setHistoryOpen}
        />
        {!selected && (
          <RegionSearch
            rows={allSummary}
            container={cardEl ?? undefined}
            onSelect={handleSelectSearch}
          />
        )}
        <div className="absolute bottom-3 left-3 z-1000">
          <MapLegend />
        </div>
      </Card>
      <RegionDetailDrawer
        selected={selected}
        highlightDate={highlightDate}
        geo={geo.data}
        isDesktop={isDesktop}
        container={cardEl ?? undefined}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
