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

// Forecast point timeline labels (NHC datelbl / maxwind / tau)
t = t.replace(
  `pointToLayer: (_f, latlng) =>
                  L.circleMarker(latlng, {
                    radius: 4, color: "#edf8f7", fillColor: color, fillOpacity: 0.95, weight: 1,
                  }),`,
  `pointToLayer: (feature, latlng) => {
                  const p = (feature as any)?.properties || {};
                  const tau = p.tau != null ? Number(p.tau) : null;
                  const isNow = tau === 0;
                  const m = L.circleMarker(latlng, {
                    radius: isNow ? 7 : 5,
                    color: "#edf8f7",
                    fillColor: color,
                    fillOpacity: 0.95,
                    weight: isNow ? 2 : 1.5,
                  });
                  const when = p.datelbl || p.fldatelbl || (tau != null ? "F+" + tau + "h" : "forecast");
                  const wind = p.maxwind != null && Number(p.maxwind) < 9000 ? Number(p.maxwind) + " kt" : "";
                  const stage = p.tcdvlp || p.stormtype || "";
                  const tip =
                    "<strong style=\\"color:#edf8f7\\">" + when + "</strong>" +
                    (wind ? " · " + wind : "") +
                    (stage ? "<br/><span style=\\"color:#8fa6a8\\">" + stage + "</span>" : "") +
                    (tau != null ? "<br/><span style=\\"color:#6b8082\\">+" + tau + "h</span>" : "");
                  m.bindTooltip(tip, {
                    permanent: !isNow,
                    direction: "top",
                    offset: [0, -8],
                    className: "stormiq-fcst-tip",
                    opacity: 0.95,
                  });
                  m.bindPopup(
                    "<strong>" + (p.stormname || stormLabel(s)) + "</strong><br/>" + tip +
                    (p.advdate ? "<br/><span style=\\"color:#6b8082\\">Adv " + (p.advisnum || "") + " · " + p.advdate + "</span>" : "")
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

if (!t.includes("stormiq-fcst-tip-css")) {
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
    mapInstance.current = map;`
  );
}

fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
