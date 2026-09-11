export type WxPoint = {
  lat: number;
  lng: number;
  time: string;
  windMph: number;
  gustMph: number;
  windDirDeg: number;
  cloudPct: number;
  precipMm: number;
  rainMm: number;
  precipProbPct: number | null;
  weatherCode: number;
};

const cache = new Map<string, { at: number; data: WxPoint }>();
const CACHE_MS = 4 * 60_000;

function cacheKey(lat: number, lng: number) {
  return lat.toFixed(2) + "," + lng.toFixed(2);
}

export function windDirLabel(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return dirs[i];
}

/** Rough WMO weather code label */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog / haze";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow / ice";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Weather " + code;
}

/** mm to inches, 1 decimal */
export function mmToIn(mm: number): number {
  return Math.round((mm / 25.4) * 10) / 10;
}

export async function fetchWxPoint(lat: number, lng: number): Promise<WxPoint> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    lat +
    "&longitude=" +
    lng +
    "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation,rain,weather_code" +
    "&hourly=precipitation_probability&forecast_days=1" +
    "&wind_speed_unit=mph&timezone=auto";

  const res = await fetch(url);
  if (!res.ok) throw new Error("wx fetch failed");
  const data = await res.json();
  const c = data.current || {};

  let precipProbPct: number | null = null;
  try {
    const times: string[] = data.hourly?.time || [];
    const probs: number[] = data.hourly?.precipitation_probability || [];
    const nowIso = (c.time || "").slice(0, 13); // YYYY-MM-DDTHH
    let idx = times.findIndex((t) => t.startsWith(nowIso));
    if (idx < 0) idx = 0;
    if (probs[idx] != null) precipProbPct = Number(probs[idx]);
  } catch {
    precipProbPct = null;
  }

  const point: WxPoint = {
    lat,
    lng,
    time: c.time || new Date().toISOString(),
    windMph: Number(c.wind_speed_10m) || 0,
    gustMph: Number(c.wind_gusts_10m) || 0,
    windDirDeg: Number(c.wind_direction_10m) || 0,
    cloudPct: Number(c.cloud_cover) || 0,
    precipMm: Number(c.precipitation) || 0,
    rainMm: Number(c.rain) || 0,
    precipProbPct,
    weatherCode: Number(c.weather_code) || 0,
  };

  cache.set(key, { at: Date.now(), data: point });
  return point;
}
