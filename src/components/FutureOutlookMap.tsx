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

function hasDrawableGeometry(geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "GeometryCollection") {
    return (geometry.geometries || []).some((g: any) => hasDrawableGeometry(g));
  }
  return (
    geometry.type === "Polygon" ||
    geometry.type === "MultiPolygon" ||
    geometry.type === "Point"
  );
}

type DayKey = "day2" | "day3";

const SOURCES: Record<
  DayKey,
  { label: string; url: string; html: string }
> = {
  day2: {
    label: "Day 2",
    url: "https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson",
    html: "https://www.spc.noaa.gov/products/outlook/day2otlk.html",
  },
  day3: {
    label: "Day 3",
    url: "https://www.spc.noaa.gov/products/outlook/day3otlk_cat.nolyr.geojson",
    html: "https://www.spc.noaa.gov/products/outlook/day3otlk.html",
  },
};

export default function FutureOutlookMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [day, setDay] = useState<DayKey>("day2");
  const [status, setStatus] = useState("Loading outlook…");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [39.5, -98.0],
      zoom: 4,
      zoomControl: true,
      minZoom: 3,
      maxZoom: 10,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
        maxZoom: 16,
      }
    ).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    const resize = () => map.invalidateSize();
    setTimeout(resize, 120);
    setTimeout(resize, 400);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const group = layerRef.current;
    if (!map || !group) return;

    let cancelled = false;

    async function load() {
      group!.clearLayers();
      setStatus(`Loading ${SOURCES[day].label}…`);
      setCounts({});

      try {
        const res = await fetch(SOURCES[day].url, {
          headers: { "User-Agent": "StormIQ (https://storm-iq.vercel.app)" },
        });
        if (!res.ok) throw new Error("fetch failed");
        const geo = await res.json();
        if (cancelled) return;

        const tally: Record<string, number> = {};
        let drawn = 0;

        (geo?.features || []).forEach((f: any) => {
          const label = (f.properties?.LABEL || f.properties?.label || "TSTM").toUpperCase();
          if (!hasDrawableGeometry(f.geometry)) return;

          const color = SPC_COLORS[label] || "#888";
          tally[label] = (tally[label] || 0) + 1;

          L.geoJSON(f, {
            style: {
              color,
              weight: label === "TSTM" ? 1 : 2.5,
              fillColor: color,
              fillOpacity: label === "TSTM" ? 0.08 : 0.28,
            },
          })
            .bindPopup(
              `<div style="font-family:system-ui;min-width:180px">
                <strong>SPC ${SOURCES[day].label} · ${label}</strong><br/>
                <span style="font-size:12px;color:#333">
                  Potential future severe area — outlook only, not a warning.
                </span><br/>
                <a href="${SOURCES[day].html}" target="_blank" rel="noopener"
                   style="font-size:11px;color:#0a7">Full ${SOURCES[day].label} discussion →</a>
              </div>`
            )
            .addTo(group!);

          drawn++;
        });

        setCounts(tally);

        if (drawn === 0) {
          setStatus(`${SOURCES[day].label} · no categorical areas drawn`);
        } else {
          setStatus(`${SOURCES[day].label} · ${drawn} risk area${drawn === 1 ? "" : "s"}`);
        }

        setTimeout(() => map!.invalidateSize(), 80);
      } catch {
        if (!cancelled) setStatus(`Could not load ${SOURCES[day].label} outlook`);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [day]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {(["day2", "day3"] as DayKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDay(key)}
              style={{
                background:
                  day === key ? "rgba(217,255,74,0.16)" : "rgba(0,0,0,0.25)",
                border:
                  day === key
                    ? "1px solid rgba(217,255,74,0.45)"
                    : "1px solid var(--line)",
                color: day === key ? "#d9ff4a" : "var(--muted)",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {SOURCES[key].label}
            </button>
          ))}
        </div>

        <span className="small muted">{status}</span>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 420,
          minHeight: 420,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--line)",
          background: "#071014",
        }}
      >
        <div
          ref={mapRef}
          style={{ width: "100%", height: "100%", minHeight: 420 }}
        />

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
          <div style={{ fontWeight: 700, marginBottom: 3, color: "#edf8f7" }}>
            Future risk
          </div>
          <div><span style={{ color: "#66cc66" }}>■</span> Marginal</div>
          <div><span style={{ color: "#ffe066" }}>■</span> Slight</div>
          <div><span style={{ color: "#ff9933" }}>■</span> Enhanced</div>
          <div><span style={{ color: "#ff3333" }}>■</span> Moderate</div>
          <div><span style={{ color: "#cc33ff" }}>■</span> High</div>
        </div>
      </div>

      {Object.keys(counts).length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 10,
          }}
        >
          {Object.entries(counts).map(([label, n]) => (
            <span
              key={label}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                color: SPC_COLORS[label] || "var(--muted)",
              }}
            >
              {label} × {n}
            </span>
          ))}
        </div>
      )}

      <p className="small muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
        These are <strong style={{ color: "var(--text)" }}>outlook target areas</strong> for
        planning — not watches or warnings. When Day 1 arrives, use the live operations
        map and official NWS products.{" "}
        <a
          href={SOURCES[day].html}
          target="_blank"
          rel="noopener"
          style={{ color: "var(--cyan)", fontWeight: 600 }}
        >
          Full {SOURCES[day].label} discussion →
        </a>
        {" · "}
        <a
          href="https://www.spc.noaa.gov/products/exper/day4-8/"
          target="_blank"
          rel="noopener"
          style={{ color: "var(--cyan)", fontWeight: 600 }}
        >
          Day 4–8 →
        </a>
      </p>
    </div>
  );
}
