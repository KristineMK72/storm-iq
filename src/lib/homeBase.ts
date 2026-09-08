const KEY = "stormiq-home-base";

export type HomeBase = {
  lat: number;
  lng: number;
  label?: string;
};

export function loadHomeBase(): HomeBase | null {
  try {
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

/** Estimate drive time via public OSRM (fallback to distance/speed) */
export async function estimateDriveMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ minutes: number; miles: number; source: "osrm" | "estimate" }> {
  const miles = milesBetween(from, to);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const sec = data?.routes?.[0]?.duration;
      if (typeof sec === "number" && sec > 0) {
        return {
          minutes: Math.round(sec / 60),
          miles: Math.round(miles),
          source: "osrm",
        };
      }
    }
  } catch {
    // fall through
  }

  // Fallback: assume ~55 mph average including stops
  return {
    minutes: Math.round((miles / 55) * 60),
    miles: Math.round(miles),
    source: "estimate",
  };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
