#!/usr/bin/env node
/**
 * Downloads the last known-good restore script (cities, outlook, share, etc.)
 * runs it, then applies the tap-map sounding patch + readable SPC Day 1 popups.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "src/components/StormMap.tsx");

const GOOD_RESTORE =
  "https://cdn.jsdelivr.net/gh/KristineMK72/storm-iq@5958c1ba78888c6573f7f52995a3396436196659/scripts/restore-stormmap.mjs";

const res = await fetch(GOOD_RESTORE);
if (!res.ok) {
  console.error("restore-stormmap: could not fetch known-good restore", res.status);
  process.exit(1);
}
const goodCode = await res.text();
if (goodCode.length < 1000 || goodCode.includes("PLACEHOLDER")) {
  console.error("restore-stormmap: known-good content looks wrong", goodCode.slice(0, 80));
  process.exit(1);
}
const tmp = path.join(__dirname, ".restore-good.generated.mjs");
fs.writeFileSync(tmp, goodCode);
const run = spawnSync(process.execPath, [tmp], { cwd: root, encoding: "utf8" });
if (run.status !== 0) {
  console.error(run.stdout || "");
  console.error(run.stderr || "");
  process.exit(run.status || 1);
}
console.log(run.stdout || "");

let t = fs.readFileSync(out, "utf8");

if (!t.includes("SkewTPanel")) {
  t = t.replace(
    'from "../lib/nhc";',
    'from "../lib/nhc";\nimport SkewTPanel from "./SkewTPanel";'
  );
}
if (!t.includes("soundingPt")) {
  if (t.includes('const [shareNote, setShareNote] = useState("");')) {
    t = t.replace(
      'const [shareNote, setShareNote] = useState("");',
      'const [shareNote, setShareNote] = useState("");\n  const [soundingPt, setSoundingPt] = useState<{ lat: number; lng: number } | null>(null);'
    );
  } else {
    t = t.replace(
      "const [selected, setSelected] = useState<",
      'const [soundingPt, setSoundingPt] = useState<{ lat: number; lng: number } | null>(null);\n  const [selected, setSelected] = useState<'
    );
  }
}

// Reliable map click: always (re)bind sounding handler; draw a pin
if (!t.includes("stormiq-sounding-marker")) {
  t = t.replace(
    /map\.on\("click", \(e: L\.LeafletMouseEvent\) => \{\s*setSoundingPt\(\{ lat: e\.latlng\.lat, lng: e\.latlng\.lng \}\);\s*\}\);\s*/,
    ""
  );
  t = t.replace(
    "mapInstance.current = map;",
    `map.on("click", (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setSoundingPt({ lat, lng });
      const prev = (map as any)._stormiqSoundingMarker as L.CircleMarker | undefined;
      if (prev) map.removeLayer(prev);
      const pin = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#d9ff4a",
        fillColor: "#d9ff4a",
        fillOpacity: 0.95,
        weight: 2,
      }).addTo(map);
      pin.bindTooltip("Sounding", { permanent: true, direction: "top", offset: [0, -8], className: "stormiq-city-tip stormiq-city-tip-major" });
      (map as any)._stormiqSoundingMarker = pin;
    });
    // stormiq-sounding-marker
    mapInstance.current = map;`
  );
}

if (!t.includes("<SkewTPanel")) {
  if (t.includes("<MapLayerLegends")) {
    t = t.replace(
      "    <MapLayerLegends />",
      `      {soundingPt && (
        <SkewTPanel
          lat={soundingPt.lat}
          lng={soundingPt.lng}
          onClose={() => {
            setSoundingPt(null);
            const map = mapInstance.current;
            const prev = map && (map as any)._stormiqSoundingMarker;
            if (map && prev) {
              map.removeLayer(prev);
              (map as any)._stormiqSoundingMarker = null;
            }
          }}
        />
      )}
    <MapLayerLegends />`
    );
  } else {
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
      {soundingPt && (
        <SkewTPanel
          lat={soundingPt.lat}
          lng={soundingPt.lng}
          onClose={() => setSoundingPt(null)}
        />
      )}
    </div>
  );
}`
    );
  }
}

// ---- Readable SPC Day 1 popups with official link ----
if (!t.includes("Open official SPC Day 1")) {
  // Categorical outlook: inject popup HTML with dark text + link
  const catOld = `L.geoJSON(f, {
                style: { color, weight: 2, fillColor: color, fillOpacity: label === "TSTM" ? 0.08 : 0.22 },
              }).addTo(tornLayerRef.current!);`;
  const catNew = `const catPopup =
                '<div class="stormiq-spc-popup">' +
                '<div class="stormiq-spc-label">' + (label || "SPC") + '</div>' +
                '<div class="stormiq-spc-title">SPC Day 1 Outlook</div>' +
                '<div class="stormiq-spc-sub">Categorical risk</div>' +
                '<a class="stormiq-spc-link" href="https://www.spc.noaa.gov/products/outlook/day1otlk.html" target="_blank" rel="noopener">Open official SPC Day 1 →</a>' +
                '</div>';
              L.geoJSON(f, {
                style: { color, weight: 2, fillColor: color, fillOpacity: label === "TSTM" ? 0.08 : 0.22 },
              }).bindPopup(catPopup, { maxWidth: 280, className: "stormiq-spc-popup-wrap" }).addTo(tornLayerRef.current!);`;
  if (t.includes(catOld)) {
    t = t.replace(catOld, catNew);
    console.log("restore-stormmap: patched categorical SPC popup");
  } else {
    console.warn("restore-stormmap: categorical SPC block not found for popup patch");
  }

  // Hail outlook: add popup with link
  const hailOld = `L.geoJSON(f, {
                style: { color: "#c084fc", weight: 1.5, fillColor: "#c084fc", fillOpacity: 0.2, dashArray: "4 3" },
              }).addTo(hailLayerRef.current!);`;
  const hailNew = `const hailPopup =
                '<div class="stormiq-spc-popup">' +
                '<div class="stormiq-spc-label">HAIL</div>' +
                '<div class="stormiq-spc-title">SPC Day 1 Hail</div>' +
                '<div class="stormiq-spc-sub">Significant hail probability</div>' +
                '<a class="stormiq-spc-link" href="https://www.spc.noaa.gov/products/outlook/day1otlk.html" target="_blank" rel="noopener">Open official SPC Day 1 →</a>' +
                '</div>';
              L.geoJSON(f, {
                style: { color: "#c084fc", weight: 1.5, fillColor: "#c084fc", fillOpacity: 0.2, dashArray: "4 3" },
              }).bindPopup(hailPopup, { maxWidth: 280, className: "stormiq-spc-popup-wrap" }).addTo(hailLayerRef.current!);`;
  if (t.includes(hailOld)) {
    t = t.replace(hailOld, hailNew);
    console.log("restore-stormmap: patched hail SPC popup");
  } else {
    console.warn("restore-stormmap: hail SPC block not found for popup patch");
  }
}

fs.writeFileSync(out, t);
console.log("restore-stormmap: sounding + SPC popups wired, wrote", out, "(" + t.length + " bytes)");
