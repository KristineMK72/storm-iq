#!/usr/bin/env node
/**
 * Rebuilds src/components/StormMap.tsx from base64 part files.
 * Runs before Astro build so the full map ships even when the
 * committed StormMap.tsx is a stub.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const partsDir = path.join(__dirname, "sm_parts");
const out = path.join(root, "src/components/StormMap.tsx");

const parts = [];
for (let i = 0; i < 32; i++) {
  const p = path.join(partsDir, `part_${i}.txt`);
  if (!fs.existsSync(p)) break;
  parts.push(fs.readFileSync(p, "utf8").trim());
}
if (!parts.length) {
  console.error("restore-stormmap: no part files found");
  process.exit(1);
}
const buf = Buffer.from(parts.join(""), "base64");
fs.writeFileSync(out, buf);
console.log("restore-stormmap: wrote", out, "(" + buf.length + " bytes)");
