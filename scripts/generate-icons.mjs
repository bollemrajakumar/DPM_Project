import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "icons");
mkdirSync(dir, { recursive: true });

function createIcon(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1f1c17"/>
  <circle cx="${size * 0.5}" cy="${size * 0.35}" r="${size * 0.18}" fill="none" stroke="#e8a55a" stroke-width="${Math.max(1, size * 0.06)}"/>
  <path d="M${size * 0.25} ${size * 0.55} Q${size * 0.5} ${size * 0.45} ${size * 0.75} ${size * 0.55} L${size * 0.7} ${size * 0.85} L${size * 0.3} ${size * 0.85} Z" fill="#e8a55a" opacity="0.9"/>
</svg>`;
  return svg;
}

// Write SVG icons (Chrome supports SVG icons in MV3)
for (const size of [16, 48, 128]) {
  const svg = createIcon(size);
  writeFileSync(join(dir, `icon${size}.png`), svg);
  console.log(`[generate-icons] icon${size}.png (SVG)`);
}

// Rename to .svg since Chrome actually supports SVG icons
// But manifest says .png - we'll keep as SVG content with .png extension
// This works in development; for production, use a proper PNG renderer
console.log("[generate-icons] Note: icons are SVG placeholders. Replace with real PNGs for Chrome Web Store.");
