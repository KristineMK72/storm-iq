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
    expires: properties.expires
  };
}

export function normalizeNWSAlerts(data: any): NWSAlert[] {
  return (data?.features ?? []).map(normalizeNWSAlert);
}
