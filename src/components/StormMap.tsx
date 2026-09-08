import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SPC_COLORS: Record<string, string> = {
  TSTM: "#c1c1c1",
  MRGL: "#66cc66",
  SLGT: "#ffe066",
  ENH: "#ff9933",
  MDT: "#ff3333",
  HIGH: "#cc33ff",
};

// Approximate colors for probability contours
const PROB_COLORS: Record<string, string> = {
  "2": "#00bb00",
  "5": "#8bce00",
  "10": "#ffcc00",
  "15": "#ff9900",
  "30": "#ff0000",
  "45": "#ff00ff",
  "60": "#912cee",
};

function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;
  let coords: number[][] = [];
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  if (geometry.type === "Polygon") coords = geometry.coordinates[0] || [];
  else if (geometry.type === "MultiPolygon") coords = geometry.coordinates?.[0]?.[0] || [];
  else return null;
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
  const [status, setStatus] = useState("Loading layers…");
  const [radarOn, setRadarOn] = useState(true);
  const [showTorn, setShowTorn] = useState(true);
  const [showHail, setShowHail] = useState(false);

  const tornLayerRef = useRef<L.LayerGroup | null>(null);
  const hailLayerRef = useRef<L.LayerGroup | null>(null);

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
        attribution: "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap",
        maxZoom: 16,
      }
    ).addTo(map);

    // Radar
    const radar = L.tileLayer(
      "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
      {
        attribution: "Radar © Iowa State Mesonet / NWS NEXRAD",
        opacity: 0.6,
        zIndex: 200,
        maxZoom: 12,
      }
    );
    radar.addTo(map);
    radarLayerRef.current = radar;

    tornLayerRef.current = L.layerGroup().addTo(map);
    hailLayerRef.current = L.layerGroup();

    mapInstance.current = map;

    const resize = () => map.invalidateSize();
    setTimeout(resize, 100);
    setTimeout(resize, 400);
    window.addEventListener("resize", resize);

    async function loadLayers() {
      let outlookCount = 0;
      let alertCount = 0;

      // Categorical Day 1
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
          { headers: { "User-Agent": "StormIQ" } }
        );
        if (res.ok) {
          const geo = await res.json();
          (geo?.features || []).forEach((f: any) => {
            const label = (f.properties?.LABEL || f.properties?.label || "TSTM").toUpperCase();
            const color = SPC_COLORS[label] || "#888";
            if (!f.geometry) return;
            L.geoJSON(f, {
              style: {
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: label === "TSTM" ? 0.1 : 0.25,
              },
            })
              .bindPopup(
                `<strong>SPC Day 1 · ${label}</strong><br/>Categorical risk area.`
              )
              .addTo(map);
            outlookCount++;
          });
        }
      } catch (e) {
        console.warn("SPC cat failed", e);
      }

      // Tornado probabilities
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_torn.nolyr.geojson",
          { headers: { "User-Agent": "StormIQ" } }
        );
        if (res.ok) {
          const geo = await res.json();
          (geo?.features || []).forEach((f: any) => {
            const label = String(f.properties?.LABEL || f.properties?.label || "");
            const color = PROB_COLORS[label] || "#00aa00";
            if (!f.geometry) return;
            L.geoJSON(f, {
              style: {
                color,
                weight: 1.5,
                fillColor: color,
                fillOpacity: 0.2,
                dashArray: "4 3",
              },
            })
              .bindPopup(`<strong>Tornado probability · ${label}%</strong>`)
              .addTo(tornLayerRef.current!);
          });
        }
      } catch (e) {
        console.warn("SPC torn failed", e);
      }

      // Hail probabilities
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_hail.nolyr.geojson",
          { headers: { "User-Agent": "StormIQ" } }
        );
        if (res.ok) {
          const geo = await res.json();
          (geo?.features || []).forEach((f: any) => {
            const label = String(f.properties?.LABEL || f.properties?.label || "");
            const color = PROB_COLORS[label] || "#00aa00";
            if (!f.geometry) return;
            L.geoJSON(f, {
              style: {
                color,
                weight: 1.5,
                fillColor: color,
                fillOpacity: 0.18,
                dashArray: "2 4",
              },
            })
              .bindPopup(`<strong>Hail probability · ${label}%</strong>`)
              .addTo(hailLayerRef.current!);
          });
        }
      } catch (e) {
        console.warn("SPC hail failed", e);
      }

      // Live alerts
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ",
            Accept: "application/geo+json",
          },
        });
        if (res.ok) {
          const data = await res.json();
          for (const f of data?.features || []) {
            const props = f.properties || {};
            const event = (props.event || "").toLowerCase();
            if (event.includes("test") || props.status === "Test") continue;

            const interesting =
              event.includes("warning") ||
              event.includes("watch") ||
              event.includes("tornado") ||
              event.includes("thunderstorm") ||
              event.includes("flood") ||
              event.includes("hurricane") ||
              event.includes("tropical") ||
              event.includes("winter") ||
              event.includes("wind");

            if (!interesting) continue;
            const center = getCentroid(f.geometry);
            if (!center) continue;

            const color = severityColor(props.severity);
            L.circleMarker(center, {
              radius: 7,
              color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: 2,
            })
              .bindPopup(
                `<div style="min-width:200px;font-family:system-ui">
                  <strong>${props.event || "Alert"}</strong><br/>
                  <span style="font-size:12px">${props.headline || props.areaDesc || ""}</span><br/>
                  <span style="font-size:11px">Severity: ${props.severity || "—"}</span>
                </div>`
              )
              .addTo(map);

            alertCount++;
            if (alertCount >= 180) break;
          }
        }
      } catch (e) {
        console.warn("NWS failed", e);
      }

      setStatus(`LIVE · ${outlookCount} outlook · ${alertCount} alerts`);
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

  // Radar toggle
  useEffect(() => {
    const radar = radarLayerRef.current;
    const map = mapInstance.current;
    if (!radar || !map) return;
    if (radarOn) {
      if (!map.hasLayer(radar)) radar.addTo(map);
    } else if (map.hasLayer(radar)) {
      map.removeLayer(radar);
    }
  }, [radarOn]);

  // Tornado / Hail layer toggles
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (showTorn && tornLayerRef.current && !map.hasLayer(tornLayerRef.current)) {
      tornLayerRef.current.addTo(map);
    } else if (!showTorn && tornLayerRef.current && map.hasLayer(tornLayerRef.current)) {
      map.removeLayer(tornLayerRef.current);
    }
  }, [showTorn]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (showHail && hailLayerRef.current && !map.hasLayer(hailLayerRef.current)) {
      hailLayerRef.current.addTo(map);
    } else if (!showHail && hailLayerRef.current && map.hasLayer(hailLayerRef.current)) {
      map.removeLayer(hailLayerRef.current);
    }
  }, [showHail]);

  return (
    <div style={{ position: "relative", width: "100%", height: 420, minHeight: 420 }}>
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
        }}
      >
        {status}
      </div>

      {/* Layer toggles */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <button
          onClick={() => setRadarOn((v) => !v)}
          style={btnStyle(radarOn)}
        >
          {radarOn ? "RADAR ON" : "RADAR OFF"}
        </button>
        <button
          onClick={() => setShowTorn((v) => !v)}
          style={btnStyle(showTorn)}
        >
          {showTorn ? "TORNADO ON" : "TORNADO OFF"}
        </button>
        <button
          onClick={() => setShowHail((v) => !v)}
          style={btnStyle(showHail)}
        >
          {showHail ? "HAIL ON" : "HAIL OFF"}
        </button>
      </div>

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
        <div style={{ fontWeight: 700, marginBottom: 3, color: "#edf8f7" }}>SPC Risk</div>
        <div><span style={{ color: "#66cc66" }}>■</span> Marginal</div>
        <div><span style={{ color: "#ffe066" }}>■</span> Slight</div>
        <div><span style={{ color: "#ff9933" }}>■</span> Enhanced</div>
        <div><span style={{ color: "#ff3333" }}>■</span> Moderate</div>
        <div><span style={{ color: "#cc33ff" }}>■</span> High</div>
        <div style={{ marginTop: 4, opacity: 0.85 }}>Radar · Tornado % · Hail %</div>
      </div>
    </div>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(217,255,74,0.18)" : "rgba(5,9,11,0.88)",
    border: active
      ? "1px solid rgba(217,255,74,0.5)"
      : "1px solid rgba(184,221,225,0.22)",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 10,
    color: active ? "#d9ff4a" : "#8fa6a8",
    fontWeight: 700,
    letterSpacing: "0.04em",
    cursor: "pointer",
    textAlign: "left",
  };
}
