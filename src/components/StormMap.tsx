import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type AlertFeature = {
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
  lat: number;
  lng: number;
};

// Simple centroid for Polygon / MultiPolygon
function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;

  let coords: number[][] = [];

  if (geometry.type === "Point") {
    return [geometry.coordinates[1], geometry.coordinates[0]];
  }

  if (geometry.type === "Polygon") {
    coords = geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    coords = geometry.coordinates[0][0];
  } else {
    return null;
  }

  if (!coords || coords.length === 0) return null;

  let latSum = 0;
  let lngSum = 0;
  let count = 0;

  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lngSum += c[0];
      latSum += c[1];
      count++;
    }
  }

  if (count === 0) return null;
  return [latSum / count, lngSum / count];
}

function severityColor(severity?: string): string {
  switch ((severity || "").toLowerCase()) {
    case "extreme":
      return "#ff2d2d";
    case "severe":
      return "#ff5c5c";
    case "moderate":
      return "#ff9f43";
    case "minor":
      return "#ffd166";
    default:
      return "#52e0d0";
  }
}

export default function StormMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [39.8, -98.5],
      zoom: 4,
      zoomControl: true,
      minZoom: 3,
      maxZoom: 12,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community",
        maxZoom: 16,
      }
    ).addTo(map);

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    // Fetch live NWS alerts
    async function loadAlerts() {
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });

        if (!res.ok) throw new Error(`NWS ${res.status}`);

        const data = await res.json();
        const features = data?.features ?? [];

        const alerts: AlertFeature[] = [];

        for (const f of features) {
          const props = f.properties ?? {};
          const event = (props.event || "").toLowerCase();

          // Focus on the most important / actionable alerts
          const isImportant =
            event.includes("tornado") ||
            event.includes("severe thunderstorm") ||
            event.includes("flash flood") ||
            event.includes("hurricane") ||
            event.includes("tropical") ||
            event.includes("blizzard") ||
            event.includes("ice storm") ||
            event.includes("winter storm") ||
            event.includes("high wind") ||
            event.includes("warning");

          if (!isImportant) continue;

          const center = getCentroid(f.geometry);
          if (!center) continue;

          alerts.push({
            id: f.id || crypto.randomUUID(),
            event: props.event || "Weather Alert",
            headline: props.headline,
            description: props.description,
            areaDesc: props.areaDesc,
            severity: props.severity,
            urgency: props.urgency,
            certainty: props.certainty,
            effective: props.effective,
            expires: props.expires,
            lat: center[0],
            lng: center[1],
          });
        }

        // Limit to keep the map readable (most relevant first)
        const limited = alerts.slice(0, 180);

        limited.forEach((a) => {
          const color = severityColor(a.severity);

          const marker = L.circleMarker([a.lat, a.lng], {
            radius: a.severity === "Extreme" || a.severity === "Severe" ? 8 : 6,
            color,
            fillColor: color,
            fillOpacity: 0.85,
            weight: 2,
          }).addTo(map);

          const expires = a.expires
            ? new Date(a.expires).toLocaleString()
            : "—";

          const popupHtml = `
            <div style="min-width:220px;font-family:system-ui,sans-serif;line-height:1.4">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#111">
                ${a.event}
              </div>
              <div style="font-size:12px;color:#333;margin-bottom:6px">
                ${a.headline || a.areaDesc || "Active National Weather Service alert"}
              </div>
              <div style="font-size:11px;color:#555">
                <div><b>Severity:</b> ${a.severity || "—"}</div>
                <div><b>Urgency:</b> ${a.urgency || "—"}</div>
                <div><b>Area:</b> ${a.areaDesc || "—"}</div>
                <div><b>Expires:</b> ${expires}</div>
              </div>
              <div style="margin-top:8px;font-size:11px">
                <a href="/alerts" style="color:#0a7">View all live alerts →</a>
              </div>
            </div>
          `;

          marker.bindPopup(popupHtml, { maxWidth: 280 });
        });

        setCount(limited.length);
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load NWS alerts", err);
        setStatus("error");
      }
    }

    loadAlerts();

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div id="storm-map" ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Live status badge */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 1000,
          background: "rgba(5,9,11,0.85)",
          border: "1px solid rgba(184,221,225,0.2)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 11,
          color: status === "ready" ? "#d9ff4a" : status === "error" ? "#ff5c5c" : "#8fa6a8",
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        {status === "loading" && "LOADING LIVE ALERTS…"}
        {status === "ready" && `LIVE · ${count} ALERTS`}
        {status === "error" && "ALERTS UNAVAILABLE"}
      </div>
    </div>
  );
}
