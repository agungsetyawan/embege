import L from "leaflet";

export function fillColor(count: number): string {
  if (count >= 5) return "#dc2626";
  if (count >= 2) return "#f97316";
  if (count >= 1) return "#eab308";
  return "transparent";
}

// Same severity classes for dots and clusters, aligned with the legend.
export function sevClass(count: number): string {
  if (count >= 5) return "mbg-sev-5";
  if (count >= 2) return "mbg-sev-2";
  return "mbg-sev-1";
}

const dotCache = new Map<number, L.DivIcon>();

// One dot per region. Number = that region's case count. Cached per count
// so re-renders reuse the icon instead of rebuilding DOM strings.
export function dotIcon(count: number): L.DivIcon {
  const cached = dotCache.get(count);
  if (cached) return cached;
  const icon = L.divIcon({
    html: `<div class="mbg-dot ${sevClass(count)}"><span>${count}</span></div>`,
    className: "mbg-dot-wrap",
    iconSize: L.point(26, 26, true),
  });
  dotCache.set(count, icon);
  return icon;
}

export function clusterIcon(total: number): L.DivIcon {
  const size = total >= 100 ? 46 : total >= 10 ? 40 : 34;
  return L.divIcon({
    html: `<div class="mbg-cluster ${sevClass(total)}"><span>${total}</span></div>`,
    className: "mbg-cluster-wrap",
    iconSize: L.point(size, size, true),
  });
}
