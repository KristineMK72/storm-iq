export type HrrrLayerSpec = {
  url: string;
  opacity?: number;
  label?: string;
};

export type HrrrManifest = {
  updated?: string;
  valid?: string | null;
  model?: string;
  run?: string | null;
  forecastHour?: number | null;
  bounds: [[number, number], [number, number]];
  layers: {
    refl?: HrrrLayerSpec;
    cape?: HrrrLayerSpec;
  };
  note?: string;
};

const DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [24.2, -125.0],
  [49.5, -66.5],
];

export function defaultHrrrManifest(): HrrrManifest {
  return {
    valid: null,
    model: "HRRR",
    bounds: DEFAULT_BOUNDS,
    layers: {
      refl: { url: "", opacity: 0.55, label: "Simulated reflectivity" },
      cape: { url: "", opacity: 0.45, label: "MLCAPE" },
    },
    note: "HRRR overlay not configured",
  };
}

export async function fetchHrrrManifest(): Promise<HrrrManifest> {
  try {
    const custom =
      typeof window !== "undefined"
        ? (window as any).__STORMIQ_HRRR_MANIFEST__
        : null;
    if (custom && custom.bounds && custom.layers) {
      return { ...defaultHrrrManifest(), ...custom };
    }
  } catch {
    // ignore
  }

  try {
    const res = await fetch("/hrrr/manifest.json", { cache: "no-cache" });
    if (!res.ok) return defaultHrrrManifest();
    const data = await res.json();
    return {
      ...defaultHrrrManifest(),
      ...data,
      bounds: data.bounds || DEFAULT_BOUNDS,
      layers: { ...defaultHrrrManifest().layers, ...(data.layers || {}) },
    };
  } catch {
    return defaultHrrrManifest();
  }
}

export function formatHrrrValid(iso?: string | null): string {
  if (!iso) return "no frame yet";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function layerReady(spec?: HrrrLayerSpec): boolean {
  return !!(spec && spec.url && String(spec.url).trim().length > 4);
}
