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
  else if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries || []) {
      const c = getCentroid(g);
      if (c) return c;
    }
    return null;
  } else return null;
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

function hasDrawableGeometry(geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "GeometryCollection") {
    return (geometry.geometries || []).some((g: any) => hasDrawableGeometry(g));
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") return true;
  if (geometry.type === "Point") return true;
  return false;
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

function isDangerousEvent(event?: string): boolean {
  const e = (event || "").toLowerCase();
  return (
    e.includes("tornado warning") ||
    e.includes("flash flood warning") ||
    e.includes("hurricane warning") ||
    e.includes("extreme")
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

export default function StormMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const tornLayerRef = useRef<L.LayerGroup | null>(null);
  const hailLayerRef = useRef<L.LayerGroup | null>(null);
  const dynamicRef = useRef<L.LayerGroup | null>(null);

  const [status, setStatus] = useState("Loading layers…");
  const [radarOn, setRadarOn] = useState(true);
  const [showTorn, setShowTorn] = useState(true);
  const [showHail, setShowHail] = useState(true); // ON by default
  const [showCities, setShowCities] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [routeInfo, setRouteInfo] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [selected, setSelected] = useState<{
    lat: number;
    lng: number;
    title: string;
    dangerous: boolean;
  } | null>(null);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const showPolygonsRef = useRef(showPolygons);
  showPolygonsRef.current = showPolygons;

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
        opacity: 0.55,
        zIndex: 200,
        maxZoom: 12,
      }
    );
    radar.addTo(map);
    radarLayerRef.current = radar;

    tornLayerRef.current = L.layerGroup().addTo(map);
    hailLayerRef.current = L.layerGroup().addTo(map); // start on map
    dynamicRef.current = L.layerGroup().addTo(map);

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

    const home = loadHomeBase();
    if (home) {
      L.circleMarker([home.lat, home.lng], {
        radius: 9,
        color: "#d9ff4a",
        fillColor: "#d9ff4a",
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindPopup("<strong>Home base</strong><br/>Your starting point")
        .addTo(map);
    }

    mapInstance.current = map;

    const resize = () => map.invalidateSize();
    setTimeout(resize, 100);
    setTimeout(resize, 400);
    window.addEventListener("resize", resize);

    async function loadLayers() {
      const map = mapInstance.current;
      if (!map || !dynamicRef.current || !tornLayerRef.current || !hailLayerRef.current) return;

      dynamicRef.current.clearLayers();
      tornLayerRef.current.clearLayers();
      hailLayerRef.current.clearLayers();

      let outlookCount = 0;
      let alertCount = 0;
      let hailCount = 0;
      let tornCount = 0;

      // Day 1 categorical
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson"
        );
        if (res.ok) {
          const geo = await res.json();
          (geo?.features || []).forEach((f: any) => {
            const label = (f.properties?.LABEL || f.properties?.label || "TSTM").toUpperCase();
            const color = SPC_COLORS[label] || "#888";
            if (!hasDrawableGeometry(f.geometry)) return;
            L.geoJSON(f, {
              style: {
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: label === "TSTM" ? 0.08 : 0.22,
              },
            })
              .bindPopup(
                `<strong>SPC Day 1 · ${label}</strong><br/>Categorical severe risk area.`
              )
              .addTo(dynamicRef.current!);
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
            if (!hasDrawableGeometry(f.geometry)) return;
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
            tornCount++;
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
            if (!hasDrawableGeometry(f.geometry)) return;
            L.geoJSON(f, {
              style: {
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.22,
                dashArray: "2 4",
              },
            })
              .bindPopup(`<strong>Hail probability · ${label}%</strong>`)
              .addTo(hailLayerRef.current!);
            hailCount++;
          });
        }
      } catch (e) {
        console.warn("SPC hail failed", e);
      }

      // Live NWS alerts — polygons + markers
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (res.ok) {
          const data = await res.json();
          for (const f of data?.features || []) {
            const props = f.properties || {};
            const eventName = props.event || "Alert";
            const event = eventName.toLowerCase();
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

            const color = severityColor(props.severity);
            const dangerous = isDangerousEvent(eventName);
            const center = getCentroid(f.geometry);

            const detail = `
              <div style="min-width:200px;font-family:system-ui;line-height:1.4">
                <strong>${eventName}</strong><br/>
                <span style="font-size:12px;color:#333">${props.headline || props.areaDesc || ""}</span><br/>
                <span style="font-size:11px;color:#555">
                  Severity: ${props.severity || "—"}<br/>
                  Urgency: ${props.urgency || "—"}<br/>
                  ${props.expires ? "Expires: " + new Date(props.expires).toLocaleString() : ""}
                </span>
                <div style="margin-top:8px;font-size:11px;color:#666">Tap marker for route panel</div>
              </div>`;

            // Full polygon when geometry exists
            if (showPolygonsRef.current && hasDrawableGeometry(f.geometry) && f.geometry?.type !== "Point") {
              try {
                L.geoJSON(f, {
                  style: {
                    color,
                    weight: event.includes("warning") ? 2.5 : 1.5,
                    fillColor: color,
                    fillOpacity: event.includes("warning") ? 0.22 : 0.12,
                  },
                })
                  .bindPopup(detail)
                  .addTo(dynamicRef.current!);
              } catch {
                // skip bad geometry
              }
            }

            if (center) {
              const [lat, lng] = center;
              const marker = L.circleMarker(center, {
                radius: event.includes("warning") ? 8 : 6,
                color,
                fillColor: color,
                fillOpacity: 0.95,
                weight: 2,
              }).addTo(dynamicRef.current!);

              marker.bindPopup(detail);
              marker.on("click", () => {
                setSelected({ lat, lng, title: eventName, dangerous });
              });
            }

            alertCount++;
            if (alertCount >= 200) break;
          }
        }
      } catch (e) {
        console.warn("NWS failed", e);
      }

      const hailNote =
        hailCount === 0 ? " · hail none" : ` · hail ${hailCount}`;
      const tornNote =
        tornCount === 0 ? "" : ` · torn ${tornCount}`;

      setStatus(`LIVE · ${outlookCount} outlook · ${alertCount} alerts${tornNote}${hailNote}`);
      setLastRefresh(new Date().toLocaleTimeString());
      setTimeout(() => map.invalidateSize(), 80);
    }

    loadLayers();
    const interval = window.setInterval(loadLayers, 180000); // 3 min

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
      window.clearInterval(interval);
      window.removeEventListener("resize", resize);
      map.remove();
      mapInstance.current = null;
      radarLayerRef.current = null;
    };
  }, []);

  async function drawRoute() {
    const map = mapInstance.current;
    const dest = selectedRef.current;
    if (!map || !dest) return;

    const home = loadHomeBase();
    if (!home) {
      setRouteInfo("Set Home base on Command page first");
      return;
    }

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    setRouteInfo("Routing…");

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${home.lng},${home.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      const coords = data?.routes?.[0]?.geometry?.coordinates;
      const duration = data?.routes?.[0]?.duration;
      const distance = data?.routes?.[0]?.distance;
      if (!coords?.length) throw new Error("no geom");

      const latlngs = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
      const line = L.polyline(latlngs, {
        color: "#d9ff4a",
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
      routeLayerRef.current = line;
      map.fitBounds(line.getBounds(), { padding: [36, 36] });

      const mins = Math.round((duration || 0) / 60);
      const miles = Math.round((distance || 0) / 1609.34);
      const hPart = Math.floor(mins / 60);
      const mPart = mins % 60;
      const eta = hPart ? `${hPart}h ${mPart}m` : `${mPart} min`;
      setRouteInfo(`${eta} · ${miles} mi`);
    } catch {
      const line = L.polyline(
        [
          [home.lat, home.lng],
          [dest.lat, dest.lng],
        ],
        { color: "#d9ff4a", weight: 3, opacity: 0.85, dashArray: "6 6" }
      ).addTo(map);
      routeLayerRef.current = line;
      map.fitBounds(line.getBounds(), { padding: [36, 36] });
      setRouteInfo("Straight path (live routing unavailable)");
    }
  }

  function clearRoute() {
    const map = mapInstance.current;
    if (map && routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    setRouteInfo("");
    setSelected(null);
  }

  function openMaps() {
    const dest = selected;
    if (!dest) return;
    const home = loadHomeBase();
    window.open(mapsUrl(dest.lat, dest.lng, home), "_blank", "noopener");
  }

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
        <div>{routeInfo || status}</div>
        {lastRefresh && !routeInfo && (
          <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>Updated {lastRefresh}</div>
        )}
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
        <button onClick={() => setShowPolygons((v) => !v)} style={btnStyle(showPolygons)}>
          {showPolygons ? "POLYGONS ON" : "POLYGONS OFF"}
        </button>
        <button onClick={() => setShowCities((v) => !v)} style={btnStyle(showCities)}>
          {showCities ? "CITIES ON" : "CITIES OFF"}
        </button>
      </div>

      {selected && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 16,
            zIndex: 1100,
            background: "rgba(5,9,11,0.94)",
            border: selected.dangerous
              ? "1px solid rgba(255,92,92,0.55)"
              : "1px solid rgba(217,255,74,0.35)",
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#edf8f7", marginBottom: 4 }}>
            {selected.title}
          </div>

          {selected.dangerous && (
            <div style={{ fontSize: 11, color: "#ff8a8a", marginBottom: 8, lineHeight: 1.4 }}>
              ⚠ Active danger zone. Route goes toward a warning — not around it.
              Do not drive into tornado/flash-flood cores.
            </div>
          )}

          {!selected.dangerous && (
            <div style={{ fontSize: 11, color: "#8fa6a8", marginBottom: 8 }}>
              Routes are point-to-point only — they do not auto-avoid storm cores.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={drawRoute}
              style={{
                background: "rgba(217,255,74,0.16)",
                border: "1px solid rgba(217,255,74,0.45)",
                color: "#d9ff4a",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              SHOW ROUTE
            </button>
            <button
              onClick={openMaps}
              style={{
                background: "rgba(82,224,208,0.12)",
                border: "1px solid rgba(82,224,208,0.35)",
                color: "#52e0d0",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              OPEN IN MAPS
            </button>
            <button
              onClick={clearRoute}
              style={{
                background: "transparent",
                border: "1px solid rgba(184,221,225,0.2)",
                color: "#8fa6a8",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
