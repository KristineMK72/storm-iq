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

// Forecast point timeline — cyclone cards
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

// SPC Outlook visibility: stronger fills, torn/wind, pane above radar
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

fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
