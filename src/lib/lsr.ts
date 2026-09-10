/** SPC Local Storm Reports (today + yesterday) */

export type LsrType = "tornado" | "wind" | "hail";
export type LsrDay = "today" | "yesterday";

export type StormReport = {
  id: string;
  type: LsrType;
  day: LsrDay;
  time: string;
  lat: number;
  lng: number;
  location: string;
  county: string;
  state: string;
  detail: string;
  comments: string;
};

const URLS: Record<LsrDay, Record<LsrType, string>> = {
  today: {
    tornado: "https://www.spc.noaa.gov/climo/reports/today_torn.csv",
    wind: "https://www.spc.noaa.gov/climo/reports/today_wind.csv",
    hail: "https://www.spc.noaa.gov/climo/reports/today_hail.csv",
  },
  yesterday: {
    tornado: "https://www.spc.noaa.gov/climo/reports/yesterday_torn.csv",
    wind: "https://www.spc.noaa.gov/climo/reports/yesterday_wind.csv",
    hail: "https://www.spc.noaa.gov/climo/reports/yesterday_hail.csv",
  },
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

function parseTypedCsv(text: string, type: LsrType, day: LsrDay): StormReport[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const reports: StormReport[] = [];

  for (const line of lines) {
    if (/^Time,/i.test(line)) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 7) continue;
    const [time, detail, location, county, state, latS, lonS, ...rest] = cols;
    const lat = parseFloat(latS);
    const lng = parseFloat(lonS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 20 || lat > 55 || lng < -130 || lng > -60) continue;

    reports.push({
      id: `${day}-${type}-${time}-${lat}-${lng}-${location}`,
      type,
      day,
      time,
      lat,
      lng,
      location: location || "—",
      county: county || "",
      state: state || "",
      detail: detail || "",
      comments: rest.join(", ").trim(),
    });
  }
  return reports;
}

async function fetchDay(day: LsrDay): Promise<StormReport[]> {
  const results = await Promise.all(
    (Object.keys(URLS[day]) as LsrType[]).map(async (type) => {
      try {
        const res = await fetch(URLS[day][type], { mode: "cors", cache: "no-cache" });
        if (!res.ok) return [] as StormReport[];
        return parseTypedCsv(await res.text(), type, day);
      } catch {
        return [] as StormReport[];
      }
    })
  );
  return results.flat();
}

export async function fetchTodayReports(): Promise<StormReport[]> {
  return fetchDay("today");
}

export async function fetchYesterdayReports(): Promise<StormReport[]> {
  return fetchDay("yesterday");
}

/** Prefer today; if empty (or includeYesterday), merge yesterday */
export async function fetchReports(opts?: {
  includeYesterday?: boolean;
}): Promise<StormReport[]> {
  const today = await fetchTodayReports();
  if (!opts?.includeYesterday) return today;
  const y = await fetchYesterdayReports();
  // If today has data, still optionally show yesterday behind a flag
  return [...today, ...y];
}

export function reportColor(type: LsrType, day: LsrDay = "today"): string {
  if (day === "yesterday") {
    if (type === "tornado") return "#cc6666";
    if (type === "hail") return "#6aa8a0";
    return "#c4a85a";
  }
  if (type === "tornado") return "#ff2d2d";
  if (type === "hail") return "#52e0d0";
  return "#ffd166";
}

export function reportLabel(type: LsrType, day: LsrDay = "today"): string {
  const base =
    type === "tornado" ? "Tornado report" : type === "hail" ? "Hail report" : "Wind report";
  return day === "yesterday" ? `${base} (yesterday)` : base;
}
