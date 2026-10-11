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

// Forecast point timeline — cyclone cards (not plain white tips)
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

// Layer defaults from URL
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

// Map center/zoom from URL
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
    });`
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

// SHARE button
if (!t.includes("shareMapView({")) {
  t = t.replace(
    "style={btnStyle(false)}\n          >\n            ↻\n          </button>",
    "style={btnStyle(false)}\n          >\n            ↻\n          </button>\n            <button\n              type=\"button\"\n              onClick={async () => {\n                const map = mapInstance.current;\n                if (!map) return;\n                const c = map.getCenter();\n                const result = await shareMapView({\n                  lat: c.lat,\n                  lng: c.lng,\n                  z: map.getZoom(),\n                  radar: radarOn,\n                  clouds: cloudsOn,\n                  tropical: showTropical,\n                });\n                setShareNote(result === \"shared\" ? \"Shared\" : result === \"copied\" ? \"Link copied\" : \"Could not share\");\n                window.setTimeout(() => setShareNote(\"\"), 2500);\n              }}\n              style={btnStyle(!!shareNote)}\n              title=\"Share this map view\"\n            >\n              {shareNote || \"🔗 SHARE\"}\n            </button>"
  );
}

fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
