/** Daily extended forecast at a point via Open-Meteo (precip / snow / rain). */

export type DailyForecast = {
  date: string;
  precipMm: number | null;
  rainMm: number | null;
  snowCm: number | null;
  precipProb: number | null;
  tempMaxF: number | null;
  tempMinF: number | null;
  weatherCode: number | null;
};

export type ExtendedForecast = {
  days: DailyForecast[];
};

const cache = new Map<string, { at: number; data: ExtendedForecast }>();
const CACHE_MS = 20 * 60_000;

function weatherLabel(code: number | null): string {
  if (code == null) return "";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunder";
  return "";
}

export function weatherEmoji(code: number | null): string {
  if (code == null) return "";
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 86) return "🌨️";
  if (code <= 99) return "⛈️";
  return "";
}

export async function fetchExtendedForecast(lat: number, lng: number): Promise<ExtendedForecast> {
  const k = lat.toFixed(2) + "," + lng.toFixed(2);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    lat +
    "&longitude=" +
    lng +
    "&daily=precipitation_sum,rain_sum,snowfall_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,weather_code" +
    "&temperature_unit=fahrenheit&precipitation_unit=mm&timezone=auto&forecast_days=7";

  const res = await fetch(url);
  if (!res.ok) throw new Error("forecast fetch failed");
  const data = await res.json();
  const d = data.daily || {};
  const times: string[] = d.time || [];

  const days: DailyForecast[] = times.map((date, i) => ({
    date,
    precipMm: d.precipitation_sum?.[i] != null ? Number(d.precipitation_sum[i]) : null,
    rainMm: d.rain_sum?.[i] != null ? Number(d.rain_sum[i]) : null,
    snowCm: d.snowfall_sum?.[i] != null ? Number(d.snowfall_sum[i]) : null,
    precipProb: d.precipitation_probability_max?.[i] != null ? Number(d.precipitation_probability_max[i]) : null,
    tempMaxF: d.temperature_2m_max?.[i] != null ? Number(d.temperature_2m_max[i]) : null,
    tempMinF: d.temperature_2m_min?.[i] != null ? Number(d.temperature_2m_min[i]) : null,
    weatherCode: d.weather_code?.[i] != null ? Number(d.weather_code[i]) : null,
  }));

  const result: ExtendedForecast = { days };
  cache.set(k, { at: Date.now(), data: result });
  return result;
}

export function formatDay(iso: string): string {
  const dt = new Date(iso + "T12:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export { weatherLabel };
