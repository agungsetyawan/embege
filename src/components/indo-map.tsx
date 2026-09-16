"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Feature, FeatureCollection } from "geojson";
import L, { type Map as LeafletMap } from "leaflet";
import {
  Ambulance,
  ExternalLink,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import { IndoMapSkeleton } from "@/components/indo-map-skeleton";
import { ReportDialog } from "@/components/report-dialog";
import { Alert, AlertAction, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  Cascader,
  CascaderContent,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
  CascaderTrigger,
} from "@/components/reui/cascader/cascader";
import { CascaderItems } from "@/components/reui/cascader/cascader-item";
import {
  CascaderBreadcrumb,
  CascaderInput,
  CascaderNav,
} from "@/components/reui/cascader/cascader-nav";
import type { CascaderNode } from "@/components/reui/cascader/cascader-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { IconTile } from "./reui/icon-tile";

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

// TODO(future): swap the static GeoJSON for vector tiles once it gets too heavy.
async function fetchKabupaten(): Promise<FeatureCollection> {
  const res = await fetch("/geojson/kabupaten.geojson");
  if (!res.ok) throw new Error("Gagal memuat batas kab/kota");
  return res.json();
}

// Per-region summary only (small and stable). Case details are fetched per region when the popup opens.
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

// Same severity classes for dots and clusters, aligned with the legend.
function sevClass(count: number): string {
  if (count >= 5) return "mbg-sev-5";
  if (count >= 2) return "mbg-sev-2";
  return "mbg-sev-1";
}

// One dot per region. Number = that region's case count.
function dotIcon(count: number): L.DivIcon {
  return L.divIcon({
    html: `<div class="mbg-dot ${sevClass(count)}"><span>${count}</span></div>`,
    className: "mbg-dot-wrap",
    iconSize: L.point(26, 26, true),
  });
}

// Dim everything outside Indonesia: one world-sized polygon with all
// kabupaten rings as holes. Sits above the tiles but below the overlays.
function DimOutsideIndonesia({ geo }: { geo: FeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const toLatLng = ([lng, lat]: number[]) => [lat, lng] as [number, number];
    const holes: [number, number][][] = [];
    for (const feature of geo.features) {
      const geometry = feature.geometry;
      if (geometry?.type === "Polygon") {
        for (const ring of geometry.coordinates) holes.push(ring.map(toLatLng));
      } else if (geometry?.type === "MultiPolygon") {
        for (const poly of geometry.coordinates)
          for (const ring of poly) holes.push(ring.map(toLatLng));
      }
    }
    // World-sized outer ring with all kabupaten rings as holes.
    const mask = L.polygon(
      [
        [
          [-90, -180],
          [90, -180],
          [90, 180],
          [-90, 180],
        ],
        ...holes,
      ],
      {
        interactive: false,
        stroke: false,
        fillOpacity: 0.65,
        className: "mbg-outside-dim",
      },
    ).addTo(map);
    return () => void map.removeLayer(mask);
  }, [map, geo]);
  return null;
}

