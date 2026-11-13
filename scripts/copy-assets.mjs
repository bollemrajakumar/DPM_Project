import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// Copy manifest.json
cpSync(join(root, "manifest.json"), join(dist, "manifest.json"));
console.log("[copy-assets] manifest.json");

// Copy icons
const iconsSrc = join(root, "public", "icons");
const iconsDst = join(dist, "icons");
if (existsSync(iconsSrc)) {
  mkdirSync(iconsDst, { recursive: true });
  cpSync(iconsSrc, iconsDst, { recursive: true });
  console.log("[copy-assets] icons/");
}

// Copy WASM files
const wasmSrc = join(root, "public", "wasm");
const wasmDst = join(dist, "wasm");
if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log("[copy-assets] wasm/");
}
