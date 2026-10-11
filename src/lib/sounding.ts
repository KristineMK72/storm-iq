/**
 * Model vertical profile / sounding at a point (Open-Meteo GFS path).
 * Used for tap-map Skew-T + CAPE/CIN/shear readout.
 */

export type SoundingLevel = {
  hPa: number;
  tC: number | null;
  tdC: number | null;
  windKt: number | null;
  windDir: number | null;
};

export type Sounding = {
  lat: number;
  lng: number;
  elevationM: number | null;
  model: string;
  time: string | null;
  cape: number;
  cin: number;
  t2m: number | null;
  td2m: number | null;
  wind10Kt: number | null;
  wind10Dir: number | null;
  /** Rough 0–6 km bulk shear (kt) using ~1000 hPa vs 500 hPa */
  shear0_6kt: number | null;
  levels: SoundingLevel[];
};

const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200];

const cache = new Map<string, { at: number; data: Sounding }>();
const CACHE_MS = 15 * 60_000;

function key(lat: number, lng: number) {
  return lat.toFixed(2) + "," + lng.toFixed(2);
}

function windDiffKt(
  sp1: number | null,
  dir1: number | null,
  sp2: number | null,
  dir2: number | null
): number | null {
  if (sp1 == null || dir1 == null || sp2 == null || dir2 == null) return null;
  const r1 = (dir1 * Math.PI) / 180;
  const r2 = (dir2 * Math.PI) / 180;
  const u1 = -sp1 * Math.sin(r1);
  const v1 = -sp1 * Math.cos(r1);
  const u2 = -sp2 * Math.sin(r2);
  const v2 = -sp2 * Math.cos(r2);
  return Math.sqrt((u2 - u1) ** 2 + (v2 - v1) ** 2);
}

export async function fetchSounding(lat: number, lng: number): Promise<Sounding> {
  const k = key(lat, lng);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const hourlyParts: string[] = [
    "cape",
    "convective_inhibition",
    "temperature_2m",
    "dewpoint_2m",
    "wind_speed_10m",
    "wind_direction_10m",
  ];
  for (const p of LEVELS) {
    hourlyParts.push(
      `temperature_${p}hPa`,
      `dewpoint_${p}hPa`,
      `wind_speed_${p}hPa`,
      `wind_direction_${p}hPa`
    );
  }

  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    lat +
    "&longitude=" +
    lng +
    "&hourly=" +
    hourlyParts.join(",") +
    "&models=gfs_seamless&forecast_hours=3&wind_speed_unit=kn&timezone=auto";

  const res = await fetch(url);
  if (!res.ok) throw new Error("sounding fetch failed");
  const data = await res.json();
  const h = data.hourly || {};
  const times: string[] = h.time || [];
  const now = Date.now();
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(new Date(times[i]).getTime() - now);
    if (d < best) {
      best = d;
      idx = i;
    }
  }

  const num = (arr: unknown, i: number): number | null => {
    if (!Array.isArray(arr) || arr[i] == null) return null;
    const n = Number(arr[i]);
    return Number.isFinite(n) ? n : null;
  };

  const levels: SoundingLevel[] = LEVELS.map((hPa) => ({
    hPa,
    tC: num(h[`temperature_${hPa}hPa`], idx),
    tdC: num(h[`dewpoint_${hPa}hPa`], idx),
    windKt: num(h[`wind_speed_${hPa}hPa`], idx),
    windDir: num(h[`wind_direction_${hPa}hPa`], idx),
  })).filter((L) => L.tC != null || L.tdC != null);

  const low = levels.find((L) => L.hPa === 1000) || levels[0];
  const mid = levels.find((L) => L.hPa === 500);
  const shear0_6kt =
    low && mid
      ? windDiffKt(low.windKt, low.windDir, mid.windKt, mid.windDir)
      : null;

  const sounding: Sounding = {
    lat,
    lng,
    elevationM: data.elevation != null ? Number(data.elevation) : null,
    model: "GFS (Open-Meteo)",
    time: times[idx] || null,
    cape: num(h.cape, idx) ?? 0,
    cin: num(h.convective_inhibition, idx) ?? 0,
    t2m: num(h.temperature_2m, idx),
    td2m: num(h.dewpoint_2m, idx),
    wind10Kt: num(h.wind_speed_10m, idx),
    wind10Dir: num(h.wind_direction_10m, idx),
    shear0_6kt,
    levels,
  };
  cache.set(k, { at: Date.now(), data: sounding });
  return sounding;
}

export function capeLabel(cape: number): string {
  if (cape < 500) return "Weak";
  if (cape < 1000) return "Marginal";
  if (cape < 2000) return "Moderate";
  if (cape < 3000) return "Strong";
  return "Extreme";
}

export function shearLabel(kt: number | null): string {
  if (kt == null) return "—";
  if (kt < 20) return "Weak";
  if (kt < 35) return "Moderate";
  if (kt < 50) return "Strong";
  return "Extreme";
}
