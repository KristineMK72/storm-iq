/**
 * National Hurricane Center — active tropical cyclones
 * Source: https://www.nhc.noaa.gov/CurrentStorms.json
 */

export type NhcStorm = {
  id: string;
  binNumber?: string;
  name: string;
  classification: string; // TD | TS | HU | PT | etc.
  intensity: number; // max sustained wind kt
  pressure: number | null; // mb
  lat: number;
  lng: number;
  movementDir: number | null; // degrees
  movementSpeed: number | null; // kt
  lastUpdate: string | null;
  publicAdvisoryUrl?: string;
  forecastDiscussionUrl?: string;
  forecastGraphicsUrl?: string;
  trackKmzUrl?: string;
  coneKmzUrl?: string;
  bestTrackKmzUrl?: string;
};

export type NhcActiveResponse = {
  activeStorms: NhcStorm[];
  fetchedAt: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseStorm(raw: any): NhcStorm | null {
  if (!raw || typeof raw !== "object") return null;
  const lat =
    num(raw.latitudeNumeric) ??
    (() => {
      const s = String(raw.latitude || "");
      const m = s.match(/([\d.]+)\s*([NS])/i);
      if (!m) return null;
      const v = parseFloat(m[1]);
      return m[2].toUpperCase() === "S" ? -v : v;
    })();
  const lng =
    num(raw.longitudeNumeric) ??
    (() => {
      const s = String(raw.longitude || "");
      const m = s.match(/([\d.]+)\s*([EW])/i);
      if (!m) return null;
      const v = parseFloat(m[1]);
      return m[2].toUpperCase() === "W" ? -v : v;
    })();
  if (lat == null || lng == null) return null;

  const intensity = num(raw.intensity) ?? 0;
  const pressure = num(raw.pressure);

  return {
    id: String(raw.id || ""),
    binNumber: raw.binNumber ? String(raw.binNumber) : undefined,
    name: String(raw.name || "Unknown"),
    classification: String(raw.classification || "").toUpperCase(),
    intensity,
    pressure,
    lat,
    lng,
    movementDir: num(raw.movementDir),
    movementSpeed: num(raw.movementSpeed),
    lastUpdate: raw.lastUpdate ? String(raw.lastUpdate) : null,
    publicAdvisoryUrl: raw.publicAdvisory?.url,
    forecastDiscussionUrl: raw.forecastDiscussion?.url,
    forecastGraphicsUrl: raw.forecastGraphics?.url,
    trackKmzUrl: raw.forecastTrack?.kmzFile,
    coneKmzUrl: raw.trackCone?.kmzFile,
    bestTrackKmzUrl: raw.bestTrackGIS?.kmzFile,
  };
}

export async function fetchActiveStorms(): Promise<NhcActiveResponse> {
  const res = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json", {
    cache: "no-cache",
  });
  if (!res.ok) throw new Error("NHC CurrentStorms HTTP " + res.status);
  const data = await res.json();
  const storms: NhcStorm[] = [];
  for (const raw of data?.activeStorms || []) {
    const s = parseStorm(raw);
    if (s) storms.push(s);
  }
  return { activeStorms: storms, fetchedAt: new Date().toISOString() };
}

/** Saffir–Simpson–ish color by classification + intensity */
export function stormColor(s: NhcStorm): string {
  const c = s.classification;
  const k = s.intensity;
  if (c === "HU" || c === "MH") {
    if (k >= 137) return "#8b00ff"; // Cat 5
    if (k >= 113) return "#ff2d55"; // Cat 4
    if (k >= 96) return "#ff5c5c"; // Cat 3
    if (k >= 83) return "#ff9f43"; // Cat 2
    return "#ffd166"; // Cat 1
  }
  if (c === "TS") return "#52e0d0";
  if (c === "TD" || c === "SS" || c === "SD") return "#8fa6a8";
  if (c === "PT" || c === "LO" || c === "DB") return "#4a6670";
  return "#edf8f7";
}

export function stormLabel(s: NhcStorm): string {
  const cls =
    s.classification === "HU"
      ? s.intensity >= 96
        ? "Major Hurricane"
        : "Hurricane"
      : s.classification === "TS"
      ? "Tropical Storm"
      : s.classification === "TD"
      ? "Tropical Depression"
      : s.classification || "Cyclone";
  return cls + " " + s.name;
}

export function movementText(s: NhcStorm): string {
  if (s.movementDir == null || s.movementSpeed == null) return "movement unknown";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(((s.movementDir % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx] + " at " + Math.round(s.movementSpeed) + " kt";
}

/** Leaflet divIcon HTML for a storm marker */
export function stormMarkerHtml(s: NhcStorm): string {
  const color = stormColor(s);
  const short =
    s.classification === "HU" ? "H" : s.classification === "TS" ? "TS" : s.classification.slice(0, 2) || "?";
  return (
    '<div style="' +
    "background:" +
    color +
    ";color:#05090b;font-weight:900;font-size:11px;" +
    "width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;" +
    "border:2px solid #edf8f7;box-shadow:0 0 0 2px rgba(0,0,0,0.35);" +
    '">' +
    short +
    "</div>"
  );
}
