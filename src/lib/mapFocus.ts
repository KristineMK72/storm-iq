/** Cross-component focus: TargetBoard → Map */

export type MapFocus = {
  lat: number;
  lng: number;
  title?: string;
  zoom?: number;
};

const EVENT = "stormiq-map-focus";
const STORAGE_KEY = "stormiq-map-focus";

export function focusMap(focus: MapFocus) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(focus));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: focus }));
  }
}

export function readAndClearFocus(): MapFocus | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as MapFocus;
  } catch {
    return null;
  }
}

export function onMapFocus(handler: (f: MapFocus) => void): () => void {
  const fn = (e: Event) => {
    const detail = (e as CustomEvent).detail as MapFocus;
    if (detail?.lat != null && detail?.lng != null) handler(detail);
  };
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
