export type WxPoint = {
  lat: number;
  lng: number;
  time: string;
  windMph: number;
  gustMph: number;
  windDirDeg: number;
  cloudPct: number;
};

const cache = new Map<string, { at: number; data: WxPoint }>();
const CACHE_MS = 4 * 60_000;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/** Compass from degrees */
export function windDirLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return dirs[i];
}

export async function fetchWxPoint(lat: number, lng: number): Promise<WxPoint> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover` +
    `&wind_speed_unit=mph&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("wx fetch failed");
  const data = await res.json();
  const c = data.current || {};

  const point: WxPoint = {
    lat,
    lng,
    time: c.time || new Date().toISOString(),
    windMph: Number(c.wind_speed_10m) || 0,
    gustMph: Number(c.wind_gusts_10m) || 0,
    windDirDeg: Number(c.wind_direction_10m) || 0,
    cloudPct: Number(c.cloud_cover) || 0,
  };

  cache.set(key, { at: Date.now(), data: point });
  return point;
}
