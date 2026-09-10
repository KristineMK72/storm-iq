/** SPC Local Storm Reports (today) */

export type LsrType = "tornado" | "wind" | "hail";

export type StormReport = {
  id: string;
  type: LsrType;
  time: string;
  lat: number;
  lng: number;
  location: string;
  county: string;
  state: string;
  detail: string; // scale / speed / size
  comments: string;
};

const URLS: Record<LsrType, string> = {
  tornado: "https://www.spc.noaa.gov/climo/reports/today_torn.csv",
  wind: "https://www.spc.noaa.gov/climo/reports/today_wind.csv",
  hail: "https://www.spc.noaa.gov/climo/reports/today_hail.csv",
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseTypedCsv(text: string, type: LsrType): StormReport[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const reports: StormReport[] = [];

  for (const line of lines) {
    if (/^Time,/i.test(line)) continue; // header
    const cols = parseCsvLine(line);
    if (cols.length < 7) continue;

    const [time, detail, location, county, state, latS, lonS, ...rest] = cols;
    const lat = parseFloat(latS);
    const lng = parseFloat(lonS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 20 || lat > 55 || lng < -130 || lng > -60) continue;

    const comments = rest.join(", ").trim();

    reports.push({
      id: `${type}-${time}-${lat}-${lng}-${location}`,
      type,
      time,
      lat,
      lng,
      location: location || "—",
      county: county || "",
      state: state || "",
      detail: detail || "",
      comments,
    });
  }

  return reports;
}

export async function fetchTodayReports(): Promise<StormReport[]> {
  const results = await Promise.all(
    (Object.keys(URLS) as LsrType[]).map(async (type) => {
      try {
        const res = await fetch(URLS[type], { mode: "cors", cache: "no-cache" });
        if (!res.ok) return [] as StormReport[];
        return parseTypedCsv(await res.text(), type);
      } catch {
        return [] as StormReport[];
      }
    })
  );

  return results.flat();
}

export function reportColor(type: LsrType): string {
  if (type === "tornado") return "#ff2d2d";
  if (type === "hail") return "#52e0d0";
  return "#ffd166"; // wind
}

export function reportLabel(type: LsrType): string {
  if (type === "tornado") return "Tornado report";
  if (type === "hail") return "Hail report";
  return "Wind report";
}
