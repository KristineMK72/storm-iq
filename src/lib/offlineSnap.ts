const KEY = "stormiq-offline-snap";

export type OfflineSnap = {
  savedAt: string;
  alertCount: number;
  tor: number;
  svr: number;
  ffw: number;
  watches: number;
  headlines: string[];
  note: string;
};

export function loadOfflineSnap(): OfflineSnap | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineSnap;
  } catch {
    return null;
  }
}

export function saveOfflineSnap(snap: OfflineSnap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
    window.dispatchEvent(new CustomEvent("stormiq-offline-snap"));
  } catch {
    // ignore
  }
}

/** Pull a compact NWS snapshot for offline fallback */
export async function refreshOfflineSnap(): Promise<OfflineSnap> {
  const res = await fetch("https://api.weather.gov/alerts/active", {
    headers: {
      "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
      Accept: "application/geo+json",
    },
  });
  if (!res.ok) throw new Error("NWS failed");
  const data = await res.json();

  let tor = 0,
    svr = 0,
    ffw = 0,
    watches = 0;
  const headlines: string[] = [];

  for (const f of data?.features || []) {
    const p = f.properties || {};
    const e = (p.event || "").toLowerCase();
    if (e.includes("test") || p.status === "Test") continue;
    if (e.includes("tornado warning")) tor++;
    else if (e.includes("severe thunderstorm warning")) svr++;
    else if (e.includes("flash flood warning")) ffw++;
    else if (e.includes("watch")) watches++;

    if (
      headlines.length < 12 &&
      (e.includes("warning") || e.includes("watch")) &&
      p.headline
    ) {
      headlines.push(String(p.headline).slice(0, 140));
    }
  }

  const snap: OfflineSnap = {
    savedAt: new Date().toISOString(),
    alertCount: (data?.features || []).length,
    tor,
    svr,
    ffw,
    watches,
    headlines,
    note: "Last successful NWS pull — use only if live fetch fails.",
  };
  saveOfflineSnap(snap);
  return snap;
}
