"use client";

import type { Feature } from "geojson";
import L from "leaflet";
import { Minus, Plus } from "lucide-react";
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
      className="absolute right-3 bottom-5 z-1000 flex flex-col overflow-hidden rounded-lg border bg-background shadow-md"
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
