import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// SPC categorical colors (approximate official)
const SPC_COLORS: Record<string, string> = {
  TSTM: "#c1c1c1",
  MRGL: "#66cc66",
  SLGT: "#ffe066",
  ENH: "#ff9933",
  MDT: "#ff3333",
  HIGH: "#cc33ff",
};

function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;

  let coords: number[][] = [];

  if (geometry.type === "Point") {
    return [geometry.coordinates[1], geometry.coordinates[0]];
  }
  if (geometry.type === "Polygon") {
    coords = geometry.coordinates[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    coords = geometry.coordinates?.[0]?.[0] || [];
  } else {
    return null;
  }

  if (!coords.length) return null;

  let lat = 0, lng = 0, n = 0;
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lng += c[0];
      lat += c[1];
      n++;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

function severityColor(severity?: string): string {
  const s = (severity || "").toLowerCase();
  if (s === "extreme") return "#ff2d2d";
  if (s === "severe") return "#ff5c5c";
  if (s === "moderate") return "#ff9f43";
  if (s === "minor") return "#ffd166";
  return "#52e0d0";
}

export default function StormMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const [status, setStatus] = useState("Loading outlook & alerts…");
  const [radarOn, setRadarOn] = useState(true);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [39.5, -98.0],
      zoom: 4,
      zoomControl: true,
      minZoom: 3,
      maxZoom: 12,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors",
        maxZoom: 16,
      }
    ).addTo(map);

    // Live NEXRAD base reflectivity (Iowa State Mesonet – free NWS data)
    const radar = L.tileLayer(
      "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
      {
        attribution: "Radar © Iowa State Mesonet / NWS NEXRAD",
        opacity: 0.65,
        zIndex: 200,
        maxZoom: 12,
      }
    );
    radar.addTo(map);
    radarLayerRef.current = radar;

    mapInstance.current = map;

    const resize = () => map.invalidateSize();
    setTimeout(resize, 100);
    setTimeout(resize, 400);
    window.addEventListener("resize", resize);

    async function loadLayers() {
      let outlookCount = 0;
      let alertCount = 0;

      // ── 1. SPC Day 1 Categorical Outlook ───────────────────────────
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
          { headers: { "User-Agent": "StormIQ (https://storm-iq.vercel.app)" } }
        );
        if (res.ok) {
          const geo = await res.json();
          const features = geo?.features || [];

          features.forEach((f: any) => {
            const label = (f.properties?.LABEL || f.properties?.label || "TSTM").toUpperCase();
            const color = SPC_COLORS[label] || "#888";

            if (!f.geometry) return;

            const layer = L.geoJSON(f, {
              style: {
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: label === "TSTM" ? 0.12 : 0.28,
              },
            }).addTo(map);

            layer.bindPopup(
              `<div style="font-family:system-ui;min-width:180px">
                <strong style="font-size:14px">SPC Day 1 · ${label}</strong><br/>
                <span style="font-size:12px;color:#333">
                  Categorical convective outlook risk area.
                </span><br/>
                <a href="https://www.spc.noaa.gov/products/outlook/" target="_blank" rel="noopener"
                   style="font-size:11px;color:#0a7">Full SPC outlook →</a>
              </div>`
            );

            outlookCount++;
          });
        }
      } catch (e) {
        console.warn("SPC outlook failed", e);
      }

      // ── 2. Live NWS Alerts ─────────────────────────────────────────
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const features = data?.features || [];

          for (const f of features) {
            const props = f.properties || {};
            const event = (props.event || "").toLowerCase();

            if (event.includes("test") || props.status === "Test") continue;

            const interesting =
              event.includes("warning") ||
              event.includes("watch") ||
              event.includes("advisory") ||
              event.includes("tornado") ||
              event.includes("thunderstorm") ||
              event.includes("flood") ||
              event.includes("hurricane") ||
              event.includes("tropical") ||
              event.includes("blizzard") ||
              event.includes("winter") ||
              event.includes("wind") ||
              event.includes("heat") ||
              event.includes("fire");

            if (!interesting) continue;

            const center = getCentroid(f.geometry);
            if (!center) continue;

            const color = severityColor(props.severity);
            const marker = L.circleMarker(center, {
              radius: 7,
              color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: 2,
            }).addTo(map);

            const expires = props.expires
              ? new Date(props.expires).toLocaleString()
              : "—";

            marker.bindPopup(
              `<div style="min-width:220px;font-family:system-ui;line-height:1.4">
                <div style="font-weight:700;font-size:14px;margin-bottom:4px">
                  ${props.event || "Alert"}
                </div>
                <div style="font-size:12px;color:#333;margin-bottom:6px">
                  ${props.headline || props.areaDesc || "Active NWS alert"}
                </div>
                <div style="font-size:11px;color:#555">
                  <div><b>Severity:</b> ${props.severity || "—"}</div>
                  <div><b>Urgency:</b> ${props.urgency || "—"}</div>
                  <div><b>Area:</b> ${props.areaDesc || "—"}</div>
                  <div><b>Expires:</b> ${expires}</div>
                </div>
                <div style="margin-top:8px;font-size:11px">
                  <a href="/alerts" style="color:#0a7">All live alerts →</a>
                </div>
              </div>`,
              { maxWidth: 280 }
            );

            alertCount++;
            if (alertCount >= 200) break;
          }
        }
      } catch (e) {
        console.warn("NWS alerts failed", e);
      }

      if (outlookCount || alertCount) {
        setStatus(
          `LIVE · ${outlookCount} outlook · ${alertCount} alert${alertCount !== 1 ? "s" : ""}`
        );
      } else {
        setStatus("LIVE · Radar on · No high-impact alerts");
      }

      setTimeout(() => map.invalidateSize(), 100);
    }

    loadLayers();

    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapInstance.current = null;
      radarLayerRef.current = null;
    };
  }, []);

  // Toggle radar visibility
  useEffect(() => {
    const radar = radarLayerRef.current;
    const map = mapInstance.current;
    if (!radar || !map) return;

    if (radarOn) {
      if (!map.hasLayer(radar)) radar.addTo(map);
    } else {
      if (map.hasLayer(radar)) map.removeLayer(radar);
    }
  }, [radarOn]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 420,
        minHeight: 420,
      }}
    >
      <div
        id="storm-map"
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 420,
          borderRadius: 14,
          background: "#071014",
        }}
      />

      {/* Status */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 1000,
          background: "rgba(5,9,11,0.88)",
          border: "1px solid rgba(184,221,225,0.22)",
          borderRadius: 8,
          padding: "6px 11px",
          fontSize: 11,
          color: "#d9ff4a",
          fontWeight: 600,
          letterSpacing: "0.03em",
          maxWidth: 260,
        }}
      >
        {status}
      </div>

      {/* Radar toggle */}
      <button
        onClick={() => setRadarOn((v) => !v)}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1000,
          background: radarOn ? "rgba(217,255,74,0.18)" : "rgba(5,9,11,0.88)",
          border: radarOn
            ? "1px solid rgba(217,255,74,0.5)"
            : "1px solid rgba(184,221,225,0.22)",
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 11,
          color: radarOn ? "#d9ff4a" : "#8fa6a8",
          fontWeight: 700,
          letterSpacing: "0.04em",
          cursor: "pointer",
        }}
      >
        {radarOn ? "RADAR ON" : "RADAR OFF"}
      </button>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 12,
          zIndex: 1000,
          background: "rgba(5,9,11,0.88)",
          border: "1px solid rgba(184,221,225,0.18)",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 10,
          color: "#c8d8d9",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#edf8f7" }}>
          Layers
        </div>
        <div><span style={{ color: "#66cc66" }}>■</span> Marginal</div>
        <div><span style={{ color: "#ffe066" }}>■</span> Slight</div>
        <div><span style={{ color: "#ff9933" }}>■</span> Enhanced</div>
        <div><span style={{ color: "#ff3333" }}>■</span> Moderate</div>
        <div><span style={{ color: "#cc33ff" }}>■</span> High</div>
        <div style={{ marginTop: 4, opacity: 0.85 }}>Radar = NEXRAD</div>
        <div style={{ opacity: 0.85 }}>Dots = NWS alerts</div>
      </div>
    </div>
  );
}
