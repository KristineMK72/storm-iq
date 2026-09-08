import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { loadHomeBase, type HomeBase } from "../lib/homeBase";

const SPC_COLORS: Record<string, string> = {
  TSTM: "#c1c1c1",
  MRGL: "#66cc66",
  SLGT: "#ffe066",
  ENH: "#ff9933",
  MDT: "#ff3333",
  HIGH: "#cc33ff",
};

const PROB_COLORS: Record<string, string> = {
  "2": "#00bb00",
  "5": "#8bce00",
  "10": "#ffcc00",
  "15": "#ff9900",
  "30": "#ff0000",
  "45": "#ff00ff",
  "60": "#912cee",
};

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Denver", lat: 39.74, lng: -104.99 },
  { name: "Oklahoma City", lat: 35.47, lng: -97.52 },
  { name: "Dallas", lat: 32.78, lng: -96.8 },
  { name: "Kansas City", lat: 39.1, lng: -94.58 },
  { name: "Omaha", lat: 41.26, lng: -95.94 },
  { name: "Minneapolis", lat: 44.98, lng: -93.27 },
  { name: "Chicago", lat: 41.88, lng: -87.63 },
  { name: "St. Louis", lat: 38.63, lng: -90.2 },
  { name: "Memphis", lat: 35.15, lng: -90.05 },
  { name: "Atlanta", lat: 33.75, lng: -84.39 },
  { name: "Nashville", lat: 36.16, lng: -86.78 },
  { name: "Lubbock", lat: 33.58, lng: -101.86 },
  { name: "Amarillo", lat: 35.22, lng: -101.83 },
  { name: "Wichita", lat: 37.69, lng: -97.34 },
  { name: "Des Moines", lat: 41.59, lng: -93.62 },
  { name: "Sioux Falls", lat: 43.55, lng: -96.7 },
];

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

