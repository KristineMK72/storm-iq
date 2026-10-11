#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const chunks = [];
for (let i = 0; i < 8; i++) {
  const p = path.join(__dirname, `patch_b64_${i}.txt`);
  if (!fs.existsSync(p)) break;
  chunks.push(fs.readFileSync(p, "utf8").trim());
}
if (!chunks.length) {
  console.error("restore-stormmap: missing patch_b64_*.txt");
  process.exit(1);
}
const code = Buffer.from(chunks.join(""), "base64").toString("utf8");
const tmp = path.join(__dirname, ".stormmap-patches.generated.mjs");
fs.writeFileSync(tmp, code);
const mod = await import(pathToFileURL(tmp).href);
t = mod.applyAllPatches(t);
fs.writeFileSync(out, t);
console.log("restore-stormmap: wrote", out, "(" + t.length + " bytes)");
