"use client";

import type { FeatureCollection } from "geojson";
import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { onIdle } from "@/lib/idle";

function toLatLng([lng, lat]: number[]): [number, number] {
  return [lat, lng];
}

// Dim everything outside Indonesia: one world-sized polygon with all
// district rings as holes. Sits above the tiles but below the overlays.
// Computed on idle so the 708KB GeoJSON walk stays off first paint.
export function DimOutsideIndonesia({ geo }: { geo: FeatureCollection }) {
  const map = useMap();

  useEffect(() => {
    let mask: L.Polygon | null = null;
    const cancel = onIdle(() => {
      const holes: [number, number][][] = [];
      for (const feature of geo.features) {
        const geometry = feature.geometry;
        if (geometry?.type === "Polygon") {
          for (const ring of geometry.coordinates)
            holes.push(ring.map(toLatLng));
        } else if (geometry?.type === "MultiPolygon") {
          for (const poly of geometry.coordinates)
            for (const ring of poly) holes.push(ring.map(toLatLng));
        }
      }
      if (holes.length === 0) return;
      // World-sized outer ring with all district rings as holes.
      mask = L.polygon(
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
    });
    return () => {
      cancel();
      if (mask) map.removeLayer(mask);
    };
  }, [map, geo]);
  return null;
}
