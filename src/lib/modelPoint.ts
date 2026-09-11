export type ModelHour = {
  time: string; // local iso from API
  cape: number;
  cin: number;
  windMph: number;
  windDir: number;
  precipMm: number;
  cloudPct: number;
};

export type ModelSeries = {
  lat: number;
  lng: number;
  model: string;
  hours: ModelHour[];
  peakCape: number;
  peakCapeTime: string;
  maxPrecipMm: number;
};

const cache = new Map<string, { at: number; data: ModelSeries }>();
const CACHE_MS = 20 * 60_000;

function key(lat: number, lng: number) {
  return lat.toFixed(2) + "," + lng.toFixed(2);
}

export async function fetchModelSeries(
  lat: number,
  lng: number
): Promise<ModelSeries> {
  const k = key(lat, lng);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  // Open-Meteo gfs_hrrr = NOAA HRRR-based CONUS high-res path when available
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    lat +
    "&longitude=" +
    lng +
    "&hourly=cape,convective_inhibition,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover" +
    "&forecast_days=1&models=gfs_hrrr&wind_speed_unit=mph&timezone=auto";

  const res = await fetch(url);
  if (!res.ok) throw new Error("model fetch failed");
  const data = await res.json();
  const h = data.hourly || {};
  const times: string[] = h.time || [];
  const cape: number[] = h.cape || [];
  const cin: number[] = h.convective_inhibition || [];
  const wind: number[] = h.wind_speed_10m || [];
  const dir: number[] = h.wind_direction_10m || [];
  const precip: number[] = h.precipitation || [];
  const cloud: number[] = h.cloud_cover || [];

  const now = Date.now();
  const hours: ModelHour[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    // Keep from 1h ago through +18h
    if (t < now - 60 * 60_000) continue;
    if (t > now + 18 * 60 * 60_000) break;
    hours.push({
      time: times[i],
      cape: Number(cape[i]) || 0,
      cin: Number(cin[i]) || 0,
      windMph: Number(wind[i]) || 0,
      windDir: Number(dir[i]) || 0,
      precipMm: Number(precip[i]) || 0,
      cloudPct: Number(cloud[i]) || 0,
    });
    if (hours.length >= 18) break;
  }

  let peakCape = 0;
  let peakCapeTime = hours[0]?.time || "";
  let maxPrecipMm = 0;
  for (const hr of hours) {
    if (hr.cape > peakCape) {
      peakCape = hr.cape;
      peakCapeTime = hr.time;
    }
    if (hr.precipMm > maxPrecipMm) maxPrecipMm = hr.precipMm;
  }

  const series: ModelSeries = {
    lat,
    lng,
    model: "gfs_hrrr (Open-Meteo / NOAA HRRR path)",
    hours,
    peakCape,
    peakCapeTime,
    maxPrecipMm,
  };
  cache.set(k, { at: Date.now(), data: series });
  return series;
}

export function fmtHour(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function capeLabel(cape: number): string {
  if (cape < 500) return "Weak";
  if (cape < 1000) return "Marginal";
  if (cape < 2000) return "Moderate";
  if (cape < 3000) return "Strong";
  return "Extreme";
}
