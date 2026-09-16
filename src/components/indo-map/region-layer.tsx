"use client";

import type { FeatureCollection } from "geojson";
import { GeoJSON } from "react-leaflet";
import { fillColor } from "./severity";
import type { SummaryRow } from "./types";

export function KabupatenLayer({
  geo,
  byKey,
  onSelect,
}: {
  geo: FeatureCollection;
  byKey: Map<string, SummaryRow>;
  onSelect: (s: SummaryRow) => void;
}) {
  return (
    <GeoJSON
      key="kabupaten"
      data={geo}
      eventHandlers={{
        click: (e) => {
          const s = byKey.get(e.layer.feature?.properties?.id as string);
          if (s) onSelect(s);
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
  );
}
