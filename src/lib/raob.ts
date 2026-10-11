/**
 * Observed radiosonde (RAOB) via Iowa Environmental Mesonet.
 * Real balloon data — 00Z / 12Z typically.
 */

export type RaobLevel = {
  hPa: number;
  tC: number | null;
  tdC: number | null;
  windKt: number | null;
  windDir: number | null;
  heightM: number | null;
};

export type ObservedSounding = {
  station: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  valid: string;
  levels: RaobLevel[];
};

type Station = { sid: string; name: string; lat: number; lng: number };

let stationsCache: Station[] | null = null;
let stationsAt = 0;
const STATIONS_TTL = 24 * 60 * 60_000;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR;
  const dLon = (lon2 - lon1) * toR;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Load online US RAOB sites (skip composite _XXX ids). */
export async function loadRaobStations(): Promise<Station[]> {
  if (stationsCache && Date.now() - stationsAt < STATIONS_TTL) return stationsCache;
  const res = await fetch("https://mesonet.agron.iastate.edu/geojson/network/RAOB.geojson");
  if (!res.ok) throw new Error("RAOB network fetch failed");
  const data = await res.json();
  const stations: Station[] = [];
  for (const f of data.features || []) {
    const p = f.properties || {};
    if (!p.online) continue;
    if (p.country && p.country !== "US") continue;
    const sid = String(p.sid || "");
    if (!sid || sid.startsWith("_")) continue;
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    stations.push({
      sid,
      name: String(p.sname || sid).replace(/\s+/g, " ").trim(),
      lat: coords[1],
      lng: coords[0],
    });
  }
  stationsCache = stations;
  stationsAt = Date.now();
  return stations;
}

export function nearestStation(stations: Station[], lat: number, lng: number): Station & { distanceKm: number } {
  let best = stations[0];
  let bestD = Infinity;
  for (const s of stations) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { ...best, distanceKm: bestD };
}

/** Candidate 00Z/12Z times: most recent first. */
function soundingTimes(now = new Date()): string[] {
  const out: string[] = [];
  const utc = new Date(now);
  for (let back = 0; back < 5; back++) {
    const t = new Date(utc.getTime() - back * 12 * 3600_000);
    const h = t.getUTCHours() < 12 ? 0 : 12;
    const snapped = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), h, 0, 0));
    if (snapped.getTime() > utc.getTime() + 2 * 3600_000) continue;
    const iso = snapped.toISOString().replace(/\.\d{3}Z$/, "Z");
    if (!out.includes(iso)) out.push(iso);
  }
  return out;
}

const profileCache = new Map<string, { at: number; data: ObservedSounding | null }>();
const PROFILE_TTL = 30 * 60_000;

export async function fetchNearestObserved(
  lat: number,
  lng: number
): Promise<ObservedSounding | null> {
  const key = lat.toFixed(2) + "," + lng.toFixed(2);
  const hit = profileCache.get(key);
  if (hit && Date.now() - hit.at < PROFILE_TTL) return hit.data;

  const stations = await loadRaobStations();
  if (!stations.length) {
    profileCache.set(key, { at: Date.now(), data: null });
    return null;
  }
  const nearest = nearestStation(stations, lat, lng);
  const times = soundingTimes();

  for (const ts of times) {
    const url =
      "https://mesonet.agron.iastate.edu/json/raob.py?station=" +
      encodeURIComponent(nearest.sid) +
      "&ts=" +
      encodeURIComponent(ts);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const profiles = data.profiles || [];
      if (!profiles.length) continue;
      const prof = profiles[0];
      const raw = prof.profile || [];
      const levels: RaobLevel[] = [];
      for (const row of raw) {
        const hPa = Number(row.pres);
        if (!Number.isFinite(hPa)) continue;
        const tC = row.tmpc != null ? Number(row.tmpc) : null;
        const tdC = row.dwpc != null ? Number(row.dwpc) : null;
        if (tC == null && tdC == null) continue;
        levels.push({
          hPa,
          tC: tC != null && Number.isFinite(tC) ? tC : null,
          tdC: tdC != null && Number.isFinite(tdC) ? tdC : null,
          windKt: row.sknt != null && Number.isFinite(Number(row.sknt)) ? Number(row.sknt) : null,
          windDir: row.drct != null && Number.isFinite(Number(row.drct)) ? Number(row.drct) : null,
          heightM: row.hght != null && Number.isFinite(Number(row.hght)) ? Number(row.hght) : null,
        });
      }
      if (levels.length < 5) continue;
      const obs: ObservedSounding = {
        station: nearest.sid,
        name: nearest.name,
        lat: nearest.lat,
        lng: nearest.lng,
        distanceKm: nearest.distanceKm,
        valid: String(prof.valid || ts),
        levels,
      };
      profileCache.set(key, { at: Date.now(), data: obs });
      return obs;
    } catch {
      /* try next time */
    }
  }

  profileCache.set(key, { at: Date.now(), data: null });
  return null;
}
