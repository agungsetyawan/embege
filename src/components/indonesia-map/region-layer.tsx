"use client";

import type { FeatureCollection } from "geojson";
import { memo } from "react";
import { GeoJSON } from "react-leaflet";
import { fillColor } from "./severity";
import type { SummaryRow } from "./types";

// memo: a new style function makes react-leaflet call setStyle on all 515
// paths. Without it every map state change (theme, full-map, drawer) costs
// ~400 ms at 4x CPU throttling.
export const DistrictLayer = memo(function DistrictLayer({
  geo,
  byKey,
  maxCount,
  onSelect,
}: {
  geo: FeatureCollection;
  byKey: Map<string, SummaryRow>;
  maxCount: number;
  onSelect: (s: SummaryRow) => void;
}) {
  return (
    <GeoJSON
      key="districts"
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
          fillColor: fillColor(n, maxCount),
          fillOpacity: n > 0 ? 0.5 : 0.05,
        };
      }}
    />
  );
});
