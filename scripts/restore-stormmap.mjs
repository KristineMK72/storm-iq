#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "src/components/StormMap.tsx");
const SOURCE =
  "https://raw.githubusercontent.com/KristineMK72/storm-iq/e6f7b0c2/src/components/StormMap.tsx";

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error("restore-stormmap: fetch failed", res.status);
  process.exit(1);
}
let t = await res.text();

t = t.replace(
  `function frameLabel(frame: string): string {
  if (!frame) return "now";
  return "−" + frame.replace("m", "") + "m";
}
`,
  `function frameMinutesAgo(frame: string): number {
  if (!frame) return 0;
  const n = parseInt(frame.replace("m", ""), 10);
  return Number.isFinite(n) ? n : 0;
}
function frameLabel(frame: string): string {
  if (!frame) return "Now";
  return "−" + frame.replace("m", "") + " min";
}
function frameClockLabel(frame: string): string {
  const mins = frameMinutesAgo(frame);
  return new Date(Date.now() - mins * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
`
);
t = t.replace(
  "{frameLabel(RADAR_FRAMES[radarFrame] || \"\")}",
  '{frameLabel(RADAR_FRAMES[radarFrame] || "") + " · " + frameClockLabel(RADAR_FRAMES[radarFrame] || "")}'
);

if (!t.includes("MapLayerLegends")) {
  t = t.replace(
    'from "../lib/nhc";',
    'from "../lib/nhc";\nimport { MapLayerLegends } from "./MapLayerLegends";'
  );
}

if (!t.includes("mapShare")) {
  t = t.replace(
    'from "../lib/nhc";',
    'from "../lib/nhc";\nimport { parseMapShare, shareMapView, syncMapShareToUrl } from "../lib/mapShare";'
  );
}

t = t.replace(
  `pointToLayer: (_f, latlng) =>
                  L.circleMarker(latlng, {
                    radius: 4, color: "#edf8f7", fillColor: color, fillOpacity: 0.95, weight: 1,
                  }),`,
  `pointToLayer: (feature, latlng) => {
                  const p = (feature as any)?.properties || {};
                  const tau = p.tau != null ? Number(p.tau) : null;
                  const isNow = tau === 0;
                  const when = p.datelbl || p.fldatelbl || (tau != null ? "F+" + tau + "h" : "forecast");
                  const wind = p.maxwind != null && Number(p.maxwind) < 9000 ? Number(p.maxwind) + " kt" : "";
                  const stage = p.tcdvlp || p.stormtype || "";
                  const title = (p.stormname || stormLabel(s) || "Cyclone").toString();
                  const cardHtml =
                    '<div class="stormiq-hcard' + (isNow ? ' stormiq-hcard-now' : '') + '">' +
                    '<div class="stormiq-hcard-ico">🌀</div>' +
                    '<div class="stormiq-hcard-body">' +
                    '<strong>' + when + (wind ? ' · ' + wind : '') + '</strong>' +
                    (stage ? '<span>' + stage + '</span>' : '') +
                    (tau != null ? '<em>+' + tau + 'h · ' + title + '</em>' : '<em>' + title + '</em>') +
                    '</div></div>';
                  const icon = L.divIcon({
                    className: 'stormiq-hcard-wrap',
                    html: cardHtml,
                    iconSize: [158, 52],
                    iconAnchor: [20, 26],
                  });
                  const m = L.marker(latlng, { icon, zIndexOffset: isNow ? 600 : 400 });
                  m.bindPopup(
                    '<div style="min-width:160px">' +
                    '<div style="font-size:18px;margin-bottom:4px">🌀</div>' +
                    '<strong style="color:#edf8f7">' + title + '</strong><br/>' +
                    '<span style="color:#ffd166">' + when + (wind ? ' · ' + wind : '') + '</span>' +
                    (stage ? '<br/><span style="color:#8fa6a8">' + stage + '</span>' : '') +
                    (tau != null ? '<br/><span style="color:#6b8082">+' + tau + 'h from advisory</span>' : '') +
                    (p.advdate ? '<br/><span style="color:#6b8082">Adv ' + (p.advisnum || '') + ' · ' + p.advdate + '</span>' : '') +
                    '</div>'
                  );
                  return m;
                },`
);

t = t.replace(
  "fillColor: color, fillOpacity: 0.12, opacity: 0.7",
  "fillColor: color, fillOpacity: 0.16, opacity: 0.85"
);
t = t.replace(
  "style: { color, weight: 3, opacity: 0.95 }",
  "style: { color, weight: 3.5, opacity: 1 }"
);

