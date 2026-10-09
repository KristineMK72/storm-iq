#!/usr/bin/env node
/**
 * Restores StormMap.tsx from a known-good commit, then applies
 * small UI patches (realistic radar clock labels + below-map legend).
 */
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

// --- realistic time labels (IEM mosaics are true 5-min steps) ---
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

// --- import below-map legend ---
if (!t.includes("MapLayerLegends")) {
  t = t.replace(
    'from "../lib/nhc";',
    'from "../lib/nhc";\nimport { MapLayerLegends } from "./MapLayerLegends";'
  );
}

// --- wrap return so legend sits below the map surface ---
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

fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
