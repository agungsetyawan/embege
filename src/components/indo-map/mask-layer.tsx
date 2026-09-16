"use client";

import type { FeatureCollection } from "geojson";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";

function toLatLng([lng, lat]: number[]): [number, number] {
  return [lat, lng];
}

// Dim everything outside Indonesia: one world-sized polygon with all
// kabupaten rings as holes. Sits above the tiles but below the overlays.
export function DimOutsideIndonesia({ geo }: { geo: FeatureCollection }) {
  const map = useMap();
  const holes = useMemo<[number, number][][]>(() => {
    const rings: [number, number][][] = [];
    for (const feature of geo.features) {
      const geometry = feature.geometry;
      if (geometry?.type === "Polygon") {
        for (const ring of geometry.coordinates) rings.push(ring.map(toLatLng));
      } else if (geometry?.type === "MultiPolygon") {
        for (const poly of geometry.coordinates)
          for (const ring of poly) rings.push(ring.map(toLatLng));
      }
    }
    return rings;
  }, [geo]);

  useEffect(() => {
    if (holes.length === 0) return;
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
  }, [map, holes]);
  return null;
}
