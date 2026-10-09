/**
 * National Hurricane Center — active tropical cyclones
 * CurrentStorms.json + NOAA tropical MapServer (track / cone / past track)
 */

export type NhcStorm = {
  id: string;
  binNumber?: string;
  name: string;
  classification: string;
  intensity: number;
  pressure: number | null;
  lat: number;
  lng: number;
  movementDir: number | null;
  movementSpeed: number | null;
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

/** GeoJSON FeatureCollections for one storm wallet */
export type NhcStormGeometry = {
  track: GeoJSON.FeatureCollection | null;
  cone: GeoJSON.FeatureCollection | null;
  pastTrack: GeoJSON.FeatureCollection | null;
  points: GeoJSON.FeatureCollection | null;
};

const MAPSERVER =
  "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";

/** Layer IDs: Forecast Points, Track, Cone, Past Track — by wallet (AT1…CP5) */
const WALLET_LAYERS: Record<
  string,
  { points: number; track: number; cone: number; pastTrack: number }
> = {
  AT1: { points: 6, track: 7, cone: 8, pastTrack: 12 },
  AT2: { points: 32, track: 33, cone: 34, pastTrack: 38 },
  AT3: { points: 58, track: 59, cone: 60, pastTrack: 64 },
  AT4: { points: 84, track: 85, cone: 86, pastTrack: 90 },
  AT5: { points: 110, track: 111, cone: 112, pastTrack: 116 },
  EP1: { points: 136, track: 137, cone: 138, pastTrack: 142 },
  EP2: { points: 162, track: 163, cone: 164, pastTrack: 168 },
  EP3: { points: 188, track: 189, cone: 190, pastTrack: 194 },
  EP4: { points: 214, track: 215, cone: 216, pastTrack: 220 },
  EP5: { points: 240, track: 241, cone: 242, pastTrack: 246 },
  CP1: { points: 266, track: 267, cone: 268, pastTrack: 272 },
  CP2: { points: 292, track: 293, cone: 294, pastTrack: 298 },
  CP3: { points: 318, track: 319, cone: 320, pastTrack: 324 },
  CP4: { points: 344, track: 345, cone: 346, pastTrack: 350 },
  CP5: { points: 370, track: 371, cone: 372, pastTrack: 376 },
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

  return {
    id: String(raw.id || ""),
    binNumber: raw.binNumber ? String(raw.binNumber).toUpperCase() : undefined,
    name: String(raw.name || "Unknown"),
    classification: String(raw.classification || "").toUpperCase(),
    intensity: num(raw.intensity) ?? 0,
    pressure: num(raw.pressure),
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
  // Prefer same-origin proxy (vercel.json rewrite) — NHC does not send CORS headers.
  const urls = ["/api/nhc/current", "https://www.nhc.noaa.gov/CurrentStorms.json"];
  let data: any = null;
  let lastStatus = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      lastStatus = res.status;
      if (!res.ok) continue;
      data = await res.json();
      if (data) break;
    } catch {
      /* try next */
    }
  }
  if (!data) throw new Error("NHC CurrentStorms unavailable (HTTP " + lastStatus + ")");
  const storms: NhcStorm[] = [];
  for (const raw of data?.activeStorms || []) {
    const s = parseStorm(raw);
    if (s) storms.push(s);
  }
  return { activeStorms: storms, fetchedAt: new Date().toISOString() };
}

async function queryLayer(layerId: number): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const url =
      MAPSERVER +
      "/" +
      layerId +
      "/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson";
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.type !== "FeatureCollection") return null;
    if (!Array.isArray(data.features) || data.features.length === 0) return null;
    return data as GeoJSON.FeatureCollection;
  } catch {
    return null;
  }
}

/** Forecast track, cone, past track for a storm wallet (e.g. AT4, EP3) */
export async function fetchStormGeometry(binNumber?: string): Promise<NhcStormGeometry> {
  const empty: NhcStormGeometry = { track: null, cone: null, pastTrack: null, points: null };
  if (!binNumber) return empty;
  const key = binNumber.toUpperCase();
  const ids = WALLET_LAYERS[key];
  if (!ids) return empty;
  const [track, cone, pastTrack, points] = await Promise.all([
    queryLayer(ids.track),
    queryLayer(ids.cone),
    queryLayer(ids.pastTrack),
    queryLayer(ids.points),
  ]);
  return { track, cone, pastTrack, points };
}

export function stormColor(s: NhcStorm): string {
  const c = s.classification;
  const k = s.intensity;
  if (c === "HU" || c === "MH") {
    if (k >= 137) return "#8b00ff";
    if (k >= 113) return "#ff2d55";
    if (k >= 96) return "#ff5c5c";
    if (k >= 83) return "#ff9f43";
    return "#ffd166";
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
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const idx = Math.round((((s.movementDir % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx] + " at " + Math.round(s.movementSpeed) + " kt";
}

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
