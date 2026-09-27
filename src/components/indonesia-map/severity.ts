import L from "leaflet";

// Gradient stops: yellow (fewest cases) -> orange -> red (most cases).
const STOPS = ["#eab308", "#f97316", "#dc2626"] as const;

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Position on the gradient: 1 case is yellow (0), max is red (1). Log scale
// because case counts are skewed (1 vs 100+); totals above max clamp to red.
function severityT(count: number, max: number): number {
  if (max <= 1 || count <= 1) return 0;
  const t = Math.log((count + 1) / 2) / Math.log((max + 1) / 2);
  return Math.min(1, Math.max(0, t));
}

function severityRgb(count: number, max: number): Rgb {
  const t = severityT(count, max);
  const [a, b] = t < 0.5 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return [r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f];
}

export function severityColor(count: number, max: number): string {
  return toHex(severityRgb(count, max));
}

// Glyph color on the gradient fill: dark on yellow, white once past orange.
export function severityText(count: number, max: number): string {
  const [r, g, b] = severityRgb(count, max).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#422006" : "#fff";
}

export function fillColor(count: number, max: number): string {
  if (count <= 0) return "transparent";
  return severityColor(count, max);
}

const dotCache = new Map<string, L.DivIcon>();

// One dot per region. Number = that region's case count. Cached per
// count+max so re-renders reuse the icon instead of rebuilding DOM strings.
export function dotIcon(count: number, max: number): L.DivIcon {
  const key = `${count}|${max}`;
  const cached = dotCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    html: `<div class="mbg-dot" style="background-color:${severityColor(count, max)};color:${severityText(count, max)}"><span>${count}</span></div>`,
    className: "mbg-dot-wrap",
    iconSize: L.point(26, 26, true),
  });
  dotCache.set(key, icon);
  return icon;
}

export function clusterIcon(total: number, max: number): L.DivIcon {
  const size = total >= 100 ? 46 : total >= 10 ? 40 : 34;
  return L.divIcon({
    html: `<div class="mbg-cluster" style="background-color:${severityColor(total, max)};color:${severityText(total, max)}"><span>${total}</span></div>`,
    className: "mbg-cluster-wrap",
    iconSize: L.point(size, size, true),
  });
}
