"use client";

import type * as L from "leaflet";
import { Marker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import { clusterIcon, dotIcon } from "./severity";
import type { SummaryRow } from "./types";

export function RegionMarkers({
  summary,
  countByLatLng,
  onSelect,
}: {
  summary: SummaryRow[];
  countByLatLng: Map<string, number>;
  onSelect: (s: SummaryRow) => void;
}) {
  const createClusterIcon = (cluster: L.MarkerCluster) => {
    const total = cluster.getAllChildMarkers().reduce((t, m) => {
      const ll = m.getLatLng();
      return t + (countByLatLng.get(`${ll.lat},${ll.lng}`) ?? 0);
    }, 0);
    return clusterIcon(total);
  };

  return (
    <MarkerClusterGroup
      chunkedLoading
      showCoverageOnHover={false}
      iconCreateFunction={createClusterIcon}
    >
      {summary.map((s) => (
        <Marker
          key={s.region_id}
          position={[s.lat, s.lng]}
          icon={dotIcon(s.count)}
          title={`${s.count} kasus di ${s.district}, ${s.province}`}
          eventHandlers={{ click: () => onSelect(s) }}
        />
      ))}
    </MarkerClusterGroup>
  );
}
