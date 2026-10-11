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

// Apply all patches from external modules kept inline for a single restore script
const { applyAllPatches } = await import("./stormmap-patches.mjs");
t = applyAllPatches(t);

fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
