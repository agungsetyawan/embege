"use client";

import type { Feature } from "geojson";
import L from "leaflet";
import { Info, Maximize, Minimize, Minus, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { IconTile } from "../reui/icon-tile";
import type { SummaryRow } from "./types";

// Fly to the bounding box of regions with cases once on load.
// Zero cases = keep the default Indonesia-wide view. After the user zooms/clicks,
// never steal the frame back (marker clicks re-render the page).
export function FitToCases({ summary }: { summary: SummaryRow[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const active = summary.filter((s) => s.count > 0);
    if (active.length === 0) return;
    fitted.current = true;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const s of active) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lng < minLng) minLng = s.lng;
      if (s.lng > maxLng) maxLng = s.lng;
    }
    const pad = active.length === 1 ? 1.5 : 0.5;
    map.fitBounds(
      [
        [minLat - pad, minLng - pad],
        [maxLat + pad, maxLng + pad],
      ],
      { padding: [20, 20], animate: false },
    );
  }, [map, summary]);
  return null;
}

export function FocusRegion({ feature }: { feature?: Feature }) {
  const map = useMap();
  useEffect(() => {
    if (feature)
      map.fitBounds(L.geoJSON(feature).getBounds(), { padding: [12, 12] });
  }, [map, feature]);
  return null;
}

// Reports when the Leaflet instance exists. Lives inside the MapContainer so
// useMap() guarantees the instance: no ref-timing gamble (the forwarded ref
// on MapContainer only resolves a commit after mount).
export function MapReadyProbe({ onReady }: { onReady: () => void }) {
  // Mounted only once the Leaflet instance exists (MapContainer renders
  // children after creating it), so a mount effect is the ready signal.
  useMap();
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

// Custom zoom buttons (ReUI IconTile). Lives inside the MapContainer so
// useMap() guarantees the instance: no ref-timing gamble, zoom state syncs.
export function MapZoomControl() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [limits, setLimits] = useState({
    min: map.getMinZoom(),
    max: map.getMaxZoom(),
  });
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sync = () => {
      setZoom(map.getZoom());
      setLimits({ min: map.getMinZoom(), max: map.getMaxZoom() });
    };
    sync();
    map.on("zoomend zoomlevelschange", sync);
    return () => void map.off("zoomend zoomlevelschange", sync);
  }, [map]);
  // Clicks/scrolls over the buttons must not drag or zoom the map itself.
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);
  const atMin = zoom <= limits.min;
  const atMax = zoom >= limits.max;

  return (
    <div
      ref={boxRef}
      className="absolute right-3 bottom-3 z-1000 flex flex-col overflow-hidden rounded-lg border bg-background shadow-md"
    >
      <IconTile
        variant="outline"
        size="sm"
        className="rounded-none border-0 shadow-none disabled:opacity-50 dark:bg-background"
        render={
          <button
            type="button"
            aria-label="Perbesar peta"
            disabled={atMax}
            onClick={() => map.zoomIn()}
          />
        }
      >
        <Plus />
      </IconTile>
      <IconTile
        variant="outline"
        size="sm"
        className="rounded-none border-0 border-t shadow-none disabled:opacity-50 dark:bg-background"
        render={
          <button
            type="button"
            aria-label="Perkecil peta"
            disabled={atMin}
            onClick={() => map.zoomOut()}
          />
        }
      >
        <Minus />
      </IconTile>
    </div>
  );
}

// Basemap follows the app theme: Esri Canvas Light/Dark Gray, key-free.
interface BasemapTiles {
  id: string;
  url: string;
  overlayUrl: string;
  attribution: string;
}

const ESRI_ATTR =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export function resolveBasemap(isDark: boolean): BasemapTiles {
  const shade = isDark ? "Dark" : "Light";
  return {
    id: shade,
    url: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${shade}_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    overlayUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${shade}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
  };
}

// Expand toggle, top-right: pseudo-fullscreen via CSS class so it works on
// iOS Safari (no Fullscreen API on iPhone) and Esc closes the drawer first.
// Lives inside the MapContainer so useMap() gives the instance for
// invalidateSize().
export function MapToolbar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const map = useMap();
  const { resolvedTheme, setTheme } = useTheme();
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run on every toggle so Leaflet remeasures after the class changes
  useEffect(() => {
    map.invalidateSize();
  }, [map, expanded]);

  return (
    <div
      ref={boxRef}
      className="absolute top-3 right-3 z-1000 flex flex-col gap-2"
    >
      <IconTile
        variant="outline"
        size="sm"
        className="shrink-0 shadow-md dark:bg-background"
        render={
          <button
            type="button"
            aria-label="Ganti tema gelap/terang"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          />
        }
      >
        <Sun className="hidden size-4 dark:block" />
        <Moon className="size-4 dark:hidden" />
      </IconTile>
      <IconTile
        variant="outline"
        size="sm"
        className="shrink-0 shadow-md dark:bg-background"
        render={
          <button
            type="button"
            aria-label={expanded ? "Keluar layar penuh" : "Mode layar penuh"}
            aria-expanded={expanded}
            onClick={onToggle}
          />
        }
      >
        {expanded ? (
          <Minimize className="size-4" />
        ) : (
          <Maximize className="size-4" />
        )}
      </IconTile>
    </div>
  );
}

// Tile credits behind an info button (hover reveals on desktop, tap toggles
// on touch). Keep visible: Esri tiles require credit.
export function MapAttributionControl() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);
  return (
    <div
      ref={boxRef}
      className="group absolute bottom-3 left-3 z-1000 flex flex-col items-start gap-1.5"
    >
      <div
        role="note"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static first-party Esri credit, no user input
        dangerouslySetInnerHTML={{ __html: ESRI_ATTR }}
        className={`max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-[11px] leading-relaxed text-popover-foreground shadow-md transition-opacity [&_a]:underline ${
          open
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
        }`}
      />
      <IconTile
        variant="outline"
        size="sm"
        className="shrink-0 shadow-md dark:bg-background"
        render={
          <button
            type="button"
            aria-label="Atribusi data peta"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          />
        }
      >
        <Info className="size-4" />
      </IconTile>
    </div>
  );
}