// Fly to the bounding box of regions with cases once on load.
// Zero cases = keep the default Indonesia-wide view. After the user zooms/clicks,
// never steal the frame back (marker clicks re-render the page).
function FitToCases({ summary }: { summary: SummaryRow[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const active = summary.filter((s) => s.count > 0);
    if (active.length === 0) return;
    fitted.current = true;
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

function formatCaseDate(iso: string | null): string {
  if (!iso) return "Tanggal belum diketahui";
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return format(parsed, "d MMMM yyyy", { locale: localeId });
}

function FocusRegion({ feature }: { feature?: Feature }) {
  const map = useMap();
  useEffect(() => {
    if (feature) {
      map.fitBounds(L.geoJSON(feature).getBounds(), { padding: [12, 12] });
    }
  }, [map, feature]);
  return null;
}

function RegionPreview({
  selected,
  geo,
}: {
  selected: SummaryRow;
  geo: FeatureCollection;
}) {
  const id = `${selected.province}/${selected.district}`;
  const feature = geo.features.find((f) => f.properties?.id === id);
  return (
    <MapContainer
      center={[selected.lat, selected.lng]}
      zoom={9}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      zoomControl={false}
      attributionControl={false}
      className="h-40 w-full"
    >
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" />
      <GeoJSON
        data={geo}
        interactive={false}
        style={(f) => {
          const isSelected = f?.properties?.id === id;
          return {
            color: "#2563eb",
            weight: 0.5,
            fillColor: fillColor(selected.count),
            fillOpacity: isSelected ? 0.5 : 0.05,
          };
        }}
      />
      <FocusRegion feature={feature} />
    </MapContainer>
  );
}

function CaseList({ regionId }: { regionId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cases", regionId],
    queryFn: () => fetchRegionCases(regionId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading)
    return (
      <output
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Memuat daftar kasus"
      >
        {["kasus-1", "kasus-2", "kasus-3"].map((id) => (
          <div key={id} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </output>
    );
  if (isError || !data)
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Daftar kasus gagal dimuat.</AlertTitle>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </AlertAction>
      </Alert>
    );
  if (data.cases.length === 0)
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Belum ada kasus untuk daerah ini.
      </p>
    );

  return (
    <ul className="flex flex-col">
      {data.cases.map((c) => (
        <li
          key={c.id}
          className="flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <IconTile variant="soft" size="xs" className="text-destructive">
              <Ambulance />
            </IconTile>
            <span>{formatCaseDate(c.occurred_on)}</span>
            {c.victims !== null && (
              <Badge variant="secondary" size="sm">
                {c.victims.toLocaleString("id-ID")} korban
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed">{c.summary}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={c.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
            >
              <ExternalLink className="size-3.5" />
              {c.source_media}
            </a>
            <ReportDialog caseId={c.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Grouped by province (ReUI Cascader), searchable deep. Same setSelected
// path as a marker click, plus a zoom-in flight.
type RegionSearchNode = CascaderNode<{ count: number }>;

function buildRegionSearchTree(rows: SummaryRow[]): RegionSearchNode[] {
  const byProvince = new Map<string, RegionSearchNode>();
  for (const r of rows) {
    let province = byProvince.get(r.province);
    if (!province) {
      province = {
        value: `prov:${r.province}`,
        label: r.province,
        children: [],
      };
      byProvince.set(r.province, province);
    }
    province.children?.push({
      value: r.region_id,
      label: r.district ?? r.province,
      // label: r.district ? r.district : r.province,
      keywords: [r.district, r.province],
      data: { count: r.count },
    });
  }
  return [...byProvince.values()];
}

function RegionSearch({
  rows,
  onSelect,
}: {
  rows: SummaryRow[];
  onSelect: (s: SummaryRow) => void;
}) {
  const [cascaderKey, setCascaderKey] = useState(0);
  const tree = useMemo(() => buildRegionSearchTree(rows), [rows]);

  return (
    <Cascader
      key={cascaderKey}
      items={tree}
      searchScope="deep"
      onValueChange={(value) => {
        const row = rows.find((r) => r.region_id === value);
        if (row) onSelect(row);
      }}
      onOpenChange={(open) => {
        // Reset query and path so the next open starts clean.
        if (!open) setCascaderKey((k) => k + 1);
      }}
      renderLabel={(node) => {
        const count = (node.data as { count?: number } | undefined)?.count;
        if (count == null || count === 0) return node.label;
        return (
          <span className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{node.label}</span>
            <Badge variant="secondary" size="sm" className="shrink-0">
              {count.toLocaleString("id-ID")} kasus
            </Badge>
          </span>
        );
      }}
      labels={{
        search: (parent) =>
          parent ? `Cari di ${parent}...` : "Cari kabupaten/kota...",
        empty: "Tidak ada daerah yang cocok.",
        back: "Kembali",
      }}
    >
      <CascaderTrigger
        showIcon={false}
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Cari kabupaten/kota"
            className="absolute top-3 right-3 z-1001 size-9 shrink-0 rounded-lg bg-background shadow-md"
          />
        }
      >
        <Search className="size-4" />
      </CascaderTrigger>
      <CascaderContent align="end" className="w-64">
        <CascaderPanel>
          <CascaderNav>
            <CascaderBreadcrumb />
            <CascaderInput />
          </CascaderNav>
          <CascaderEmpty />
          <CascaderList maxHeight={288}>
            <CascaderItems />
          </CascaderList>
          <CascaderStatus />
        </CascaderPanel>
      </CascaderContent>
    </Cascader>
  );
}

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
    staleTime: 5 * 60 * 1000,
  });

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

  const allSummary = data.data.summary;
  const summary = allSummary.filter((s) => s.count > 0);
  const byKey = new Map(summary.map((s) => [`${s.province}/${s.district}`, s]));
  const countByLatLng = new Map(
    summary.map((s) => [`${s.lat},${s.lng}`, s.count]),
  );

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
          className="h-[60vh] md:h-[70vh] w-full"
        >
          {/* Esri WorldStreetMap: English labels, no API key. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          />
          <DimOutsideIndonesia geo={geo.data} />
          <FitToCases summary={summary} />
          <GeoJSON
            key="kabupaten"
            data={geo.data}
            eventHandlers={{
              click: (e) => {
                const s = byKey.get(e.layer.feature?.properties?.id as string);
                if (s) {
                  setSelected(s);
                  mapRef.current?.panTo([s.lat, s.lng]);
                }
              },
            }}
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
          <MarkerClusterGroup
            chunkedLoading
            showCoverageOnHover={false}
            iconCreateFunction={(cluster) => {
              const total = cluster.getAllChildMarkers().reduce((t, m) => {
                const ll = m.getLatLng();
                return t + (countByLatLng.get(`${ll.lat},${ll.lng}`) ?? 0);
              }, 0);
              const size = total >= 100 ? 46 : total >= 10 ? 40 : 34;
              return L.divIcon({
                html: `<div class="mbg-cluster ${sevClass(total)}"><span>${total}</span></div>`,
                className: "mbg-cluster-wrap",
                iconSize: L.point(size, size, true),
              });
            }}
          >
            {summary.map((s) => (
              <Marker
                key={s.region_id}
                position={[s.lat, s.lng]}
                icon={dotIcon(s.count)}
                title={`${s.count} kasus di ${s.district}, ${s.province}`}
                eventHandlers={{
                  click: () => {
                    setSelected(s);
                    mapRef.current?.panTo([s.lat, s.lng]);
                  },
                }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
        {!selected && (
          <RegionSearch
            rows={allSummary}
            onSelect={(s) => {
              setSelected(s);
              mapRef.current?.flyTo(
                [s.lat, s.lng],
                Math.max(mapRef.current.getZoom(), 9),
              );
            }}
          />
        )}
      </Card>
      <Drawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        {selected && (
          <DrawerContent className="w-full sm:max-w-md">
            <DrawerHeader className="pb-4 shadow-sm">
              <DrawerTitle>
                {selected.district}, {selected.province}
              </DrawerTitle>
              {selected.count > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  <Badge variant="destructive-light">
                    <Ambulance />
                    {selected.count.toLocaleString("id-ID")} kasus
                  </Badge>
                  <Badge variant="secondary">
                    <Users />
                    {selected.victims.toLocaleString("id-ID")} korban
                  </Badge>
                </div>
              )}
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <div className="mb-4 overflow-hidden rounded-lg border">
                <RegionPreview selected={selected} geo={geo.data} />
              </div>
              <CaseList regionId={selected.region_id} />
            </div>
          </DrawerContent>
        )}
      </Drawer>
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