function mapsUrl(lat: number, lng: number, home?: HomeBase | null) {
  if (home) {
    return `https://www.google.com/maps/dir/?api=1&origin=${home.lat},${home.lng}&destination=${lat},${lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export default function StormMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const homeMarkerRef = useRef<L.CircleMarker | null>(null);
  const tornLayerRef = useRef<L.LayerGroup | null>(null);
  const hailLayerRef = useRef<L.LayerGroup | null>(null);

  const [status, setStatus] = useState("Loading layers…");
  const [radarOn, setRadarOn] = useState(true);
  const [showTorn, setShowTorn] = useState(true);
  const [showHail, setShowHail] = useState(false);
  const [showCities, setShowCities] = useState(true);
  const [routeInfo, setRouteInfo] = useState("");

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

    // City points
    const cityGroup = L.layerGroup();
    CITIES.forEach((c) => {
      L.circleMarker([c.lat, c.lng], {
        radius: 4,
        color: "#8fa6a8",
        fillColor: "#edf8f7",
        fillOpacity: 0.85,
        weight: 1,
      })
        .bindTooltip(c.name, {
          permanent: true,
          direction: "right",
          offset: [6, 0],
          className: "city-label",
        })
        .addTo(cityGroup);
    });
    cityGroup.addTo(map);
    (map as any)._cityGroup = cityGroup;

    // Home base pin
    const home = loadHomeBase();
    if (home) {
      const hm = L.circleMarker([home.lat, home.lng], {
        radius: 9,
        color: "#d9ff4a",
        fillColor: "#d9ff4a",
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindPopup("<strong>Home base</strong><br/>Your starting point")
        .addTo(map);
      homeMarkerRef.current = hm;
    }

    mapInstance.current = map;

    // Expose route helper for popup buttons
    (window as any).__stormiqRouteTo = async (lat: number, lng: number) => {
      const h = loadHomeBase();
      if (!h) {
        setRouteInfo("Set Home base on Command page first");
        return;
      }

      setRouteInfo("Routing…");

      // Clear old route
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${h.lng},${h.lat};${lng},${lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("route failed");
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        const duration = data?.routes?.[0]?.duration;
        const distance = data?.routes?.[0]?.distance;

        if (!coords?.length) throw new Error("no geometry");

        const latlngs = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
        const line = L.polyline(latlngs, {
          color: "#d9ff4a",
          weight: 4,
          opacity: 0.9,
        }).addTo(map);

        routeLayerRef.current = line;
        map.fitBounds(line.getBounds(), { padding: [40, 40] });

        const mins = Math.round((duration || 0) / 60);
        const miles = Math.round((distance || 0) / 1609.34);
        const hPart = Math.floor(mins / 60);
        const mPart = mins % 60;
        const eta = hPart ? `${hPart}h ${mPart}m` : `${mPart} min`;
        setRouteInfo(`Route · ${eta} · ${miles} mi`);
      } catch {
        // Fallback: straight line
        const line = L.polyline(
          [
            [h.lat, h.lng],
            [lat, lng],
          ],
          { color: "#d9ff4a", weight: 3, opacity: 0.8, dashArray: "6 6" }
        ).addTo(map);
        routeLayerRef.current = line;
        map.fitBounds(line.getBounds(), { padding: [40, 40] });
        setRouteInfo("Straight-line path (routing unavailable)");
      }
    };

    (window as any).__stormiqClearRoute = () => {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      setRouteInfo("");
    };

    const resize = () => map.invalidateSize();
    setTimeout(resize, 100);
    setTimeout(resize, 400);
    window.addEventListener("resize", resize);

    async function loadLayers() {
      let outlookCount = 0;
      let alertCount = 0;
      const currentHome = loadHomeBase();

      // Categorical
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson"
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
              .bindPopup(`<strong>SPC Day 1 · ${label}</strong><br/>Categorical risk area.`)
              .addTo(map);
            outlookCount++;
          });
        }
      } catch (e) {
        console.warn("SPC cat failed", e);
      }

      // Tornado probs
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_torn.nolyr.geojson"
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

      // Hail probs
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_hail.nolyr.geojson"
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

      // Alerts with route actions
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

            const [lat, lng] = center;
            const color = severityColor(props.severity);
            const gmaps = mapsUrl(lat, lng, currentHome);

            const popup = `
              <div style="min-width:210px;font-family:system-ui;line-height:1.4">
                <strong style="font-size:13px">${props.event || "Alert"}</strong><br/>
                <span style="font-size:12px;color:#333">${props.headline || props.areaDesc || ""}</span><br/>
                <span style="font-size:11px;color:#555">Severity: ${props.severity || "—"}</span>
                <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
                  <button
                    onclick="window.__stormiqRouteTo(${lat},${lng})"
                    style="background:#111;color:#d9ff4a;border:1px solid #d9ff4a;border-radius:6px;padding:6px 8px;font-weight:700;font-size:11px;cursor:pointer"
                  >ROUTE FROM HOME</button>
                  <a href="${gmaps}" target="_blank" rel="noopener"
                     style="text-align:center;background:#0a7;color:#fff;border-radius:6px;padding:6px 8px;font-weight:700;font-size:11px;text-decoration:none">
                    OPEN IN MAPS
                  </a>
                </div>
              </div>`;

            L.circleMarker(center, {
              radius: 7,
              color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: 2,
            })
              .bindPopup(popup, { maxWidth: 280 })
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

    // Style city tooltips lightly via injected CSS once
    if (!document.getElementById("stormiq-city-css")) {
      const style = document.createElement("style");
      style.id = "stormiq-city-css";
      style.textContent = `
        .city-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #b8c8ca !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          text-shadow: 0 1px 2px #000;
        }
        .city-label::before { display: none !important; }
      `;
      document.head.appendChild(style);
    }

    return () => {
      window.removeEventListener("resize", resize);
      delete (window as any).__stormiqRouteTo;
      delete (window as any).__stormiqClearRoute;
      map.remove();
      mapInstance.current = null;
      radarLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const radar = radarLayerRef.current;
    const map = mapInstance.current;
    if (!radar || !map) return;
    if (radarOn) {
      if (!map.hasLayer(radar)) radar.addTo(map);
    } else if (map.hasLayer(radar)) map.removeLayer(radar);
  }, [radarOn]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (showTorn && tornLayerRef.current && !map.hasLayer(tornLayerRef.current))
      tornLayerRef.current.addTo(map);
    else if (!showTorn && tornLayerRef.current && map.hasLayer(tornLayerRef.current))
      map.removeLayer(tornLayerRef.current);
  }, [showTorn]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (showHail && hailLayerRef.current && !map.hasLayer(hailLayerRef.current))
      hailLayerRef.current.addTo(map);
    else if (!showHail && hailLayerRef.current && map.hasLayer(hailLayerRef.current))
      map.removeLayer(hailLayerRef.current);
  }, [showHail]);

  useEffect(() => {
    const map = mapInstance.current as any;
    if (!map?._cityGroup) return;
    if (showCities) map._cityGroup.addTo(map);
    else map.removeLayer(map._cityGroup);
  }, [showCities]);

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
          maxWidth: 220,
        }}
      >
        {routeInfo || status}
      </div>

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
        <button onClick={() => setRadarOn((v) => !v)} style={btnStyle(radarOn)}>
          {radarOn ? "RADAR ON" : "RADAR OFF"}
        </button>
        <button onClick={() => setShowTorn((v) => !v)} style={btnStyle(showTorn)}>
          {showTorn ? "TORNADO ON" : "TORNADO OFF"}
        </button>
        <button onClick={() => setShowHail((v) => !v)} style={btnStyle(showHail)}>
          {showHail ? "HAIL ON" : "HAIL OFF"}
        </button>
        <button onClick={() => setShowCities((v) => !v)} style={btnStyle(showCities)}>
          {showCities ? "CITIES ON" : "CITIES OFF"}
        </button>
        {routeInfo && (
          <button
            onClick={() => (window as any).__stormiqClearRoute?.()}
            style={btnStyle(false)}
          >
            CLEAR ROUTE
          </button>
        )}
      </div>

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
        <div style={{ fontWeight: 700, marginBottom: 3, color: "#edf8f7" }}>Layers</div>
        <div>Tap alert → Route / Maps</div>
        <div style={{ opacity: 0.85 }}>Lime pin = home base</div>
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