t = t.replace(
  "const [radarOn, setRadarOn] = useState(true);",
  "const [radarOn, setRadarOn] = useState(() => parseMapShare().radar ?? true);"
);
t = t.replace(
  "const [cloudsOn, setCloudsOn] = useState(false);",
  "const [cloudsOn, setCloudsOn] = useState(() => parseMapShare().clouds ?? false);"
);
t = t.replace(
  "const [showTropical, setShowTropical] = useState(true);",
  "const [showTropical, setShowTropical] = useState(() => parseMapShare().tropical ?? true);"
);
if (!t.includes("shareNote")) {
  t = t.replace(
    "const [selected, setSelected] = useState<",
    'const [shareNote, setShareNote] = useState("");\n  const [selected, setSelected] = useState<'
  );
}

t = t.replace(
  `const map = L.map(mapRef.current, {
      center: [39.5, -98.0],
      zoom: 4,
      zoomControl: true,
      minZoom: 3,
      maxZoom: 12,
    });`,
  `const share0 = parseMapShare();
    const map = L.map(mapRef.current, {
      center: [share0.lat ?? 39.5, share0.lng ?? -98.0],
      zoom: share0.z ?? 4,
      zoomControl: true,
      minZoom: 3,
      maxZoom: 12,
    });
    if (!map.getPane("outlookPane")) {
      map.createPane("outlookPane");
      const op = map.getPane("outlookPane");
      if (op) op.style.zIndex = "450";
    }`
);

if (!t.includes("syncMapShareToUrl")) {
  t = t.replace(
    "mapInstance.current = map;",
    `if (!document.getElementById("stormiq-fcst-tip-css")) {
      const st = document.createElement("style");
      st.id = "stormiq-fcst-tip-css";
      st.textContent =
        ".stormiq-fcst-tip{background:rgba(5,9,11,0.92)!important;border:1px solid rgba(255,157,67,0.4)!important;" +
        "color:#ffd166!important;font-size:10px!important;font-weight:700!important;padding:3px 7px!important;" +
        "border-radius:6px!important;box-shadow:0 2px 8px rgba(0,0,0,0.4)!important;}" +
        ".stormiq-fcst-tip::before{border-top-color:rgba(5,9,11,0.92)!important;}";
      document.head.appendChild(st);
    }
    const pushShareUrl = () => {
      const c = map.getCenter();
      syncMapShareToUrl({
        lat: c.lat,
        lng: c.lng,
        z: map.getZoom(),
        radar: radarOn,
        clouds: cloudsOn,
        tropical: showTropical,
      });
    };
    map.on("moveend", pushShareUrl);
    map.on("zoomend", pushShareUrl);
    pushShareUrl();
    mapInstance.current = map;`
  );
}

if (!t.includes("<MapLayerLegends")) {
  t = t.replace(
    `  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: chaseMode ? "min(78vh, 820px)" : "min(72vh, 720px)",
      }}
    >`,
    `  return (
    <div style={{ width: "100%" }}>
    <div
      style={{
        position: "relative",
        width: "100%",
        height: chaseMode ? "min(78vh, 820px)" : "min(72vh, 720px)",
      }}
    >`
  );
  t = t.replace(
    `            CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}`,
    `            CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
    <MapLayerLegends />
    </div>
  );
}`
  );
}

if (!t.includes("shareMapView({")) {
  t = t.replace(
    "style={btnStyle(false)}\n          >\n            ↻\n          </button>",
    "style={btnStyle(false)}\n          >\n            ↻\n          </button>\n            <button\n              type=\"button\"\n              onClick={async () => {\n                const map = mapInstance.current;\n                if (!map) return;\n                const c = map.getCenter();\n                const result = await shareMapView({\n                  lat: c.lat,\n                  lng: c.lng,\n                  z: map.getZoom(),\n                  radar: radarOn,\n                  clouds: cloudsOn,\n                  tropical: showTropical,\n                });\n                setShareNote(result === \"shared\" ? \"Shared\" : result === \"copied\" ? \"Link copied\" : \"Could not share\");\n                window.setTimeout(() => setShareNote(\"\"), 2500);\n              }}\n              style={btnStyle(!!shareNote)}\n              title=\"Share this map view\"\n            >\n              {shareNote || \"🔗 SHARE\"}\n            </button>"
  );
}

