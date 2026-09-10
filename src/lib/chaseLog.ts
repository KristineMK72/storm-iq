const KEY = "stormiq-chase-log";
const MAX = 40;

export type ChaseLogEntry = {
  id: string;
  at: string; // ISO
  event: string;
  area: string;
  severity?: string;
  score?: number;
  lat?: number;
  lng?: number;
};

export function loadChaseLog(): ChaseLogEntry[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ChaseLogEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addChaseLog(entry: Omit<ChaseLogEntry, "id" | "at"> & { id?: string }) {
  const next: ChaseLogEntry = {
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    event: entry.event,
    area: entry.area,
    severity: entry.severity,
    score: entry.score,
    lat: entry.lat,
    lng: entry.lng,
  };
  const list = loadChaseLog().filter((e) => e.id !== next.id);
  list.unshift(next);
  const trimmed = list.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("stormiq-chase-log"));
  } catch {
    // ignore quota
  }
  return next;
}

export function clearChaseLog() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("stormiq-chase-log"));
  } catch {
    // ignore
  }
}

export function exportChaseLogText(): string {
  const list = loadChaseLog();
  if (!list.length) return "Storm IQ chase log — empty\n";
  const lines = ["Storm IQ chase log", `Exported ${new Date().toLocaleString()}`, ""];
  for (const e of list) {
    lines.push(
      `${new Date(e.at).toLocaleString()} | ${e.event} | ${e.area}` +
        (e.severity ? ` | ${e.severity}` : "") +
        (e.score != null ? ` | score ${e.score}` : "")
    );
  }
  lines.push("", "Official NWS warnings always take priority.");
  return lines.join("\n");
}
