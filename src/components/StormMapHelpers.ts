import type { HomeBase } from "../lib/homeBase";

export const CITIES = [
  { name: "OKC", lat: 35.47, lng: -97.52 },
  { name: "DFW", lat: 32.78, lng: -96.8 },
  { name: "Denver", lat: 39.74, lng: -104.99 },
  { name: "Chicago", lat: 41.88, lng: -87.63 },
  { name: "Atlanta", lat: 33.75, lng: -84.39 },
  { name: "Omaha", lat: 41.26, lng: -95.94 },
  { name: "St Louis", lat: 38.63, lng: -90.2 },
  { name: "Memphis", lat: 35.15, lng: -90.05 },
  { name: "Wichita", lat: 37.69, lng: -97.34 },
  { name: "Amarillo", lat: 35.22, lng: -101.83 },
];

export const RADAR_FRAMES = [
  "m50m", "m45m", "m40m", "m35m", "m30m", "m25m",
  "m20m", "m15m", "m10m", "m05m", "",
];

export const CLOUDS_URL =
  "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-ir-4km-900913/{z}/{x}/{y}.png";

export function radarUrl(frame: string): string {
  const tag = frame ? `nexrad-n0q-900913-${frame}` : "nexrad-n0q-900913";
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${tag}/{z}/{x}/{y}.png`;
}

export function frameMinutesAgo(frame: string): number {
  if (!frame) return 0;
  const n = parseInt(frame.replace("m", ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function frameLabel(frame: string): string {
  if (!frame) return "Now";
  return "−" + frame.replace("m", "") + " min";
}

export function frameClockLabel(frame: string): string {
  const mins = frameMinutesAgo(frame);
  return new Date(Date.now() - mins * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;
  let coords: number[][] = [];
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  if (geometry.type === "Polygon") coords = geometry.coordinates[0] || [];
  else if (geometry.type === "MultiPolygon") coords = geometry.coordinates?.[0]?.[0] || [];
  else if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries || []) {
      const c = getCentroid(g);
      if (c) return c;
    }
    return null;
  } else return null;
  if (!coords.length) return null;
  let lat = 0, lng = 0, n = 0;
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lng += c[0];
      lat += c[1];
      n++;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

export function hasDrawableGeometry(geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "GeometryCollection")
    return (geometry.geometries || []).some(hasDrawableGeometry);
  return ["Polygon", "MultiPolygon", "Point"].includes(geometry.type);
}

export function severityColor(severity?: string): string {
  const s = (severity || "").toLowerCase();
  if (s === "extreme") return "#ff2d55";
  if (s === "severe") return "#ff5c5c";
  if (s === "moderate") return "#ffd166";
  return "#52e0d0";
}

export function mapsUrl(lat: number, lng: number, home?: HomeBase | null) {
  if (home)
    return (
      "https://www.google.com/maps/dir/?api=1&origin=" +
      home.lat +
      "," +
      home.lng +
      "&destination=" +
      lat +
      "," +
      lng +
      "&travelmode=driving"
    );
  return "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng;
}

export function isDangerousEvent(event?: string): boolean {
  const e = (event || "").toLowerCase();
  return (
    e.includes("warning") &&
    (e.includes("tornado") ||
      e.includes("severe thunderstorm") ||
      e.includes("flash flood"))
  );
}

export function btnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(217,255,74,0.16)" : "rgba(5,9,11,0.75)",
    border: active
      ? "1px solid rgba(217,255,74,0.45)"
      : "1px solid rgba(184,221,225,0.2)",
    color: active ? "#d9ff4a" : "#8fa6a8",
    borderRadius: 8,
    padding: "5px 9px",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.04em",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };
}
