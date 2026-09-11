/** Richer offline cache for low-signal chase days */

const KEY = "stormiq-offline-cache-v2";

export type CachedAlert = {
  event: string;
  headline: string;
  area: string;
  severity?: string;
  onset?: string;
  expires?: string;
  lat?: number;
  lng?: number;
};

export type OfflineCache = {
  savedAt: string;
  tor: number;
  svr: number;
  ffw: number;
  watches: number;
  posture: string;
  spcValid: string;
  spcSummary: string;
  alerts: CachedAlert[];
  note: string;
};

export function loadOfflineCache(): OfflineCache | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineCache;
  } catch {
    return null;
  }
}

export function saveOfflineCache(cache: OfflineCache) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent("stormiq-offline-cache"));
  } catch {
    // quota
  }
}

function getCentroid(geometry: any): [number, number] | null {
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
  let lat = 0,
    lng = 0,
    n = 0;
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lng += c[0];
      lat += c[1];
      n++;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

export async function refreshOfflineCache(): Promise<OfflineCache> {
  let tor = 0,
    svr = 0,
    ffw = 0,
    watches = 0;
  const alerts: CachedAlert[] = [];

  const alertsRes = await fetch("https://api.weather.gov/alerts/active", {
    headers: {
      "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
      Accept: "application/geo+json",
    },
  });
  if (!alertsRes.ok) throw new Error("NWS failed");
  const data = await alertsRes.json();

  for (const f of data?.features || []) {
    const p = f.properties || {};
    const e = (p.event || "").toLowerCase();
    if (e.includes("test") || p.status === "Test") continue;
    if (e.includes("tornado warning")) tor++;
    else if (e.includes("severe thunderstorm warning")) svr++;
    else if (e.includes("flash flood warning")) ffw++;
    else if (e.includes("watch") && (e.includes("tornado") || e.includes("severe") || e.includes("flash flood")))
      watches++;

    const interesting =
      e.includes("tornado") ||
      e.includes("severe thunderstorm") ||
      e.includes("flash flood");
    if (!interesting) continue;

    const center = getCentroid(f.geometry);
    if (alerts.length < 25) {
      alerts.push({
        event: p.event || "Alert",
        headline: (p.headline || "").slice(0, 160),
        area: (p.areaDesc || "").split(";")[0].trim().slice(0, 60),
        severity: p.severity,
        onset: p.onset || p.effective,
        expires: p.expires,
        lat: center?.[0],
        lng: center?.[1],
      });
    }
  }

  let spcValid = "";
  let spcSummary = "";
  try {
    const spcRes = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk.txt", {
      mode: "cors",
      cache: "no-cache",
    });
    if (spcRes.ok) {
      const text = await spcRes.text();
      const vm = text.match(/Valid\s+(\d{6})Z\s*-\s*(\d{6})Z/i);
      if (vm) spcValid = "Valid " + vm[1] + "Z - " + vm[2] + "Z";
      const sm = text.match(/\.\.\.SUMMARY\.\.\.\s*([\s\S]*?)(?:\n\s*\n|\.\.\.[A-Z])/i);
      if (sm && sm[1]) spcSummary = sm[1].replace(/\s+/g, " ").trim().slice(0, 280);
    }
  } catch {
    // keep empty
  }

  let posture = "MONITOR";
  if (tor + svr + ffw > 0) posture = "IN WINDOW - WARNINGS";
  else if (watches > 0) posture = "IN WINDOW - WATCHES";
  else if (spcSummary) posture = "PLANNING - DAY 1";

  const cache: OfflineCache = {
    savedAt: new Date().toISOString(),
    tor,
    svr,
    ffw,
    watches,
    posture,
    spcValid,
    spcSummary,
    alerts,
    note: "Cached for low-signal use. Not a substitute for live NWS products when online.",
  };
  saveOfflineCache(cache);
  return cache;
}
