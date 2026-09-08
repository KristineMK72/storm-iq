const KEY = "stormiq-home-base";

export type HomeBase = {
  lat: number;
  lng: number;
  label?: string;
};

export function loadHomeBase(): HomeBase | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HomeBase;
  } catch {
    return null;
  }
}

export function saveHomeBase(home: HomeBase) {
  localStorage.setItem(KEY, JSON.stringify(home));
}

export function clearHomeBase() {
  localStorage.removeItem(KEY);
}

/** Straight-line distance in miles */
export function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Drive-time estimate.
 * Primary: road-distance factor on great-circle (reliable, no external API).
 * Optional: try OSRM if available (may be blocked in some browsers).
 */
export async function estimateDriveMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ minutes: number; miles: number; source: "osrm" | "estimate" }> {
  const straightMiles = milesBetween(from, to);

  // Try OSRM quickly; fall back fast
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const sec = data?.routes?.[0]?.duration;
      const distM = data?.routes?.[0]?.distance;
      if (typeof sec === "number" && sec > 0) {
        return {
          minutes: Math.max(1, Math.round(sec / 60)),
          miles: Math.round(typeof distM === "number" ? distM / 1609.34 : straightMiles * 1.25),
          source: "osrm",
        };
      }
    }
  } catch {
    // ignore — use estimate
  }

  // Road miles ≈ straight × 1.25; average ~50 mph including towns/stops
  const roadMiles = straightMiles * 1.25;
  const minutes = Math.max(1, Math.round((roadMiles / 50) * 60));

  return {
    minutes,
    miles: Math.round(roadMiles),
    source: "estimate",
  };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