// SPC Outlook visibility
t = t.replace(
  `try {
          const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson");
          if (res.ok) {
            const geo = await res.json();
            for (const f of geo?.features || []) {
              const label = (f.properties?.LABEL || "").toUpperCase();
              const color =
                label === "HIGH" ? "#ff2d55" : label === "MDT" ? "#ff5c5c" : label === "ENH" ? "#ff9f43" : label === "SLGT" ? "#ffd166" : label === "MRGL" ? "#52e0d0" : "#4a6670";
              L.geoJSON(f, {
                style: { color, weight: 2, fillColor: color, fillOpacity: label === "TSTM" ? 0.08 : 0.22 },
              }).addTo(tornLayerRef.current!);
            }
          }
        } catch { /* */ }

        try {
          const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_hail.nolyr.geojson");
          if (res.ok) {
            const geo = await res.json();
            for (const f of geo?.features || []) {
              L.geoJSON(f, {
                style: { color: "#c084fc", weight: 1.5, fillColor: "#c084fc", fillOpacity: 0.2, dashArray: "4 3" },
              }).addTo(hailLayerRef.current!);
            }
          }
        } catch { /* */ }`,
  `const outlookLabels: string[] = [];
        const catColor = (label: string) =>
          label === "HIGH" ? "#cc33ff" : label === "MDT" ? "#ff3333" : label === "ENH" ? "#ff9933" : label === "SLGT" ? "#ffe066" : label === "MRGL" ? "#66cc66" : label === "TSTM" ? "#9aa5a8" : "#4a6670";
        const catFill = (label: string) =>
          label === "HIGH" ? 0.45 : label === "MDT" ? 0.4 : label === "ENH" ? 0.35 : label === "SLGT" ? 0.32 : label === "MRGL" ? 0.28 : 0.14;
        try {
          const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson");
          if (res.ok) {
            const geo = await res.json();
            for (const f of geo?.features || []) {
              const label = String(f.properties?.LABEL || f.properties?.label || "").toUpperCase();
              if (label && !outlookLabels.includes(label)) outlookLabels.push(label);
              const color = catColor(label);
              L.geoJSON(f as any, {
                pane: "outlookPane",
                style: { color, weight: label === "TSTM" ? 1.5 : 2.5, fillColor: color, fillOpacity: catFill(label), opacity: 0.95 },
                onEachFeature: (feat, layer) => {
                  const lab = String(feat.properties?.LABEL || "").toUpperCase() || "Outlook";
                  layer.bindPopup("<strong style=\\"color:#edf8f7\\">SPC Day 1 · " + lab + "</strong><br/><span style=\\"color:#8fa6a8\\">Categorical severe outlook</span>");
                },
              }).addTo(tornLayerRef.current!);
            }
          }
        } catch { /* */ }

        for (const [url, stroke, name] of [
          ["https://www.spc.noaa.gov/products/outlook/day1otlk_torn.nolyr.geojson", "#ff2d55", "Tornado"],
          ["https://www.spc.noaa.gov/products/outlook/day1otlk_wind.nolyr.geojson", "#ffd166", "Wind"],
        ] as const) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const geo = await res.json();
            for (const f of geo?.features || []) {
              const lab = String(f.properties?.LABEL || f.properties?.label || name);
              L.geoJSON(f as any, {
                pane: "outlookPane",
                style: { color: stroke, weight: 2, fillColor: stroke, fillOpacity: 0.18, opacity: 0.9, dashArray: "5 4" },
                onEachFeature: (feat, layer) => {
                  layer.bindPopup("<strong style=\\"color:#edf8f7\\">SPC Day 1 · " + name + "</strong><br/><span style=\\"color:#8fa6a8\\">" + lab + "</span>");
                },
              }).addTo(tornLayerRef.current!);
            }
          } catch { /* */ }
        }

        try {
          const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_hail.nolyr.geojson");
          if (res.ok) {
            const geo = await res.json();
            for (const f of geo?.features || []) {
              const lab = String(f.properties?.LABEL || f.properties?.label || "Hail");
              L.geoJSON(f as any, {
                pane: "outlookPane",
                style: { color: "#c084fc", weight: 2, fillColor: "#c084fc", fillOpacity: 0.22, dashArray: "4 3", opacity: 0.95 },
                onEachFeature: (feat, layer) => {
                  layer.bindPopup("<strong style=\\"color:#edf8f7\\">SPC Day 1 · Hail</strong><br/><span style=\\"color:#8fa6a8\\">" + lab + "</span>");
                },
              }).addTo(hailLayerRef.current!);
            }
          }
        } catch { /* */ }
        (mapInstance.current as any)._outlookLabels = outlookLabels;`
);

