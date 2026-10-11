#!/usr/bin/env node
/**
 * Downloads the last known-good restore script (cities, outlook, share, etc.)
 * runs it, then applies the tap-map sounding patch.
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
if (!t.includes("setSoundingPt({")) {
  t = t.replace(
    "mapInstance.current = map;",
    `map.on("click", (e: L.LeafletMouseEvent) => {
      setSoundingPt({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapInstance.current = map;`
  );
}
if (!t.includes("<SkewTPanel")) {
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

fs.writeFileSync(out, t);
console.log("restore-stormmap: sounding wired, wrote", out, "(" + t.length + " bytes)");
