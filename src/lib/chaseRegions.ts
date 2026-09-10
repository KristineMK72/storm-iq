const KEY = "stormiq-chase-regions";

export type ChaseRegion = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMi: number;
};

export function loadRegions(): ChaseRegion[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRegions(regions: ChaseRegion[]) {
  localStorage.setItem(KEY, JSON.stringify(regions.slice(0, 6)));
  window.dispatchEvent(new CustomEvent("stormiq-regions-updated"));
}

export function addRegion(region: Omit<ChaseRegion, "id">): ChaseRegion[] {
  const next = [
    ...loadRegions().filter((r) => r.name.toLowerCase() !== region.name.toLowerCase()),
    { ...region, id: `r-${Date.now()}` },
  ].slice(0, 6);
  saveRegions(next);
  return next;
}

export function removeRegion(id: string): ChaseRegion[] {
  const next = loadRegions().filter((r) => r.id !== id);
  saveRegions(next);
  return next;
}