t = t.replace(
  'setStatus(n + " alert features · SPC outlook");',
  'const ol = ((mapInstance.current as any)._outlookLabels || []) as string[];\n          setStatus(n + " alert features · SPC " + (ol.length ? ol.join("/") : "outlook"));'
);

t = t.replace(
  '{showTorn ? "OUTLOOK ON" : "OUTLOOK"}',
  '{showTorn ? "SPC DAY 1 ON" : "SPC DAY 1"}'
);

// Cities more prominent — expanded list + Esri labels + permanent major names
t = t.replace(
  `const CITIES = [
  { name: "OKC", lat: 35.47, lng: -97.52 },
  { name: "DFW", lat: 32.78, lng: -96.8 },
  { name: "Denver", lat: 39.74, lng: -104.99 },
  { name: "Chicago", lat: 41.88, lng: -87.63 },
  { name: "Atlanta", lat: 33.75, lng: -84.39 },
  { name: "Omaha", lat: 41.26, lng: -95.94 },
  { name: "St Louis", lat: 38.63, lng: -90.2 },
  { name: "Memphis", lat: 35.15, lng: -90.05 },
  { name: "Wichita", lat: 37.69, lng: -97.34 },
  { name: "Amarillo", lat: 35.22, lng: -101.83 },
];`,
  `const CITIES: { name: string; lat: number; lng: number; major?: boolean }[] = [
  { name: "OKC", lat: 35.4676, lng: -97.5164, major: true },
  { name: "Dallas", lat: 32.7767, lng: -96.797, major: true },
  { name: "Houston", lat: 29.7604, lng: -95.3698, major: true },
  { name: "San Antonio", lat: 29.4241, lng: -98.4936, major: true },
  { name: "Austin", lat: 30.2672, lng: -97.7431, major: true },
  { name: "Denver", lat: 39.7392, lng: -104.9903, major: true },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, major: true },
  { name: "Atlanta", lat: 33.749, lng: -84.388, major: true },
  { name: "Kansas City", lat: 39.0997, lng: -94.5786, major: true },
  { name: "St Louis", lat: 38.627, lng: -90.1994, major: true },
  { name: "Minneapolis", lat: 44.9778, lng: -93.265, major: true },
  { name: "New Orleans", lat: 29.9511, lng: -90.0715, major: true },
  { name: "Nashville", lat: 36.1627, lng: -86.7816, major: true },
  { name: "Memphis", lat: 35.1495, lng: -90.049, major: true },
  { name: "Birmingham", lat: 33.5186, lng: -86.8104, major: true },
  { name: "Jackson", lat: 32.2988, lng: -90.1848, major: true },
  { name: "Little Rock", lat: 34.7465, lng: -92.2896, major: true },
  { name: "Omaha", lat: 41.2565, lng: -95.9345, major: true },
  { name: "Tulsa", lat: 36.154, lng: -95.9928, major: true },
  { name: "Wichita", lat: 37.6872, lng: -97.3301, major: true },
  { name: "Amarillo", lat: 35.222, lng: -101.8313, major: true },
  { name: "Lubbock", lat: 33.5779, lng: -101.8552, major: true },
  { name: "Norman", lat: 35.2226, lng: -97.4395, major: true },
  { name: "Des Moines", lat: 41.5868, lng: -93.625, major: true },
  { name: "Indianapolis", lat: 39.7684, lng: -86.1581, major: true },
  { name: "Louisville", lat: 38.2527, lng: -85.7585, major: true },
  { name: "Cincinnati", lat: 39.1031, lng: -84.512, major: true },
  { name: "Columbus", lat: 39.9612, lng: -82.9988, major: true },
  { name: "Detroit", lat: 42.3314, lng: -83.0458, major: true },
  { name: "Charlotte", lat: 35.2271, lng: -80.8431, major: true },
  { name: "Raleigh", lat: 35.7796, lng: -78.6382, major: true },
  { name: "Washington", lat: 38.9072, lng: -77.0369, major: true },
  { name: "Philadelphia", lat: 39.9526, lng: -75.1652, major: true },
  { name: "New York", lat: 40.7128, lng: -74.006, major: true },
  { name: "Boston", lat: 42.3601, lng: -71.0589, major: true },
  { name: "Miami", lat: 25.7617, lng: -80.1918, major: true },
  { name: "Tampa", lat: 27.9506, lng: -82.4572, major: true },
  { name: "Orlando", lat: 28.5383, lng: -81.3792, major: true },
  { name: "Jacksonville", lat: 30.3322, lng: -81.6557, major: true },
  { name: "Mobile", lat: 30.6954, lng: -88.0399, major: true },
  { name: "Pensacola", lat: 30.4213, lng: -87.2169, major: true },
  { name: "Phoenix", lat: 33.4484, lng: -112.074, major: true },
  { name: "Albuquerque", lat: 35.0844, lng: -106.6504, major: true },
  { name: "El Paso", lat: 31.7619, lng: -106.485, major: true },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, major: true },
  { name: "Seattle", lat: 47.6062, lng: -122.3321, major: true },
  { name: "Dodge City", lat: 37.7528, lng: -100.0171 },
  { name: "Garden City", lat: 37.9717, lng: -100.8727 },
  { name: "Liberal", lat: 37.0431, lng: -100.921 },
  { name: "Enid", lat: 36.3956, lng: -97.8784 },
  { name: "Lawton", lat: 34.6036, lng: -98.3959 },
  { name: "Stillwater", lat: 36.1156, lng: -97.0584 },
  { name: "Fort Smith", lat: 35.3859, lng: -94.3985 },
  { name: "Shreveport", lat: 32.5252, lng: -93.7502 },
  { name: "Huntsville", lat: 34.7304, lng: -86.5861 },
  { name: "Chattanooga", lat: 35.0456, lng: -85.3097 },
  { name: "Topeka", lat: 39.0473, lng: -95.6752 },
  { name: "Lincoln", lat: 40.8136, lng: -96.7026 },
  { name: "Colorado Springs", lat: 38.8339, lng: -104.8214 },
  { name: "Waco", lat: 31.5493, lng: -97.1467 },
  { name: "Corpus Christi", lat: 27.8006, lng: -97.3964 },
  { name: "Baton Rouge", lat: 30.4515, lng: -91.1871 },
  { name: "Gulfport", lat: 30.3674, lng: -89.0928 },
];`
);

