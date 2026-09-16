"use client";

import type { FeatureCollection } from "geojson";
import { useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { FocusRegion } from "./map-helpers";
import { fillColor } from "./severity";
import type { SummaryRow } from "./types";

export function RegionPreview({
  selected,
  geo,
}: {
  selected: SummaryRow;
  geo: FeatureCollection;
}) {
  const id = `${selected.province}/${selected.district}`;
  const feature = useMemo(
    () => geo.features.find((f) => f.properties?.id === id),
    [geo, id],
  );
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
