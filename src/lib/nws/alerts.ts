export type NWSAlert = {
  id: string;
  event: string;
  headline?: string;
  description?: string;
  areaDesc?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  effective?: string;
  expires?: string;
};

export function normalizeNWSAlert(feature: any): NWSAlert {
  const properties = feature?.properties ?? {};

  return {
    id: feature?.id ?? crypto.randomUUID(),
    event: properties.event ?? "Weather Alert",
    headline: properties.headline,
    description: properties.description,
    areaDesc: properties.areaDesc,
    severity: properties.severity,
    urgency: properties.urgency,
    certainty: properties.certainty,
    effective: properties.effective,
    expires: properties.expires,
  };
}

export function normalizeNWSAlerts(data: any): NWSAlert[] {
  return (data?.features ?? []).map(normalizeNWSAlert);
}

/** Fetch currently active NWS alerts (national). */
export async function fetchActiveAlerts(): Promise<NWSAlert[]> {
  const response = await fetch("https://api.weather.gov/alerts/active", {
    headers: {
      // NWS requires a User-Agent that identifies the application
      "User-Agent": "StormIQ (storm-iq-demo)",
      Accept: "application/geo+json",
    },
  });

  if (!response.ok) {
    throw new Error(`NWS alerts request failed: ${response.status}`);
  }

  const data = await response.json();
  return normalizeNWSAlerts(data);
}