t = t.replace(
  `const cityGroup = L.layerGroup();
    for (const c of CITIES) {
      L.circleMarker([c.lat, c.lng], {
        radius: 4,
        color: "#8fa6a8",
        fillColor: "#edf8f7",
        fillOpacity: 0.85,
        weight: 1,
      })
        .bindTooltip(c.name, { permanent: false })
        .addTo(cityGroup);
    }
    (map as any)._cityGroup = cityGroup;
    cityGroup.addTo(map);`,
  `L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16, opacity: 0.9 }
    ).addTo(map);

    if (!document.getElementById("stormiq-city-tip-css")) {
      const st = document.createElement("style");
      st.id = "stormiq-city-tip-css";
      st.textContent =
        ".stormiq-city-tip{background:rgba(5,9,11,0.88)!important;border:1px solid rgba(184,221,225,0.35)!important;" +
        "color:#edf8f7!important;font-size:10px!important;font-weight:700!important;padding:2px 6px!important;" +
        "border-radius:6px!important;box-shadow:0 2px 8px rgba(0,0,0,0.45)!important;}" +
        ".stormiq-city-tip::before{border-top-color:rgba(5,9,11,0.88)!important;}" +
        ".stormiq-city-tip-major{color:#d9ff4a!important;border-color:rgba(217,255,74,0.45)!important;font-size:11px!important;}";
      document.head.appendChild(st);
    }

    const cityGroup = L.layerGroup();
    for (const c of CITIES) {
      const major = !!c.major;
      const m = L.circleMarker([c.lat, c.lng], {
        radius: major ? 5 : 3.5,
        color: major ? "#d9ff4a" : "#8fa6a8",
        fillColor: major ? "#edf8f7" : "#c5d5d6",
        fillOpacity: major ? 0.95 : 0.8,
        weight: major ? 1.5 : 1,
      });
      m.bindTooltip(c.name, {
        permanent: major,
        direction: "right",
        offset: [8, 0],
        opacity: 0.95,
        className: major ? "stormiq-city-tip stormiq-city-tip-major" : "stormiq-city-tip",
      });
      m.addTo(cityGroup);
    }
    (map as any)._cityGroup = cityGroup;
    cityGroup.addTo(map);`
);

fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
