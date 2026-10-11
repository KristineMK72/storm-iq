/**
 * Shareable map deep links (MyRadar-style).
 * Example: /map?lat=27.0&lng=-87.6&z=6&clouds=1
 */
export type MapShareState = {
  lat: number;
  lng: number;
  z: number;
  radar?: boolean;
  clouds?: boolean;
  tropical?: boolean;
};

function readSearch(): string {
  try {
    return typeof window !== "undefined" ? window.location.search : "";
  } catch {
    return "";
  }
}

export function parseMapShare(search = readSearch()): Partial<MapShareState> {
  const p = new URLSearchParams(search);
  const out: Partial<MapShareState> = {};
  const lat = parseFloat(p.get("lat") || "");
  const lng = parseFloat(p.get("lng") || "");
  const z = parseFloat(p.get("z") || "");
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    out.lat = lat;
    out.lng = lng;
  }
  if (Number.isFinite(z) && z >= 3 && z <= 12) out.z = Math.round(z);
  if (p.has("radar")) out.radar = p.get("radar") !== "0" && p.get("radar") !== "off";
  if (p.has("clouds")) out.clouds = p.get("clouds") === "1" || p.get("clouds") === "on";
  if (p.has("tropical")) out.tropical = p.get("tropical") !== "0" && p.get("tropical") !== "off";
  return out;
}

export function buildMapShareUrl(state: MapShareState): string {
  let origin = "https://storm-iq.vercel.app";
  try {
    if (typeof window !== "undefined" && window.location?.origin) origin = window.location.origin;
  } catch {
    /* */
  }
  const u = new URL(origin + "/map");
  u.searchParams.set("lat", state.lat.toFixed(4));
  u.searchParams.set("lng", state.lng.toFixed(4));
  u.searchParams.set("z", String(Math.round(state.z)));
  if (state.radar === false) u.searchParams.set("radar", "0");
  if (state.clouds) u.searchParams.set("clouds", "1");
  if (state.tropical === false) u.searchParams.set("tropical", "0");
  return u.toString();
}

/** Keep the address bar in sync so Copy link / browser share works. */
export function syncMapShareToUrl(state: MapShareState): void {
  try {
    if (typeof window === "undefined" || !window.history?.replaceState) return;
    const url = buildMapShareUrl(state);
    const next = new URL(url);
    // Stay on current path (Command or Map) but keep share params
    const cur = new URL(window.location.href);
    cur.search = next.search;
    window.history.replaceState({}, "", cur.pathname + cur.search);
  } catch {
    /* */
  }
}

export async function shareMapView(
  state: MapShareState,
  title = "Storm IQ live map"
): Promise<"shared" | "copied" | "failed"> {
  const url = buildMapShareUrl(state);
  const text = title + "\n" + url;
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return "failed";
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    /* */
  }
  return "failed";
}
