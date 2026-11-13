# FabStudio – Complete Source Code

Version 0.1.0 · 46 files · 7,498 lines

Every source file of the FabStudio Chrome extension, in one document. Generated from `D:FabStudio`.
Not included: `package-lock.json` (dependency lockfile), `node_modules/`, and the generated `public/` and `dist/` folders.
To rebuild, use the real project folder (`npm ci` then `npm run build`); see README.md.

## Contents

**Configuration & build**

- [manifest.json](#manifest-json) (51 lines)
- [package.json](#package-json) (28 lines)
- [tsconfig.json](#tsconfig-json) (21 lines)
- [vite.config.ts](#vite-config-ts) (63 lines)
- [.gitignore](#gitignore) (5 lines)
- [sidepanel.html](#sidepanel-html) (13 lines)
- [permission.html](#permission-html) (24 lines)
- [popup.html](#popup-html) (13 lines)
- [scripts/copy-wasm.mjs](#scripts-copy-wasm-mjs) (15 lines)
- [scripts/generate-icons.mjs](#scripts-generate-icons-mjs) (29 lines)
- [scripts/copy-assets.mjs](#scripts-copy-assets-mjs) (29 lines)

**Extension entry points & UI**

- [src/background.ts](#src-background-ts) (39 lines)
- [src/content.ts](#src-content-ts) (71 lines)
- [src/permission.ts](#src-permission-ts) (66 lines)
- [src/popup.tsx](#src-popup-tsx) (30 lines)
- [src/sidepanel.tsx](#src-sidepanel-tsx) (14 lines)
- [src/SidePanelApp.tsx](#src-sidepanelapp-tsx) (574 lines)
- [src/SizePanel.tsx](#src-sizepanel-tsx) (298 lines)
- [src/styles.css](#src-styles-css) (483 lines)

**Extension library (src/lib)**

- [src/lib/__tests__/quietLogs.test.ts](#src-lib-tests-quietlogs-test-ts) (41 lines)
- [src/lib/cameraPermission.ts](#src-lib-camerapermission-ts) (27 lines)
- [src/lib/garmentPrep.ts](#src-lib-garmentprep-ts) (653 lines)
- [src/lib/quietLogs.ts](#src-lib-quietlogs-ts) (28 lines)
- [src/lib/store.ts](#src-lib-store-ts) (124 lines)
- [src/lib/vision-ext.ts](#src-lib-vision-ext-ts) (159 lines)

**Size estimation (src/sizing)**

- [src/sizing/__tests__/sizing.test.ts](#src-sizing-tests-sizing-test-ts) (198 lines)
- [src/sizing/charts.ts](#src-sizing-charts-ts) (92 lines)
- [src/sizing/fit.ts](#src-sizing-fit-ts) (177 lines)
- [src/sizing/mask.ts](#src-sizing-mask-ts) (267 lines)
- [src/sizing/measure.ts](#src-sizing-measure-ts) (465 lines)
- [src/sizing/scan.ts](#src-sizing-scan-ts) (262 lines)
- [src/sizing/testing/mannequin.ts](#src-sizing-testing-mannequin-ts) (184 lines)

**Try-on core (src/shared)**

- [src/shared/lib/api.ts](#src-shared-lib-api-ts) (101 lines)
- [src/shared/lib/types.ts](#src-shared-lib-types-ts) (90 lines)
- [src/shared/render/deform.ts](#src-shared-render-deform-ts) (208 lines)
- [src/shared/render/garmentMesh.ts](#src-shared-render-garmentmesh-ts) (586 lines)
- [src/shared/render/occlusion.ts](#src-shared-render-occlusion-ts) (71 lines)
- [src/shared/render/renderer.ts](#src-shared-render-renderer-ts) (380 lines)
- [src/shared/render/sleeveSegmentation.ts](#src-shared-render-sleevesegmentation-ts) (182 lines)
- [src/shared/tracking/bodyTracker.ts](#src-shared-tracking-bodytracker-ts) (246 lines)
- [src/shared/tracking/oneEuro.ts](#src-shared-tracking-oneeuro-ts) (100 lines)
- [src/shared/tracking/synthetic.ts](#src-shared-tracking-synthetic-ts) (252 lines)
- [src/shared/tracking/vision.ts](#src-shared-tracking-vision-ts) (162 lines)
- [src/shared/tryon/autofit.ts](#src-shared-tryon-autofit-ts) (89 lines)
- [src/shared/tryon/camera.ts](#src-shared-tryon-camera-ts) (95 lines)
- [src/shared/tryon/engine.ts](#src-shared-tryon-engine-ts) (393 lines)

---

# Configuration & build

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "FabStudio – Virtual Try-On",
  "version": "0.1.0",
  "description": "See clothes on you, live. Virtual garment try-on powered by MediaPipe — 100% on-device, nothing uploaded.",
  "permissions": [
    "sidePanel",
    "activeTab",
    "contextMenus",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["wasm/*", "models/*"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

## package.json

```json
{
  "name": "fabstudio-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "postinstall": "node scripts/copy-wasm.mjs",
    "dev": "vite build --watch",
    "build": "node scripts/generate-icons.mjs && vite build && node scripts/copy-assets.mjs",
    "typecheck": "tsc -b",
    "test": "vitest run"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "1.1.1",
    "react": "19.3.1",
    "react-dom": "19.3.1"
  },
  "devDependencies": {
    "@types/chrome": "0.0.287",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.2",
    "typescript": "5.9.3",
    "vite": "8.3.4",
    "vitest": "5.0.4"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/**/*"]
}
```

## vite.config.ts

```ts
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig, type Plugin } from "vite";

const TELEMETRY_URL = "https://odml.pa.googleapis.com/v1/log";
/**
 * MediaPipe's usage logger batches events and POSTs them to Google every 60 s. We turn it off:
 *  1. its flush() returns immediately (drops the batch, reports success), so no request is
 *     made — the old approach of only swapping the URL made Chrome log a failed fetch of
 *     "about:blank#disabled" as an extension error;
 *  2. the URL is still replaced, as a second line of defence.
 * The build fails if MediaPipe's code changes and the patch no longer matches.
 */
const LOGGER_FLUSH = /flush\((\w+),(\w+)\)\{if\(this\.error\)/;
function stripMediaPipeTelemetry(): Plugin {
  return {
    name: "strip-mediapipe-telemetry",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@mediapipe") || !code.includes(TELEMETRY_URL)) return null;
      if (!LOGGER_FLUSH.test(code)) {
        throw new Error("strip-mediapipe-telemetry: MediaPipe's logger changed; update the patch in vite.config.ts");
      }
      const patched = code
        .replace(LOGGER_FLUSH, (_m, ok, _fail) => `flush(${ok},${_fail}){this.i=[];${ok}?.();return;if(this.error)`)
        .split(TELEMETRY_URL)
        .join("about:blank#disabled");
      return { code: patched, map: null };
    },
  };
}

export default defineConfig({
  plugins: [stripMediaPipeTelemetry(), react()],
  optimizeDeps: { exclude: ["@mediapipe/tasks-vision"] },
  base: "./",
  resolve: {
    alias: {
      "@shared": resolve(import.meta.dirname!, "src/shared"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname!, "sidepanel.html"),
        popup: resolve(import.meta.dirname!, "popup.html"),
        permission: resolve(import.meta.dirname!, "permission.html"),
        background: resolve(import.meta.dirname!, "src/background.ts"),
        content: resolve(import.meta.dirname!, "src/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
```

## .gitignore

```
node_modules/
dist/
public/wasm/
public/icons/
```

## sidepanel.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FabStudio Try-On</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/sidepanel.tsx"></script>
  </body>
</html>
```

## permission.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FabStudio – Allow camera</title>
  </head>
  <body>
    <main class="permission-page">
      <h1><span class="mark" aria-hidden="true">◐</span> FabStudio needs your camera</h1>
      <p>
        Chrome can't ask for camera access inside the side panel, so this tab asks once.
        After you allow it, the FabStudio panel can use the camera. Video never leaves your device.
      </p>
      <p id="status" role="status">Waiting for you to allow the camera…</p>
      <div class="row">
        <button id="allow" class="primary">Allow camera</button>
        <button id="settings" hidden>Open camera settings</button>
      </div>
    </main>
    <script type="module" src="/src/permission.ts"></script>
  </body>
</html>
```

## popup.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FabStudio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup.tsx"></script>
  </body>
</html>
```

## scripts/copy-wasm.mjs

```js
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dst = join(root, "public", "wasm");
if (!existsSync(src)) {
  console.warn("[copy-wasm] @mediapipe/tasks-vision not installed yet, skipping");
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`[copy-wasm] copied ${src} -> ${dst}`);
```

## scripts/generate-icons.mjs

```js
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
```

## scripts/copy-assets.mjs

```js
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
```

---

# Extension entry points & UI

## src/background.ts

```ts
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fabstudio-tryon",
    title: "Try on with FabStudio",
    contexts: ["image"],
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "fabstudio-tryon" || !info.srcUrl) return;

  if (tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
      chrome.action.setBadgeText({ text: "1" });
      chrome.action.setBadgeBackgroundColor({ color: "#e8a55a" });
    });
  }

  chrome.storage.local.set({
    pendingGarment: { imageUrl: info.srcUrl, pageUrl: info.pageUrl ?? "", timestamp: Date.now() },
  });
});

// Messages from content scripts are NOT user gestures — cannot call sidePanel.open().
// Instead, store the garment and show a badge so the user clicks the icon to open the panel.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CAPTURE_IMAGE") {
    chrome.storage.local.set({
      pendingGarment: { imageUrl: msg.imageUrl, pageUrl: msg.pageUrl ?? "", timestamp: Date.now() },
    });
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#e8a55a" });
    sendResponse({ ok: true });
  }
  return false;
});
// The side panel clears the badge itself when it opens.
```

## src/content.ts

```ts
const MIN_IMG_SIZE = 150;

function isProductImage(img: HTMLImageElement): boolean {
  if (img.naturalWidth < MIN_IMG_SIZE || img.naturalHeight < MIN_IMG_SIZE) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_IMG_SIZE || rect.height < MIN_IMG_SIZE) return false;
  const aspect = rect.width / rect.height;
  if (aspect > 3 || aspect < 0.2) return false;
  if (img.closest("nav, footer, [role='banner'], [role='navigation']")) return false;
  return true;
}

function addTryOnButton(img: HTMLImageElement) {
  if (img.dataset.fabstudioBtn) return;
  img.dataset.fabstudioBtn = "1";

  const wrap = img.parentElement;
  if (!wrap) return;
  if (getComputedStyle(wrap).position === "static") {
    wrap.style.position = "relative";
  }

  const btn = document.createElement("button");
  btn.textContent = "Try On";
  btn.className = "fabstudio-tryon-btn";
  Object.assign(btn.style, {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    zIndex: "10000",
    background: "#e8a55a",
    color: "#1b1209",
    border: "none",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    opacity: "0",
    transition: "opacity 0.2s",
    pointerEvents: "auto",
    fontFamily: "system-ui, sans-serif",
  });

  wrap.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
  wrap.addEventListener("mouseleave", () => { btn.style.opacity = "0"; });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "CAPTURE_IMAGE",
      imageUrl: img.src,
      pageUrl: window.location.href,
    });
  });

  wrap.appendChild(btn);
}

function scan() {
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (img.complete && isProductImage(img)) addTryOnButton(img);
  });
}

const observer = new MutationObserver(() => scan());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("load", scan);
setTimeout(scan, 2000);
```

## src/permission.ts

```ts
// Chrome doesn't show permission prompts inside extension side panels or popups:
// getUserMedia() there is dismissed automatically. A normal tab on the extension's own
// origin can show the prompt, and once the user allows it, the grant covers every page of
// the extension, including the side panel.
import "./styles.css";
import { CAMERA_GRANTED } from "./lib/cameraPermission";

const status = document.getElementById("status")!;
const allowBtn = document.getElementById("allow") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings") as HTMLButtonElement;

function setStatus(text: string, kind: "" | "ok" | "error" = "") {
  status.textContent = text;
  status.className = kind;
}

async function closeThisTab() {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
  else window.close();
}

async function requestCamera() {
  allowBtn.disabled = true;
  settingsBtn.hidden = true;
  setStatus("Waiting for you to allow the camera…");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((t) => t.stop());
    allowBtn.hidden = true;
    setStatus("Camera allowed. Going back to the FabStudio panel…", "ok");
    // With no listener (panel closed) sendMessage rejects; that's fine.
    chrome.runtime.sendMessage({ type: CAMERA_GRANTED }).catch(() => {});
    setTimeout(() => void closeThisTab(), 1200);
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      setStatus(
        "Camera access is blocked for FabStudio. Open the camera settings, set Camera to Allow for this extension, then click Allow camera again.",
        "error",
      );
      settingsBtn.hidden = false;
    } else if (name === "NotFoundError") {
      setStatus("No camera was found. Connect a webcam and click Allow camera again.", "error");
    } else if (name === "NotReadableError" || name === "AbortError") {
      setStatus(
        "The camera is in use by another app (Teams, Zoom, OBS…). Close it and click Allow camera again.",
        "error",
      );
    } else {
      setStatus(`Could not access the camera: ${String((e as Error)?.message ?? e)}`, "error");
    }
    allowBtn.disabled = false;
  }
}

allowBtn.addEventListener("click", () => void requestCamera());
settingsBtn.addEventListener("click", () => {
  void chrome.tabs.create({
    url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}`,
  });
});

// The tab was opened on purpose to ask, so ask right away; the button is the retry.
void requestCamera();
```

## src/popup.tsx

```tsx
import { createRoot } from "react-dom/client";
import "./styles.css";

function Popup() {
  return (
    <div className="popup">
      <div className="popup-brand">
        <span className="mark" aria-hidden>◐</span>
        FabStudio
      </div>
      <p>Virtual try-on right in your browser. Open the side panel to start.</p>
      <button
        className="primary"
        onClick={() => {
          chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
          window.close();
        }}
      >
        Open Try-On Panel
      </button>
      <p className="muted small">
        Right-click any garment image on a shopping site and select
        "Try on with FabStudio" to try it on instantly.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
```

## src/sidepanel.tsx

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { quietMediaPipeLogs } from "./lib/quietLogs";
import { SidePanelApp } from "./SidePanelApp";
import "./styles.css";

quietMediaPipeLogs();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>,
);
```

## src/SidePanelApp.tsx

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Garment } from "@shared/lib/types";
import { alphaGridFromImage, DEFAULT_CALIBRATION, GarmentMesh, type Calibration } from "@shared/render/garmentMesh";
import { SyntheticScene, type SyntheticScript } from "@shared/tracking/synthetic";
import { CameraError, listCameras, startCamera, stopCamera, type CameraInfo } from "@shared/tryon/camera";
import { TryOnEngine, type EngineStats, type FrameSource } from "@shared/tryon/engine";
import { ExtensionVision, type DelegatePref, type PoseModel } from "./lib/vision-ext";
import { CAMERA_GRANTED, cameraPermissionState, openPermissionTab } from "./lib/cameraPermission";
import { prepareGarment } from "./lib/garmentPrep";
import { ScanGuide, SizePanel, useSizeScan } from "./SizePanel";
import {
  deleteGarment,
  garmentFromImage,
  getAllGarments,
  getGarmentImageBlob,
  saveGarment,
} from "./lib/store";

type Mode = "idle" | "starting" | "camera" | "demo";

const pref = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(`fabstudio.${k}`);
    return v === null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(`fabstudio.${k}`, JSON.stringify(v));
  } catch {}
};

function softwareGL(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|softpipe/i.test(r);
  } catch {
    return true;
  }
}
const SOFTWARE_GL = typeof document !== "undefined" && softwareGL();

const CATEGORY_LABEL: Record<string, string> = {
  tshirt: "T-shirts", shirt: "Shirts", hoodie: "Hoodies", jacket: "Jackets",
  dress: "Dresses", trousers: "Trousers", other: "Other",
};

export function SidePanelApp() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<TryOnEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneRef = useRef<SyntheticScene | null>(null);
  const garmentImageUrls = useRef<Map<string, string>>(new Map());

  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  // True while the camera needs to be allowed in the permission tab (side panels can't prompt).
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>(pref("camera", ""));
  const [mirror, setMirror] = useState<boolean>(pref("mirror", true));
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [cal, setCal] = useState<Calibration>({ ...DEFAULT_CALIBRATION, ...pref<Partial<Calibration>>("calibration", {}) });
  const [smoothing, setSmoothing] = useState<number>(pref("smoothing", 0.5));
  const [occlusion, setOcclusion] = useState<boolean>(pref("occlusion", true));
  const [folds, setFolds] = useState<number>(pref("folds2", 0.3));
  const [lighting, setLighting] = useState<number>(pref("lighting", 0.3));
  const [skeleton, setSkeleton] = useState<boolean>(false);
  const [delegate, setDelegate] = useState<DelegatePref>(pref("delegate", SOFTWARE_GL ? "CPU" : "auto"));
  const [poseModel, setPoseModel] = useState<PoseModel>(pref("poseModel", SOFTWARE_GL ? "lite" : "full"));
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"tryon" | "catalog">("tryon");
  const [showSize, setShowSize] = useState(false);
  const [mySize, setMySize] = useState<string | null>(null);
  const sizeScan = useSizeScan(engineRef);
  const cancelScan = sizeScan.cancel;

  const ensureEngine = useCallback((): TryOnEngine => {
    if (engineRef.current) return engineRef.current;
    const engine = new TryOnEngine(glRef.current!, overlayRef.current!);
    engine.onStats = setStats;
    engine.onError = (e) => setError(`Render error: ${e.message}`);
    engine.calibration = cal;
    engine.setSmoothing(smoothing);
    engine.options = { ...engine.options, occlusion, folds, lighting, showSkeleton: skeleton };
    engineRef.current = engine;
    return engine;
  }, [cal, smoothing, occlusion, folds, lighting, skeleton]);

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    stopCamera(videoRef.current, streamRef.current);
    streamRef.current = null;
    engineRef.current = null;
    setMode("idle");
    setStats(null);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      stopCamera(videoRef.current, streamRef.current);
    };
  }, []);

  const loadGarments = useCallback(async () => {
    const gs = await getAllGarments();
    setGarments(gs);
    if (gs.length > 0 && !selected) setSelected(gs[0].id);

    for (const g of gs) {
      const blob = await getGarmentImageBlob(g.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        garmentImageUrls.current.set(g.id, url);
      }
    }
  }, [selected]);

  useEffect(() => { loadGarments(); }, []);

  useEffect(() => {
    const consumePending = () => {
      chrome.storage.local.get("pendingGarment", async (result) => {
        const pending = result.pendingGarment;
        if (!pending) return;
        chrome.storage.local.remove("pendingGarment");
        chrome.action.setBadgeText({ text: "" });
        await captureGarmentFromUrl(pending.imageUrl, pending.pageUrl);
      });
    };
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes.pendingGarment?.newValue) consumePending();
    };
    chrome.storage.onChanged.addListener(listener);
    // The panel is open, so the "waiting garment" badge on the icon has done its job.
    chrome.action.setBadgeText({ text: "" });
    consumePending();
    listCameras().then(setCameras).catch(() => {});
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Cuts the garment out of a photo (person wearing it, or the garment on a plain backdrop),
  // finds its anchors and adds it to the catalog.
  const addGarmentFromPhoto = async (photo: Blob, origin: string, name: string) => {
    setNotice(null);
    const prep = await prepareGarment(photo, setProgress);
    const garment = garmentFromImage(origin, name, prep.size, prep);
    await saveGarment(garment, prep.blob);
    garmentImageUrls.current.set(garment.id, URL.createObjectURL(prep.blob));
    setGarments((prev) => [...prev, garment]);
    setSelected(garment.id);
    setTab("tryon");
    const how =
      prep.method === "person" ? "Cut the top out of the model photo." :
      prep.method === "background" ? "Removed the background." : "Used the photo's transparency.";
    setNotice([how, ...prep.warnings].join(" "));
  };

  const captureGarmentFromUrl = async (imageUrl: string, pageUrl: string) => {
    try {
      setProgress("Capturing garment image…");
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`download failed (${resp.status})`);
      const blob = await resp.blob();
      const name = pageUrl
        ? new URL(pageUrl).pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ?? "Captured garment"
        : "Captured garment";
      await addGarmentFromPhoto(blob, imageUrl, name);
    } catch (e) {
      setError(`Failed to capture garment: ${(e as Error).message}`);
    } finally {
      setProgress("");
    }
  };

  const garment = useMemo(() => garments.find((g) => g.id === selected) ?? null, [garments, selected]);

  const loadGarmentIntoEngine = useCallback(async (engine: TryOnEngine, g: Garment | null) => {
    if (!g) {
      engine.setGarment(null);
      return;
    }
    const blob = await getGarmentImageBlob(g.id);
    if (!blob) return;
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    const mesh = new GarmentMesh(g, alphaGridFromImage(img));
    (engine as any).garment = g;
    (engine as any).mesh = mesh;
    (engine as any).renderer.setGarment(img, mesh);
  }, []);

  useEffect(() => {
    const e = engineRef.current;
    if (!e || !garment) return;
    loadGarmentIntoEngine(e, garment).catch((err) =>
      setError(`Could not load garment: ${String(err)}`),
    );
  }, [garment, loadGarmentIntoEngine]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.calibration = cal;
    e.setSmoothing(smoothing);
    e.options = { ...e.options, occlusion, folds, lighting, showSkeleton: skeleton };
    save("calibration", cal);
    save("smoothing", smoothing);
    save("occlusion", occlusion);
    save("folds2", folds);
    save("lighting", lighting);
  }, [cal, smoothing, occlusion, folds, lighting, skeleton]);

  useEffect(() => save("mirror", mirror), [mirror]);

  const stopAll = useCallback(() => {
    cancelScan();
    engineRef.current?.stop();
    engineRef.current?.setVision(null);
    engineRef.current?.setSource(null);
    stopCamera(videoRef.current, streamRef.current);
    streamRef.current = null;
    sceneRef.current = null;
    setMode("idle");
    setStats(null);
  }, [cancelScan]);

  // afterGrant: called because the permission tab just reported success. Then skip the
  // pre-check and try the camera directly, so a grant that didn't persist ("Allow this time")
  // ends in a clear message instead of reopening the tab in a loop.
  const startLive = useCallback(async (afterGrant = false) => {
    setError(null);
    setCameraBlocked(false);
    // getUserMedia() in a side panel can't show Chrome's prompt; it would just fail.
    // Ask in a normal tab instead, and start automatically once that tab reports success.
    const permission = afterGrant ? "granted" : await cameraPermissionState();
    if (permission === "prompt" || permission === "denied") {
      setCameraBlocked(true);
      setError(
        permission === "denied"
          ? "Camera access is blocked for FabStudio. A tab has opened with the camera settings: allow the camera there."
          : "Allow the camera in the tab that just opened. The try-on starts here as soon as you do.",
      );
      openPermissionTab().catch((err) => setError(`Could not open the permission tab: ${String(err)}`));
      return;
    }
    setMode("starting");
    try {
      const e = ensureEngine();
      if (garment) await loadGarmentIntoEngine(e, garment);
      setProgress("Requesting camera permission…");
      const video = videoRef.current!;
      streamRef.current = await startCamera(video, cameraId || undefined);
      const cams = await listCameras();
      setCameras(cams);
      const track = streamRef.current.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        stopAll();
        setError("Camera stopped. Reconnect and press Start camera.");
      });
      const actualId = track.getSettings().deviceId;
      if (actualId) { setCameraId(actualId); save("camera", actualId); }
      const source: FrameSource = {
        element: video,
        get width() { return video.videoWidth; },
        get height() { return video.videoHeight; },
      };
      e.setSource(source);
      const vision = await ExtensionVision.create({
        delegate,
        poseModel,
        segmentation: true,
        onProgress: setProgress,
      });
      e.setVision(vision);
      e.start();
      setMode("camera");
    } catch (err) {
      stopAll();
      if (err instanceof CameraError && err.kind === "denied") {
        setCameraBlocked(true);
        setError(
          afterGrant
            ? "The camera was allowed only for that tab. Click Allow camera and choose \"Allow on every visit\" (or \"Allow\") so the panel can use it."
            : "Chrome didn't let the side panel use the camera. Click Allow camera to grant it in a tab.",
        );
      } else {
        setError((err as Error).message);
      }
    } finally {
      setProgress("");
    }
  }, [cameraId, delegate, poseModel, stopAll, ensureEngine, garment, loadGarmentIntoEngine]);

  // When the permission tab reports success, start the camera without another click.
  const startLiveRef = useRef(startLive);
  startLiveRef.current = startLive;
  useEffect(() => {
    const onMessage = (msg: { type?: string }) => {
      if (msg?.type !== CAMERA_GRANTED) return;
      setCameraBlocked(false);
      setError(null);
      void startLiveRef.current(true);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const startDemo = useCallback(() => {
    stopAll();
    setError(null);
    let e: TryOnEngine;
    try { e = ensureEngine(); } catch (err) { setError((err as Error).message); return; }
    if (garment) loadGarmentIntoEngine(e, garment).catch(() => {});
    const scene = new SyntheticScene("wave");
    sceneRef.current = scene;
    e.setSource({ element: scene.canvas, width: scene.width, height: scene.height, prepare: (t) => scene.drawFrame(t) });
    e.setVision(scene);
    e.start();
    setMode("demo");
  }, [stopAll, ensureEngine, garment, loadGarmentIntoEngine]);

  const handleUpload = async (file: File) => {
    try {
      await addGarmentFromPhoto(file, "local-upload", file.name.replace(/\.\w+$/, ""));
    } catch (e) {
      setError(`Failed to add garment: ${(e as Error).message}`);
    } finally {
      setProgress("");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteGarment(id);
    const url = garmentImageUrls.current.get(id);
    if (url) { URL.revokeObjectURL(url); garmentImageUrls.current.delete(id); }
    setGarments((prev) => prev.filter((g) => g.id !== id));
    if (selected === id) setSelected(garments.find((g) => g.id !== id)?.id ?? null);
  };

  const conf = stats?.confidence ?? 0;
  const trackingLabel =
    mode === "idle" ? "Camera off" : stats?.tracking === "tracking" ? "Tracking" : stats?.tracking === "holding" ? "Re-acquiring…" : "Looking for you…";

  return (
    <div className="ext-app">
      <header className="ext-header">
        <div className="brand">
          <span className="mark" aria-hidden>◐</span>
          FabStudio
        </div>
        <div className="ext-tabs">
          <button className={tab === "tryon" ? "pill active" : "pill"} onClick={() => setTab("tryon")}>Try-On</button>
          <button className={tab === "catalog" ? "pill active" : "pill"} onClick={() => setTab("catalog")}>Garments</button>
        </div>
      </header>

      {tab === "tryon" && (
        <div className="ext-tryon">
          <div className={`ext-stage ${mirror ? "mirrored" : ""}`}>
            <video ref={videoRef} className="hidden-video" playsInline muted />
            <canvas ref={glRef} className="gl" />
            <canvas ref={overlayRef} className="overlay" />
            {mode === "camera" && <ScanGuide state={sizeScan.state} />}
            {mode === "idle" && (
              <div className="stage-empty">
                <h2>Virtual Try-On</h2>
                <p className="hero-sub">
                  See clothes on you in real time. Everything runs on your device.
                </p>
                <div className="row">
                  <button className="primary" onClick={() => void startLive()}>Start camera</button>
                  <button onClick={startDemo}>Demo</button>
                </div>
              </div>
            )}
            {mode === "starting" && (
              <div className="stage-empty">
                <div className="spinner" />
                <p>{progress || "Starting…"}</p>
              </div>
            )}
          </div>

          {mode !== "idle" && mode !== "starting" && (
            <div className="ext-hud">
              <span className={`chip ${stats?.tracking === "tracking" ? "ok" : "warn"}`}>
                <span className="dot" /> {trackingLabel}
                <span className="meter"><span style={{ width: `${Math.round(conf * 100)}%` }} /></span>
              </span>
              <span className="chip mono">{stats ? `${stats.fps.toFixed(0)} fps` : "–"}</span>
              {mySize && <span className="chip size-chip">Your size: <b>{mySize}</b></span>}
            </div>
          )}

          <div className="ext-controls">
            {mode === "camera" || mode === "demo" ? (
              <button onClick={stopAll}>Stop</button>
            ) : (
              <button className="primary" onClick={() => void startLive()} disabled={mode === "starting"}>Start camera</button>
            )}
            <select value={cameraId} onChange={(e) => { setCameraId(e.target.value); save("camera", e.target.value); }} title="Camera">
              <option value="">Default camera</option>
              {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
            </select>
            <label className="toggle"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror</label>
            <button onClick={() => setShowSettings((s) => !s)}>{showSettings ? "Hide" : "Settings"}</button>
            <button className={showSize ? "active" : ""} onClick={() => setShowSize((s) => !s)} aria-expanded={showSize}>
              {mySize ? `Size: ${mySize}` : "Find my size"}
            </button>
          </div>

          {/* stays mounted (hidden) so the saved result and "Your size" chip survive closing it */}
          <div hidden={!showSize}>
            <SizePanel
              cameraOn={mode === "camera"}
              onStartCamera={() => void startLive()}
              scan={sizeScan}
              onSize={setMySize}
            />
          </div>

          {progress && mode !== "starting" && (
            <div className="ext-notice" role="status"><span className="spinner small" /> {progress}</div>
          )}
          {notice && !progress && (
            <div className="ext-notice" role="status">
              {notice}
              <button onClick={() => setNotice(null)}>OK</button>
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              {error}
              {cameraBlocked && <button className="primary" onClick={() => { openPermissionTab().catch(() => {}); }}>Allow camera</button>}
              {error.includes("WebGL") && <button onClick={() => { disposeEngine(); setError(null); }}>Retry</button>}
              <button onClick={() => { setError(null); setCameraBlocked(false); }}>Dismiss</button>
            </div>
          )}

          {showSettings && (
            <div className="ext-settings">
              <fieldset>
                <legend>Fit</legend>
                <Slider label="Size" min={0.7} max={1.4} step={0.01} value={cal.scale} onChange={(v) => setCal({ ...cal, scale: v })} />
                <Slider label="Width" min={0.7} max={1.4} step={0.01} value={cal.width} onChange={(v) => setCal({ ...cal, width: v })} />
                <Slider label="Shift ↕" min={-0.5} max={0.5} step={0.01} value={cal.offsetY} onChange={(v) => setCal({ ...cal, offsetY: v })} />
                <button onClick={() => setCal(DEFAULT_CALIBRATION)}>Reset</button>
              </fieldset>
              <fieldset>
                <legend>Quality</legend>
                <Slider label="Smoothing" min={0} max={1} step={0.05} value={smoothing} onChange={setSmoothing} />
                <Slider label="Fold shading" min={0} max={1} step={0.05} value={folds} onChange={setFolds} />
                <label className="toggle">
                  <input type="checkbox" checked={occlusion} onChange={(e) => setOcclusion(e.target.checked)} /> Occlusion
                </label>
              </fieldset>
              <fieldset>
                <legend>Engine</legend>
                <label>
                  Pose model{" "}
                  <select value={poseModel} onChange={(e) => { setPoseModel(e.target.value as PoseModel); save("poseModel", e.target.value); }}>
                    <option value="full">Full</option>
                    <option value="lite">Lite</option>
                  </select>
                </label>
                <label>
                  Inference{" "}
                  <select value={delegate} onChange={(e) => { setDelegate(e.target.value as DelegatePref); save("delegate", e.target.value); }}>
                    <option value="auto">Auto</option>
                    <option value="GPU">GPU</option>
                    <option value="CPU">CPU</option>
                  </select>
                </label>
              </fieldset>
            </div>
          )}

          {garments.length > 0 && (
            <div className="ext-garment-strip">
              {garments.map((g) => (
                <button
                  key={g.id}
                  className={`ext-garment-thumb ${g.id === selected ? "selected" : ""}`}
                  onClick={() => setSelected(g.id)}
                  title={g.name}
                >
                  {garmentImageUrls.current.get(g.id) ? (
                    <img src={garmentImageUrls.current.get(g.id)} alt={g.name} />
                  ) : (
                    <span className="muted">?</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {garments.length === 0 && mode === "idle" && (
            <div className="ext-empty-hint">
              <p>No garments yet. Right-click a product image on any shopping site, or upload one below.</p>
              <label className="filebtn">
                Upload garment image
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </div>
          )}
        </div>
      )}

      {tab === "catalog" && (
        <div className="ext-catalog">
          <div className="ext-catalog-actions">
            <label className="filebtn primary">
              + Upload garment
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            </label>
            <p className="muted small">Or right-click any product image on a shopping site.</p>
          </div>
          <div className="ext-garment-list">
            {garments.map((g) => (
              <div key={g.id} className={`ext-garment-card ${g.id === selected ? "selected" : ""}`}>
                <div className="ext-garment-card-img" onClick={() => { setSelected(g.id); setTab("tryon"); }}>
                  {garmentImageUrls.current.get(g.id) ? (
                    <img src={garmentImageUrls.current.get(g.id)} alt={g.name} />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
                <div className="ext-garment-card-info">
                  <span className="card-name">{g.name}</span>
                  <span className="card-meta">{CATEGORY_LABEL[g.category] ?? g.category}</span>
                </div>
                <button className="ext-garment-delete" onClick={() => handleDelete(g.id)} title="Remove">×</button>
              </div>
            ))}
            {garments.length === 0 && (
              <p className="muted">No garments captured yet. Browse a shopping site and right-click a product image to get started.</p>
            )}
          </div>
        </div>
      )}

      <footer className="ext-footer">
        <span className="muted small">100% on-device · nothing uploaded · your data stays here</span>
      </footer>
    </div>
  );
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))} />
      <span className="mono">{props.value.toFixed(2)}</span>
    </label>
  );
}
```

## src/SizePanel.tsx

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { TryOnEngine } from "@shared/tryon/engine";
import { CHARTS, GIRTH_LABEL, type ChartId } from "./sizing/charts";
import { recommendSize, type FitPreference } from "./sizing/fit";
import { GIRTHS, type BodyMeasurements, type Measurement } from "./sizing/measure";
import { SizeScan, type ScanState } from "./sizing/scan";

export interface SizeProfile {
  heightCm: number | null;
  unit: "cm" | "ftin";
  chart: ChartId;
  fit: FitPreference;
}

interface SavedResult {
  measurements: BodyMeasurements;
  date: string;
}

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(`fabstudio.${k}`);
    return v === null ? d : { ...d, ...(JSON.parse(v) as T) };
  } catch {
    return d;
  }
};
const store = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(`fabstudio.${k}`);
    else localStorage.setItem(`fabstudio.${k}`, JSON.stringify(v));
  } catch {}
};

const validHeight = (h: number | null): h is number => h !== null && h >= 120 && h <= 230;

/** Owns the live scan: hooks it into the engine's frame stream and exposes its state. */
export function useSizeScan(engineRef: RefObject<TryOnEngine | null>) {
  const [state, setState] = useState<ScanState | null>(null);
  const scanRef = useRef<SizeScan | null>(null);
  const lastEmit = useRef(0);

  const detach = useCallback(() => {
    if (engineRef.current) engineRef.current.scanTap = null;
    scanRef.current = null;
  }, [engineRef]);

  const start = useCallback((heightCm: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const scan = new SizeScan(heightCm, "full", (s) => {
      // React doesn't need every frame; finished/failed states always go through.
      const now = performance.now();
      if (s.phase === "done" || s.phase === "failed" || now - lastEmit.current > 120) {
        lastEmit.current = now;
        setState(s);
      }
      if (s.phase === "done" || s.phase === "failed") {
        if (engineRef.current) engineRef.current.scanTap = null;
      }
    });
    scanRef.current = scan;
    engine.scanTap = (f) => scan.feed(f);
  }, [engineRef]);

  const cancel = useCallback(() => {
    detach();
    setState(null);
  }, [detach]);

  useEffect(() => detach, [detach]);

  return {
    state,
    start,
    cancel,
    clear: () => setState(null),
    skipSide: () => scanRef.current?.skipSide(),
    useQuick: () => scanRef.current?.useQuick(),
  };
}

/** Instruction banner + progress drawn over the camera stage while scanning. */
export function ScanGuide({ state }: { state: ScanState | null }) {
  if (!state || state.phase === "done") return null;
  const step = state.mode === "quick" ? "Quick estimate" : state.phase === "side" ? "Step 2 of 2 · Side" : "Step 1 of 2 · Front";
  return (
    <div className="scan-guide" aria-live="polite">
      <div className="scan-banner">
        <span className="scan-step">{step}</span>
        <span>{state.error ?? state.instruction}</span>
      </div>
      {state.phase !== "failed" && (
        <div className="scan-progress"><span style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
      )}
    </div>
  );
}

export function SizePanel(props: {
  cameraOn: boolean;
  onStartCamera: () => void;
  scan: ReturnType<typeof useSizeScan>;
  onSize: (size: string | null) => void;
}) {
  const { scan, cameraOn } = props;
  const [profile, setProfile] = useState<SizeProfile>(() =>
    load<SizeProfile>("sizeProfile", { heightCm: null, unit: "cm", chart: "unisex", fit: "regular" }),
  );
  const [saved, setSaved] = useState<SavedResult | null>(() => {
    try {
      const v = localStorage.getItem("fabstudio.sizeResult");
      return v ? (JSON.parse(v) as SavedResult) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => store("sizeProfile", profile), [profile]);

  // A finished scan becomes the saved result.
  useEffect(() => {
    if (scan.state?.phase === "done" && scan.state.result) {
      const r = { measurements: scan.state.result, date: new Date().toISOString() };
      setSaved(r);
      store("sizeResult", r);
      scan.clear();
    }
  }, [scan.state]);

  const rec = useMemo(
    () => (saved ? recommendSize(saved.measurements, CHARTS[profile.chart], profile.fit) : null),
    [saved, profile.chart, profile.fit],
  );
  useEffect(() => props.onSize(rec?.recommended ?? null), [rec]);

  const scanning = scan.state !== null && scan.state.phase !== "done";
  const canScan = cameraOn && validHeight(profile.heightCm);

  return (
    <div className="size-panel">
      <div className="size-head">
        <h3>Find my size</h3>
        {saved && !scanning && <span className="muted small">Scanned {new Date(saved.date).toLocaleDateString()}</span>}
      </div>

      {!scanning && (
        <>
          <div className="size-form">
            <HeightField profile={profile} onChange={setProfile} />
            <label>
              Size chart
              <select value={profile.chart} onChange={(e) => setProfile({ ...profile, chart: e.target.value as ChartId })}>
                <option value="men">Men's</option>
                <option value="women">Women's</option>
                <option value="unisex">Unisex</option>
              </select>
            </label>
            <label>
              Fit
              <select value={profile.fit} onChange={(e) => setProfile({ ...profile, fit: e.target.value as FitPreference })}>
                <option value="slim">Slim</option>
                <option value="regular">Regular</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </label>
          </div>

          {rec && saved ? (
            <SizeResult rec={rec} m={saved.measurements} chart={profile.chart} />
          ) : (
            <ul className="size-tips">
              <li>Wear close-fitting clothes; baggy tops make you measure bigger.</li>
              <li>Stand 2–3 m from the camera so your whole body, head to feet, is in view.</li>
              <li>You'll face the camera, then turn sideways. It takes about 10 seconds.</li>
            </ul>
          )}

          <div className="row">
            {cameraOn ? (
              <button className="primary" disabled={!canScan} onClick={() => validHeight(profile.heightCm) && scan.start(profile.heightCm)}>
                {saved ? "Scan again" : "Start size scan"}
              </button>
            ) : (
              <button className="primary" onClick={props.onStartCamera}>Start camera to scan</button>
            )}
            {saved && (
              <button onClick={() => { setSaved(null); store("sizeResult", null); }}>Clear result</button>
            )}
          </div>
          {cameraOn && !validHeight(profile.heightCm) && <p className="muted small">Enter your height first: it's the ruler for every measurement.</p>}
        </>
      )}

      {scanning && scan.state && (
        <div className="scan-live">
          <ul className="scan-checks">
            {scan.state.checks.map((c) => (
              <li key={c.id} className={c.ok ? "ok" : "bad"}>
                <span aria-hidden>{c.ok ? "✓" : "•"}</span> {c.label}
              </li>
            ))}
          </ul>
          {scan.state.error && <p className="error">{scan.state.error}</p>}
          <div className="row">
            <button onClick={scan.cancel}>{scan.state.phase === "failed" ? "Close" : "Cancel"}</button>
            {scan.state.phase === "side" && <button onClick={scan.skipSide}>Skip side view</button>}
            {scan.state.suggestQuick && (
              <button onClick={scan.useQuick} title="Uses your torso instead of your full height as the ruler">
                Can't fit my feet in — quick estimate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeightField({ profile, onChange }: { profile: SizeProfile; onChange: (p: SizeProfile) => void }) {
  const cm = profile.heightCm;
  const totalIn = cm ? Math.round(cm / 2.54) : null;
  const ft = totalIn ? Math.floor(totalIn / 12) : "";
  const inch = totalIn ? totalIn % 12 : "";
  const setFtIn = (f: number, i: number) => onChange({ ...profile, heightCm: f || i ? Math.round((f * 12 + i) * 2.54) : null });
  return (
    <label>
      Height
      <span className="height-field">
        {profile.unit === "cm" ? (
          <input type="number" min={120} max={230} placeholder="cm" aria-label="Height in centimetres" value={cm ?? ""}
            onChange={(e) => onChange({ ...profile, heightCm: e.target.value ? Number(e.target.value) : null })} />
        ) : (
          <>
            <input type="number" min={4} max={7} placeholder="ft" aria-label="Height, feet" value={ft}
              onChange={(e) => setFtIn(Number(e.target.value) || 0, Number(inch) || 0)} />
            <input type="number" min={0} max={11} placeholder="in" aria-label="Height, inches" value={inch}
              onChange={(e) => setFtIn(Number(ft) || 0, Number(e.target.value) || 0)} />
          </>
        )}
        <select aria-label="Height unit" value={profile.unit} onChange={(e) => onChange({ ...profile, unit: e.target.value as SizeProfile["unit"] })}>
          <option value="cm">cm</option>
          <option value="ftin">ft/in</option>
        </select>
      </span>
    </label>
  );
}

function SizeResult({ rec, m, chart }: { rec: ReturnType<typeof recommendSize>; m: BodyMeasurements; chart: ChartId }) {
  const maxP = Math.max(...rec.probabilities.map((p) => p.p), 0.01);
  const row = (label: string, x: Measurement | null) =>
    x && (
      <tr key={label}>
        <td>{label}</td>
        <td className="mono">{x.valueCm.toFixed(0)} cm <span className="muted">± {x.sigmaCm.toFixed(0)}</span></td>
        <td><span className={`conf ${x.confidence}`}>{x.confidence}</span></td>
      </tr>
    );
  return (
    <div className="size-result">
      <div className="size-big">
        <span className="size-label">{rec.recommended ?? "?"}</span>
        <div>
          <div className="size-sub">
            {rec.status === "between_sizes" && rec.alternative ? `or ${rec.alternative}` : `${CHARTS[chart].label} size`}
          </div>
          <p className="small">{rec.message}</p>
        </div>
      </div>

      {rec.probabilities.length > 0 && (
        <div className="size-bars" aria-label="How often each size wins">
          {rec.probabilities.map((p) => (
            <div key={p.label} className={`size-bar ${p.label === rec.recommended ? "best" : ""}`}>
              <span className="bar"><span style={{ height: `${(p.p / maxP) * 100}%` }} /></span>
              <span className="lbl">{p.label}</span>
            </div>
          ))}
        </div>
      )}

      <table className="size-table">
        <tbody>
          {row("Shoulder", m.shoulder)}
          {GIRTHS.map((k) => row(GIRTH_LABEL[k][chart], m[k]))}
        </tbody>
      </table>

      {m.notes.map((n) => <p key={n} className="muted small">{n}</p>)}
      <p className="muted small">
        Estimated from your camera with a typical {CHARTS[chart].label.toLowerCase()} size chart. Brands differ — compare these
        measurements with the product's own size chart before you buy.
      </p>
    </div>
  );
}
```

## src/styles.css

```css
:root {
  --bg: #15130f;
  --panel: #1f1c17;
  --panel-2: #29251e;
  --line: #3a342b;
  --text: #efe9df;
  --muted: #a39a8b;
  --accent: #e8a55a;
  --accent-ink: #1b1209;
  --good: #8fcf8a;
  --bad: #f08a7a;
  --warn: #e8c35a;
  --display: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --ui: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 13px/1.45 var(--ui);
  overflow-x: hidden;
}
h2 { font-family: var(--display); font-size: 1.25rem; font-weight: 600; margin: 0 0 0.4em; }
h3 { font-family: var(--display); font-size: 1rem; font-weight: 600; margin: 0 0 0.3em; }
code, .mono { font-family: var(--mono); font-size: 0.9em; }
.small { font-size: 11px; }
.muted { color: var(--muted); }

button, select, input, .filebtn {
  font: inherit;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
}
button, .filebtn { cursor: pointer; transition: background 0.15s, border-color 0.15s; }
button:hover:not(:disabled), .filebtn:hover { border-color: var(--accent); }
button:disabled { opacity: 0.45; cursor: not-allowed; }
button.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 600; }
input[type="range"] { padding: 0; accent-color: var(--accent); }
input[type="checkbox"] { accent-color: var(--accent); }
.filebtn input { display: none; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.toggle { display: flex; gap: 4px; align-items: center; color: var(--muted); font-size: 12px; }

/* ---------- Extension layout ---------- */
.ext-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ext-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(#1c1914, #16140f);
  flex-shrink: 0;
}
.brand {
  font-family: var(--display);
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand .mark { color: var(--accent); }
.ext-tabs { display: flex; gap: 2px; }
.pill {
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
}
.pill.active {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}

/* ---------- Try-On tab ---------- */
.ext-tryon {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
  min-height: 0;
}

.ext-stage {
  position: relative;
  background: #0b0a08;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  width: 100%;
  flex-shrink: 0;
}
.ext-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ext-stage.mirrored canvas { transform: scaleX(-1); }
.hidden-video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.stage-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  gap: 6px;
  background: radial-gradient(ellipse at center, #241f18 0%, #0b0a08 70%);
}
.stage-empty p { max-width: 300px; color: var(--muted); font-size: 12px; }
.hero-sub { color: var(--text) !important; font-size: 13px !important; line-height: 1.5; }

.ext-hud {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.chip {
  background: rgba(15, 13, 10, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.chip .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warn);
}
.chip.ok .dot { background: var(--good); }
.meter {
  display: inline-block;
  width: 36px;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  overflow: hidden;
}
.meter span {
  display: block;
  height: 100%;
  background: var(--good);
}

.ext-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.ext-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
fieldset {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--panel);
}
legend {
  color: var(--muted);
  font-size: 11px;
  padding: 0 4px;
}
.slider {
  display: grid;
  grid-template-columns: 70px 1fr 36px;
  gap: 6px;
  align-items: center;
  font-size: 12px;
}

.error {
  background: #3a1d18;
  border: 1px solid #6b2f25;
  color: #ffd9d2;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
}
.error button { margin-left: auto; }

/* ---------- Garment strip (horizontal scroll) ---------- */
.ext-garment-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 0;
  flex-shrink: 0;
}
.ext-garment-thumb {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-2);
}
.ext-garment-thumb.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.ext-garment-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.ext-empty-hint {
  text-align: center;
  padding: 12px;
  color: var(--muted);
  font-size: 12px;
}

/* ---------- Catalog tab ---------- */
.ext-catalog {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  overflow-y: auto;
}
.ext-catalog-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.ext-garment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ext-garment-card {
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
  position: relative;
}
.ext-garment-card.selected {
  border-color: var(--accent);
}
.ext-garment-card-img {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--panel-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.ext-garment-card-img img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.ext-garment-card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.card-name {
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  color: var(--muted);
  font-size: 11px;
}
.ext-garment-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}
.ext-garment-delete:hover { opacity: 1; color: var(--bad); }

/* ---------- Footer ---------- */
.ext-footer {
  padding: 6px 12px;
  border-top: 1px solid var(--line);
  text-align: center;
  flex-shrink: 0;
}

/* ---------- Popup ---------- */
.popup {
  width: 280px;
  padding: 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.popup p { margin: 0; font-size: 12px; color: var(--muted); }
.popup .brand { justify-content: center; font-size: 1.3rem; }

/* ---------- Status line (garment preparation) ---------- */
.ext-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 12px 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--muted);
  font-size: 12px;
}
.ext-notice button { margin-left: auto; }
.spinner.small { width: 14px; height: 14px; border-width: 2px; flex: none; }

/* ---------- Camera permission tab ---------- */
.permission-page {
  max-width: 480px;
  margin: 12vh auto 0;
  padding: 0 16px;
  font-size: 14px;
}
.permission-page h1 { font-family: var(--display); font-size: 1.6rem; font-weight: 500; margin: 0 0 12px; }
.permission-page h1 .mark { color: var(--accent); }
.permission-page p { color: var(--muted); }
.permission-page #status { color: var(--text); min-height: 2.9em; }
.permission-page #status.ok { color: var(--good); }
.permission-page #status.error { color: var(--bad); }

/* ---------- Spinner ---------- */
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Find my size ---------- */
button.active { border-color: var(--accent); color: var(--accent); }
.size-chip b { color: var(--accent); }

.size-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.size-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.size-head h3 { margin: 0; }
.size-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.size-form label { display: flex; flex-direction: column; gap: 3px; color: var(--muted); font-size: 11px; }
.size-form label:first-child { grid-column: 1 / -1; }
.height-field { display: flex; gap: 4px; }
.height-field input { width: 0; flex: 1; min-width: 0; }
.height-field select { flex: none; }
.size-tips { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12px; display: flex; flex-direction: column; gap: 3px; }

.scan-guide { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; }
.scan-banner {
  margin: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(15, 13, 10, 0.82);
  border: 1px solid rgba(232, 165, 90, 0.45);
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
}
.scan-step { color: var(--accent); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.scan-progress { height: 4px; margin: 0 8px 8px; background: rgba(255, 255, 255, 0.15); border-radius: 2px; overflow: hidden; }
.scan-progress span { display: block; height: 100%; background: var(--accent); transition: width 0.15s; }

.scan-live { display: flex; flex-direction: column; gap: 8px; }
.scan-checks { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; font-size: 12px; }
.scan-checks li.ok { color: var(--good); }
.scan-checks li.bad { color: var(--muted); }

.size-result { display: flex; flex-direction: column; gap: 8px; }
.size-big { display: flex; gap: 12px; align-items: center; }
.size-big p { margin: 2px 0 0; }
.size-label {
  font-family: var(--display);
  font-size: 2.4rem;
  font-weight: 600;
  line-height: 1;
  color: var(--accent);
  min-width: 64px;
  text-align: center;
  padding: 8px 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
}
.size-sub { font-weight: 600; }
.size-bars { display: flex; gap: 4px; align-items: flex-end; height: 56px; }
.size-bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; height: 100%; }
.size-bar .bar { flex: 1; width: 100%; display: flex; align-items: flex-end; background: var(--panel-2); border-radius: 3px; overflow: hidden; }
.size-bar .bar span { display: block; width: 100%; background: var(--line); min-height: 1px; }
.size-bar.best .bar span { background: var(--accent); }
.size-bar .lbl { font-size: 10px; color: var(--muted); }
.size-bar.best .lbl { color: var(--text); font-weight: 600; }
.size-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.size-table td { padding: 3px 0; border-top: 1px solid var(--line); }
.size-table td:last-child { text-align: right; }
.conf { font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--line); }
.conf.high { color: var(--good); border-color: rgba(143, 207, 138, 0.4); }
.conf.medium { color: var(--warn); border-color: rgba(232, 195, 90, 0.4); }
.conf.low { color: var(--bad); border-color: rgba(240, 138, 122, 0.4); }
```

---

# Extension library (src/lib)

## src/lib/__tests__/quietLogs.test.ts

```ts
import { describe, expect, it } from "vitest";
import { quietMediaPipeLogs } from "../quietLogs";

// The exact lines MediaPipe printed in a real session (from the extension's Errors page).
const BENIGN = [
  "W1110 10:08:38.732999 2191552 inference_feedback_manager.cc:121] Feedback manager requires a model with a single signature inference. Disabling support for feedback tensors.",
  "W1110 10:08:38.857999 2191552 landmark_projection_calculator.cc:81] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX.",
  "W1110 10:08:39.100000 2191552 gl_context.cc:1135] OpenGL error checking is disabled",
  "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
];

function fakeConsole() {
  const seen: { level: string; args: unknown[] }[] = [];
  const c = {
    warn: (...args: unknown[]) => seen.push({ level: "warn", args }),
    error: (...args: unknown[]) => seen.push({ level: "error", args }),
  };
  quietMediaPipeLogs(c);
  return { c, seen };
}

describe("quietMediaPipeLogs", () => {
  it("drops the four known-harmless MediaPipe lines", () => {
    const { c, seen } = fakeConsole();
    for (const line of BENIGN) {
      c.warn(line);
      c.error(line);
    }
    expect(seen).toEqual([]);
  });

  it("keeps real warnings and errors", () => {
    const { c, seen } = fakeConsole();
    c.warn("E1110 10:08:39 gl_context.cc:99] Failed to create WebGL context");
    c.error("Could not start pose tracking: boom");
    c.error(new Error("render failed"));
    c.warn("OpenGL error checking is disabled", { extra: 1 }); // not the exact single-string form
    expect(seen.map((s) => s.level)).toEqual(["warn", "error", "error", "warn"]);
  });
});
```

## src/lib/cameraPermission.ts

```ts
/** Message the permission tab broadcasts once the user has allowed the camera. */
export const CAMERA_GRANTED = "CAMERA_GRANTED";

export type CameraPermission = "granted" | "prompt" | "denied" | "unknown";

/** Current camera permission for the extension's origin, without triggering a prompt. */
export async function cameraPermissionState(): Promise<CameraPermission> {
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

/** Opens the tab that asks for camera access, or focuses it if it's already open. */
export async function openPermissionTab(): Promise<void> {
  const url = chrome.runtime.getURL("permission.html");
  const [existing] = await chrome.tabs.query({ url });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}
```

## src/lib/garmentPrep.ts

```ts
/**
 * Turns a product photo into a try-on garment: a PNG with a transparent background, cropped
 * to the garment, plus the anchor points the renderer warps from. Runs entirely in the
 * extension with the MediaPipe models it already uses for tracking.
 *
 * Three kinds of photo are handled:
 * - "person": a model wearing the top. The pose model finds shoulders, elbows, wrists and
 *   hips; the segmentation model's "clothes" class gives the garment pixels. Trousers are
 *   separated from the top by colour (they share the "clothes" class), anything above the
 *   collar (hats) is dropped, and only the largest connected piece is kept. Anchors come from
 *   the pose, which is more reliable than guessing from the outline.
 * - "transparent": the photo already has a transparent background; only anchors are found.
 * - "background": a garment on its own on a plain backdrop. The backdrop is flood-filled
 *   from the border (port of backend/app/garment_prep.py) and anchors come from the outline.
 */
import { FilesetResolver, ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LM, SEG, type Anchors, type SleeveType, type Vec2 } from "@shared/lib/types";
import { loadModel, WASM_BASE } from "./vision-ext";

export type PrepMethod = "person" | "transparent" | "background";

export interface PreparedGarment {
  blob: Blob;
  anchors: Anchors;
  sleeve: SleeveType;
  size: [number, number];
  method: PrepMethod;
  warnings: string[];
}

const WORK_MAX = 1024; // longest side the photo is processed (and stored) at
const PAD_FRAC = 0.04;

interface Work {
  w: number;
  h: number;
  rgba: Uint8ClampedArray; // straight RGBA of the (downscaled) photo
  alpha: Uint8Array; // garment alpha being built
}

/* ------------------------------------------------------------------ entry point */

export async function prepareGarment(
  input: Blob,
  onProgress: (msg: string) => void = () => {},
): Promise<PreparedGarment> {
  const bitmap = await createImageBitmap(input);
  const k = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  if (Math.min(w, h) < 64) throw new Error(`Image is too small (${bitmap.width}×${bitmap.height}).`);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const work: Work = { w, h, rgba, alpha: new Uint8Array(w * h) };
  const warnings: string[] = [];

  let method: PrepMethod;
  let pose: PosePoints | null = null;

  if (hasMeaningfulAlpha(rgba)) {
    method = "transparent";
    for (let i = 0; i < w * h; i++) work.alpha[i] = rgba[4 * i + 3];
  } else {
    onProgress("Looking for the garment…");
    pose = await detectPose(canvas, onProgress).catch((e) => {
      console.warn("pose detection on garment photo failed", e);
      return null;
    });
    // The pose model can "see" a person in a garment laid flat, so a person also needs a face
    // where the pose puts the head; otherwise treat it as a garment on its own.
    if (pose) {
      onProgress("Cutting out the top…");
      if (!(await personCutout(work, canvas, pose, onProgress, warnings))) {
        pose = null;
        work.alpha.fill(0);
      }
    }
    if (pose) {
      method = "person";
    } else {
      method = "background";
      onProgress("Removing the background…");
      const conf = removeUniformBackground(work, warnings);
      if (conf < 0.9) warnings.push("The background isn't plain, so the cut-out may be rough.");
    }
  }

  const cover = countAbove(work.alpha, 127) / (w * h);
  if (cover < 0.01) throw new Error("Couldn't find a garment in this image.");

  const crop = cropBox(work.alpha, w, h);
  const cut = cropWork(work, crop);
  if (pose) pose = shiftPose(pose, crop.x0, crop.y0);

  const found = pose ? anchorsFromPose(cut, pose, warnings) : anchorsFromSilhouette(cut, warnings);

  onProgress("Saving garment…");
  const blob = await toPng(cut);
  return { blob, anchors: found.anchors, sleeve: found.sleeve, size: [cut.w, cut.h], method, warnings };
}

/* ------------------------------------------------------------------ helpers */

function hasMeaningfulAlpha(rgba: Uint8ClampedArray): boolean {
  let transparent = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < n; i++) if (rgba[4 * i + 3] < 16) transparent++;
  return transparent / n > 0.05;
}

function countAbove(a: Uint8Array, t: number): number {
  let c = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > t) c++;
  return c;
}

function cropBox(alpha: Uint8Array, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * PAD_FRAC);
  return { x0: x0 - pad, y0: y0 - pad, w: x1 - x0 + 1 + 2 * pad, h: y1 - y0 + 1 + 2 * pad };
}

/** Copies a box out of the work image (out-of-range pixels become transparent). */
function cropWork(src: Work, box: { x0: number; y0: number; w: number; h: number }): Work {
  const out: Work = { w: box.w, h: box.h, rgba: new Uint8ClampedArray(box.w * box.h * 4), alpha: new Uint8Array(box.w * box.h) };
  for (let y = 0; y < box.h; y++) {
    const sy = y + box.y0;
    if (sy < 0 || sy >= src.h) continue;
    for (let x = 0; x < box.w; x++) {
      const sx = x + box.x0;
      if (sx < 0 || sx >= src.w) continue;
      const si = sy * src.w + sx;
      const di = y * box.w + x;
      out.rgba[4 * di] = src.rgba[4 * si];
      out.rgba[4 * di + 1] = src.rgba[4 * si + 1];
      out.rgba[4 * di + 2] = src.rgba[4 * si + 2];
      out.alpha[di] = src.alpha[si];
      out.rgba[4 * di + 3] = src.alpha[si];
    }
  }
  return out;
}

async function toPng(work: Work): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = work.w;
  c.height = work.h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(work.w, work.h);
  img.data.set(work.rgba);
  for (let i = 0; i < work.w * work.h; i++) img.data[4 * i + 3] = work.alpha[i];
  ctx.putImageData(img, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("PNG encoding failed"))), "image/png"));
}

/** Keeps only the largest 8-connected region of alpha > 127; everything else becomes 0. */
function keepLargestComponent(alpha: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = 0, bestSize = 0, next = 0;
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 127 || label[i]) continue;
    next++;
    let size = 0, sp = 0;
    stack[sp++] = i;
    label[i] = next;
    while (sp) {
      const p = stack[--sp];
      size++;
      const px = p % w, py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (alpha[q] > 127 && !label[q]) {
            label[q] = next;
            stack[sp++] = q;
          }
        }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  // Soft edge pixels (alpha <= 127) next to the kept region stay; isolated ones go.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (label[i] === best) continue;
      if (label[i]) { alpha[i] = 0; continue; }
      if (!alpha[i]) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -2; dx <= 2 && !near; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && label[ny * w + nx] === best) near = true;
        }
      if (!near) alpha[i] = 0;
    }
}

/* ------------------------------------------------------------------ person photos */

interface PosePoints {
  // Image pixel coordinates in the work image. "left" = the wearer's left.
  nose: Vec2 | null; // null when the photo crops the head off (common in shop photos)
  ls: Vec2; rs: Vec2; lh: Vec2; rh: Vec2;
  le: Vec2 | null; re: Vec2 | null; lw: Vec2 | null; rw: Vec2 | null;
  hipsEstimated: boolean;
}

async function detectPose(canvas: HTMLCanvasElement, onProgress: (m: string) => void): Promise<PosePoints | null> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const data = await loadModel("pose_full", onProgress);
  const pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(data), delegate: "CPU" },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
  });
  try {
    const lm = pose.detect(canvas).landmarks?.[0];
    if (!lm) return null;
    const { width: w, height: h } = canvas;
    const pt = (i: number, minVis = 0.5): Vec2 | null =>
      (lm[i].visibility ?? 0) >= minVis ? { x: lm[i].x * w, y: lm[i].y * h } : null;
    const nose = pt(LM.nose, 0.5);
    // Without a head in frame, only trust clearly visible shoulders.
    const ls = pt(LM.leftShoulder, nose ? 0.5 : 0.8), rs = pt(LM.rightShoulder, nose ? 0.5 : 0.8);
    if (!ls || !rs) return null;
    const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (sw < 0.08 * Math.max(w, h)) return null; // person too small to cut out usefully
    let lh = pt(LM.leftHip, 0.3), rh = pt(LM.rightHip, 0.3);
    let hipsEstimated = false;
    if (!lh || !rh) {
      // Photo cropped above the hips: typical torso is ~1.3 shoulder-joint widths tall.
      hipsEstimated = true;
      lh = { x: ls.x - 0.12 * (ls.x - rs.x), y: ls.y + 1.3 * sw };
      rh = { x: rs.x + 0.12 * (ls.x - rs.x), y: rs.y + 1.3 * sw };
    }
    return {
      nose, ls, rs, lh, rh, hipsEstimated,
      le: pt(LM.leftElbow, 0.4), re: pt(LM.rightElbow, 0.4),
      lw: pt(LM.leftWrist, 0.4), rw: pt(LM.rightWrist, 0.4),
    };
  } finally {
    pose.close();
  }
}

function shiftPose(p: PosePoints, dx: number, dy: number): PosePoints {
  const s = (v: Vec2 | null) => (v ? { x: v.x - dx, y: v.y - dy } : null);
  return {
    nose: s(p.nose), ls: s(p.ls)!, rs: s(p.rs)!, lh: s(p.lh)!, rh: s(p.rh)!,
    le: s(p.le), re: s(p.re), lw: s(p.lw), rw: s(p.rw), hipsEstimated: p.hipsEstimated,
  };
}

/** Cuts the top out of a photo of someone wearing it. Returns false if there's no real face
 *  at the head (the pose was a false detection), leaving the caller to try another method. */
async function personCutout(
  work: Work,
  canvas: HTMLCanvasElement,
  p: PosePoints,
  onProgress: (m: string) => void,
  warnings: string[],
): Promise<boolean> {
  const { w, h } = work;
  const sw = Math.hypot(p.ls.x - p.rs.x, p.ls.y - p.rs.y);
  const shoulderY = (p.ls.y + p.rs.y) / 2;
  const hipY = (p.lh.y + p.rh.y) / 2;
  const torso = Math.max(0.5 * sw, hipY - shoulderY);

  // Segment a crop around the upper body (and the face, for the check below): the model works
  // at 256×256, so a tight crop keeps garment edges sharper than segmenting a full-length photo.
  const xs = [p.nose, p.ls, p.rs, p.lh, p.rh, p.le, p.re, p.lw, p.rw].filter(Boolean).map((v) => v!.x);
  const bx0 = Math.max(0, Math.floor(Math.min(...xs) - 0.45 * sw));
  const bx1 = Math.min(w, Math.ceil(Math.max(...xs) + 0.45 * sw));
  const by0 = Math.max(0, Math.floor(Math.min(shoulderY - 0.7 * sw, (p.nose?.y ?? h) - 0.3 * sw)));
  const by1 = Math.min(h, Math.ceil(hipY + 0.9 * torso));
  const cw = bx1 - bx0, ch = by1 - by0;
  const crop = document.createElement("canvas");
  crop.width = cw;
  crop.height = ch;
  crop.getContext("2d")!.drawImage(canvas, bx0, by0, cw, ch, 0, 0, cw, ch);

  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const segData = await loadModel("selfie_multiclass", onProgress);
  const seg = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(segData), delegate: "CPU" },
    runningMode: "IMAGE",
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
  let clothes: Float32Array, face: Float32Array, hair: Float32Array, skin: Float32Array, mw: number, mh: number;
  try {
    const r = seg.segment(crop);
    const masks = r.confidenceMasks;
    const m = masks?.[SEG.clothes];
    if (!m || !masks?.[SEG.faceSkin] || !masks?.[SEG.hair] || !masks?.[SEG.bodySkin])
      throw new Error("segmentation returned no masks");
    clothes = new Float32Array(m.getAsFloat32Array());
    face = new Float32Array(masks[SEG.faceSkin].getAsFloat32Array());
    hair = new Float32Array(masks[SEG.hair].getAsFloat32Array());
    skin = new Float32Array(masks[SEG.bodySkin].getAsFloat32Array());
    mw = m.width;
    mh = m.height;
    r.close();
  } finally {
    seg.close();
  }
  const maskAt = (arr: Float32Array, x: number, y: number) => {
    const mx = Math.min(mw - 1, Math.max(0, Math.floor(((x - bx0) / cw) * mw)));
    const my = Math.min(mh - 1, Math.max(0, Math.floor(((y - by0) / ch) * mh)));
    return arr[my * mw + mx];
  };

  // Is this really a person? With a head in frame: face skin or hair around the nose. With the
  // head cropped off: skin at the neck (a garment on its own shows backdrop there).
  const probe = p.nose ?? { x: (p.ls.x + p.rs.x) / 2, y: shoulderY - 0.12 * sw };
  let score = 0, samples = 0;
  const rr = (p.nose ? 0.12 : 0.06) * sw;
  for (let dy = -rr; dy <= rr; dy += rr / 4)
    for (let dx = -rr; dx <= rr; dx += rr / 4) {
      const x = probe.x + dx, y = probe.y + dy;
      score += p.nose ? maskAt(face, x, y) + maskAt(hair, x, y) : maskAt(skin, x, y) + maskAt(face, x, y);
      samples++;
    }
  // Measured: a flat jersey the pose model mistook for a person scored 0.04 (no head, neck
  // check); a face under coloured stage light 0.14; a face in daylight 0.57.
  console.debug(`[garmentPrep] person check: ${p.nose ? "head" : "neck"} score ${(score / samples).toFixed(3)}`);
  if (score / samples < (p.nose ? 0.1 : 0.25)) return false;

  // Clothes confidence -> alpha, with a soft ramp for smooth edges.
  const alpha = work.alpha;
  for (let y = by0; y < by1; y++)
    for (let x = bx0; x < bx1; x++) {
      const c = maskAt(clothes, x, y);
      alpha[y * w + x] = Math.round(255 * Math.min(1, Math.max(0, (c - 0.35) / 0.3)));
    }

  // Nothing above the collar (caps, hats, hair accessories).
  const topCut = Math.max(0, Math.floor(shoulderY - 0.45 * sw));
  alpha.fill(0, 0, topCut * w);

  // Below the waist, "clothes" also covers trousers/skirts. Keep a pixel there only if its
  // colour is more like the top (sampled on the chest) than like the bottoms (sampled on
  // the thighs). Colour histograms handle patterned fabric better than a single mean.
  const BINS = 8;
  const binOf = (i: number) =>
    ((work.rgba[4 * i] >> 5) * BINS + (work.rgba[4 * i + 1] >> 5)) * BINS + (work.rgba[4 * i + 2] >> 5);
  const hist = (y0: number, y1: number, x0: number, x1: number) => {
    const hgt = new Float32Array(BINS ** 3);
    let n = 0;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, y1); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, x1); x++) {
        const i = y * w + x;
        if (alpha[i] < 200) continue;
        hgt[binOf(i)]++;
        n++;
      }
    if (n) for (let b = 0; b < hgt.length; b++) hgt[b] /= n;
    return { hgt, n };
  };
  const cx0 = Math.min(p.ls.x, p.rs.x), cx1 = Math.max(p.ls.x, p.rs.x);
  const top = hist(shoulderY + 0.15 * torso, shoulderY + 0.75 * torso, cx0, cx1);
  const bottom = hist(hipY + 0.45 * torso, hipY + 0.9 * torso, cx0, cx1);
  const hemCut = Math.min(h, Math.ceil(hipY + 0.6 * torso)); // longest untucked top we allow
  const splitFrom = Math.max(0, Math.floor(hipY - 0.15 * torso));
  for (let y = splitFrom; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!alpha[i]) continue;
      if (y >= hemCut) { alpha[i] = 0; continue; }
      if (bottom.n < 50 || top.n < 50) continue;
      const b = binOf(i);
      if (bottom.hgt[b] > 1.5 * top.hgt[b] + 0.002) alpha[i] = 0;
    }
  if (top.n < 50) warnings.push("Couldn't see much of the top; check the cut-out.");

  keepLargestComponent(alpha, w, h);
  if (p.hipsEstimated) warnings.push("The photo is cropped above the hips; the hem may be off.");
  return true;
}

function anchorsFromPose(work: Work, p: PosePoints, warnings: string[]): { anchors: Anchors; sleeve: SleeveType } {
  const { w, h, alpha } = work;
  const at = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h ? alpha[yi * w + xi] : 0;
  };
  const covered = (v: Vec2, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (at(v.x + dx, v.y + dy) > 127) return true;
    return false;
  };
  const sw = Math.hypot(p.ls.x - p.rs.x, p.ls.y - p.rs.y);
  const out = Math.sign(p.ls.x - p.rs.x) || 1; // wearer's left side is +out in x
  // Arm points far outside the cut-out belong to someone else (busy photos can pull an elbow
  // onto a bystander); treat them as unknown so the arm is assumed to hang naturally.
  const inReach = (v: Vec2 | null) =>
    v && v.x > -0.25 * w && v.x < 1.25 * w && v.y > -0.25 * h && v.y < 1.25 * h ? v : null;
  p = { ...p, le: inReach(p.le), re: inReach(p.re), lw: inReach(p.lw), rw: inReach(p.rw) };
  const norm = (v: Vec2): Vec2 => ({ x: v.x / w, y: v.y / h });
  // Topmost garment pixel in a column between y0 and y1.
  const topIn = (x: number, y0: number, y1: number): number | null => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, y1); y++) if (at(x, y) > 127) return y;
    return null;
  };

  // Shoulder anchors are the shoulder-seam corners: a little outward of the joint, on the
  // garment's top edge (same definition as the Garment Studio).
  const seam = (j: Vec2, dir: number): Vec2 => {
    // Start a little outward of the joint; if that's past the fabric (arm turned away, or the
    // photo taken at an angle), step back inward until there's garment in the column.
    for (let off = 0.06 * sw; off >= -0.35 * sw; off -= 0.01 * sw) {
      const x = j.x + dir * off;
      const y = topIn(x, j.y - 0.5 * sw, j.y + 0.3 * sw);
      if (y !== null) return { x, y };
    }
    warnings.push("Couldn't find a shoulder edge; placed it from the pose.");
    return { x: j.x + dir * 0.06 * sw, y: j.y - 0.08 * sw };
  };
  const lsA = seam(p.ls, out);
  const rsA = seam(p.rs, -out);
  // Shop models stand upright; a steep shoulder line means one seam was misplaced (turned
  // body, arm across the shoulder). Level it rather than warp the garment.
  const tilt = Math.atan2(Math.abs(lsA.y - rsA.y), Math.abs(lsA.x - rsA.x));
  if (tilt > (15 * Math.PI) / 180) {
    const y = Math.min(lsA.y, rsA.y);
    lsA.y = rsA.y = y;
    warnings.push("The shoulders looked tilted, so they were levelled; check the fit.");
  }

  const ncx = (p.ls.x + p.rs.x) / 2;
  let neckY = Infinity;
  for (let x = Math.round(ncx - 0.15 * sw); x <= Math.round(ncx + 0.15 * sw); x++) {
    const y = topIn(x, Math.min(p.ls.y, p.rs.y) - 0.6 * sw, Math.max(p.ls.y, p.rs.y) + 0.2 * sw);
    if (y !== null) neckY = Math.min(neckY, y);
  }
  if (!Number.isFinite(neckY)) neckY = (lsA.y + rsA.y) / 2 - 0.1 * sw;

  const anchors: Anchors = {
    neck: norm({ x: ncx, y: neckY }),
    left_shoulder: norm(lsA),
    right_shoulder: norm(rsA),
    left_hip: norm(p.lh),
    right_hip: norm(p.rh),
  };

  // Sleeves: walk down the arm (shoulder -> elbow -> wrist) while it's still covered by the
  // garment. Where coverage ends is the cuff; past the elbow means a long sleeve.
  const rank: Record<SleeveType, number> = { none: 0, short: 1, long: 2 };
  let sleeve: SleeveType = "none";
  const r = Math.max(1, Math.round(0.02 * sw));
  for (const side of ["left", "right"] as const) {
    const S = side === "left" ? p.ls : p.rs;
    const dir = side === "left" ? out : -out;
    const E = (side === "left" ? p.le : p.re) ?? { x: S.x + dir * 0.1 * sw, y: S.y + 0.82 * sw };
    const Wp = (side === "left" ? p.lw : p.rw) ?? { x: E.x + (E.x - S.x) * 0.9, y: E.y + (E.y - S.y) * 0.9 };
    const point = (t: number): Vec2 =>
      t <= 1 ? { x: S.x + (E.x - S.x) * t, y: S.y + (E.y - S.y) * t } : { x: E.x + (Wp.x - E.x) * (t - 1), y: E.y + (Wp.y - E.y) * (t - 1) };
    let end = 0, gap = 0;
    for (let t = 0; t <= 2; t += 0.02) {
      if (covered(point(t), r)) { end = t; gap = 0; }
      else if ((gap += 0.02) > 0.1) break;
    }
    let s: SleeveType = "none";
    if (end >= 0.25) {
      anchors[`${side}_cuff`] = norm(point(end));
      if (end > 1.3) {
        s = "long";
        anchors[`${side}_elbow`] = norm(E);
      } else s = "short";
    }
    if (rank[s] > rank[sleeve]) sleeve = s;
  }
  return { anchors, sleeve };
}

/* ------------------------------------------------------------------ plain-background photos */

/** Flood-fills the backdrop from the border by colour distance. Returns border uniformity. */
function removeUniformBackground(work: Work, warnings: string[], threshold = 28): number {
  const { w, h, rgba } = work;
  const bw = Math.max(2, Math.floor(Math.min(w, h) / 100));
  const border: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (y < bw || y >= h - bw || x < bw || x >= w - bw) border.push(y * w + x);
  const med = [0, 1, 2].map((c) => {
    const v = border.map((i) => rgba[4 * i + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const dist = (i: number) =>
    Math.hypot(rgba[4 * i] - med[0], rgba[4 * i + 1] - med[1], rgba[4 * i + 2] - med[2]);
  const uniformity = border.filter((i) => dist(i) < threshold).length / border.length;

  // Grow the backdrop from the border through pixels close to the backdrop colour (connected
  // only, so a white logo inside the garment survives). Tolerating gradual shading instead was
  // tried and leaks into light garments on light walls, so uneven backdrops get a warning.
  const bg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (i: number) => {
    if (!bg[i] && dist(i) < threshold) { bg[i] = 1; stack[sp++] = i; }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp];
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // Hard mask, then feather inward by one pixel so no backdrop-coloured fringe survives.
  for (let i = 0; i < w * h; i++) work.alpha[i] = bg[i] ? 0 : 255;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      if (bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w]) work.alpha[i] = 128;
    }
  const fg = countAbove(work.alpha, 127) / (w * h);
  if (fg > 0.95) warnings.push("Almost nothing was removed; a transparent PNG will work better.");
  keepLargestComponent(work.alpha, w, h);
  return uniformity;
}

/** Shoulder-seam corner on one side of a front-view outline (port of _seam_corner). */
function seamCorner(mask: Uint8Array, w: number, h: number, cx: number, outward: number, torsoW: number): Vec2 | null {
  const topy = new Float64Array(w).fill(h);
  let minX = w, maxX = -1;
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (mask[y * w + x]) { topy[x] = y; if (x < minX) minX = x; if (x > maxX) maxX = x; break; }
  if (maxX < 0) return null;
  const k = Math.max(1, Math.floor(0.006 * w));
  const sm = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let j = x - k; j <= x + k; j++) if (j >= 0 && j < w) { s += topy[j]; n++; }
    sm[x] = s / n;
  }
  const extreme = outward > 0 ? maxX : minX;
  const start = Math.floor(cx + outward * 0.12 * torsoW);
  if ((extreme - start) * outward <= 0) return null;
  const step = Math.max(1, Math.floor(0.015 * w));
  let steepSeen = false;
  for (let x = extreme - outward * step; (x - start) * outward > 0; x -= outward) {
    const xIn = x - outward * step;
    if (xIn < 0 || xIn >= w) break;
    const slope = (sm[x] - sm[xIn]) / step;
    if (slope > 0.6) { steepSeen = true; continue; }
    if (steepSeen && slope < 0.45) return { x, y: topy[x] };
  }
  return null;
}

/** Heuristic anchors from a front-view upper-body outline (port of detect_anchors). */
function anchorsFromSilhouette(work: Work, warnings: string[]): { anchors: Anchors; sleeve: SleeveType } {
  const { w, h } = work;
  const mask = new Uint8Array(w * h);
  let top = h, bottom = -1, sumX = 0, n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (work.alpha[y * w + x] > 127) {
        mask[y * w + x] = 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        sumX += x;
        n++;
      }
  const gh = bottom - top;
  const cx = sumX / n;
  const rowExtent = (y: number): [number, number] | null => {
    let a = -1, b = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (a < 0) a = x; b = x; }
    return a < 0 ? null : [a, b];
  };
  const band: [number, number][] = [];
  for (let y = Math.floor(bottom - 0.12 * gh); y < Math.floor(bottom - 0.04 * gh); y++) {
    const e = rowExtent(y);
    if (e) band.push(e);
  }
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  const xl = band.length ? median(band.map((b) => b[0])) : cx - 0.3 * w;
  const xr = band.length ? median(band.map((b) => b[1])) : cx + 0.3 * w;
  const torsoW = xr - xl;
  if (torsoW < 0.2 * w) warnings.push("The hem looks unusually narrow; anchors may be off.");

  let neckY = Infinity;
  for (let x = Math.floor(cx - 0.05 * torsoW); x <= Math.floor(cx + 0.05 * torsoW); x++)
    for (let y = 0; y < h; y++) if (mask[y * w + x]) { neckY = Math.min(neckY, y); break; }
  if (!Number.isFinite(neckY)) neckY = top + 0.05 * gh;

  const seams: Record<"left" | "right", Vec2> = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
  for (const [side, outward] of [["left", 1], ["right", -1]] as const) {
    const s = seamCorner(mask, w, h, cx, outward, torsoW);
    if (!s) warnings.push(`Couldn't find the ${side} shoulder seam; placed a default.`);
    seams[side] = s ?? { x: outward > 0 ? xr - 0.07 * torsoW : xl + 0.07 * torsoW, y: top + 0.12 * gh };
  }
  const seamY = (seams.left.y + seams.right.y) / 2;
  const hipY = seamY + 0.75 * (bottom - seamY);
  const hipInset = 0.17 * torsoW;
  const anchors: Anchors = {
    neck: { x: cx / w, y: neckY / h },
    left_shoulder: { x: seams.left.x / w, y: seams.left.y / h },
    right_shoulder: { x: seams.right.x / w, y: seams.right.y / h },
    left_hip: { x: (xr - hipInset) / w, y: hipY / h },
    right_hip: { x: (xl + hipInset) / w, y: hipY / h },
  };

  const rank: Record<SleeveType, number> = { none: 0, short: 1, long: 2 };
  let sleeve: SleeveType = "none";
  const margin = 0.04 * torsoW;
  const shoulderW = seams.left.x - seams.right.x;
  for (const side of ["right", "left"] as const) {
    const sh = seams[side];
    const pts: Vec2[] = [];
    for (let y = top; y < top + 0.75 * gh; y++)
      for (let x = 0; x < w; x++)
        if (mask[y * w + x] && (side === "right" ? x < xl - margin : x > xr + margin)) pts.push({ x, y });
    if (pts.length < 0.002 * n) continue;
    const d = pts.map((q) => Math.hypot(q.x - sh.x, q.y - sh.y));
    const cut = [...d].sort((a, b) => a - b)[Math.floor(0.97 * (d.length - 1))];
    const far = pts.filter((_, i) => d[i] >= cut);
    const cuff = { x: far.reduce((s, q) => s + q.x, 0) / far.length, y: far.reduce((s, q) => s + q.y, 0) / far.length };
    anchors[`${side}_cuff`] = { x: cuff.x / w, y: cuff.y / h };
    let s: SleeveType = "short";
    if (Math.hypot(cuff.x - sh.x, cuff.y - sh.y) > 0.95 * shoulderW) {
      s = "long";
      anchors[`${side}_elbow`] = { x: (sh.x + 0.5 * (cuff.x - sh.x)) / w, y: (sh.y + 0.5 * (cuff.y - sh.y)) / h };
    }
    if (rank[s] > rank[sleeve]) sleeve = s;
  }
  return { anchors, sleeve };
}
```

## src/lib/quietLogs.ts

```ts
/**
 * MediaPipe's WebAssembly runtime prints its internal C++ log lines through console.warn
 * (and TensorFlow Lite's notices through console.error). Chrome lists every one of them on
 * the extension's "Errors" page, where these four harmless, expected messages look like
 * failures to users. Drop exactly those; every other message still reaches the console.
 *
 * Installed once at startup, before MediaPipe loads: its runtime binds console.error when a
 * model is created, so it picks up this filtered version.
 */
export const BENIGN_MEDIAPIPE_LOGS: RegExp[] = [
  /inference_feedback_manager\.cc:\d+\] Feedback manager requires a model with a single signature inference/,
  /landmark_projection_calculator\.cc:\d+\] Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI/,
  /gl_context\.cc:\d+\] OpenGL error checking is disabled/,
  /^INFO: Created TensorFlow Lite XNNPACK delegate for CPU\.?$/,
];

export const isBenignMediaPipeLog = (args: unknown[]): boolean =>
  args.length === 1 && typeof args[0] === "string" && BENIGN_MEDIAPIPE_LOGS.some((r) => r.test(args[0] as string));

export function quietMediaPipeLogs(c: Pick<Console, "warn" | "error"> = console): void {
  for (const level of ["warn", "error"] as const) {
    const original = c[level].bind(c);
    c[level] = (...args: unknown[]) => {
      if (!isBenignMediaPipeLog(args)) original(...args);
    };
  }
}
```

## src/lib/store.ts

```ts
import type { Anchors, Garment, MeshConfig } from "@shared/lib/types";

const DB_NAME = "fabstudio-extension";
const DB_VERSION = 1;
const GARMENTS_STORE = "garments";
const IMAGES_STORE = "images";
const MODELS_STORE = "models";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(GARMENTS_STORE)) {
        db.createObjectStore(GARMENTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE);
      }
      if (!db.objectStoreNames.contains(MODELS_STORE)) {
        db.createObjectStore(MODELS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function getAllGarments(): Promise<Garment[]> {
  return tx<Garment[]>(GARMENTS_STORE, "readonly", (s) => s.getAll());
}

export async function saveGarment(garment: Garment, imageBlob: Blob): Promise<void> {
  const db = await openDB();
  const t = db.transaction([GARMENTS_STORE, IMAGES_STORE], "readwrite");
  t.objectStore(GARMENTS_STORE).put(garment);
  t.objectStore(IMAGES_STORE).put(imageBlob, garment.id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteGarment(id: string): Promise<void> {
  const db = await openDB();
  const t = db.transaction([GARMENTS_STORE, IMAGES_STORE], "readwrite");
  t.objectStore(GARMENTS_STORE).delete(id);
  t.objectStore(IMAGES_STORE).delete(id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getGarmentImageUrl(id: string): Promise<string | null> {
  const blob = await tx<Blob | undefined>(IMAGES_STORE, "readonly", (s) => s.get(id));
  return blob ? URL.createObjectURL(blob) : null;
}

export async function getGarmentImageBlob(id: string): Promise<Blob | null> {
  const blob = await tx<Blob | undefined>(IMAGES_STORE, "readonly", (s) => s.get(id));
  return blob ?? null;
}

export async function cacheModel(key: string, data: ArrayBuffer): Promise<void> {
  await tx(MODELS_STORE, "readwrite", (s) => s.put(data, key));
}

export async function getCachedModel(key: string): Promise<ArrayBuffer | null> {
  const data = await tx<ArrayBuffer | undefined>(MODELS_STORE, "readonly", (s) => s.get(key));
  return data ?? null;
}

export function defaultAnchors(): Anchors {
  return {
    neck: { x: 0.5, y: 0.12 },
    left_shoulder: { x: 0.18, y: 0.18 },
    right_shoulder: { x: 0.82, y: 0.18 },
    left_hip: { x: 0.28, y: 0.85 },
    right_hip: { x: 0.72, y: 0.85 },
  };
}

export function defaultMesh(): MeshConfig {
  return { cols: 12, rows: 16, sleeve_blend: 0.15, elbow_blend: 0.3 };
}

export function garmentFromImage(
  imageUrl: string,
  name: string,
  imageSize: [number, number],
  prep?: { anchors: Anchors; sleeve: Garment["sleeve"] },
): Garment {
  const id = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    category: "other",
    body_region: "upper_body",
    sleeve: prep?.sleeve ?? "short",
    anchors: prep?.anchors ?? defaultAnchors(),
    mesh: defaultMesh(),
    source: { origin: imageUrl, license: "user-captured", demo: false },
    views: { front: id },
    preview: id,
    image_size: imageSize,
    renderable: true,
    sizes: [],
  };
}
```

## src/lib/vision-ext.ts

```ts
import { FilesetResolver, ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { CategoryMask, PixelLandmark } from "@shared/lib/types";
import type { PoseProvider } from "@shared/tracking/vision";
import { cacheModel, getCachedModel } from "./store";

export type Delegate = "GPU" | "CPU";
export type DelegatePref = Delegate | "auto";
export type PoseModel = "full" | "lite";

export const WASM_BASE = chrome.runtime.getURL("wasm");

const MODEL_URLS: Record<string, string> = {
  pose_full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
  pose_lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
  selfie_multiclass: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
};

export async function loadModel(key: string, onProgress?: (msg: string) => void): Promise<ArrayBuffer> {
  const cached = await getCachedModel(key);
  if (cached) {
    onProgress?.(`Loaded ${key} from cache`);
    return cached;
  }
  const url = MODEL_URLS[key];
  if (!url) throw new Error(`Unknown model: ${key}`);
  onProgress?.(`Downloading ${key}…`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download ${key}: ${resp.status}`);
  const data = await resp.arrayBuffer();
  await cacheModel(key, data);
  onProgress?.(`Cached ${key}`);
  return data;
}

export class ExtensionVision implements PoseProvider {
  private lastTs = 0;
  private constructor(
    private pose: PoseLandmarker,
    private seg: ImageSegmenter | null,
    public delegate: Delegate,
    public poseModel: PoseModel,
    private fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    private liteAvailable: boolean,
  ) {}

  get label(): string {
    return `MediaPipe pose ${this.poseModel} · ${this.delegate}${this.seg ? " · segmentation" : ""}`;
  }

  get canSegment(): boolean {
    return this.seg !== null;
  }

  static async create(opts: {
    delegate: DelegatePref;
    poseModel: PoseModel;
    segmentation: boolean;
    onProgress?: (msg: string) => void;
  }): Promise<ExtensionVision> {
    const p = opts.onProgress ?? (() => {});
    p("Loading MediaPipe runtime…");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

    const model = opts.poseModel;
    const poseKey = `pose_${model}`;
    const poseData = await loadModel(poseKey, p);

    const delegates: Delegate[] = opts.delegate === "auto" ? ["GPU", "CPU"] : [opts.delegate];
    let lastErr: unknown = null;

    for (const delegate of delegates) {
      try {
        p(`Loading pose model (${model}, ${delegate})…`);
        const pose = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: new Uint8Array(poseData), delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        let seg: ImageSegmenter | null = null;
        if (opts.segmentation) {
          try {
            const segData = await loadModel("selfie_multiclass", p);
            p(`Loading segmentation model (${delegate})…`);
            seg = await ImageSegmenter.createFromOptions(fileset, {
              baseOptions: { modelAssetBuffer: new Uint8Array(segData), delegate },
              runningMode: "VIDEO",
              outputCategoryMask: true,
              outputConfidenceMasks: false,
            });
          } catch (e) {
            console.warn("segmentation unavailable", e);
          }
        }

        const liteAvailable = model === "lite" || (await getCachedModel("pose_lite")) !== null;
        return new ExtensionVision(pose, seg, delegate, model, fileset, liteAvailable);
      } catch (e) {
        console.warn(`MediaPipe ${delegate} delegate failed`, e);
        lastErr = e;
      }
    }
    throw new Error(`Could not start pose tracking: ${String(lastErr)}`);
  }

  private ts(tsMs: number): number {
    this.lastTs = Math.max(this.lastTs + 1, Math.round(tsMs));
    return this.lastTs;
  }

  detect(frame: TexImageSource, width: number, height: number, tsMs: number): PixelLandmark[] | null {
    const res = this.pose.detectForVideo(frame as HTMLVideoElement, this.ts(tsMs));
    const lm = res.landmarks?.[0];
    if (!lm) return null;
    return lm.map((p) => ({ x: p.x * width, y: p.y * height, visibility: p.visibility ?? 0 }));
  }

  segment(frame: TexImageSource, tsMs: number): CategoryMask | null {
    if (!this.seg) return null;
    let out: CategoryMask | null = null;
    this.seg.segmentForVideo(frame as HTMLVideoElement, this.ts(tsMs), (r) => {
      const m = r.categoryMask;
      if (m) {
        out = { width: m.width, height: m.height, data: new Uint8Array(m.getAsUint8Array()) };
      }
    });
    return out;
  }

  async downgrade(): Promise<boolean> {
    if (this.poseModel === "full" && this.liteAvailable) {
      const liteData = await loadModel("pose_lite");
      const pose = await PoseLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetBuffer: new Uint8Array(liteData), delegate: this.delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      this.pose.close();
      this.pose = pose;
      this.poseModel = "lite";
      return true;
    }
    if (this.seg) {
      this.seg.close();
      this.seg = null;
      return true;
    }
    return false;
  }

  close(): void {
    this.pose.close();
    this.seg?.close();
  }
}
```

---

# Size estimation (src/sizing)

## src/sizing/__tests__/sizing.test.ts

```ts
import { describe, expect, it } from "vitest";
import { CHARTS } from "../charts";
import { recommendSize } from "../fit";
import { ellipsePerimeter, kneePoint, PersonMask } from "../mask";
import {
  analyseFront, analyseSide, combine, SHAPE_FACTOR,
  type BodyMeasurements, type Measurement,
} from "../measure";
import { SizeScan, type ScanState } from "../scan";
import { levels, renderMannequin, type Body, type MannequinOpts } from "../testing/mannequin";

const MAN: Body = { heightCm: 178, shoulderCm: 46, chestW: 31, chestD: 24, waistW: 29, waistD: 21, hipW: 34, hipD: 24 };
const expectedGirth = (w: number, d: number, k: keyof typeof SHAPE_FACTOR) => ellipsePerimeter(w / 2, d / 2) * SHAPE_FACTOR[k];

// 16:9 camera frame, square segmentation mask (anisotropic, like MediaPipe's 256×256 model)
const FRAME: Omit<MannequinOpts, "view"> = { frameW: 1280, frameH: 720, maskW: 512, maskH: 512, personPx: 620 };

describe("mask geometry", () => {
  it("ellipse perimeter matches a circle", () => {
    expect(ellipsePerimeter(10, 10)).toBeCloseTo(2 * Math.PI * 10, 6);
  });

  it("keeps only the largest blob and fills holes", () => {
    const w = 20;
    const h = 20;
    const d = new Uint8Array(w * h);
    for (let y = 2; y < 18; y++) for (let x = 2; x < 12; x++) d[y * w + x] = 1;
    d[10 * w + 6] = 0; // hole
    d[1 * w + 18] = 1; // speck
    const m = PersonMask.fromCategoryMask({ width: w, height: h, data: d }, w, h);
    expect(m.at(6, 10)).toBe(1);
    expect(m.at(18, 1)).toBe(0);
    expect(m.verticalExtent()).toEqual([2, 17]);
  });

  it("finds the bend of an L-shaped curve", () => {
    const pts = [...Array.from({ length: 6 }, (_, i) => ({ x: i, y: 0 })), ...Array.from({ length: 6 }, (_, i) => ({ x: 5, y: i + 1 }))];
    expect(kneePoint(pts)).toBe(5);
  });
});

describe("measurement on a synthetic mannequin", () => {
  const front = renderMannequin(MAN, { ...FRAME, view: "front" });
  const side = renderMannequin(MAN, { ...FRAME, view: "side" });

  it("finds chest, waist and hip levels near the true heights", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    expect(f).not.toBeNull();
    const L = levels(MAN);
    expect(Math.abs(f.levelCm!.chest - L.chest)).toBeLessThan(3);
    expect(Math.abs(f.levelCm!.waist - L.waist)).toBeLessThan(3);
    expect(Math.abs(f.levelCm!.hip - L.hip)).toBeLessThan(3);
    // widths are exact up to about one mask column (pixelation)
    const col = f.cmPerPx / (FRAME.maskW / FRAME.frameW);
    expect(Math.abs(f.widthCm.chest - MAN.chestW)).toBeLessThan(col * 1.2);
    expect(Math.abs(f.widthCm.waist - MAN.waistW)).toBeLessThan(col * 1.2);
    expect(Math.abs(f.widthCm.hip - MAN.hipW)).toBeLessThan(col * 1.2);
    expect(f.widthClear).toEqual({ chest: true, waist: true, hip: true });
  });

  it("measures girths from front + side within 3%", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    const s = analyseSide(side.mask, side.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm)!;
    const m = combine(Array(10).fill(f), Array(10).fill(s), MAN.heightCm, "full");
    expect(m.hasSide).toBe(true);
    const rel = (got: Measurement | null, want: number) => Math.abs(got!.valueCm - want) / want;
    expect(rel(m.chest, expectedGirth(MAN.chestW, MAN.chestD, "chest"))).toBeLessThan(0.03);
    expect(rel(m.waist, expectedGirth(MAN.waistW, MAN.waistD, "waist"))).toBeLessThan(0.03);
    expect(rel(m.hip, expectedGirth(MAN.hipW, MAN.hipD, "hip"))).toBeLessThan(0.03);
    expect(m.chest!.flags).toEqual([]);
  });

  it("measures shoulder width from the contour within 8%", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    expect(f.shoulderFromContour).toBe(true);
    expect(Math.abs(f.shoulderCm - MAN.shoulderCm) / MAN.shoulderCm).toBeLessThan(0.08);
  });

  it("is scale-independent (same body, smaller in the frame)", () => {
    const small = renderMannequin(MAN, { ...FRAME, view: "front", personPx: 450 });
    const f = analyseFront(small.mask, small.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    expect(Math.abs(f.widthCm.chest - MAN.chestW)).toBeLessThan(1.2);
  });

  it("stays within 5% at the real model's 256×256 mask and a smaller person", () => {
    const o = { ...FRAME, maskW: 256, maskH: 256, personPx: 520 };
    const fr = renderMannequin(MAN, { ...o, view: "front" });
    const sd = renderMannequin(MAN, { ...o, view: "side" });
    const f = analyseFront(fr.mask, fr.landmarks, o.frameW, o.frameH, MAN.heightCm, "full")!;
    const s = analyseSide(sd.mask, sd.landmarks, o.frameW, o.frameH, MAN.heightCm)!;
    const m = combine(Array(10).fill(f), Array(10).fill(s), MAN.heightCm, "full");
    for (const [k, w, d] of [["chest", MAN.chestW, MAN.chestD], ["waist", MAN.waistW, MAN.waistD], ["hip", MAN.hipW, MAN.hipD]] as const) {
      const want = expectedGirth(w, d, k);
      expect(Math.abs(m[k]!.valueCm - want) / want).toBeLessThan(0.05);
    }
  });

  it("front-only result is flagged low confidence", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    const m = combine(Array(10).fill(f), [], MAN.heightCm, "full");
    expect(m.hasSide).toBe(false);
    expect(m.chest!.confidence).toBe("low");
    expect(m.notes.join(" ")).toMatch(/No side view/);
  });
});

const meas = (v: number, sigma = 1.5): Measurement => ({ valueCm: v, sigmaCm: sigma, scaleRel: 0.012, confidence: "high", method: "test", flags: [] });
const body = (chest: number, waist: number, hip?: number, sigma = 1.5): BodyMeasurements => ({
  heightCm: 178, mode: "full", hasSide: true, frames: { front: 20, side: 15 },
  shoulder: meas(46), chest: meas(chest, sigma), waist: meas(waist, sigma), hip: hip ? meas(hip, sigma) : null, notes: [],
});

describe("size recommendation", () => {
  it("picks M for a mid-range men's M body", () => {
    const r = recommendSize(body(100, 85), CHARTS.men, "regular");
    expect(r.recommended).toBe("M");
    expect(r.status).toBe("confident");
    expect(r.probability).toBeGreaterThan(0.8);
  });

  it("reports between sizes on a chart boundary", () => {
    const r = recommendSize(body(104, 89, undefined, 3), CHARTS.men, "regular");
    expect(r.status).toBe("between_sizes");
    expect(new Set([r.recommended, r.alternative])).toEqual(new Set(["M", "L"]));
  });

  it("a relaxed fit preference leans toward the larger size", () => {
    const pL = (pref: "slim" | "relaxed") =>
      recommendSize(body(103.5, 88.5, undefined, 2), CHARTS.men, pref).probabilities.find((p) => p.label === "L")!.p;
    expect(pL("relaxed")).toBeGreaterThan(pL("slim"));
    expect(recommendSize(body(103.5, 88.5, undefined, 2), CHARTS.men, "slim").recommended).toBe("M");
  });

  it("flags bodies outside the chart", () => {
    expect(recommendSize(body(145, 130), CHARTS.men, "regular").status).toBe("outside_range");
    expect(recommendSize(body(70, 58), CHARTS.men, "regular").status).toBe("outside_range");
  });

  it("uses bust, waist and hip for the women's chart", () => {
    const r = recommendSize(body(90, 72, 96), CHARTS.women, "regular");
    expect(r.recommended).toBe("M");
    expect(r.details.map((d) => d.key)).toEqual(["chest", "waist", "hip"]);
  });

  it("refuses without a chest measurement", () => {
    const b = body(100, 85);
    b.chest = null;
    expect(recommendSize(b, CHARTS.men, "regular").status).toBe("insufficient_data");
  });
});

describe("live scan", () => {
  const front = renderMannequin(MAN, { ...FRAME, view: "front" });
  const side = renderMannequin(MAN, { ...FRAME, view: "side" });
  const frame = (r: ReturnType<typeof renderMannequin>, t: number) => ({
    landmarks: r.landmarks, mask: r.mask, width: FRAME.frameW, height: FRAME.frameH, tMs: t,
  });

  it("guides through front and side and produces measurements", () => {
    const states: ScanState[] = [];
    const scan = new SizeScan(MAN.heightCm, "full", (s) => states.push(s));
    let t = 0;
    for (let i = 0; i < 40 && scan.current.phase === "front"; i++) scan.feed(frame(front, (t += 33)));
    expect(scan.current.phase).toBe("side");
    // still facing front: the side checks must ask to turn
    scan.feed(frame(front, (t += 33)));
    expect(scan.current.checks.find((c) => c.id === "profile")?.ok).toBe(false);
    for (let i = 0; i < 40 && scan.current.phase === "side"; i++) scan.feed(frame(side, (t += 33)));
    expect(scan.current.phase).toBe("done");
    const m = scan.current.result!;
    expect(m.hasSide).toBe(true);
    expect(Math.abs(m.chest!.valueCm - expectedGirth(MAN.chestW, MAN.chestD, "chest")) / m.chest!.valueCm).toBeLessThan(0.03);
    expect(recommendSize(m, CHARTS.men, "regular").recommended).toBeTruthy();
  });

  it("asks to step back when the feet are cut off, and offers the quick estimate", () => {
    const cut = renderMannequin(MAN, { ...FRAME, view: "front", floorY: FRAME.frameH + 60 });
    const scan = new SizeScan(MAN.heightCm, "full", () => {});
    let t = 0;
    for (let i = 0; i < 300; i++) scan.feed(frame(cut, (t += 33)));
    expect(scan.current.phase).toBe("front");
    expect(scan.current.checks.find((c) => c.id === "feet")?.ok).toBe(false);
    expect(scan.current.instruction).toMatch(/feet/);
    expect(scan.current.suggestQuick).toBe(true);
    scan.useQuick();
    for (let i = 0; i < 40 && scan.current.phase === "front"; i++) scan.feed(frame(cut, (t += 33)));
    expect(scan.current.phase).toBe("done");
    expect(scan.current.result!.mode).toBe("quick");
  });

  it("fails clearly when no segmentation mask arrives", () => {
    const scan = new SizeScan(MAN.heightCm, "full", () => {});
    for (let t = 0; t < 5000; t += 100) scan.feed({ landmarks: front.landmarks, mask: null, width: 1280, height: 720, tMs: t });
    expect(scan.current.phase).toBe("failed");
    expect(scan.current.error).toMatch(/segmentation/);
  });
});
```

## src/sizing/charts.ts

```ts
/**
 * Generic BODY-measurement size charts for tops (chest/bust, waist, hip in cm).
 *
 * These are typical international (EU/UK high-street) ranges, NOT any brand's chart. Brands
 * differ by a size or more, so the result tells people to compare with the product's own chart.
 * Ranges are contiguous: a size covers [min, max].
 */
import type { Girth } from "./measure";

export type ChartId = "men" | "women" | "unisex";

export interface ChartSize {
  label: string;
  dims: Partial<Record<Girth, [number, number]>>;
}

export interface SizeChart {
  id: ChartId;
  label: string;
  /** how much each body measurement counts (FitSize: chest weighs most for tops) */
  weights: Partial<Record<Girth, number>>;
  sizes: ChartSize[];
}

const sizes = (rows: [string, ...([number, number] | null)[]][], keys: Girth[]): ChartSize[] =>
  rows.map(([label, ...ranges]) => {
    const dims: ChartSize["dims"] = {};
    keys.forEach((k, i) => {
      const r = ranges[i];
      if (r) dims[k] = r;
    });
    return { label, dims };
  });

export const CHARTS: Record<ChartId, SizeChart> = {
  men: {
    id: "men",
    label: "Men's",
    weights: { chest: 3, waist: 1 },
    sizes: sizes(
      [
        ["XS", [84, 89], [70, 75]],
        ["S", [89, 96], [75, 81]],
        ["M", [96, 104], [81, 89]],
        ["L", [104, 112], [89, 97]],
        ["XL", [112, 120], [97, 105]],
        ["XXL", [120, 128], [105, 113]],
        ["3XL", [128, 136], [113, 121]],
      ],
      ["chest", "waist"],
    ),
  },
  women: {
    id: "women",
    label: "Women's",
    weights: { chest: 3, waist: 1.5, hip: 1 },
    sizes: sizes(
      [
        ["XS", [78, 82], [60, 64], [84, 88]],
        ["S", [82, 87], [64, 69], [88, 93]],
        ["M", [87, 93], [69, 75], [93, 99]],
        ["L", [93, 100], [75, 82], [99, 106]],
        ["XL", [100, 108], [82, 90], [106, 114]],
        ["XXL", [108, 116], [90, 98], [114, 122]],
      ],
      ["chest", "waist", "hip"],
    ),
  },
  unisex: {
    id: "unisex",
    label: "Unisex",
    weights: { chest: 3, waist: 1 },
    sizes: sizes(
      [
        ["XS", [82, 88], [68, 74]],
        ["S", [88, 96], [74, 82]],
        ["M", [96, 104], [82, 90]],
        ["L", [104, 112], [90, 98]],
        ["XL", [112, 120], [98, 106]],
        ["XXL", [120, 128], [106, 114]],
      ],
      ["chest", "waist"],
    ),
  },
};

export const GIRTH_LABEL: Record<Girth, Record<ChartId, string>> = {
  chest: { men: "Chest", women: "Bust", unisex: "Chest" },
  waist: { men: "Waist", women: "Waist", unisex: "Waist" },
  hip: { men: "Hip", women: "Hip", unisex: "Hip" },
};
```

## src/sizing/fit.ts

```ts
/**
 * Size recommendation against a BODY-measurement chart (ported from FitSize `fit_engine.py`).
 *
 * Each size's penalty grows as the body moves away from a target point inside the size's
 * range (the fit preference moves the target), steeply when the body is ABOVE the range
 * (too tight) and more gently below it (loose). Measurement uncertainty is handled with
 * Monte-Carlo sampling: values from one scan share a common scale error. The probability
 * reported is "how often this size wins across plausible versions of your measurements"
 * — decision stability, NOT validated accuracy.
 */
import type { SizeChart } from "./charts";
import { GIRTHS, type BodyMeasurements, type Girth, type Measurement } from "./measure";

export type FitPreference = "slim" | "regular" | "relaxed";
const TARGET: Record<FitPreference, number> = { slim: 0.75, regular: 0.5, relaxed: 0.3 };
const AMBIGUOUS = 0.6;
const SAMPLES = 3000;

export type SizeStatus = "confident" | "between_sizes" | "outside_range" | "insufficient_data";

export interface DimDetail {
  key: Girth;
  bodyCm: number;
  range: [number, number];
  status: "within" | "above" | "below";
}

export interface SizeRecommendation {
  status: SizeStatus;
  recommended: string | null;
  alternative: string | null;
  probability: number;
  probabilities: { label: string; p: number }[];
  details: DimDetail[];
  message: string;
}

/** Small seeded PRNG (mulberry32) + Box–Muller, so the same scan always gives the same answer. */
function rng(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
}

function rangePenalty(b: number, mn: number, mx: number, hw: number, target: number): number {
  if (b > mx) {
    const dt = (b - mx) / hw;
    return 0.5 * ((mx - target) / (2 * hw)) ** 2 + dt + 1.5 * dt * dt;
  }
  if (b < mn) {
    const dl = (mn - b) / hw;
    return 0.5 * ((mn - target) / (2 * hw)) ** 2 + 0.5 * dl + 0.5 * dl * dl;
  }
  return 0.5 * ((b - target) / (2 * hw)) ** 2;
}

/** Half-widths: half the size's range, but at least half the gap to the neighbouring sizes. */
function halfWidths(chart: SizeChart, key: Girth): number[] {
  const mids = chart.sizes.map((s) => {
    const r = s.dims[key];
    return r ? (r[0] + r[1]) / 2 : null;
  });
  return chart.sizes.map((s, i) => {
    const gaps: number[] = [];
    for (const j of [i - 1, i + 1]) {
      const a = mids[i];
      const b = mids[j];
      if (a != null && b != null) gaps.push(Math.abs(b - a) / 2);
    }
    const neighbour = Math.max(gaps.length ? Math.min(...gaps) : 2, 1);
    const r = s.dims[key];
    return r && r[1] > r[0] ? Math.max((r[1] - r[0]) / 2, neighbour) : neighbour;
  });
}

export function recommendSize(body: BodyMeasurements, chart: SizeChart, pref: FitPreference): SizeRecommendation {
  const keys = GIRTHS.filter(
    (k) => (chart.weights[k] ?? 0) > 0 && body[k] && chart.sizes.every((s) => s.dims[k]),
  );
  if (!keys.includes("chest")) {
    return {
      status: "insufficient_data", recommended: null, alternative: null, probability: 0, probabilities: [],
      details: [], message: "Couldn't measure your chest, which matters most for tops. Try the scan again.",
    };
  }
  const meas = Object.fromEntries(keys.map((k) => [k, body[k] as Measurement])) as Record<Girth, Measurement>;
  const hw = Object.fromEntries(keys.map((k) => [k, halfWidths(chart, k)])) as Record<Girth, number[]>;
  const t = TARGET[pref];

  const totalPenalty = (vals: Record<Girth, number>, si: number): number => {
    let sum = 0;
    let wsum = 0;
    for (const k of keys) {
      const [mn, mx] = chart.sizes[si].dims[k]!;
      const w = chart.weights[k]!;
      sum += w * rangePenalty(vals[k], mn, mx, hw[k][si], mn + t * (mx - mn));
      wsum += w;
    }
    return sum / wsum;
  };

  // ---- Monte Carlo: shared scale error + independent error per measurement ----
  const gauss = rng(12345);
  const wins = new Array(chart.sizes.length).fill(0);
  for (let n = 0; n < SAMPLES; n++) {
    const zShared = gauss();
    const vals = {} as Record<Girth, number>;
    for (const k of keys) {
      const m = meas[k];
      const shared = m.valueCm * m.scaleRel;
      const ind = Math.sqrt(Math.max(m.sigmaCm ** 2 - shared ** 2, 0));
      vals[k] = m.valueCm + zShared * shared + gauss() * ind;
    }
    let best = 0;
    let bestP = Infinity;
    for (let si = 0; si < chart.sizes.length; si++) {
      const p = totalPenalty(vals, si);
      if (p < bestP) {
        bestP = p;
        best = si;
      }
    }
    wins[best]++;
  }
  const probs = wins.map((w) => w / SAMPLES);
  const meanVals = Object.fromEntries(keys.map((k) => [k, meas[k].valueCm])) as Record<Girth, number>;
  const meanPen = chart.sizes.map((_, si) => totalPenalty(meanVals, si));
  const order = chart.sizes.map((_, i) => i).sort((a, b) => probs[b] - probs[a] || meanPen[a] - meanPen[b]);
  const best = order[0];
  let second: number | null = order[1] ?? null;
  if (second !== null && probs[second] === 0) {
    const rest = chart.sizes.map((_, i) => i).filter((i) => i !== best).sort((a, b) => meanPen[a] - meanPen[b]);
    second = rest[0] ?? null;
  }

  const details: DimDetail[] = keys.map((k) => {
    const r = chart.sizes[best].dims[k]!;
    const b = meanVals[k];
    return { key: k, bodyCm: b, range: r, status: b > r[1] ? "above" : b < r[0] ? "below" : "within" };
  });

  const label = (i: number | null) => (i === null ? null : chart.sizes[i].label);
  const pBest = probs[best];
  let status: SizeStatus = "confident";
  let message = `${chart.sizes[best].label} fits your measurements best.`;
  const tightChest = details.find((d) => d.key === "chest" && d.status === "above");
  if (best === chart.sizes.length - 1 && tightChest) {
    status = "outside_range";
    message = `Your chest is above this chart's largest size (${chart.sizes[best].label}). Check the brand's own chart for bigger sizes.`;
  } else if (best === 0 && details.some((d) => d.key === "chest" && d.status === "below")) {
    status = "outside_range";
    message = `Your chest is below this chart's smallest size (${chart.sizes[best].label}). Check the brand's own chart for smaller sizes.`;
  } else if (pBest < AMBIGUOUS && second !== null) {
    status = "between_sizes";
    message = `Between ${chart.sizes[best].label} and ${chart.sizes[second].label}: ${chart.sizes[best].label} wins in ${Math.round(pBest * 100)}% of plausible cases. Pick ${chart.sizes[Math.max(best, second)].label} if you like room, ${chart.sizes[Math.min(best, second)].label} for a closer fit.`;
  }

  return {
    status,
    recommended: label(best),
    alternative: label(second),
    probability: pBest,
    probabilities: chart.sizes.map((s, i) => ({ label: s.label, p: probs[i] })),
    details,
    message,
  };
}
```

## src/sizing/mask.ts

```ts
/**
 * Geometry on a binary person mask (ported from FitSize `vision/geometry.py`).
 *
 * The segmentation model's category mask can be smaller than the camera frame and doesn't
 * have to share its aspect ratio, so a mask column and a mask row may cover different
 * numbers of frame pixels. `fx` / `fy` (mask px per frame px) keep track of that. Frame
 * pixels are square, so all real-world distances are converted through frame pixels.
 */
import type { CategoryMask } from "@shared/lib/types";

export type Run = [number, number]; // inclusive [x0, x1] in mask columns

/** Masks wider than this are subsampled before analysis (speed; the model output is ~256 px anyway). */
const MAX_WIDTH = 480;

export class PersonMask {
  private constructor(
    readonly w: number,
    readonly h: number,
    readonly data: Uint8Array, // 1 = person
    /** mask columns per frame pixel */
    readonly fx: number,
    /** mask rows per frame pixel */
    readonly fy: number,
  ) {}

  /**
   * Binary person mask from a category mask: any class but background counts as person,
   * only the largest connected blob is kept, and holes inside it are filled.
   */
  static fromCategoryMask(m: CategoryMask, frameW: number, frameH: number): PersonMask {
    const stride = Math.max(1, Math.ceil(m.width / MAX_WIDTH));
    const w = Math.floor(m.width / stride);
    const h = Math.floor(m.height / stride);
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const src = y * stride * m.width;
      for (let x = 0; x < w; x++) bin[y * w + x] = m.data[src + x * stride] !== 0 ? 1 : 0;
    }
    keepLargestComponent(bin, w, h);
    fillHoles(bin, w, h);
    return new PersonMask(w, h, bin, w / frameW, h / frameH);
  }

  /** For tests: wrap an already-binary mask. */
  static fromBinary(data: Uint8Array, w: number, h: number, frameW = w, frameH = h): PersonMask {
    return new PersonMask(w, h, data, w / frameW, h / frameH);
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  /** First and last rows that contain person pixels. */
  verticalExtent(): [number, number] | null {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < this.h; y++) {
      const row = this.data.subarray(y * this.w, (y + 1) * this.w);
      if (row.includes(1)) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    return top < 0 ? null : [top, bottom];
  }

  /** Contiguous person runs in row y. */
  runs(y: number): Run[] {
    if (y < 0 || y >= this.h) return [];
    const out: Run[] = [];
    let start = -1;
    const base = y * this.w;
    for (let x = 0; x < this.w; x++) {
      const v = this.data[base + x];
      if (v && start < 0) start = x;
      if (!v && start >= 0) {
        out.push([start, x - 1]);
        start = -1;
      }
    }
    if (start >= 0) out.push([start, this.w - 1]);
    return out;
  }

  /** The run in row y that contains column x, or the nearest one within maxGap columns. */
  runContaining(y: number, x: number, maxGap: number): Run | null {
    let best: Run | null = null;
    let bestD = Infinity;
    for (const r of this.runs(Math.round(y))) {
      if (r[0] <= x && x <= r[1]) return r;
      const d = Math.min(Math.abs(x - r[0]), Math.abs(x - r[1]));
      if (d <= maxGap && d < bestD) {
        best = r;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * For each column from xFrom to xTo (either direction), the first person row at or below
   * yMin. Stops at the first empty column. Returns [col, row] pairs.
   */
  upperContour(xFrom: number, xTo: number, yMin: number): [number, number][] {
    const pts: [number, number][] = [];
    const step = xTo >= xFrom ? 1 : -1;
    const y0 = Math.max(0, Math.round(yMin));
    for (let x = Math.round(xFrom); step > 0 ? x <= xTo : x >= xTo; x += step) {
      if (x < 0 || x >= this.w) break;
      let found = -1;
      for (let y = y0; y < this.h; y++) {
        if (this.data[y * this.w + x]) {
          found = y;
          break;
        }
      }
      if (found < 0) break;
      pts.push([x, found]);
      if (found >= this.h - 1) break;
    }
    return pts;
  }

  /**
   * Top of the gap between the legs: the first row scanning down from yStart where the
   * centre column is background but there is person on both sides.
   */
  findCrotch(xCenter: number, yStart: number, yEnd: number): number | null {
    const xc = Math.round(xCenter);
    const end = Math.min(Math.round(yEnd), this.h - 1);
    for (let y = Math.max(0, Math.round(yStart)); y <= end; y++) {
      const x0 = Math.max(0, xc - 1);
      const x1 = Math.min(this.w - 1, xc + 1);
      let centreEmpty = true;
      for (let x = x0; x <= x1; x++) if (this.data[y * this.w + x]) centreEmpty = false;
      if (!centreEmpty) continue;
      let left = false;
      let right = false;
      for (let x = 0; x < x0; x++) if (this.data[y * this.w + x]) { left = true; break; }
      for (let x = x1 + 1; x < this.w; x++) if (this.data[y * this.w + x]) { right = true; break; }
      if (left && right) return y;
    }
    return null;
  }
}

export const runWidth = (r: Run | null): number => (r ? r[1] - r[0] + 1 : 0);

/** Ramanujan's second approximation of an ellipse perimeter (semi-axes a, b). */
export function ellipsePerimeter(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  const h = (a - b) ** 2 / (a + b) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** Circumference of an ellipse with FULL axes width/depth, and its 1σ by error propagation. */
export function ellipseCircumference(width: number, depth: number, sigmaW: number, sigmaD: number): [number, number] {
  const c = ellipsePerimeter(width / 2, depth / 2);
  const ew = Math.max(width * 1e-4, 1e-6);
  const ed = Math.max(depth * 1e-4, 1e-6);
  const dcdw = (ellipsePerimeter((width + ew) / 2, depth / 2) - c) / ew;
  const dcdd = (ellipsePerimeter(width / 2, (depth + ed) / 2) - c) / ed;
  return [c, Math.hypot(dcdw * sigmaW, dcdd * sigmaD)];
}

/** Index of the point farthest from the chord between the first and last point (the "bend"). */
export function kneePoint(pts: { x: number; y: number }[]): number | null {
  if (pts.length < 5) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const norm = Math.hypot(abx, aby);
  if (norm < 1e-9) return null;
  let best = -1;
  let bestD = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.abs(abx * (pts[i].y - a.y) - aby * (pts[i].x - a.x)) / norm;
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return best <= 0 || best === pts.length - 1 ? null : best;
}

export function median(v: number[]): number {
  if (v.length === 0) return NaN;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function keepLargestComponent(bin: Uint8Array, w: number, h: number): void {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let next = 0;
  let bestLabel = 0;
  let bestSize = 0;
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || label[i]) continue;
    next++;
    let size = 0;
    let sp = 0;
    stack[sp++] = i;
    label[i] = next;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      // 8-connectivity
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (bin[q] && !label[q]) {
            label[q] = next;
            stack[sp++] = q;
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
  }
  for (let i = 0; i < bin.length; i++) bin[i] = bin[i] && label[i] === bestLabel ? 1 : 0;
}

/** Background regions not connected to the border are holes: fill them. */
function fillHoles(bin: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const seed = (p: number) => {
    if (!bin[p] && !outside[p]) {
      outside[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }
  for (let i = 0; i < bin.length; i++) if (!outside[i]) bin[i] = 1;
}
```

## src/sizing/measure.ts

```ts
/**
 * Body measurements from the live camera: a FRONT view (A-pose) and an optional SIDE view,
 * using the user's height as the ruler. Ported and adapted from FitSize
 * (`vision/pipeline.py`):
 *
 *  - Scale: the silhouette's head-to-sole height in pixels ↔ the user's real height.
 *    (Quick mode, when the feet can't be in frame: shoulder-to-hip landmark distance ↔
 *    TRUNK_TO_HEIGHT × height, a population ratio, so much less accurate.)
 *  - Chest / waist / hip levels are found like sliding a tape: the widest torso row in the
 *    chest window, the narrowest in the waist window, the widest in the hip window. Levels
 *    are stored as height above the floor so the side view is measured at the same height.
 *  - Girth = SHAPE_FACTOR × ellipse(front width, side depth). See SHAPE_FACTOR below for why
 *    FitSize's plain ellipse is corrected. Without a side view, girth is estimated from the
 *    front width alone with a population ratio and flagged as low confidence.
 *
 * Every value is the median over many frames and carries a 1σ uncertainty.
 *
 * HONESTY NOTE: every constant below is an engineering prior or a population average, not a
 * value validated against tape measurements for this app. Results are estimates.
 */
import type { CategoryMask, PixelLandmark } from "@shared/lib/types";
import { ellipseCircumference, kneePoint, median, PersonMask, runWidth, type Run } from "./mask";

// ---- MediaPipe pose landmark indices ----
export const P = {
  nose: 0, leftEye: 2, rightEye: 5, mouthL: 9, mouthR: 10,
  lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28,
  lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
} as const;

// ---- priors (see honesty note) ----
/** Relative 1σ of the height-derived scale: hair, shoes, posture, mask edges at head and feet. */
const SCALE_REL_SIGMA = 0.012;
const HEIGHT_SIGMA_CM = 1.0;
/** Quick mode: shoulder→hip joint distance as a fraction of standing height (acromion ≈ 0.82 H,
 *  hip joint ≈ 0.52 H; Pheasant & Haslegrave, "Bodyspace"). People vary around it by several %. */
const TRUNK_TO_HEIGHT = 0.3;
const QUICK_SCALE_REL_SIGMA = 0.06;
/** MediaPipe shoulder landmarks sit at the joint, inside the shoulder-seam points. */
const SHOULDER_SEAM_CORRECTION = 1.12;

/**
 * A torso cross-section is boxier than an ellipse, so the ellipse through the front width and
 * side depth UNDER-estimates the girth. Factors = mean girth / ellipse(mean breadth, mean depth)
 * from US Army ANSUR II (2012) averages: chest ≈ 1.24 (men) / 1.17 (women); waist ≈ 1.06;
 * hip ≈ 1.07. FitSize used the plain ellipse (factor 1), which reads one size small or more.
 */
export const SHAPE_FACTOR = { chest: 1.2, waist: 1.06, hip: 1.07 } as const;
/** Relative 1σ "shape model" error of girth from width + depth (prior). */
const GIRTH_MODEL_REL_SIGMA = { chest: 0.06, waist: 0.05, hip: 0.05 } as const;
/** Without a side view: girth ≈ ratio × front width (ANSUR II mean girth / mean breadth). */
const GIRTH_PER_WIDTH = { chest: 3.6, waist: 2.88, hip: 2.9 } as const;
const GIRTH_FROM_WIDTH_REL_SIGMA = 0.09;
const SHOULDER_MODEL_SIGMA_CM = 2.0;

export type Girth = "chest" | "waist" | "hip";
export const GIRTHS: Girth[] = ["chest", "waist", "hip"];

export type ScaleMode = "full" | "quick";

export interface Measurement {
  valueCm: number;
  sigmaCm: number;
  /** relative scale error shared by all values of one scan (for the fit engine) */
  scaleRel: number;
  confidence: "high" | "medium" | "low";
  method: string;
  flags: string[];
}

export interface BodyMeasurements {
  heightCm: number;
  mode: ScaleMode;
  hasSide: boolean;
  frames: { front: number; side: number };
  shoulder: Measurement | null;
  chest: Measurement | null;
  waist: Measurement | null;
  hip: Measurement | null;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Per-frame view geometry
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
  v: number;
}

class View {
  readonly lm: Pt[]; // landmarks in MASK coordinates
  readonly top: number;
  readonly bottom: number;
  constructor(
    readonly mask: PersonMask,
    landmarks: PixelLandmark[],
    ext: [number, number],
    readonly side: boolean,
  ) {
    this.lm = landmarks.map((p) => ({ x: p.x * mask.fx, y: p.y * mask.fy, v: p.visibility }));
    [this.top, this.bottom] = ext;
  }
  get personRows(): number {
    return this.bottom - this.top;
  }
  /** person height in FRAME pixels */
  get personPx(): number {
    return this.personRows / this.mask.fy;
  }
  mid(a: number, b: number): Pt {
    const p = this.lm[a];
    const q = this.lm[b];
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, v: Math.min(p.v, q.v) };
  }
  get shoulderY(): number {
    return this.mid(P.lSh, P.rSh).y;
  }
  get hipY(): number {
    return this.mid(P.lHip, P.rHip).y;
  }
  centerX(y: number): number {
    const s = this.mid(P.lSh, P.rSh);
    const h = this.mid(P.lHip, P.rHip);
    if (Math.abs(h.y - s.y) < 1e-6) return (s.x + h.x) / 2;
    const t = Math.max(-0.6, Math.min(1.6, (y - s.y) / (h.y - s.y)));
    return s.x + t * (h.x - s.x);
  }
  torsoRun(y: number): Run | null {
    const gap = this.side ? Math.round(0.04 * this.personRows) : Math.max(2, Math.round(0.01 * this.personRows));
    return this.mask.runContaining(Math.round(y), this.centerX(y), gap);
  }
  /** x (mask cols) where the shoulder→elbow→wrist polylines cross row y */
  armXAtRow(y: number): number[] {
    const xs: number[] = [];
    for (const chain of [[P.lSh, P.lEl, P.lWr], [P.rSh, P.rEl, P.rWr]]) {
      const pts = chain.map((i) => this.lm[i]);
      for (let k = 0; k < 2; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        const lo = Math.min(a.y, b.y);
        const hi = Math.max(a.y, b.y);
        if (lo <= y && y <= hi && hi - lo > 1e-6) {
          xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
          break;
        }
      }
    }
    return xs;
  }
  armsClear(y: number, run: Run | null): boolean {
    if (!run) return false;
    return !this.armXAtRow(y).some((ax) => run[0] - 1 <= ax && ax <= run[1] + 1);
  }
  /** frame px → mask */
  toFrame(col: number, row: number): { x: number; y: number } {
    return { x: col / this.mask.fx, y: row / this.mask.fy };
  }
}

// ---------------------------------------------------------------------------
// Front view
// ---------------------------------------------------------------------------

export interface FrontSample {
  /** cm per FRAME pixel */
  cmPerPx: number;
  /** relative 1σ of cmPerPx */
  scaleRel: number;
  /** 1σ of a horizontal width from silhouette-edge noise (both edges), cm */
  edgeCm: number;
  personPx: number;
  shoulderCm: number;
  shoulderFromContour: boolean;
  widthCm: Record<Girth, number>;
  widthClear: Record<Girth, boolean>;
  /** level heights above the floor (full mode only) */
  levelCm: Record<Girth, number> | null;
}

export function analyseFront(
  cat: CategoryMask,
  landmarks: PixelLandmark[],
  frameW: number,
  frameH: number,
  heightCm: number,
  mode: ScaleMode,
): FrontSample | null {
  const mask = PersonMask.fromCategoryMask(cat, frameW, frameH);
  return analyseFrontMask(mask, landmarks, heightCm, mode);
}

export function analyseFrontMask(mask: PersonMask, landmarks: PixelLandmark[], heightCm: number, mode: ScaleMode): FrontSample | null {
  const ext = mask.verticalExtent();
  if (!ext || ext[1] - ext[0] < 40) return null;
  const g = new View(mask, landmarks, ext, false);
  const shY = g.shoulderY;
  const hipY = g.hipY;
  const span = hipY - shY;
  if (span < 0.1 * g.personRows) return null;

  // ---- scale ----
  let cmPerPx: number;
  let scaleRel: number;
  if (mode === "full") {
    cmPerPx = heightCm / g.personPx;
    const edgePx = Math.max(2, 1 / mask.fy);
    scaleRel = Math.hypot(SCALE_REL_SIGMA, (Math.SQRT2 * edgePx) / g.personPx, HEIGHT_SIGMA_CM / heightCm);
  } else {
    const s = g.toFrame(g.mid(P.lSh, P.rSh).x, shY);
    const h = g.toFrame(g.mid(P.lHip, P.rHip).x, hipY);
    const trunkPx = Math.hypot(h.x - s.x, h.y - s.y);
    if (trunkPx < 20) return null;
    cmPerPx = (TRUNK_TO_HEIGHT * heightCm) / trunkPx;
    scaleRel = Math.hypot(QUICK_SCALE_REL_SIGMA, HEIGHT_SIGMA_CM / heightCm);
  }
  const cmPerCol = cmPerPx / mask.fx;
  const cmAboveFloor = (row: number) => ((g.bottom - row) / mask.fy) * cmPerPx;

  // ---- crotch (limits the hip window) ----
  const hipMid = g.mid(P.lHip, P.rHip);
  const kneeY = g.mid(P.lKnee, P.rKnee).y;
  const crotchY = kneeY > hipY ? mask.findCrotch(hipMid.x, hipY, kneeY) : null;

  // ---- chest / waist / hip levels: slide the "tape" ----
  const scan = (lo: number, hi: number, mode2: "max" | "min"): number | null => {
    let yLo = Math.round(shY + lo * span);
    let yHi = Math.round(shY + hi * span);
    if (crotchY !== null) yHi = Math.min(yHi, crotchY - 2);
    yLo = Math.max(0, yLo);
    // Pixelated masks give several rows the same extreme width; take the middle of the tie.
    let bestRows: number[] = [];
    let bestW = mode2 === "max" ? -Infinity : Infinity;
    for (let y = yLo; y <= yHi; y++) {
      const run = g.torsoRun(y);
      if (!g.armsClear(y, run)) continue;
      const w = runWidth(run);
      if (!w) continue;
      if (w === bestW) bestRows.push(y);
      else if (mode2 === "max" ? w > bestW : w < bestW) {
        bestW = w;
        bestRows = [y];
      }
    }
    return bestRows.length ? bestRows[bestRows.length >> 1] : null;
  };
  const found: Record<Girth, number | null> = {
    chest: scan(0.22, 0.45, "max"),
    waist: scan(0.55, 0.85, "min"),
    hip: scan(0.85, 1.25, "max"),
  };
  const nominal: Record<Girth, number> = { chest: 0.34, waist: 0.69, hip: 1.0 };
  const widthCm = {} as Record<Girth, number>;
  const widthClear = {} as Record<Girth, boolean>;
  const levelCm = {} as Record<Girth, number>;
  for (const k of GIRTHS) {
    const y = found[k] ?? Math.round(shY + nominal[k] * span);
    const run = g.torsoRun(y);
    widthCm[k] = runWidth(run) * cmPerCol;
    widthClear[k] = found[k] !== null && g.armsClear(y, run);
    levelCm[k] = cmAboveFloor(y);
  }

  // ---- shoulder width: bend points of the shoulder contour, else joint landmarks ----
  const mouthY = g.mid(P.mouthL, P.mouthR).y;
  const yMin = mouthY + 0.6 * (shY - mouthY);
  const pts = shoulderPoints(g, yMin);
  let shoulderCm: number;
  let fromContour = false;
  if (pts) {
    shoulderCm = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) * cmPerPx;
    fromContour = true;
  } else {
    const a = g.toFrame(g.lm[P.lSh].x, g.lm[P.lSh].y);
    const b = g.toFrame(g.lm[P.rSh].x, g.lm[P.rSh].y);
    shoulderCm = Math.hypot(a.x - b.x, a.y - b.y) * cmPerPx * SHOULDER_SEAM_CORRECTION;
  }

  return {
    cmPerPx,
    scaleRel,
    edgeCm: Math.SQRT2 * Math.max(2, 1 / mask.fx) * cmPerPx,
    personPx: g.personPx,
    shoulderCm,
    shoulderFromContour: fromContour,
    widthCm,
    widthClear,
    levelCm: mode === "full" ? levelCm : null,
  };
}

/** Shoulder bend points (frame px), found on the top-of-arm contour of an A-pose. */
function shoulderPoints(g: View, yMin: number): { x: number; y: number }[] | null {
  const sh = [g.lm[P.lSh], g.lm[P.rSh]].sort((a, b) => a.x - b.x);
  const el = [g.lm[P.lEl], g.lm[P.rEl]].sort((a, b) => a.x - b.x);
  const xMid = g.centerX(g.shoulderY);
  const out: { x: number; y: number }[] = [];
  const spanPx = Math.abs(g.toFrame(0, g.hipY).y - g.toFrame(0, g.shoulderY).y);
  for (const [side, s, e] of [[-1, sh[0], el[0]], [1, sh[1], el[1]]] as const) {
    const half = Math.abs(s.x - xMid);
    if (half < 3) return null;
    // the arm must be abducted so the top-of-arm contour extends past the shoulder
    if (side * (e.x - s.x) < 0.15 * half) return null;
    const contour = g.mask.upperContour(Math.round(xMid + side * 0.5 * half), Math.round(e.x), yMin);
    if (contour.length < 6) return null;
    const frame = contour.map(([c, r]) => g.toFrame(c, r));
    const k = kneePoint(frame);
    if (k === null) return null;
    const p = frame[k];
    const sf = g.toFrame(s.x, s.y);
    const halfPx = half / g.mask.fx;
    if (!(Math.abs(p.x - sf.x) < 0.6 * halfPx && sf.y - 0.35 * spanPx < p.y && p.y < sf.y + 0.2 * spanPx)) return null;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Side view
// ---------------------------------------------------------------------------

export interface SideSample {
  cmPerPx: number;
  scaleRel: number;
  edgeCm: number;
  /** depth (cm) of the torso at each height above the floor, every ~1 mask row */
  profile: { heightCm: number; depthCm: number }[];
}

export function analyseSide(cat: CategoryMask, landmarks: PixelLandmark[], frameW: number, frameH: number, heightCm: number): SideSample | null {
  return analyseSideMask(PersonMask.fromCategoryMask(cat, frameW, frameH), landmarks, heightCm);
}

export function analyseSideMask(mask: PersonMask, landmarks: PixelLandmark[], heightCm: number): SideSample | null {
  const ext = mask.verticalExtent();
  if (!ext || ext[1] - ext[0] < 40) return null;
  const g = new View(mask, landmarks, ext, true);
  const cmPerPx = heightCm / g.personPx;
  const edgePx = Math.max(2, 1 / mask.fy);
  const scaleRel = Math.hypot(SCALE_REL_SIGMA, (Math.SQRT2 * edgePx) / g.personPx, HEIGHT_SIGMA_CM / heightCm);
  const shY = g.shoulderY;
  const kneeY = g.mid(P.lKnee, P.rKnee).y;
  const profile: SideSample["profile"] = [];
  const y0 = Math.max(0, Math.round(shY));
  const y1 = Math.min(mask.h - 1, Math.round(kneeY > shY ? kneeY : g.bottom));
  for (let y = y0; y <= y1; y++) {
    const w = runWidth(g.torsoRun(y));
    if (!w) continue;
    profile.push({ heightCm: ((g.bottom - y) / mask.fy) * cmPerPx, depthCm: (w / mask.fx) * cmPerPx });
  }
  return profile.length ? { cmPerPx, scaleRel, edgeCm: Math.SQRT2 * Math.max(2, 1 / mask.fx) * cmPerPx, profile } : null;
}

function depthAt(s: SideSample, heightCm: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const p of s.profile) {
    const d = Math.abs(p.heightCm - heightCm);
    if (d < bestD) {
      bestD = d;
      best = p.depthCm;
    }
  }
  return bestD <= 2 ? best : null;
}

// ---------------------------------------------------------------------------
// Combine many frames into measurements
// ---------------------------------------------------------------------------

/** robust spread of the median (MAD-based standard error) */
function medianSE(v: number[]): number {
  if (v.length < 3) return 0;
  const m = median(v);
  return (1.4826 * median(v.map((x) => Math.abs(x - m)))) / Math.sqrt(v.length);
}

function confidence(value: number, sigma: number, flags: string[]): Measurement["confidence"] {
  if (flags.length) return "low";
  const rel = sigma / Math.max(value, 1e-6);
  return rel <= 0.025 ? "high" : rel <= 0.05 ? "medium" : "low";
}

export function combine(front: FrontSample[], side: SideSample[], heightCm: number, mode: ScaleMode): BodyMeasurements {
  const notes: string[] = [];
  const out: BodyMeasurements = {
    heightCm,
    mode,
    hasSide: false,
    frames: { front: front.length, side: side.length },
    shoulder: null,
    chest: null,
    waist: null,
    hip: null,
    notes,
  };
  if (front.length === 0) return out;
  const scaleRelF = median(front.map((f) => f.scaleRel));
  const edgeCm = median(front.map((f) => f.edgeCm));

  // ---- shoulder ----
  {
    const contour = front.filter((f) => f.shoulderFromContour);
    const use = contour.length >= front.length / 2 ? contour : front;
    const vals = use.map((f) => f.shoulderCm);
    const v = median(vals);
    const fromContour = use === contour;
    const flags = fromContour ? [] : ["Shoulder edge not found (hold your arms a little away from your body); estimated from the shoulder joints."];
    const sigma = Math.hypot(v * scaleRelF, edgeCm, fromContour ? SHOULDER_MODEL_SIGMA_CM : 2 * SHOULDER_MODEL_SIGMA_CM, medianSE(vals));
    out.shoulder = {
      valueCm: v, sigmaCm: sigma, scaleRel: scaleRelF, confidence: confidence(v, sigma, flags),
      method: fromContour ? "shoulder contour bend points" : "shoulder joints × 1.12", flags,
    };
  }

  // ---- side view usable? ----
  const levels = mode === "full" ? GIRTHS.map((k) => median(front.map((f) => f.levelCm![k]))) : null;
  const sideOk = mode === "full" && side.length >= 3;
  out.hasSide = sideOk;
  if (mode === "quick") notes.push("Quick estimate: your feet weren't in view, so the scale comes from your torso length — less accurate than a full-body scan.");
  else if (!sideOk) notes.push("No side view: chest, waist and hip are estimated from the front only (less accurate). Turn sideways during the scan for better results.");

  const scaleRelS = sideOk ? median(side.map((s) => s.scaleRel)) : 0;
  const edgeCmS = sideOk ? median(side.map((s) => s.edgeCm)) : 0;
  GIRTHS.forEach((k, i) => {
    const widths = front.map((f) => f.widthCm[k]).filter((w) => w > 0);
    if (widths.length < 3) return;
    const w = median(widths);
    const clear = front.filter((f) => f.widthClear[k]).length >= front.length / 2;
    const flags: string[] = [];
    if (!clear) flags.push("Arms or hands overlapped your outline at this level — the value is probably too large.");

    if (sideOk && levels) {
      const depths = side.map((s) => depthAt(s, levels[i])).filter((d): d is number => d !== null && d > 0);
      if (depths.length >= 3) {
        const d = median(depths);
        const [c0, sNoise] = ellipseCircumference(w, d, Math.hypot(edgeCm, medianSE(widths)), Math.hypot(edgeCmS, medianSE(depths)));
        const c = c0 * SHAPE_FACTOR[k];
        const scaleRel = (scaleRelF + scaleRelS) / 2;
        let sigma = Math.hypot(sNoise * SHAPE_FACTOR[k], c * scaleRel, c * GIRTH_MODEL_REL_SIGMA[k]);
        if (!clear) sigma *= 2;
        out[k] = {
          valueCm: c, sigmaCm: sigma, scaleRel, confidence: confidence(c, sigma, flags),
          method: `front width ${w.toFixed(1)} cm + side depth ${d.toFixed(1)} cm`, flags,
        };
        return;
      }
      notes.push(`${k[0].toUpperCase() + k.slice(1)}: the side view didn't line up at this height; estimated from the front only.`);
    }
    const c = w * GIRTH_PER_WIDTH[k];
    const scaleRel = scaleRelF;
    let sigma = Math.hypot(c * scaleRel, c * GIRTH_FROM_WIDTH_REL_SIGMA, GIRTH_PER_WIDTH[k] * Math.hypot(edgeCm, medianSE(widths)));
    if (!clear) sigma *= 2;
    flags.push("Estimated from the front view only.");
    out[k] = {
      valueCm: c, sigmaCm: sigma, scaleRel, confidence: "low",
      method: `front width ${w.toFixed(1)} cm × typical ratio`, flags,
    };
  });
  return out;
}
```

## src/sizing/scan.ts

```ts
/**
 * Live "Find my size" scan. Fed one camera frame at a time (landmarks + segmentation mask),
 * it guides the person into position, then collects:
 *   1. FRONT frames: whole body in view, facing the camera, arms a little away from the body.
 *   2. SIDE frames: turned 90°, whole body in view (skippable; without it girths are rougher).
 * Quick mode (feet can't be in frame) collects the front only and uses a torso-based scale.
 */
import type { CategoryMask, PixelLandmark } from "@shared/lib/types";
import { PersonMask } from "./mask";
import {
  analyseFrontMask, analyseSideMask, combine, P,
  type BodyMeasurements, type FrontSample, type ScaleMode, type SideSample,
} from "./measure";

export type ScanPhase = "front" | "side" | "done" | "failed";

export interface ScanCheck {
  id: string;
  label: string;
  ok: boolean;
}

export interface ScanState {
  phase: ScanPhase;
  mode: ScaleMode;
  instruction: string;
  checks: ScanCheck[];
  /** 0..1 for the current phase */
  progress: number;
  /** feet have been out of view for a while: offer the quick estimate */
  suggestQuick: boolean;
  error: string | null;
  result: BodyMeasurements | null;
}

export interface ScanFrame {
  landmarks: PixelLandmark[] | null;
  mask: CategoryMask | null;
  width: number;
  height: number;
  tMs: number;
}

const FRONT_SAMPLES = 20;
const SIDE_SAMPLES = 15;
const STEADY_FRAMES = 8;
const QUICK_HINT_AFTER_MS = 8000;
const NO_MASK_FAIL_MS = 4000;

export class SizeScan {
  private phase: ScanPhase = "front";
  private front: FrontSample[] = [];
  private side: SideSample[] = [];
  private steady = 0;
  private lastShoulder: { x: number; y: number } | null = null;
  private feetMissingMs = 0;
  private noMaskSince: number | null = null;
  private lastT: number | null = null;
  private state: ScanState;

  constructor(
    private heightCm: number,
    private mode: ScaleMode,
    private onUpdate: (s: ScanState) => void,
  ) {
    this.state = this.makeState([], "Stand where the camera can see you.");
    this.onUpdate(this.state);
  }

  get current(): ScanState {
    return this.state;
  }

  /** Switch to the front-only quick estimate (restarts the front capture). */
  useQuick(): void {
    this.mode = "quick";
    this.phase = "front";
    this.front = [];
    this.side = [];
    this.steady = 0;
    this.emit([], "Stand facing the camera with your head and hips in view.");
  }

  /** Finish without the side view. */
  skipSide(): void {
    if (this.phase === "side") this.finish();
  }

  feed(f: ScanFrame): void {
    if (this.phase === "done" || this.phase === "failed") return;
    const dt = this.lastT === null ? 0 : Math.min(500, f.tMs - this.lastT);
    this.lastT = f.tMs;

    if (!f.mask) {
      this.noMaskSince ??= f.tMs;
      if (f.tMs - this.noMaskSince > NO_MASK_FAIL_MS) {
        this.phase = "failed";
        this.emit([], "", "The size scan needs the body-segmentation model, which isn't running. Reload the panel and start the camera again.");
      }
      return;
    }
    this.noMaskSince = null;

    const lm = f.landmarks;
    if (!lm || lm.length < 33) {
      this.steady = 0;
      this.emit([{ id: "person", label: "Person in view", ok: false }], "Step in front of the camera.");
      return;
    }
    const mask = PersonMask.fromCategoryMask(f.mask, f.width, f.height);
    const checks = this.phase === "front" ? this.frontChecks(lm, mask, f) : this.sideChecks(lm, mask, f);

    const feet = checks.find((c) => c.id === "feet");
    if (this.mode === "full" && this.phase === "front" && feet && !feet.ok) this.feetMissingMs += dt;

    const allOk = checks.every((c) => c.ok);
    this.steady = allOk ? this.steady + 1 : 0;
    if (allOk && this.steady >= STEADY_FRAMES) {
      if (this.phase === "front") {
        const s = analyseFrontMask(mask, lm, this.heightCm, this.mode);
        if (s) this.front.push(s);
        if (this.front.length >= FRONT_SAMPLES) {
          if (this.mode === "quick") return this.finish();
          this.phase = "side";
          this.steady = 0;
          this.lastShoulder = null;
          return this.emit([], "Now turn 90° to your side and stand naturally, arms down.");
        }
      } else {
        const s = analyseSideMask(mask, lm, this.heightCm);
        if (s) this.side.push(s);
        if (this.side.length >= SIDE_SAMPLES) return this.finish();
      }
    }
    this.emit(checks, this.instructionFor(checks));
  }

  // ---------------------------------------------------------------------------

  private frontChecks(lm: PixelLandmark[], mask: PersonMask, f: ScanFrame): ScanCheck[] {
    const torso = [P.lSh, P.rSh, P.lHip, P.rHip].every((i) => lm[i].visibility > 0.5);
    const checks: ScanCheck[] = [{ id: "person", label: "Shoulders and hips visible", ok: torso }];
    const ext = mask.verticalExtent();
    const sMid = mid(lm[P.lSh], lm[P.rSh]);
    const hMid = mid(lm[P.lHip], lm[P.rHip]);
    const trunk = Math.hypot(hMid.x - sMid.x, hMid.y - sMid.y);

    if (this.mode === "full") {
      checks.push(...this.fullBodyChecks(lm, mask, ext));
    } else {
      checks.push({ id: "size", label: "Close enough", ok: trunk > 0.18 * f.height });
    }
    const shoulderSpan = Math.abs(lm[P.lSh].x - lm[P.rSh].x);
    checks.push({ id: "facing", label: "Facing the camera", ok: trunk > 0 && shoulderSpan / trunk > 0.45 });
    checks.push({ id: "arms", label: "Arms a little away from your body", ok: armsOut(lm) });
    checks.push({ id: "still", label: "Holding still", ok: this.still(sMid, trunk) });
    return checks;
  }

  private sideChecks(lm: PixelLandmark[], mask: PersonMask, f: ScanFrame): ScanCheck[] {
    const sMid = mid(lm[P.lSh], lm[P.rSh]);
    const hMid = mid(lm[P.lHip], lm[P.rHip]);
    const trunk = Math.hypot(hMid.x - sMid.x, hMid.y - sMid.y);
    const torso = Math.max(lm[P.lSh].visibility, lm[P.rSh].visibility) > 0.5 && Math.max(lm[P.lHip].visibility, lm[P.rHip].visibility) > 0.5;
    const shoulderSpan = Math.abs(lm[P.lSh].x - lm[P.rSh].x);
    return [
      { id: "person", label: "Body visible", ok: torso && trunk > 0.1 * f.height },
      ...this.fullBodyChecks(lm, mask, mask.verticalExtent()),
      { id: "profile", label: "Turned sideways", ok: trunk > 0 && shoulderSpan / trunk < 0.3 },
      { id: "still", label: "Holding still", ok: this.still(sMid, trunk) },
    ];
  }

  private fullBodyChecks(lm: PixelLandmark[], mask: PersonMask, ext: [number, number] | null): ScanCheck[] {
    const headOk = !!ext && ext[0] > 1;
    const feetVisible = Math.max(lm[P.lAnk].visibility, lm[P.rAnk].visibility) > 0.5;
    const feetOk = !!ext && ext[1] < mask.h - 2 && feetVisible;
    const bigEnough = !!ext && (ext[1] - ext[0]) / mask.h > 0.5;
    return [
      { id: "head", label: "Head in view", ok: headOk },
      { id: "feet", label: "Feet in view", ok: feetOk },
      { id: "size", label: "Close enough (body fills half the frame)", ok: bigEnough },
    ];
  }

  private still(sMid: { x: number; y: number }, trunk: number): boolean {
    const prev = this.lastShoulder;
    this.lastShoulder = sMid;
    if (!prev || trunk <= 0) return false;
    // raw landmarks jitter a few px even when someone stands still
    return Math.hypot(sMid.x - prev.x, sMid.y - prev.y) < 0.035 * trunk;
  }

  private instructionFor(checks: ScanCheck[]): string {
    const bad = checks.find((c) => !c.ok);
    if (!bad) {
      return this.phase === "front" && this.front.length === 0 && this.steady < STEADY_FRAMES
        ? "Hold that pose…"
        : "Measuring — hold still…";
    }
    switch (bad.id) {
      case "person": return this.phase === "side" ? "Stay in view while you turn." : "Face the camera so your shoulders and hips are visible.";
      case "head": return "Step back or tilt the camera: your head is cut off.";
      case "feet": return "Step back until your feet are in view.";
      case "size": return this.mode === "quick" ? "Come a little closer." : "Come a little closer: you're too small in the frame.";
      case "facing": return "Turn to face the camera straight on.";
      case "arms": return "Hold your arms slightly out from your sides, like an upside-down V.";
      case "profile": return "Turn a little more, until you're side-on to the camera.";
      case "still": return "Hold still for a moment.";
      default: return bad.label;
    }
  }

  private finish(): void {
    this.phase = "done";
    const result = combine(this.front, this.side, this.heightCm, this.mode);
    this.state = { ...this.makeState([], "Done."), result };
    this.onUpdate(this.state);
  }

  private makeState(checks: ScanCheck[], instruction: string, error: string | null = null): ScanState {
    const target = this.phase === "side" ? SIDE_SAMPLES : FRONT_SAMPLES;
    const have = this.phase === "side" ? this.side.length : this.front.length;
    return {
      phase: this.phase,
      mode: this.mode,
      instruction,
      checks,
      progress: this.phase === "done" ? 1 : Math.min(1, have / target),
      suggestQuick: this.mode === "full" && this.phase === "front" && this.feetMissingMs > QUICK_HINT_AFTER_MS,
      error,
      result: null,
    };
  }

  private emit(checks: ScanCheck[], instruction: string, error: string | null = null): void {
    this.state = this.makeState(checks, instruction, error);
    this.onUpdate(this.state);
  }
}

const mid = (a: PixelLandmark, b: PixelLandmark) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Both arms hang outward (A-pose): elbows outside the shoulders, wrists below the elbows and clear of the hips. */
function armsOut(lm: PixelLandmark[]): boolean {
  const pairs = [
    [lm[P.lSh], lm[P.lEl], lm[P.lWr], lm[P.lHip]],
    [lm[P.rSh], lm[P.rEl], lm[P.rWr], lm[P.rHip]],
  ];
  const cx = (lm[P.lSh].x + lm[P.rSh].x) / 2;
  const half = Math.abs(lm[P.lSh].x - lm[P.rSh].x) / 2;
  if (half < 1) return false;
  return pairs.every(([s, e, w, h]) => {
    if (Math.min(s.visibility, e.visibility, w.visibility) < 0.5) return false;
    const out = Math.sign(s.x - cx) || 1;
    const elbowOut = out * (e.x - s.x) >= 0.15 * half;
    const notRaised = e.y > s.y && w.y > e.y;
    const wristClear = out * (w.x - h.x) > 0.25 * half;
    return elbowOut && notRaised && wristClear;
  });
}
```

## src/sizing/testing/mannequin.ts

```ts
/**
 * Test-only full-body mannequin with exactly known dimensions, rasterised into a category mask
 * (at a different resolution from the frame, like the real segmentation model) plus the 33
 * MediaPipe-style landmarks. Not used by the extension at runtime.
 */
import type { CategoryMask, PixelLandmark } from "@shared/lib/types";

export interface Body {
  heightCm: number;
  shoulderCm: number; // seam to seam
  chestW: number; chestD: number;
  waistW: number; waistD: number;
  hipW: number; hipD: number;
}

export interface MannequinOpts {
  view: "front" | "side";
  frameW: number;
  frameH: number;
  maskW: number;
  maskH: number;
  /** person height in frame pixels */
  personPx: number;
  /** frame y of the soles (default: 5% above the bottom edge) */
  floorY?: number;
  /** horizontal centre in frame px (default: middle) */
  centerX?: number;
}

type Shape = (x: number, y: number) => boolean; // body coords: cm, x from centre, y up from floor

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** piecewise-linear profile through (y, value) knots (y descending) */
function profile(knots: [number, number][], y: number): number | null {
  for (let i = 0; i < knots.length - 1; i++) {
    const [y0, v0] = knots[i];
    const [y1, v1] = knots[i + 1];
    if (y <= y0 && y >= y1) return lerp(v0, v1, (y0 - y) / (y0 - y1));
  }
  return null;
}

function capsule(ax: number, ay: number, bx: number, by: number, r: number): Shape {
  return (x, y) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= r;
  };
}

export function levels(b: Body) {
  const H = b.heightCm;
  return {
    shoulder: 0.818 * H,
    chest: 0.72 * H,
    waist: 0.62 * H,
    hip: 0.52 * H,
    crotch: 0.47 * H,
    knee: 0.285 * H,
    ankle: 0.04 * H,
  };
}

const ARM_ANGLE = (25 * Math.PI) / 180;
const UPPER = 30;
const FORE = 27;

export function renderMannequin(b: Body, o: MannequinOpts): { mask: CategoryMask; landmarks: PixelLandmark[] } {
  const H = b.heightCm;
  const L = levels(b);
  const S = b.shoulderCm / 2;
  const side = o.view === "side";
  const pxPerCm = o.personPx / H;
  const floorY = o.floorY ?? o.frameH * 0.95;
  const cx = o.centerX ?? o.frameW / 2;
  const toFrame = (x: number, y: number) => ({ x: cx + x * pxPerCm, y: floorY - y * pxPerCm });

  // ---- torso half-width (front) or half-depth (side) profile ----
  const torsoKnots: [number, number][] = side
    ? [
        [L.shoulder + 2, b.chestD / 2 - 3],
        [L.shoulder - 8, b.chestD / 2 - 1],
        [L.chest, b.chestD / 2],
        [L.waist, b.waistD / 2],
        [L.hip, b.hipD / 2],
        [L.crotch, b.hipD / 2 - 1],
      ]
    : [
        [L.shoulder - 8, b.chestW / 2 - 1],
        [L.chest, b.chestW / 2],
        [L.waist, b.waistW / 2],
        [L.hip, b.hipW / 2],
        [L.crotch, b.hipW / 2 - 0.5],
      ];

  const shapes: Shape[] = [];
  // head + neck
  const headR = side ? 10 : 8;
  shapes.push((x, y) => (x / headR) ** 2 + ((y - (H - 11.5)) / 11.5) ** 2 <= 1);
  shapes.push((x, y) => Math.abs(x) <= 6 && y <= H - 18 && y >= L.shoulder);
  // torso
  shapes.push((x, y) => {
    const hw = profile(torsoKnots, y);
    return hw !== null && Math.abs(x) <= hw;
  });
  if (!side) {
    // shoulder slope from the neck to the seam points
    shapes.push((x, y) => {
      if (y < L.shoulder - 8 || y > L.shoulder + 5) return false;
      const ax = Math.abs(x);
      if (ax > S) return false;
      const top = ax <= 6 ? L.shoulder + 5 : lerp(L.shoulder + 5, L.shoulder - 1, (ax - 6) / (S - 6));
      return y <= top;
    });
    // arms in an A-pose
    for (const s of [1, -1]) {
      const jx = s * (S - 4);
      const jy = L.shoulder - 3;
      const ex = jx + s * Math.sin(ARM_ANGLE) * UPPER;
      const ey = jy - Math.cos(ARM_ANGLE) * UPPER;
      const wx = ex + s * Math.sin(ARM_ANGLE) * FORE;
      const wy = ey - Math.cos(ARM_ANGLE) * FORE;
      shapes.push(capsule(jx, jy, ex, ey, 5));
      shapes.push(capsule(ex, ey, wx, wy, 4));
    }
    // legs, apart
    for (const s of [1, -1]) {
      shapes.push(capsule(s * b.hipW / 4, L.crotch + 4, s * 11, L.ankle, 7));
      shapes.push(capsule(s * 11, L.ankle, s * 12, 2, 4.5));
    }
  } else {
    shapes.push(capsule(0, L.crotch + 4, 0, L.ankle, 7)); // legs overlap in profile
    shapes.push(capsule(0, L.ankle, 8, 2, 4.5));
  }

  // ---- rasterise into the mask ----
  const data = new Uint8Array(o.maskW * o.maskH);
  for (let my = 0; my < o.maskH; my++) {
    for (let mx = 0; mx < o.maskW; mx++) {
      const fx = ((mx + 0.5) / o.maskW) * o.frameW;
      const fy = ((my + 0.5) / o.maskH) * o.frameH;
      const x = (fx - cx) / pxPerCm;
      const y = (floorY - fy) / pxPerCm;
      if (y < 0) continue;
      if (shapes.some((s) => s(x, y))) data[my * o.maskW + mx] = 4; // "clothes"
    }
  }

  // ---- landmarks (person's LEFT on image RIGHT when facing the camera) ----
  const lm: PixelLandmark[] = Array.from({ length: 33 }, () => ({ x: cx, y: floorY, visibility: 0.2 }));
  const set = (i: number, x: number, y: number, v = 0.95) => {
    const p = toFrame(x, y);
    lm[i] = { x: p.x, y: p.y, visibility: v };
  };
  const k = side ? 0.08 : 1; // in profile, left/right collapse onto the centre line
  set(0, side ? 9 : 0, H - 12);
  set(2, 3.2 * k, H - 9);
  set(5, -3.2 * k, H - 9);
  set(9, 2.5 * k, H - 17);
  set(10, -2.5 * k, H - 17);
  const jx = (S - 4) * k;
  set(11, jx, L.shoulder - 3);
  set(12, -jx, L.shoulder - 3);
  const ang = side ? 0 : ARM_ANGLE;
  set(13, jx + Math.sin(ang) * UPPER, L.shoulder - 3 - Math.cos(ang) * UPPER);
  set(14, -jx - Math.sin(ang) * UPPER, L.shoulder - 3 - Math.cos(ang) * UPPER);
  set(15, jx + Math.sin(ang) * (UPPER + FORE), L.shoulder - 3 - Math.cos(ang) * (UPPER + FORE));
  set(16, -jx - Math.sin(ang) * (UPPER + FORE), L.shoulder - 3 - Math.cos(ang) * (UPPER + FORE));
  set(23, (b.hipW / 4) * k, L.hip + 3);
  set(24, -(b.hipW / 4) * k, L.hip + 3);
  set(25, 11 * k, L.knee);
  set(26, -11 * k, L.knee);
  set(27, 11 * k, L.ankle);
  set(28, -11 * k, L.ankle);
  set(29, 11 * k, 1);
  set(30, -11 * k, 1);
  set(31, 12 * k + (side ? 8 : 0), 1);
  set(32, -12 * k + (side ? 8 : 0), 1);

  return { mask: { width: o.maskW, height: o.maskH, data }, landmarks: lm };
}
```

---

# Try-on core (src/shared)

## src/shared/lib/api.ts

```ts
import type { Anchors, Garment, SleeveType } from "./types";

export const garmentUrl = (rel: string) => `/static/garments/${rel}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(message);
  }
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let detail: unknown = null;
    try {
      detail = (await r.json()).detail;
    } catch {
      /* not JSON */
    }
    const msg =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "message" in detail
          ? String((detail as { message: unknown }).message)
          : Array.isArray(detail)
            ? detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ")
            : `${r.status} ${r.statusText}`;
    throw new ApiError(msg, r.status, detail);
  }
  return r.json() as Promise<T>;
}

export interface CatalogResponse {
  garments: Garment[];
  errors: string[];
}

export const fetchCatalog = () => fetch("/api/catalog").then((r) => json<CatalogResponse>(r));

export interface ModelEntry {
  id: string;
  purpose: string;
  file: string;
  license: string;
  required: boolean;
  runtime: string;
  present: boolean;
  size_bytes?: number;
  checksum?: "ok" | "unpinned" | "MISMATCH";
}

export interface ModelsStatus {
  manifest: boolean;
  models: ModelEntry[];
  missing_required: string[];
  ready: boolean;
  tryon_image: { available: boolean; reasons: string[] };
}

export const fetchModels = () => fetch("/api/models/status").then((r) => json<ModelsStatus>(r));
export const fetchSystem = () => fetch("/api/system/status").then((r) => json<Record<string, unknown>>(r));
export const fetchHealth = () => fetch("/health").then((r) => json<{ status: string; version: string }>(r));

export interface PreprocessResult {
  image_png_base64: string;
  width: number;
  height: number;
  anchors: Anchors | null;
  sleeve: SleeveType;
  confidence: number;
  needs_review: boolean;
  used_existing_alpha: boolean;
  warnings: string[];
}

export function preprocessGarment(file: File, threshold: number): Promise<PreprocessResult> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("threshold", String(threshold));
  return fetch("/api/garments/preprocess", { method: "POST", body: fd }).then((r) => json<PreprocessResult>(r));
}

export function importGarment(png: Blob, metadata: Record<string, unknown>): Promise<{ garment: Garment; warnings: string[] }> {
  const fd = new FormData();
  fd.append("image", png, "garment.png");
  fd.append("metadata", JSON.stringify(metadata));
  fd.append("preprocessed", "true");
  return fetch("/api/catalog/import", { method: "POST", body: fd }).then((r) => json(r));
}

export function patchGarment(id: string, patch: Record<string, unknown>): Promise<Garment> {
  return fetch(`/api/catalog/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => json<Garment>(r));
}
```

## src/shared/lib/types.ts

```ts
export interface Vec2 {
  x: number;
  y: number;
}

export type SleeveType = "none" | "short" | "long";

/** Normalised (0..1) garment-image coordinates. Wearer's LEFT = image RIGHT. */
export interface Anchors {
  neck: Vec2;
  left_shoulder: Vec2;
  right_shoulder: Vec2;
  left_hip: Vec2;
  right_hip: Vec2;
  left_elbow?: Vec2 | null;
  right_elbow?: Vec2 | null;
  left_cuff?: Vec2 | null;
  right_cuff?: Vec2 | null;
}

export interface MeshConfig {
  cols: number;
  rows: number;
  sleeve_blend: number;
  elbow_blend: number;
}

export interface Garment {
  id: string;
  name: string;
  category: string;
  body_region: string;
  sleeve: SleeveType;
  brand?: string | null;
  color?: string | null;
  sizes: string[];
  fit?: string | null;
  price?: number | null;
  currency?: string | null;
  anchors: Anchors;
  mesh: MeshConfig;
  source: { origin: string; license: string; demo: boolean };
  views: { front: string; side?: string | null; back?: string | null };
  preview: string;
  image_size: [number, number];
  renderable: boolean;
}

/** One pose landmark in video PIXEL coordinates (un-mirrored frame). */
export interface PixelLandmark {
  x: number;
  y: number;
  visibility: number;
}

/** Category-mask classes of selfie_multiclass_256x256. */
export const SEG = {
  background: 0,
  hair: 1,
  bodySkin: 2,
  faceSkin: 3,
  clothes: 4,
  others: 5,
} as const;

export interface CategoryMask {
  width: number;
  height: number;
  data: Uint8Array;
}

/** MediaPipe pose landmark indices used by the app. */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
} as const;
```

## src/shared/render/deform.ts

```ts
/**
 * Landmark-driven 2D garment deformation (level 2 in the spec: NOT 3D cloth simulation).
 *
 * Model:
 *  1. Torso: every mesh vertex gets bilinear coordinates (u, v) relative to the garment's
 *     shoulder/hip quad. Each frame the vertex is placed at the same (u, v) inside the
 *     body's shoulder/hip quad. Points outside the quad (collar, hem, sleeves) are
 *     extrapolated, which keeps garment proportions consistent with the torso.
 *  2. Sleeves: a 2-bone chain per arm (shoulder->elbow, elbow->wrist). Vertices carry a
 *     smooth sleeve weight w and forearm weight f; the torso-mapped position is rotated
 *     about the shoulder by w*phi1 and then about the (rotated) elbow by f*phi2, where
 *     phi are the angles between the garment's rest sleeve direction and the user's arm.
 *     Rotating by a weighted ANGLE (instead of blending two rigid transforms) avoids the
 *     collapse that linear-blend skinning shows at large bends.
 */
import type { Vec2 } from "../lib/types";

export type Quad = [Vec2, Vec2, Vec2, Vec2]; // [topLeft, topRight, bottomRight, bottomLeft]

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;

/** Inverse bilinear interpolation (works for convex quads, extrapolates outside). */
export function inverseBilinear(p: Vec2, q: Quad): Vec2 {
  const [a, b, c, d] = q;
  const e = { x: b.x - a.x, y: b.y - a.y };
  const f = { x: d.x - a.x, y: d.y - a.y };
  const g = { x: a.x - b.x + c.x - d.x, y: a.y - b.y + c.y - d.y };
  const h = { x: p.x - a.x, y: p.y - a.y };
  const k2 = cross(g, f);
  const k1 = cross(e, f) + cross(h, g);
  const k0 = cross(h, e);
  let v: number;
  if (Math.abs(k2) < 1e-9 * Math.max(1, Math.abs(k1))) {
    v = -k0 / k1;
  } else {
    const disc = k1 * k1 - 4 * k0 * k2;
    const sq = Math.sqrt(Math.max(0, disc));
    const v1 = (-k1 - sq) / (2 * k2);
    const v2 = (-k1 + sq) / (2 * k2);
    // choose the root closest to the [0,1] range
    const score = (t: number) => Math.abs(t - Math.min(1, Math.max(0, t)));
    v = score(v1) <= score(v2) ? v1 : v2;
  }
  const denx = e.x + g.x * v;
  const deny = e.y + g.y * v;
  const u = Math.abs(denx) > Math.abs(deny) ? (h.x - f.x * v) / denx : (h.y - f.y * v) / deny;
  return { x: u, y: v };
}

export function bilinear(uv: Vec2, q: Quad): Vec2 {
  const [a, b, c, d] = q;
  const u = uv.x;
  const v = uv.y;
  return {
    x: (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x,
    y: (1 - u) * (1 - v) * a.y + u * (1 - v) * b.y + u * v * c.y + (1 - u) * v * d.y,
  };
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const angleOf = (v: Vec2) => Math.atan2(v.y, v.x);

export interface ArmRest {
  shoulder: Vec2; // garment px
  elbow: Vec2 | null; // garment px (long sleeves only)
  cuff: Vec2; // garment px
  /** expected shoulder->elbow length in garment px (used for short sleeves) */
  upperLen?: number;
}

/**
 * Sleeve weight of a garment-space point for one arm.
 * @param outward +1 if this sleeve extends toward +x in the image (wearer's left), else -1
 */
export function sleeveWeight(p: Vec2, arm: ArmRest, hipSameSide: Vec2, outward: 1 | -1, shoulderWidth: number, blend: number): number {
  const S = arm.shoulder;
  const v = { x: p.x - S.x, y: p.y - S.y };
  const r = Math.hypot(v.x, v.y);
  if (r < 1e-6) return 0;
  const sleeveDir = angleOf({ x: arm.cuff.x - S.x, y: arm.cuff.y - S.y });
  const downDir = angleOf({ x: hipSameSide.x - S.x, y: hipSameSide.y - S.y });
  // Bisector between the sleeve and the torso side defines the armpit seam.
  const half = wrapAngle(sleeveDir - downDir) / 2;
  const bis = downDir + half;
  const sign = Math.sign(half) || 1;
  const phi = wrapAngle(angleOf(v) - bis) * sign; // >0 toward the sleeve
  const blendAng = Math.max(0.05, blend * 2.2);
  const angular = smoothstep(-blendAng, blendAng, phi);
  // Only points outside the shoulder (in the sleeve's horizontal direction) can be sleeve,
  // so the collar/neck area never follows the arm.
  const outwardness = v.x * outward;
  const lateral = smoothstep(-0.04 * shoulderWidth, 0.1 * shoulderWidth, outwardness);
  return angular * lateral;
}

export function forearmWeight(p: Vec2, arm: ArmRest, blend: number): number {
  if (!arm.elbow) return 0;
  const S = arm.shoulder;
  const axis = { x: arm.elbow.x - S.x, y: arm.elbow.y - S.y };
  const len2 = axis.x * axis.x + axis.y * axis.y;
  const t = ((p.x - S.x) * axis.x + (p.y - S.y) * axis.y) / len2;
  return smoothstep(1 - blend, 1 + blend, t);
}

export interface BodyArm {
  shoulder: Vec2;
  elbow: Vec2 | null;
  wrist: Vec2 | null;
  armConf: number;
  forearmConf: number;
}

/** One bone of the sleeve chain, solved for the current frame. */
interface Bone {
  pivot: Vec2; // body-space pivot (shoulder joint, or elbow)
  u: Vec2; // unit rest direction of the bone in body space
  phi: number; // rotation to the user's bone direction (already scaled by confidence)
  s: number; // length scale so the garment's bone end lands on the user's joint
}

export interface ArmPose {
  upper: Bone;
  fore: Bone | null;
}

const MAX_ROT = (150 * Math.PI) / 180;
const clampRot = (a: number) => Math.max(-MAX_ROT, Math.min(MAX_ROT, a));
// Sleeves may shorten (arm pointing at the camera) or stretch a little, within limits.
const clampScale = (s: number) => Math.max(0.55, Math.min(1.45, s));
const unit = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** Move a point with a bone: scale along the bone by (1 + w(s-1)), rotate by w*phi. */
function boneApply(p: Vec2, b: Bone, w: number): Vec2 {
  const dx = p.x - b.pivot.x;
  const dy = p.y - b.pivot.y;
  const n = { x: -b.u.y, y: b.u.x };
  const along = (dx * b.u.x + dy * b.u.y) * (1 + w * (b.s - 1));
  const perp = dx * n.x + dy * n.y;
  const a = w * b.phi;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const ux = b.u.x * c - b.u.y * s;
  const uy = b.u.x * s + b.u.y * c;
  return { x: b.pivot.x + along * ux - perp * uy, y: b.pivot.y + along * uy + perp * ux };
}

/**
 * Per-frame sleeve chain. The upper sleeve pivots on the real shoulder JOINT and is
 * rotated AND length-scaled so the garment's elbow lands on the user's elbow; the
 * forearm then pivots on that elbow so the cuff lands on the wrist. Without the length
 * match, a long product-photo sleeve overshoots the hand and bends in the wrong place.
 * `toBody` is the torso map garment->body.
 */
export function solveArm(rest: ArmRest, body: BodyArm, toBody: (g: Vec2) => Vec2): ArmPose {
  const J = body.shoulder;
  // Rest elbow: the elbow anchor, or for short sleeves a point at the expected upper-arm
  // length along the sleeve (the cuff is above the elbow on short sleeves).
  let restElbowG = rest.elbow;
  if (!restElbowG) {
    const d = unit({ x: rest.cuff.x - rest.shoulder.x, y: rest.cuff.y - rest.shoulder.y });
    const L = rest.upperLen ?? Math.hypot(rest.cuff.x - rest.shoulder.x, rest.cuff.y - rest.shoulder.y);
    restElbowG = { x: rest.shoulder.x + d.x * L, y: rest.shoulder.y + d.y * L };
  }
  const E0 = toBody(restElbowG);
  const v1 = { x: E0.x - J.x, y: E0.y - J.y };
  const L1 = Math.hypot(v1.x, v1.y) || 1;
  const upper: Bone = { pivot: J, u: unit(v1), phi: 0, s: 1 };
  if (body.elbow && body.armConf > 0) {
    const cur = { x: body.elbow.x - J.x, y: body.elbow.y - J.y };
    upper.phi = clampRot(wrapAngle(angleOf(cur) - angleOf(v1))) * body.armConf;
    upper.s = 1 + (clampScale(Math.hypot(cur.x, cur.y) / L1) - 1) * body.armConf;
  }
  if (!rest.elbow) return { upper, fore: null };

  // Forearm in the frame produced by the upper bone (full weight).
  const P = boneApply(E0, upper, 1);
  const C1 = boneApply(toBody(rest.cuff), upper, 1);
  const v2 = { x: C1.x - P.x, y: C1.y - P.y };
  const L2 = Math.hypot(v2.x, v2.y) || 1;
  const fore: Bone = { pivot: P, u: unit(v2), phi: 0, s: 1 };
  if (body.elbow && body.wrist && body.forearmConf > 0) {
    const cur = { x: body.wrist.x - body.elbow.x, y: body.wrist.y - body.elbow.y };
    fore.phi = clampRot(wrapAngle(angleOf(cur) - angleOf(v2))) * body.forearmConf;
    fore.s = 1 + (clampScale(Math.hypot(cur.x, cur.y) / L2) - 1) * body.forearmConf;
  }
  return { upper, fore };
}

export function applyArm(p: Vec2, w: number, f: number, pose: ArmPose): Vec2 {
  if (w <= 0) return p;
  let q = boneApply(p, pose.upper, w);
  if (pose.fore && f > 0) q = boneApply(q, pose.fore, f);
  return q;
}
```

## src/shared/render/garmentMesh.ts

```ts
import type { Anchors, Garment, Vec2 } from "../lib/types";
import type { BodyState } from "../tracking/bodyTracker";
import { applyArm, bilinear, forearmWeight, inverseBilinear, smoothstep, solveArm, type ArmPose, type ArmRest, type Quad } from "./deform";
import { fillNearest, sampleField, segmentSleeve, type SideSegmentation } from "./sleeveSegmentation";

export interface AlphaGrid {
  width: number;
  height: number;
  /** alpha 0..255, row-major, width*height */
  data: Uint8Array | Uint8ClampedArray;
}

export interface Calibration {
  /** uniform scale multiplier */
  scale: number;
  /** offsets in shoulder-widths */
  offsetX: number;
  offsetY: number;
  /** extra width multiplier (loose/tight fit) */
  width: number;
  /** extra length multiplier (cropped / long fit) */
  length: number;
  /**
   * Where the garment's shoulder-seam corner sits relative to the pose's shoulder JOINT
   * landmark, in shoulder-widths: outward along the shoulder line, and upward. The joint
   * is inside the body, the seam is on its outline, so both are positive. Defaults are a
   * starting guess; "Auto-fit" measures them from the person's silhouette.
   */
  shoulderOut: number;
  shoulderUp: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  width: 1,
  length: 1,
  shoulderOut: 0.06,
  shoulderUp: 0.08,
};

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const norm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};

/** Mesh layers, drawn in this order: 0 torso, then 1 the wearer's left and 2 right sleeve. */
export const LAYERS = 3;
/**
 * Which layer draws a pixel, by its sleeve weight w (renderer FS_MESH uses the same values):
 * a sleeve from w > SLEEVE_FROM, the torso while w < TORSO_UNTIL. At every w at least one of
 * them is fully opaque, so the cut between torso and sleeve never shows a see-through seam.
 */
export const SLEEVE_FROM = 0.35;
export const TORSO_UNTIL = 0.65;

/**
 * Triangulated grids covering the garment's visible pixels, one layer each for the torso
 * and the two sleeves, with per-vertex torso coordinates and sleeve weights precomputed
 * once at load time.
 *
 * Separate layers let a raised sleeve pull away from the torso along the armpit gap. With a
 * single grid, every cell holding both sleeve and torso pixels (the gap in a product photo
 * is often narrower than a cell) was torn apart and faded, leaving see-through, jagged
 * sleeves and stair-stepped torso sides. The renderer cuts each layer down to its own
 * pixels with `parts`.
 */
export class GarmentMesh {
  readonly vertexCount: number;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly positions: Float32Array; // body-space output, updated per frame
  /** per-TRIANGLE opacity, updated per frame: hides fabric folded under itself */
  fade: Float32Array;
  /** Un-indexed copies for the GPU (each triangle owns its 3 vertices so a faded
   *  triangle never affects its neighbours). Sizes: triangles*3 vertices. */
  triUVs: Float32Array = new Float32Array(0);
  triPositions: Float32Array = new Float32Array(0);
  triFade: Float32Array = new Float32Array(0);
  triLayers: Float32Array = new Float32Array(0);
  /** Sleeve weights of the garment image (R = left, G = right), which the renderer uses to
   *  cut each layer to its own pixels. */
  readonly parts: { width: number; height: number; data: Uint8Array };
  private fadeSum: Float32Array | null = null;
  private fadeCnt: Uint16Array | null = null;
  private garmentPx: Float32Array;
  private torsoUV: Float32Array;
  /** torsoUV of the sleeve reshaped for a raised arm (see raisedSleeve) */
  private raisedUV: Float32Array;
  private layer: Uint8Array;
  /** a sleeve vertex's sleeve weight at rest and its forearm weight (0 on the torso) */
  private restW: Float32Array;
  private fore: Float32Array;
  /** sleeve/forearm weights in effect this frame */
  private wL: Float32Array;
  private wR: Float32Array;
  private fL: Float32Array;
  private fR: Float32Array;
  private gq: Quad;
  private armL: ArmRest | null;
  private armR: ArmRest | null;
  readonly gShoulderWidth: number;
  readonly segL: SideSegmentation | null;
  readonly segR: SideSegmentation | null;

  constructor(
    readonly garment: Garment,
    alpha: AlphaGrid,
  ) {
    const [W, H] = garment.image_size;
    const a = garment.anchors;
    const px = (p: Vec2): Vec2 => ({ x: p.x * W, y: p.y * H });
    // Quad order: [image-left shoulder, image-right shoulder, image-right hip, image-left hip]
    // = [right_shoulder, left_shoulder, left_hip, right_hip] (wearer's left is image right).
    this.gq = [px(a.right_shoulder), px(a.left_shoulder), px(a.left_hip), px(a.right_hip)];
    this.gShoulderWidth = Math.hypot(this.gq[1].x - this.gq[0].x, this.gq[1].y - this.gq[0].y);
    this.armL = armRest(a, "left", px, garment.sleeve);
    this.armR = armRest(a, "right", px, garment.sleeve);

    const { cols, rows, sleeve_blend, elbow_blend } = garment.mesh;
    this.segL = this.armL
      ? segmentSleeve(alpha, garment.image_size, this.armL, this.gq[2], 1, this.gShoulderWidth, sleeve_blend)
      : null;
    this.segR = this.armR
      ? segmentSleeve(alpha, garment.image_size, this.armR, this.gq[3], -1, this.gShoulderWidth, sleeve_blend)
      : null;

    const aw = alpha.width;
    const ah = alpha.height;
    const sx = aw / W;
    const sy = ah / H;
    const sL = this.segL?.field;
    const sR = this.segR?.field;
    const visible = (p: number) => alpha.data[p] > 8;
    const owns = (l: number, p: number) => {
      const wl = sL ? sL[p] : 0;
      const wr = sR ? sR[p] : 0;
      return l === 0 ? Math.max(wl, wr) < TORSO_UNTIL : (l === 1 ? wl : wr) > SLEEVE_FROM;
    };
    this.parts = { width: aw, height: ah, data: new Uint8Array(aw * ah * 2) };
    for (let p = 0; p < aw * ah; p++) {
      this.parts.data[2 * p] = Math.round((sL ? sL[p] : 0) * 255);
      this.parts.data[2 * p + 1] = Math.round((sR ? sR[p] : 0) * 255);
    }
    const hasLayer = [true, !!sL, !!sR];
    // Rest sleeve weight of each sleeve layer: a hinge along the seam that joins the sleeve to
    // the torso, rising from 0 at the seam to 1 at HINGE shoulder-widths from it, measured
    // through the fabric (a sleeve merely hanging next to the torso across a gap isn't sewn
    // to it). Near rest the sleeve thus turns with the arm while the seam stays closed, its
    // stretch spread over the hinge instead of tearing one row of cells. The values extend
    // from the sleeve's pixels into the rest of the image, so a sleeve vertex lying over torso
    // pixels moves with the sleeve. The torso layer follows the torso only: rotating its
    // shoulder edge with the arm tore it, and a raised arm opens the underarm instead.
    const solid = (p: number) => alpha.data[p] > 96;
    const seamDist = new Float32Array(aw * ah).fill(Infinity);
    const queue = new Int32Array(aw * ah);
    let qt = 0;
    for (let p = 0; p < aw * ah; p++)
      if (solid(p) && Math.max(sL ? sL[p] : 0, sR ? sR[p] : 0) < 0.5) (seamDist[p] = 0), (queue[qt++] = p);
    for (let qh = 0; qh < qt; qh++) {
      const p = queue[qh];
      const x = p % aw;
      for (const q of [x > 0 ? p - 1 : -1, x < aw - 1 ? p + 1 : -1, p - aw, p + aw]) {
        if (q < 0 || q >= aw * ah || !solid(q) || seamDist[q] <= seamDist[p] + 1) continue;
        seamDist[q] = seamDist[p] + 1;
        queue[qt++] = q;
      }
    }
    const hinge = HINGE * this.gShoulderWidth * sx;
    const fields = [null, sL, sR].map((s, l) => {
      if (!s) return null;
      const f = new Float32Array(aw * ah).fill(NaN);
      for (let p = 0; p < aw * ah; p++) if (solid(p) && owns(l, p)) f[p] = smoothstep(0, hinge, seamDist[p]);
      return fillNearest(f, aw, ah);
    });

    const gAcross = norm(sub(this.gq[1], this.gq[0]));
    const gDown = { x: -gAcross.y, y: gAcross.x };
    const jointAt = (seam: Vec2, inward: 1 | -1): Vec2 => ({
      x: seam.x + (inward * gAcross.x * DEFAULT_CALIBRATION.shoulderOut + gDown.x * DEFAULT_CALIBRATION.shoulderUp) * this.gShoulderWidth,
      y: seam.y + (inward * gAcross.y * DEFAULT_CALIBRATION.shoulderOut + gDown.y * DEFAULT_CALIBRATION.shoulderUp) * this.gShoulderWidth,
    });
    const owned = (s: Float32Array) => (x: number, y: number) => alpha.data[y * aw + x] > 96 && s[y * aw + x] >= 0.5;
    const reshape = [
      null,
      this.armL && sL ? raisedSleeve(this.armL, jointAt(this.gq[1], -1), owned(sL), aw, ah, sx, sy, this.gShoulderWidth) : null,
      this.armR && sR ? raisedSleeve(this.armR, jointAt(this.gq[0], 1), owned(sR), aw, ah, sx, sy, this.gShoulderWidth) : null,
    ];

    const nGrid = (cols + 1) * (rows + 1);
    const nv = LAYERS * nGrid;
    this.vertexCount = nv;
    this.uvs = new Float32Array(nv * 2);
    this.garmentPx = new Float32Array(nv * 2);
    this.torsoUV = new Float32Array(nv * 2);
    this.raisedUV = new Float32Array(nv * 2);
    this.positions = new Float32Array(nv * 2);
    this.fade = new Float32Array(0);
    this.layer = new Uint8Array(nv);
    this.restW = new Float32Array(nv);
    this.fore = new Float32Array(nv);
    this.wL = new Float32Array(nv);
    this.wR = new Float32Array(nv);
    this.fL = new Float32Array(nv);
    this.fR = new Float32Array(nv);

    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const v = j / rows;
        const g = { x: u * W, y: v * H };
        const tuv = inverseBilinear(g, this.gq);
        const foreL = this.armL ? forearmWeight(g, this.armL, elbow_blend) : 0;
        const foreR = this.armR ? forearmWeight(g, this.armR, elbow_blend) : 0;
        for (let l = 0; l < LAYERS; l++) {
          const k = l * nGrid + j * (cols + 1) + i;
          this.layer[k] = l;
          this.uvs[2 * k] = u;
          this.uvs[2 * k + 1] = v;
          this.garmentPx[2 * k] = g.x;
          this.garmentPx[2 * k + 1] = g.y;
          this.torsoUV[2 * k] = tuv.x;
          this.torsoUV[2 * k + 1] = tuv.y;
          const r = reshape[l];
          const ruv = r ? inverseBilinear(r(g), this.gq) : tuv;
          this.raisedUV[2 * k] = ruv.x;
          this.raisedUV[2 * k + 1] = ruv.y;
          const f = fields[l];
          if (!f) continue;
          this.restW[k] = sampleField(f, aw, ah, g.x * sx, g.y * sy);
          this.fore[k] = l === 1 ? foreL : foreR;
          this.setWeights(k, 0);
        }
      }
    }

    // Keep only cells that contain pixels of the layer (dilated by one cell so edges aren't clipped).
    const cells = cols * rows;
    const occupied = new Uint8Array(LAYERS * cells);
    for (let j = 0; j < rows; j++) {
      const y0 = Math.floor((j / rows) * ah);
      const y1 = Math.max(y0 + 1, Math.ceil(((j + 1) / rows) * ah));
      for (let i = 0; i < cols; i++) {
        const x0 = Math.floor((i / cols) * aw);
        const x1 = Math.max(x0 + 1, Math.ceil(((i + 1) / cols) * aw));
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const p = y * aw + x;
            if (!visible(p)) continue;
            for (let l = 0; l < LAYERS; l++) if (hasLayer[l] && owns(l, p)) occupied[l * cells + j * cols + i] = 1;
          }
      }
    }
    const idx: number[] = [];
    for (let l = 0; l < LAYERS; l++) {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let on = false;
          for (let dj = -1; dj <= 1 && !on; dj++)
            for (let di = -1; di <= 1 && !on; di++) {
              const jj = j + dj;
              const ii = i + di;
              if (jj >= 0 && jj < rows && ii >= 0 && ii < cols && occupied[l * cells + jj * cols + ii]) on = true;
            }
          if (!on) continue;
          const k0 = l * nGrid + j * (cols + 1) + i;
          const k1 = k0 + 1;
          const k2 = k0 + cols + 1;
          const k3 = k2 + 1;
          idx.push(k0, k2, k1, k1, k2, k3);
        }
      }
    }
    this.indices = new Uint32Array(idx);
    const nt = idx.length / 3;
    this.fade = new Float32Array(nt).fill(1);
    this.triUVs = new Float32Array(idx.length * 2);
    this.triPositions = new Float32Array(idx.length * 2);
    this.triFade = new Float32Array(idx.length).fill(1);
    this.triLayers = new Float32Array(idx.length);
    for (let i = 0; i < idx.length; i++) {
      this.triUVs[2 * i] = this.uvs[2 * idx[i]];
      this.triUVs[2 * i + 1] = this.uvs[2 * idx[i] + 1];
      this.triLayers[i] = this.layer[idx[i]];
    }
  }

  /**
   * Body quad matching the garment quad [R seam, L seam, L hip, R hip].
   *
   * - Top corners: the shoulder-seam corners, placed outward/upward of the shoulder joint
   *   landmarks (Calibration.shoulderOut/Up).
   * - Horizontal scale comes from the shoulder seams only; the garment keeps its own
   *   width proportions down the torso (a boxy tee stays boxy). The hip landmarks are
   *   joint centres, much narrower than the hips' outline, so they must not set the width.
   * - Vertical scale and lean come from the torso axis (shoulders -> hips). This stays
   *   stable when the person turns and the shoulder width shrinks.
   */
  bodyQuad(body: BodyState, cal: Calibration = DEFAULT_CALIBRATION): Quad {
    const sw = body.shoulderWidth;
    const across = norm(sub(body.leftShoulder, body.rightShoulder));
    const up = { x: across.y, y: -across.x }; // perpendicular, pointing up (image y grows down)
    const seamR = {
      x: body.rightShoulder.x - across.x * cal.shoulderOut * sw + up.x * cal.shoulderUp * sw,
      y: body.rightShoulder.y - across.y * cal.shoulderOut * sw + up.y * cal.shoulderUp * sw,
    };
    const seamL = {
      x: body.leftShoulder.x + across.x * cal.shoulderOut * sw + up.x * cal.shoulderUp * sw,
      y: body.leftShoulder.y + across.y * cal.shoulderOut * sw + up.y * cal.shoulderUp * sw,
    };
    const bTop = mid(seamR, seamL);
    const hipMid = mid(body.leftHip, body.rightHip);
    const bAxis = sub(hipMid, bTop);
    const bLen = Math.hypot(bAxis.x, bAxis.y);
    const bDown = norm(bAxis);
    const hipAcross = norm(sub(body.leftHip, body.rightHip));
    const Sw = Math.hypot(seamL.x - seamR.x, seamL.y - seamR.y) * cal.scale * cal.width;
    const Sh = bLen * cal.scale * cal.length;

    const g = this.gq;
    const gTop = mid(g[0], g[1]);
    const gAcross = norm(sub(g[1], g[0]));
    const gDown = { x: -gAcross.y, y: gAcross.x };
    const gSeam = Math.hypot(g[1].x - g[0].x, g[1].y - g[0].y);
    const gLen = dot(sub(mid(g[2], g[3]), gTop), gDown);

    const off = {
      x: (across.x * cal.offsetX + bDown.x * cal.offsetY) * sw,
      y: (across.y * cal.offsetX + bDown.y * cal.offsetY) * sw,
    };
    return g.map((p, i) => {
      const d = sub(p, gTop);
      const a = dot(d, gAcross) / gSeam; // shoulder-seam widths
      const b = dot(d, gDown) / gLen; // torso lengths
      const ax = i < 2 ? across : hipAcross; // hem follows the hip line's tilt
      // centre of this row on the body's torso axis, scaled about the seam centre
      return {
        x: bTop.x + bDown.x * b * Sh + ax.x * a * Sw + off.x,
        y: bTop.y + bDown.y * b * Sh + ax.y * a * Sw + off.y,
      };
    }) as Quad;
  }

  /** Recompute body-space vertex positions for the current pose. Returns this.positions. */
  deform(body: BodyState, cal: Calibration = DEFAULT_CALIBRATION): Float32Array {
    const bq = this.bodyQuad(body, cal);
    const toBody = (g: Vec2) => bilinear(inverseBilinear(g, this.gq), bq);
    const poseL = this.armL
      ? solveArm(
          this.armL,
          {
            shoulder: body.leftShoulder,
            elbow: body.leftElbow,
            wrist: body.leftWrist,
            armConf: body.leftArmConf,
            forearmConf: body.leftForearmConf,
          },
          toBody,
        )
      : null;
    const poseR = this.armR
      ? solveArm(
          this.armR,
          {
            shoulder: body.rightShoulder,
            elbow: body.rightElbow,
            wrist: body.rightWrist,
            armConf: body.rightArmConf,
            forearmConf: body.rightForearmConf,
          },
          toBody,
        )
      : null;

    // How far each sleeve is set up for a raised arm: none near the rest angle, fully from
    // about 50 degrees of upper-arm rotation. A raised sleeve is reshaped (raisedSleeve) and
    // turns as one rigid piece: hinging its root to the torso there would smear a "cape"
    // across the underarm. Near rest the hinge keeps the seam closed.
    const raisedBy = (pose: ArmPose | null) => (pose ? smoothstep(0.3, 0.9, Math.abs(pose.upper.phi)) : 0);
    const raised = [0, raisedBy(poseL), raisedBy(poseR)];
    for (let k = 0; k < this.vertexCount; k++) if (this.layer[k]) this.setWeights(k, raised[this.layer[k]]);
    const out = this.positions;
    const T = this.torsoUV;
    const R = this.raisedUV;
    for (let k = 0; k < this.vertexCount; k++) {
      const a = raised[this.layer[k]];
      let p = bilinear({ x: T[2 * k] + a * (R[2 * k] - T[2 * k]), y: T[2 * k + 1] + a * (R[2 * k + 1] - T[2 * k + 1]) }, bq);
      if (poseL && this.wL[k] > 0) p = applyArm(p, this.wL[k], this.fL[k], poseL);
      if (poseR && this.wR[k] > 0) p = applyArm(p, this.wR[k], this.fR[k], poseR);
      out[2 * k] = p.x;
      out[2 * k + 1] = p.y;
    }
    this.updateFade();
    return out;
  }

  /**
   * Triangles turned over relative to the photo are fabric folded under itself, e.g. on the
   * inside of a bent elbow; they are hidden so the fold doesn't poke out past the crease. A
   * bent elbow otherwise just stretches the outside of the sleeve, like real fabric.
   */
  private updateFade(): void {
    const { fade, positions: P, garmentPx: G, indices: I, triPositions: TP, triFade: TF } = this;
    const area = (A: Float32Array, a: number, b: number, c: number) =>
      (A[2 * b] - A[2 * a]) * (A[2 * c + 1] - A[2 * a + 1]) - (A[2 * c] - A[2 * a]) * (A[2 * b + 1] - A[2 * a + 1]);
    const nv = this.vertexCount;
    const sum = (this.fadeSum ??= new Float32Array(nv));
    const cnt = (this.fadeCnt ??= new Uint16Array(nv));
    sum.fill(0);
    cnt.fill(0);
    for (let t = 0, i = 0; i < I.length; t++, i += 3) {
      const a = I[i];
      const b = I[i + 1];
      const c = I[i + 2];
      const f = this.layer[a] && area(P, a, b, c) * area(G, a, b, c) < 0 ? 0 : 1;
      fade[t] = f;
      for (const v of [a, b, c]) {
        sum[v] += f;
        cnt[v]++;
      }
      TP[2 * i] = P[2 * a];
      TP[2 * i + 1] = P[2 * a + 1];
      TP[2 * i + 2] = P[2 * b];
      TP[2 * i + 3] = P[2 * b + 1];
      TP[2 * i + 4] = P[2 * c];
      TP[2 * i + 5] = P[2 * c + 1];
    }
    // A folded triangle disappears completely (no translucent "ghost"); its neighbours are
    // softened toward it at the shared corners, so the crease is feathered, not saw-toothed.
    for (let t = 0, i = 0; i < I.length; t++, i += 3) {
      for (let j = 0; j < 3; j++) {
        const v = I[i + j];
        TF[i + j] = fade[t] * (0.35 + (0.65 * sum[v]) / cnt[v]);
      }
    }
  }


  /** Smallest fade among the triangles that use vertex k (tests/debugging). */
  vertexFade(k: number): number {
    let m = 1;
    for (let i = 0; i < this.indices.length; i++) if (this.indices[i] === k) m = Math.min(m, this.fade[(i / 3) | 0]);
    return m;
  }

  /** Weights of sleeve vertex k for a sleeve raised by `raised` (0 rest .. 1 raised). */
  private setWeights(k: number, raised: number): void {
    const w = this.restW[k] + raised * (1 - this.restW[k]);
    if (this.layer[k] === 1) {
      this.wL[k] = w;
      this.fL[k] = w * this.fore[k];
    } else {
      this.wR[k] = w;
      this.fR[k] = w * this.fore[k];
    }
  }

  /** Layer of vertex k: 0 torso, 1 left sleeve, 2 right sleeve. */
  vertexLayer(k: number): number {
    return this.layer[k];
  }

  /** Sleeve weights, exposed for debugging overlays and tests. */
  weightsAt(k: number) {
    return { wL: this.wL[k], wR: this.wR[k], fL: this.fL[k], fR: this.fR[k] };
  }
  garmentPoint(k: number): Vec2 {
    return { x: this.garmentPx[2 * k], y: this.garmentPx[2 * k + 1] };
  }
}

function armRest(a: Anchors, side: "left" | "right", px: (p: Vec2) => Vec2, sleeve: Garment["sleeve"]): ArmRest | null {
  const cuff = a[`${side}_cuff`];
  if (sleeve === "none" || !cuff) return null;
  const elbow = a[`${side}_elbow`];
  const ls = px(a.left_shoulder);
  const rs = px(a.right_shoulder);
  // Short sleeves stop above the elbow, so the elbow isn't on the garment. Typical body:
  // shoulder-joint->elbow is about 0.82 shoulder-seam widths.
  const upperLen = 0.82 * Math.hypot(ls.x - rs.x, ls.y - rs.y);
  return { shoulder: px(a[`${side}_shoulder`]), elbow: elbow ? px(elbow) : null, cuff: px(cuff), upperLen };
}

/** Width of the hinge between sleeve and torso at rest, in shoulder-seam widths. */
const HINGE = 0.15;

/** Half the thickness of an upper arm, with a little ease, in shoulder-seam widths. */
const ARM_HALF = 0.15;

/**
 * Upper sleeve reshaped for a raised arm. In a front product photo the top of a sleeve is a
 * narrow wedge outward of the shoulder joint (the underarm panel is hidden against the
 * body), so rotated up with the arm it would cover only the top of the arm. Here the
 * sleeve's cross-section at each point along the upper arm is centred on the arm's axis and
 * widened to at least the arm's thickness. It tapers out toward the elbow, where the photo
 * shows the full sleeve. Returns the reshaped garment point.
 */
function raisedSleeve(
  arm: ArmRest,
  joint: Vec2,
  owned: (x: number, y: number) => boolean,
  aw: number,
  ah: number,
  sx: number,
  sy: number,
  seamWidth: number,
): (g: Vec2) => Vec2 {
  let elbow = arm.elbow;
  if (!elbow) {
    const d = norm(sub(arm.cuff, arm.shoulder));
    const L = arm.upperLen ?? Math.hypot(arm.cuff.x - arm.shoulder.x, arm.cuff.y - arm.shoulder.y);
    elbow = { x: arm.shoulder.x + d.x * L, y: arm.shoulder.y + d.y * L };
  }
  const axis = sub(elbow, joint);
  const L = Math.hypot(axis.x, axis.y) || 1;
  const u = { x: axis.x / L, y: axis.y / L };
  const n = { x: -u.y, y: u.x };
  // The sleeve's cross-section [lo, hi] across the axis, in bins along it.
  const BINS = 24;
  const lo = new Float32Array(BINS).fill(Infinity);
  const hi = new Float32Array(BINS).fill(-Infinity);
  for (let y = 0; y < ah; y++)
    for (let x = 0; x < aw; x++) {
      if (!owned(x, y)) continue;
      const d = { x: (x + 0.5) / sx - joint.x, y: (y + 0.5) / sy - joint.y };
      const t = dot(d, u) / L;
      if (t < 0 || t >= 1) continue;
      const b = Math.floor(t * BINS);
      const p = dot(d, n);
      lo[b] = Math.min(lo[b], p);
      hi[b] = Math.max(hi[b], p);
    }
  // Empty bins (e.g. the sleeve starts below the joint) take their nearest filled bin.
  const filled = [...lo.keys()].filter((b) => hi[b] > lo[b]);
  if (!filled.length) return (g) => g;
  const centre = new Float32Array(BINS);
  const half = new Float32Array(BINS);
  for (let b = 0; b < BINS; b++) {
    const s = filled.reduce((best, f) => (Math.abs(f - b) < Math.abs(best - b) ? f : best));
    centre[b] = (lo[s] + hi[s]) / 2;
    half[b] = (hi[s] - lo[s]) / 2;
  }
  const target = ARM_HALF * seamWidth;
  return (g) => {
    const d = sub(g, joint);
    const t = dot(d, u) / L;
    const taper = 1 - smoothstep(0.65, 1, t);
    if (taper <= 0) return g;
    // linear interpolation between bin centres
    const tb = Math.min(BINS - 1, Math.max(0, t * BINS - 0.5));
    const b0 = Math.floor(tb);
    const b1 = Math.min(BINS - 1, b0 + 1);
    const fr = tb - b0;
    const c = centre[b0] + (centre[b1] - centre[b0]) * fr;
    const h = half[b0] + (half[b1] - half[b0]) * fr;
    // Spread the cross-section to the target half-width (at most 3x) with a smooth easing
    // that reaches the full extra width at the sleeve's edge and only shifts what lies
    // beyond it, so nothing outside the sleeve gets flung away and the edge has no kink.
    const H = Math.min(3 * h, Math.max(h, target));
    const q = dot(d, n) - c;
    const moved = q + (H - h) * Math.sin((Math.PI / 2) * Math.max(-1, Math.min(1, q / Math.max(1e-3, h))));
    const off = (moved - q - c) * taper;
    return { x: g.x + n.x * off, y: g.y + n.y * off };
  };
}

/** Downsample an image's alpha channel to a small grid for mesh-cell occupancy. */
export function alphaGridFromImage(img: CanvasImageSource & { width: number; height: number }, maxSide = 256): AlphaGrid {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = rgba[4 * i + 3];
  return { width: w, height: h, data };
}
```

## src/shared/render/occlusion.ts

```ts
import type { SleeveType, Vec2 } from "../lib/types";
import type { BodyState } from "../tracking/bodyTracker";

/**
 * Draws "may occlude the garment" regions from the pose: hands always, forearms when the
 * garment's sleeves don't cover them, upper arms for sleeveless garments. The renderer
 * intersects this with the segmentation's body-skin class, so only real skin pixels inside
 * these capsules are drawn in front of the garment.
 */
export class CapsulePainter {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(private scale = 0.25) {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
  }

  paint(body: BodyState | null, width: number, height: number, sleeve: SleeveType): HTMLCanvasElement {
    const w = Math.max(1, Math.round(width * this.scale));
    const h = Math.max(1, Math.round(height * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!body) return this.canvas;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "round";
    const sw = body.shoulderWidth;
    const seg = (a: Vec2 | null, b: Vec2 | null, r: number, cap: CanvasLineCap = "round") => {
      if (!a || !b) return;
      ctx.lineCap = cap;
      ctx.lineWidth = 2 * r;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const sides = [
      { sh: body.leftShoulder, el: body.leftElbow, wr: body.leftWrist, hand: body.leftHand, conf: body.leftArmConf },
      { sh: body.rightShoulder, el: body.rightElbow, wr: body.rightWrist, hand: body.rightHand, conf: body.rightArmConf },
    ];
    for (const s of sides) {
      if (s.conf < 0.3) continue;
      // hand: blob around wrist + finger landmarks, extended past them (landmarks stop
      // at the knuckles)
      if (s.wr) {
        const pts = [s.wr, ...s.hand];
        const c = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 });
        const tip = s.el ? { x: c.x + (c.x - s.el.x) * 0.25, y: c.y + (c.y - s.el.y) * 0.25 } : c;
        seg(s.wr, tip, sw * 0.17);
        for (const p of s.hand) seg(s.wr, p, sw * 0.12);
      }
      // Forearm starts a little past the elbow with a flat cap, so it never cuts into the
      // end of a short sleeve.
      if (sleeve !== "long" && s.el && s.wr) {
        const start = { x: s.el.x + (s.wr.x - s.el.x) * 0.18, y: s.el.y + (s.wr.y - s.el.y) * 0.18 };
        seg(start, s.wr, sw * 0.13, "butt");
      }
      if (sleeve === "none") seg(s.sh, s.el, sw * 0.15);
    }
    return this.canvas;
  }
}
```

## src/shared/render/renderer.ts

```ts
/**
 * WebGL2 compositor:
 *   pass 1  camera frame (full screen)
 *   pass 2  deformed garment mesh, lit by the camera's local luminance (folds/lighting)
 *   pass 3  occluders: camera pixels that must stay in front of the garment
 *           (hair + face-skin everywhere, body-skin only inside hand/forearm capsules)
 */
import type { CategoryMask } from "../lib/types";
import { SLEEVE_FROM, TORSO_UNTIL, type GarmentMesh } from "./garmentMesh";

const VS_QUAD = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS_VIDEO = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uVideo;
out vec4 o;
void main() { o = vec4(texture(uVideo, vUV).rgb, 1.0); }`;

const VS_MESH = `#version 300 es
in vec2 aPos;
in vec2 aUV;
in float aFade;
in float aLayer;
uniform vec2 uRes;
out vec2 vUV;
out vec2 vScreen;
out float vFade;
out float vLayer;
void main() {
  vUV = aUV;
  vFade = aFade;
  vLayer = aLayer;
  vScreen = aPos / uRes;
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS_MESH = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec2 vScreen;
in float vFade;
in float vLayer;
uniform sampler2D uGarment;
uniform sampler2D uParts;   // sleeve weights: r = left sleeve, g = right sleeve
uniform sampler2D uVideo;
uniform sampler2D uCat;
uniform float uHasCat;
uniform float uOpacity;
uniform float uFolds;     // transfer of local (high-pass) shading from the camera
uniform float uLighting;  // transfer of overall scene brightness
uniform float uVideoLod;
uniform float uFineLod;
out vec4 o;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec4 g = texture(uGarment, vUV);            // premultiplied alpha
  // Each mesh layer draws only its own part of the garment (see GarmentMesh).
  vec2 s = texture(uParts, vUV).rg;
  float own = vLayer < 0.5 ? 1.0 - smoothstep(0.5, ${TORSO_UNTIL.toFixed(3)}, max(s.r, s.g))
                           : smoothstep(${SLEEVE_FROM.toFixed(3)}, 0.5, vLayer < 1.5 ? s.r : s.g);
  if (own <= 0.0) discard;
  // Band-pass: medium-scale shading (body folds, shadows) without the fine detail of the
  // user's own clothing (checks, stripes, prints), which would otherwise show through.
  float l = lum(textureLod(uVideo, vScreen, uFineLod).rgb);
  float lBlur = lum(textureLod(uVideo, vScreen, uVideoLod).rgb);
  float folds = clamp(l / max(lBlur, 0.04), 0.72, 1.25);
  // Only borrow shading from the user's own clothes; silhouette edges against the
  // background would otherwise print light/dark bands onto the garment.
  float cls = floor(texture(uCat, vScreen).r * 255.0 + 0.5);
  float onClothes = mix(0.5, cls == 4.0 ? 1.0 : 0.0, uHasCat);
  folds = mix(1.0, folds, onClothes);
  float light = clamp(lBlur / 0.45, 0.45, 1.3);
  float shade = mix(1.0, folds, uFolds) * mix(1.0, light, uLighting);
  o = vec4(g.rgb * shade, g.a) * uOpacity * vFade * own;
}`;

const FS_OCCLUDE = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uVideo;
uniform sampler2D uCat;      // R8 category ids
uniform sampler2D uCaps;     // capsule mask (r)
uniform vec2 uCatTexel;
uniform float uHairFace;
out vec4 o;
float occ(vec2 uv) {
  float c = floor(texture(uCat, uv).r * 255.0 + 0.5);
  float hf = (c == 1.0 || c == 3.0) ? uHairFace : 0.0;
  float skin = (c == 2.0) ? texture(uCaps, uv).r : 0.0;
  return max(hf, skin);
}
void main() {
  vec2 t = uCatTexel;
  float a = occ(vUV) * 0.4
    + (occ(vUV + vec2(t.x, 0.0)) + occ(vUV - vec2(t.x, 0.0)) + occ(vUV + vec2(0.0, t.y)) + occ(vUV - vec2(0.0, t.y))) * 0.15;
  if (a <= 0.001) discard;
  o = vec4(texture(uVideo, vUV).rgb * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  if (gl.isContextLost()) throw new Error("WebGL context was lost — your GPU may be busy or the driver crashed. Try closing other tabs or reloading the page.");
  const s = gl.createShader(type);
  if (!s) throw new Error("Could not create a WebGL shader — your GPU may be out of resources. Try closing other browser tabs or applications using the GPU, then reload.");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? "(no details from driver)";
    gl.deleteShader(s);
    throw new Error(`Shader compilation failed: ${log}`);
  }
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error("Could not create a WebGL program — try reloading the page.");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.bindAttribLocation(p, 1, "aUV");
  gl.bindAttribLocation(p, 2, "aFade");
  gl.bindAttribLocation(p, 3, "aLayer");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? "(no details from driver)";
    gl.deleteProgram(p);
    throw new Error(`Shader program linking failed: ${log}`);
  }
  return p;
}

export interface RenderParams {
  opacity: number;
  folds: number;
  lighting: number;
  occlusion: boolean;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private pVideo: WebGLProgram;
  private pMesh: WebGLProgram;
  private pOcc: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private meshVao: WebGLVertexArrayObject;
  private posBuf: WebGLBuffer;
  private uvBuf: WebGLBuffer;
  private fadeBuf: WebGLBuffer;
  private layerBuf: WebGLBuffer;
  private indexCount = 0;
  private texVideo: WebGLTexture;
  private texGarment: WebGLTexture | null = null;
  private texParts: WebGLTexture;
  private texCat: WebGLTexture;
  private texCaps: WebGLTexture;
  private catSize = { w: 1, h: 1 };
  private hasCat = false;
  private width = 0;
  private height = 0;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  private _contextLost = false;

  get contextLost(): boolean {
    return this._contextLost;
  }

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this._contextLost = true;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this._contextLost = false;
    });
    let gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: false, antialias: true, preserveDrawingBuffer: true });
    if (!gl) {
      gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: false });
    }
    if (!gl) throw new Error("WebGL2 is not available in this browser. Use a current Chrome/Edge/Chromium.");
    this.gl = gl;
    this.pVideo = program(gl, VS_QUAD, FS_VIDEO);
    this.pMesh = program(gl, VS_MESH, FS_MESH);
    this.pOcc = program(gl, VS_QUAD, FS_OCCLUDE);

    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.meshVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.meshVao);
    this.posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    this.fadeBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    this.layerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.texVideo = this.makeTex(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    this.texParts = this.makeTex(gl.LINEAR, gl.LINEAR);
    this.texCat = this.makeTex(gl.NEAREST, gl.NEAREST);
    this.texCaps = this.makeTex(gl.LINEAR, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  private makeTex(minF: number, magF: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minF);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magF);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return t;
  }

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.uniforms.get(p);
    if (!m) this.uniforms.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  resize(w: number, h: number): void {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  setGarment(image: TexImageSource, mesh: Pick<GarmentMesh, "triUVs" | "triLayers" | "parts">): void {
    const gl = this.gl;
    const uvs = mesh.triUVs;
    gl.bindTexture(gl.TEXTURE_2D, this.texParts);
    const { width, height, data } = mesh.parts;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, data);
    if (this.texGarment) gl.deleteTexture(this.texGarment);
    this.texGarment = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texGarment);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);

    gl.bindVertexArray(this.meshVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs.length * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, (uvs.length / 2) * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.triLayers, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.indexCount = uvs.length / 2;
  }

  clearGarment(): void {
    this.indexCount = 0;
  }

  setCategoryMask(m: CategoryMask | null): void {
    const gl = this.gl;
    this.hasCat = !!m;
    if (!m) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texCat);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, m.width, m.height, 0, gl.RED, gl.UNSIGNED_BYTE, m.data);
    this.catSize = { w: m.width, h: m.height };
  }

  setCapsules(c: HTMLCanvasElement | OffscreenCanvas): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texCaps);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c as TexImageSource);
  }

  render(frame: TexImageSource, positions: Float32Array | null, p: RenderParams, fade: Float32Array | null = null): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texVideo);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.useProgram(this.pVideo);
    gl.uniform1i(this.u(this.pVideo, "uVideo"), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (positions && this.texGarment && this.indexCount > 0 && p.opacity > 0.003) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.pMesh);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texGarment);
      gl.uniform1i(this.u(this.pMesh, "uGarment"), 1);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.texParts);
      gl.uniform1i(this.u(this.pMesh, "uParts"), 4);
      gl.uniform1i(this.u(this.pMesh, "uVideo"), 0);
      gl.uniform2f(this.u(this.pMesh, "uRes"), this.width, this.height);
      gl.uniform1f(this.u(this.pMesh, "uOpacity"), p.opacity);
      gl.uniform1f(this.u(this.pMesh, "uFolds"), p.folds);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texCat);
      gl.uniform1i(this.u(this.pMesh, "uCat"), 2);
      gl.uniform1f(this.u(this.pMesh, "uHasCat"), this.hasCat ? 1 : 0);
      gl.uniform1f(this.u(this.pMesh, "uLighting"), p.lighting);
      gl.uniform1f(this.u(this.pMesh, "uVideoLod"), Math.log2(Math.max(this.width, this.height) / 24));
      gl.uniform1f(this.u(this.pMesh, "uFineLod"), Math.max(0, Math.log2(Math.max(this.width, this.height) / 50)));
      gl.bindVertexArray(this.meshVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      if (fade) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fade);
      }
      gl.drawArrays(gl.TRIANGLES, 0, this.indexCount);

      if (p.occlusion && this.hasCat) {
        gl.useProgram(this.pOcc);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.texCat);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.texCaps);
        gl.uniform1i(this.u(this.pOcc, "uVideo"), 0);
        gl.uniform1i(this.u(this.pOcc, "uCat"), 2);
        gl.uniform1i(this.u(this.pOcc, "uCaps"), 3);
        gl.uniform2f(this.u(this.pOcc, "uCatTexel"), 1 / this.catSize.w, 1 / this.catSize.h);
        gl.uniform1f(this.u(this.pOcc, "uHairFace"), 1);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of [this.texVideo, this.texGarment, this.texCat, this.texCaps, this.texParts]) if (t) gl.deleteTexture(t);
    for (const b of [this.posBuf, this.uvBuf, this.fadeBuf, this.layerBuf]) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteVertexArray(this.meshVao);
    for (const p of [this.pVideo, this.pMesh, this.pOcc]) gl.deleteProgram(p);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
```

## src/shared/render/sleeveSegmentation.ts

```ts
/**
 * Decides, for any point of a garment image, how much it belongs to the left/right sleeve.
 *
 * Primary rule (uses the garment silhouette): in product photos sleeves are separated from
 * the torso by a transparent gap below the armpit. Scanning each row outward from the
 * torso side (hip anchor x), the first opaque run is torso and anything past the gap is
 * sleeve. Above the armpit (where sleeve and torso are joined) the cut is the line from the
 * armpit point to the shoulder anchor.
 *
 * Fallback (no gap found, e.g. arms pressed against the body): an angular rule around the
 * shoulder, which is less precise for sleeves that hang close to the torso.
 */
import type { Vec2 } from "../lib/types";
import type { AlphaGrid } from "./garmentMesh";
import { smoothstep, sleeveWeight, type ArmRest } from "./deform";

export interface SideSegmentation {
  mode: "gap" | "angular";
  armpit: Vec2 | null; // garment px
  /** Sleeve weight on the alpha grid; empty pixels carry their nearest garment pixel's value. */
  field: Float32Array;
  weight(p: Vec2): number;
}

const OPAQUE = 96;

/** Fill every NaN cell with the value of its nearest (BFS) non-NaN cell, in place. */
export function fillNearest(field: Float32Array, aw: number, ah: number): Float32Array {
  const queue = new Int32Array(aw * ah);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < field.length; i++) if (!Number.isNaN(field[i])) queue[qt++] = i;
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % aw;
    const y = (i - x) / aw;
    const v = field[i];
    if (x > 0 && Number.isNaN(field[i - 1])) (field[i - 1] = v), (queue[qt++] = i - 1);
    if (x < aw - 1 && Number.isNaN(field[i + 1])) (field[i + 1] = v), (queue[qt++] = i + 1);
    if (y > 0 && Number.isNaN(field[i - aw])) (field[i - aw] = v), (queue[qt++] = i - aw);
    if (y < ah - 1 && Number.isNaN(field[i + aw])) (field[i + aw] = v), (queue[qt++] = i + aw);
  }
  return field;
}

/** Bilinear sample of an alpha-grid field at pixel coordinates (pixel centres at +0.5). */
export function sampleField(field: Float32Array, aw: number, ah: number, px: number, py: number): number {
  const x = px - 0.5;
  const y = py - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const f = (xi: number, yi: number) => {
    const v = field[Math.min(ah - 1, Math.max(0, yi)) * aw + Math.min(aw - 1, Math.max(0, xi))];
    return Number.isNaN(v) ? 0 : v;
  };
  return f(x0, y0) * (1 - tx) * (1 - ty) + f(x0 + 1, y0) * tx * (1 - ty) + f(x0, y0 + 1) * (1 - tx) * ty + f(x0 + 1, y0 + 1) * tx * ty;
}

export function segmentSleeve(
  alpha: AlphaGrid,
  imageSize: [number, number],
  arm: ArmRest,
  hip: Vec2,
  outward: 1 | -1,
  shoulderWidth: number,
  blend: number,
): SideSegmentation {
  const [W, H] = imageSize;
  const sx = alpha.width / W;
  const sy = alpha.height / H;
  const aw = alpha.width;
  const at = (x: number, y: number) => alpha.data[y * aw + x] > OPAQUE;
  const hipX = Math.round(hip.x * sx);
  const shoulderRow = Math.max(0, Math.round(arm.shoulder.y * sy));
  const swA = shoulderWidth * sx;

  // Per-row gap [gapStart, gapEnd) in alpha coords, measured outward from hipX.
  const gapStart = new Float32Array(alpha.height).fill(NaN);
  const gapEnd = new Float32Array(alpha.height).fill(NaN);
  const torsoPresent = new Uint8Array(alpha.height);
  const inRange = (x: number) => x >= 0 && x < aw;
  // Ignore hairline seams (anti-aliasing between panels, stitching): a real armpit gap is
  // a few percent of the shoulder width at least.
  const minGap = Math.max(2, 0.03 * swA);
  for (let y = shoulderRow; y < alpha.height; y++) {
    let x = Math.min(aw - 1, Math.max(0, hipX));
    if (!at(x, y)) continue;
    torsoPresent[y] = 1;
    while (inRange(x + outward) && at(x + outward, y)) x += outward;
    const edge = x;
    x += outward;
    while (inRange(x) && !at(x, y)) x += outward;
    if (inRange(x) && Math.abs(x - edge) - 1 >= minGap) {
      gapStart[y] = edge + 0.5 * outward;
      gapEnd[y] = x - 0.5 * outward;
    }
  }

  // Armpit: first row (from the shoulder down) that starts a run of >= 3 gap rows.
  let armpitRow = -1;
  for (let y = shoulderRow; y < alpha.height - 3; y++) {
    if (!Number.isNaN(gapStart[y]) && !Number.isNaN(gapStart[y + 1]) && !Number.isNaN(gapStart[y + 2])) {
      armpitRow = y;
      break;
    }
  }
  // Rows below the torso hem where a (long) sleeve continues: first opaque x outward of hipX.
  let lastTorsoRow = -1;
  for (let y = 0; y < alpha.height; y++) if (torsoPresent[y]) lastTorsoRow = y;
  const sleeveStartBelow = new Float32Array(alpha.height).fill(NaN);
  for (let y = lastTorsoRow + 1; y < alpha.height; y++) {
    for (let x = Math.min(aw - 1, Math.max(0, hipX)); inRange(x); x += outward) {
      if (at(x, y)) {
        sleeveStartBelow[y] = x * outward;
        break;
      }
    }
  }

  /** Rule-based weight at alpha-grid coordinates (meaningful on opaque pixels). */
  const gapRule = (armpitRow: number) => {
    const A = { x: gapStart[armpitRow], y: armpitRow }; // alpha coords
    const S = { x: arm.shoulder.x * sx, y: arm.shoulder.y * sy };
    // Normal of the cut line A->S, oriented outward.
    const d = { x: S.x - A.x, y: S.y - A.y };
    const len = Math.hypot(d.x, d.y) || 1;
    let n = { x: -d.y / len, y: d.x / len };
    if (n.x * outward < 0) n = { x: -n.x, y: -n.y };
    const soft = Math.max(1, 0.04 * swA);

    return (x: number, y: number): number => {
      const row = Math.min(alpha.height - 1, Math.max(0, Math.floor(y)));
      // Above the shoulder anchor only points outward of it may follow the arm (keeps the
      // collar/neckline on the torso). Below it, the armpit cut line alone decides, so the
      // sleeve's outer edge near the shoulder gets a clean weight of 1.
      const lateral = y < S.y ? smoothstep(-0.04 * swA, 0.1 * swA, (x - S.x) * outward) : 1;
      if (y < armpitRow) {
        const sd = (x - A.x) * n.x + (y - A.y) * n.y;
        return smoothstep(-soft, soft, sd) * lateral;
      }
      if (!Number.isNaN(gapStart[row])) {
        const a = gapStart[row] * outward;
        const b = gapEnd[row] * outward;
        const xo = x * outward;
        // midpoint of the gap is the boundary; soften across the gap width
        const mid = (a + b) / 2;
        const half = Math.max(soft * 0.5, (b - a) / 2);
        return smoothstep(mid - half, mid + half, xo);
      }
      if (row > lastTorsoRow) {
        // Below the hem only a sleeve can remain; empty rows stay with the torso so the hem
        // edge isn't stretched when the arm moves.
        const start = sleeveStartBelow[row];
        if (Number.isNaN(start)) return 0;
        return smoothstep(start - 2 * soft, start, x * outward);
      }
      // Rows below the sleeve's end: torso only.
      return 0;
    };
  };
  const rule =
    armpitRow < 0
      ? (x: number, y: number) => sleeveWeight({ x: x / sx, y: y / sy }, arm, hip, outward, shoulderWidth, blend)
      : gapRule(armpitRow);

  // Weight field on the alpha grid: rule on garment pixels, then every transparent pixel
  // inherits the value of its nearest garment pixel, so a vertex in the empty space next to
  // a sleeve moves WITH the sleeve.
  const ah = alpha.height;
  const field = new Float32Array(aw * ah).fill(NaN);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (at(x, y)) field[y * aw + x] = rule(x + 0.5, y + 0.5);
  fillNearest(field, aw, ah);
  return {
    mode: armpitRow < 0 ? "angular" : "gap",
    armpit: armpitRow < 0 ? null : { x: gapStart[armpitRow] / sx, y: armpitRow / sy },
    field,
    weight: (p) => sampleField(field, aw, ah, p.x * sx, p.y * sy),
  };
}
```

## src/shared/tracking/bodyTracker.ts

```ts
import { LM, type PixelLandmark, type Vec2 } from "../lib/types";
import { OneEuro, OneEuro2D, OneEuroAngle } from "./oneEuro";

/** Smoothed body geometry in video pixel coordinates (un-mirrored frame). */
export interface BodyState {
  leftShoulder: Vec2;
  rightShoulder: Vec2;
  leftHip: Vec2;
  rightHip: Vec2;
  leftElbow: Vec2 | null;
  rightElbow: Vec2 | null;
  leftWrist: Vec2 | null;
  rightWrist: Vec2 | null;
  /** 0..1 how much each arm's elbow / wrist can be trusted (used to blend sleeve rotation). */
  leftArmConf: number;
  rightArmConf: number;
  leftForearmConf: number;
  rightForearmConf: number;
  /** Raw (lightly smoothed) hand points per side, for occlusion masks. */
  leftHand: Vec2[];
  rightHand: Vec2[];
  shoulderWidth: number;
  /** 0..1 overall torso tracking confidence. */
  confidence: number;
  hipsEstimated: boolean;
  /** Garment opacity after fade-in/out (0..1). */
  opacity: number;
  tracking: "searching" | "tracking" | "holding" | "lost";
}

export interface TrackerOptions {
  /** Below this shoulder visibility the pose is treated as unreliable. */
  minConfidence: number;
  /** Seconds to keep the last good pose before declaring tracking lost. */
  holdSeconds: number;
  /** Fade time constant in seconds. */
  fadeTau: number;
  /** 0 (responsive) .. 1 (very smooth). */
  smoothing: number;
}

const DEFAULTS: TrackerOptions = { minConfidence: 0.5, holdSeconds: 1.2, fadeTau: 0.12, smoothing: 0.5 };

// Typical MediaPipe landmark proportions, used until real hips have been seen.
const DEFAULT_HIP_WIDTH_RATIO = 0.68;
const DEFAULT_TORSO_LEN_RATIO = 1.32;

const rot = (v: Vec2, a: number): Vec2 => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});

const inFrame = (p: PixelLandmark, w: number, h: number, m = 0.02) =>
  p.x > -m * w && p.x < w * (1 + m) && p.y > -m * h && p.y < h * (1 + m);

/**
 * Turns noisy per-frame landmarks into a stable torso + arms state.
 *
 * Jitter strategy: the four torso points are NOT filtered independently. Instead we filter
 * a rigid frame (centre, rotation, log-scale) with a One Euro filter and filter the small
 * residual shape (in that frame's normalised coordinates) much more strongly. The garment
 * therefore moves smoothly as one piece while still adapting its shape.
 */
export class BodyTracker {
  opts: TrackerOptions;
  private centre = new OneEuro2D(1.2, 0.004);
  private angle = new OneEuroAngle(1.0, 0.3);
  private logScale = new OneEuro(0.8, 0.5);
  private shape = Array.from({ length: 4 }, () => new OneEuro2D(0.4, 0.02));
  private arms: Record<string, OneEuro2D> = {};
  private hand: Record<string, OneEuro2D> = {};
  private hipWidthRatio = DEFAULT_HIP_WIDTH_RATIO;
  private torsoLenRatio = DEFAULT_TORSO_LEN_RATIO;
  private lastGood: BodyState | null = null;
  private lastGoodTime = -Infinity;
  private lastTime: number | null = null;
  private opacity = 0;

  constructor(opts: Partial<TrackerOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.applySmoothing();
  }

  setSmoothing(s: number): void {
    this.opts.smoothing = Math.min(1, Math.max(0, s));
    this.applySmoothing();
  }

  private applySmoothing(): void {
    const s = this.opts.smoothing;
    // Map 0..1 to cutoff frequencies: higher smoothing => lower cutoff.
    const k = Math.pow(4, 1 - 2 * s); // 4 .. 0.25
    this.centre.setParams(1.2 * k, 0.004);
    this.angle.setMinCutoff(1.0 * k);
    this.logScale.minCutoff = 0.8 * k;
    for (const f of this.shape) f.setParams(0.4 * k, 0.02);
    for (const f of Object.values(this.arms)) f.setParams(1.5 * k, 0.01);
  }

  reset(): void {
    this.centre.reset();
    this.angle.reset();
    this.logScale.reset();
    this.shape.forEach((f) => f.reset());
    Object.values(this.arms).forEach((f) => f.reset());
    Object.values(this.hand).forEach((f) => f.reset());
    this.lastGood = null;
    this.lastGoodTime = -Infinity;
    this.hipWidthRatio = DEFAULT_HIP_WIDTH_RATIO;
    this.torsoLenRatio = DEFAULT_TORSO_LEN_RATIO;
  }

  private armFilter(key: string): OneEuro2D {
    if (!this.arms[key]) {
      const k = Math.pow(4, 1 - 2 * this.opts.smoothing);
      this.arms[key] = new OneEuro2D(1.5 * k, 0.01);
    }
    return this.arms[key];
  }

  private handFilter(key: string): OneEuro2D {
    return (this.hand[key] ??= new OneEuro2D(3.0, 0.02));
  }

  /**
   * @param landmarks 33 landmarks in pixel coords, or null when no person was detected
   * @param t seconds
   */
  update(landmarks: PixelLandmark[] | null, t: number, width: number, height: number): BodyState | null {
    const dt = this.lastTime === null ? 0 : Math.max(0, t - this.lastTime);
    this.lastTime = t;

    const ls = landmarks?.[LM.leftShoulder];
    const rs = landmarks?.[LM.rightShoulder];
    const shoulderConf = ls && rs ? Math.min(ls.visibility, rs.visibility) : 0;
    const good = !!landmarks && shoulderConf >= this.opts.minConfidence && inFrame(ls!, width, height) && inFrame(rs!, width, height);

    if (!good) {
      // Hold the last good pose briefly while fading out, then give up.
      this.opacity += (0 - this.opacity) * (1 - Math.exp(-dt / this.opts.fadeTau));
      if (this.lastGood && t - this.lastGoodTime < this.opts.holdSeconds) {
        return { ...this.lastGood, opacity: this.opacity, confidence: shoulderConf, tracking: "holding" };
      }
      if (this.lastGood) this.reset();
      return null;
    }

    const lm = landmarks!;
    const L = lm[LM.leftShoulder];
    const R = lm[LM.rightShoulder];
    const lh = lm[LM.leftHip];
    const rh = lm[LM.rightHip];

    const shoulderVec = { x: L.x - R.x, y: L.y - R.y };
    const sw = Math.hypot(shoulderVec.x, shoulderVec.y);
    // "down" is perpendicular to the shoulder line (image y grows downward). In an
    // un-mirrored frame the person's left shoulder is on the image right, so rotating
    // (R->L) by +90deg points down the torso.
    const down = { x: -shoulderVec.y / sw, y: shoulderVec.x / sw };
    const across = { x: shoulderVec.x / sw, y: shoulderVec.y / sw };
    const sc = { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 };

    const hipsVisible =
      lh.visibility > 0.5 && rh.visibility > 0.5 && inFrame(lh, width, height, 0) && inFrame(rh, width, height, 0);
    let hipL: Vec2;
    let hipR: Vec2;
    if (hipsVisible) {
      hipL = lh;
      hipR = rh;
      // Learn this person's proportions (slow EMA) for when hips leave the frame.
      const hw = Math.hypot(lh.x - rh.x, lh.y - rh.y) / sw;
      const hc = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
      const tl = ((hc.x - sc.x) * down.x + (hc.y - sc.y) * down.y) / sw;
      if (hw > 0.3 && hw < 1.2 && tl > 0.7 && tl < 2.2) {
        this.hipWidthRatio += (hw - this.hipWidthRatio) * 0.05;
        this.torsoLenRatio += (tl - this.torsoLenRatio) * 0.05;
      }
    } else {
      const hc = { x: sc.x + down.x * sw * this.torsoLenRatio, y: sc.y + down.y * sw * this.torsoLenRatio };
      const half = (sw * this.hipWidthRatio) / 2;
      hipL = { x: hc.x + across.x * half, y: hc.y + across.y * half };
      hipR = { x: hc.x - across.x * half, y: hc.y - across.y * half };
    }

    // ---- rigid frame + residual shape smoothing ----
    const pts = [L, R, hipL, hipR];
    const cRaw = { x: (L.x + R.x + hipL.x + hipR.x) / 4, y: (L.y + R.y + hipL.y + hipR.y) / 4 };
    const aRaw = Math.atan2(shoulderVec.y, shoulderVec.x);
    const c = this.centre.filter(cRaw, t);
    const a = this.angle.filter(aRaw, t);
    const s = Math.exp(this.logScale.filter(Math.log(sw), t));
    const smoothed = pts.map((p, i) => {
      const local = rot({ x: (p.x - cRaw.x) / sw, y: (p.y - cRaw.y) / sw }, -aRaw);
      const f = this.shape[i].filter(local, t);
      const back = rot(f, a);
      return { x: c.x + back.x * s, y: c.y + back.y * s };
    });

    const armPoint = (idx: number, key: string, minVis = 0.5): { p: Vec2 | null; conf: number } => {
      const p = lm[idx];
      const conf = Math.max(0, Math.min(1, (p.visibility - minVis * 0.6) / (1 - minVis * 0.6)));
      if (p.visibility < minVis * 0.6 || !inFrame(p, width, height, 0.1)) {
        this.armFilter(key).reset();
        return { p: null, conf: 0 };
      }
      return { p: this.armFilter(key).filter(p, t), conf };
    };
    const le = armPoint(LM.leftElbow, "le");
    const re = armPoint(LM.rightElbow, "re");
    const lw = armPoint(LM.leftWrist, "lw");
    const rw = armPoint(LM.rightWrist, "rw");

    const handPts = (ids: number[], side: string) =>
      ids
        .filter((i) => lm[i].visibility > 0.3)
        .map((i) => this.handFilter(`${side}${i}`).filter(lm[i], t));

    this.opacity += (1 - this.opacity) * (1 - Math.exp(-dt / this.opts.fadeTau));

    const state: BodyState = {
      leftShoulder: smoothed[0],
      rightShoulder: smoothed[1],
      leftHip: smoothed[2],
      rightHip: smoothed[3],
      leftElbow: le.p,
      rightElbow: re.p,
      leftWrist: lw.p,
      rightWrist: rw.p,
      leftArmConf: le.conf,
      rightArmConf: re.conf,
      leftForearmConf: Math.min(le.conf, lw.conf),
      rightForearmConf: Math.min(re.conf, rw.conf),
      leftHand: handPts([LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb], "l"),
      rightHand: handPts([LM.rightWrist, LM.rightPinky, LM.rightIndex, LM.rightThumb], "r"),
      shoulderWidth: s,
      confidence: hipsVisible ? Math.min(shoulderConf, (lh.visibility + rh.visibility) / 2) : shoulderConf * 0.85,
      hipsEstimated: !hipsVisible,
      opacity: this.opacity,
      tracking: "tracking",
    };
    this.lastGood = state;
    this.lastGoodTime = t;
    return state;
  }
}
```

## src/shared/tracking/oneEuro.ts

```ts
/**
 * One Euro filter (Casiez et al., CHI 2012): adaptive low-pass that removes jitter when a
 * signal is still but follows quickly when it moves fast.
 */
export class OneEuro {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(
    public minCutoff = 1.0,
    public beta = 0.007,
    public dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
  }

  get value(): number | null {
    return this.xPrev;
  }

  /** @param t timestamp in seconds */
  filter(x: number, t: number): number {
    if (this.xPrev === null || !Number.isFinite(this.xPrev)) {
      this.xPrev = x;
      this.tPrev = t;
      this.dxPrev = 0;
      return x;
    }
    const dt = Math.max(1e-3, t - this.tPrev);
    this.tPrev = t;
    const dx = (x - this.xPrev) / dt;
    const aD = OneEuro.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuro.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
}

/** Filter for an angle in radians; unwraps so a jump across ±π doesn't spin. */
export class OneEuroAngle {
  private f: OneEuro;
  private last: number | null = null;
  private unwrapped = 0;
  constructor(minCutoff = 1.0, beta = 0.5) {
    this.f = new OneEuro(minCutoff, beta);
  }
  reset(): void {
    this.f.reset();
    this.last = null;
  }
  setMinCutoff(c: number): void {
    this.f.minCutoff = c;
  }
  filter(a: number, t: number): number {
    if (this.last === null) {
      this.unwrapped = a;
    } else {
      let d = a - this.last;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.unwrapped += d;
    }
    this.last = a;
    return this.f.filter(this.unwrapped, t);
  }
}

export class OneEuro2D {
  readonly fx: OneEuro;
  readonly fy: OneEuro;
  constructor(minCutoff = 1.0, beta = 0.007) {
    this.fx = new OneEuro(minCutoff, beta);
    this.fy = new OneEuro(minCutoff, beta);
  }
  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
  setParams(minCutoff: number, beta: number): void {
    this.fx.minCutoff = this.fy.minCutoff = minCutoff;
    this.fx.beta = this.fy.beta = beta;
  }
  filter(p: { x: number; y: number }, t: number): { x: number; y: number } {
    return { x: this.fx.filter(p.x, t), y: this.fy.filter(p.y, t) };
  }
}
```

## src/shared/tracking/synthetic.ts

```ts
/**
 * Synthetic test scene: an animated 2D mannequin with exact landmarks and an exact
 * category mask. Used for automated render tests and as a no-camera demo. It exercises
 * tracking, smoothing, deformation, occlusion and rendering, but NOT the pose model.
 */
import { SEG, type CategoryMask, type PixelLandmark, type Vec2 } from "../lib/types";
import type { PoseProvider } from "./vision";

export interface SyntheticPose {
  centre: Vec2;
  sw: number;
  /** arm angles from straight-down, radians (positive = outward) */
  leftUpper: number;
  leftFore: number;
  rightUpper: number;
  rightFore: number;
  /** when true the left forearm crosses in front of the chest */
  crossLeft: boolean;
  /** visibility of everything (to simulate tracking loss) */
  visible: boolean;
}

export type SyntheticScript = "wave" | "static" | "cross" | "lost" | "raise" | "flex";

export function poseAt(tSec: number, script: SyntheticScript = "wave"): SyntheticPose {
  const base: SyntheticPose = {
    centre: { x: 640, y: 390 },
    sw: 200,
    leftUpper: 0.25,
    leftFore: 0.1,
    rightUpper: 0.25,
    rightFore: 0.1,
    crossLeft: false,
    visible: true,
  };
  if (script === "static") return base;
  if (script === "cross") return { ...base, crossLeft: true };
  if (script === "raise") return { ...base, leftUpper: 1.45, leftFore: 1.9, rightUpper: 0.9, rightFore: 0.9 };
  // both upper arms out to the sides, forearms pointing up (like a "flex")
  if (script === "flex") return { ...base, leftUpper: 1.35, leftFore: 3.0, rightUpper: 1.35, rightFore: 3.0 };
  if (script === "lost") return { ...base, visible: Math.floor(tSec) % 2 === 0 };
  const s = Math.sin(tSec * 1.3);
  return {
    ...base,
    centre: { x: 640 + 90 * Math.sin(tSec * 0.5), y: 390 + 10 * Math.sin(tSec * 0.9) },
    sw: 200 * (1 + 0.15 * Math.sin(tSec * 0.35)),
    leftUpper: 0.3 + 1.1 * (0.5 + 0.5 * s),
    leftFore: 0.3 + 1.6 * (0.5 + 0.5 * s),
    rightUpper: 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(tSec * 0.8 + 1)),
    rightFore: 0.2,
  };
}

interface Skeleton {
  ls: Vec2;
  rs: Vec2;
  lh: Vec2;
  rh: Vec2;
  le: Vec2;
  re: Vec2;
  lw: Vec2;
  rw: Vec2;
  head: Vec2;
}

function skeleton(p: SyntheticPose): Skeleton {
  const { centre: c, sw } = p;
  const ls = { x: c.x + sw / 2, y: c.y - sw * 0.6 };
  const rs = { x: c.x - sw / 2, y: c.y - sw * 0.6 };
  const lh = { x: c.x + sw * 0.34, y: c.y + sw * 0.7 };
  const rh = { x: c.x - sw * 0.34, y: c.y + sw * 0.7 };
  const ua = sw * 0.62;
  const fa = sw * 0.58;
  const limb = (o: Vec2, ang: number, len: number, side: 1 | -1) => ({
    x: o.x + side * Math.sin(ang) * len,
    y: o.y + Math.cos(ang) * len,
  });
  const le = limb(ls, p.leftUpper, ua, 1);
  const re = limb(rs, p.rightUpper, ua, -1);
  let lw = limb(le, p.leftFore, fa, 1);
  if (p.crossLeft) lw = { x: c.x - sw * 0.25, y: c.y - sw * 0.05 };
  const rw = limb(re, p.rightFore, fa, -1);
  return { ls, rs, lh, rh, le, re, lw, rw, head: { x: c.x, y: c.y - sw * 1.15 } };
}

export class SyntheticScene implements PoseProvider {
  readonly label = "Synthetic mannequin (no camera, no pose model)";
  readonly canSegment = true;
  readonly canvas: HTMLCanvasElement;
  private maskCanvas: HTMLCanvasElement;
  private current: SyntheticPose = poseAt(0);
  private t0 = performance.now();
  private noiseSeed = 1;

  constructor(
    public script: SyntheticScript = "wave",
    public width = 1280,
    public height = 720,
    public noisePx = 2.5,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = width / 4;
    this.maskCanvas.height = height / 4;
  }

  /** Advance the animation and draw the frame. Returns the time used, in seconds. */
  drawFrame(tSec?: number): number {
    const t = tSec ?? (performance.now() - this.t0) / 1000;
    this.current = poseAt(t, this.script);
    const ctx = this.canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, "#5d6470");
    g.addColorStop(1, "#2f343c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.current.visible) this.paint(ctx, false, 1);
    const m = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
    m.fillStyle = "rgb(0,0,0)";
    m.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    if (this.current.visible) this.paint(m, true, 0.25);
    return t;
  }

  private paint(ctx: CanvasRenderingContext2D, mask: boolean, k: number): void {
    const s = skeleton(this.current);
    const sw = this.current.sw;
    // In the mask pass each class gets its own colour channel so anti-aliased edges can't
    // decode to a wrong class (they just fall below the threshold).
    const MASK_COL: Record<number, string> = {
      [SEG.bodySkin]: "rgb(255,0,0)",
      [SEG.faceSkin]: "rgb(0,255,0)",
      [SEG.hair]: "rgb(0,0,255)",
      [SEG.clothes]: "rgb(255,255,0)",
    };
    const col = (cls: number, color: string) => (mask ? MASK_COL[cls] : color);
    ctx.save();
    ctx.scale(k, k);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const limb = (a: Vec2, b: Vec2, w: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const skin = col(SEG.bodySkin, "#c99a7b");
    // right arm (behind nothing)
    limb(s.rs, s.re, sw * 0.24, skin);
    limb(s.re, s.rw, sw * 0.2, skin);
    // neck + head
    limb({ x: this.current.centre.x, y: s.ls.y }, s.head, sw * 0.28, skin);
    ctx.fillStyle = col(SEG.faceSkin, "#d4a585");
    ctx.beginPath();
    ctx.ellipse(s.head.x, s.head.y, sw * 0.32, sw * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col(SEG.hair, "#2a1d16");
    ctx.beginPath();
    ctx.ellipse(s.head.x, s.head.y - sw * 0.18, sw * 0.34, sw * 0.26, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    // torso in the user's own (grey) shirt
    ctx.fillStyle = col(SEG.clothes, "#8c949c");
    ctx.beginPath();
    ctx.moveTo(s.rs.x - sw * 0.08, s.rs.y - sw * 0.04);
    ctx.lineTo(s.ls.x + sw * 0.08, s.ls.y - sw * 0.04);
    ctx.lineTo(s.lh.x + sw * 0.12, s.lh.y + sw * 0.2);
    ctx.lineTo(s.rh.x - sw * 0.12, s.rh.y + sw * 0.2);
    ctx.closePath();
    ctx.fill();
    if (!mask) {
      // a plaid pattern on the user's own shirt, to check it doesn't print through garments
      ctx.save();
      ctx.clip();
      const step = sw * 0.09;
      ctx.lineWidth = sw * 0.025;
      ctx.strokeStyle = "rgba(150,20,30,0.75)";
      for (let x = s.rh.x - sw; x < s.lh.x + sw; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, s.rs.y - sw);
        ctx.lineTo(x, s.rh.y + sw);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(20,20,40,0.6)";
      for (let y = s.rs.y - sw; y < s.rh.y + sw; y += step) {
        ctx.beginPath();
        ctx.moveTo(s.rh.x - sw, y);
        ctx.lineTo(s.lh.x + sw, y);
        ctx.stroke();
      }
      ctx.restore();
    }
    // left arm (may cross in front of the torso)
    limb(s.ls, s.le, sw * 0.24, skin);
    limb(s.le, s.lw, sw * 0.2, skin);
    ctx.fillStyle = skin;
    for (const w of [s.lw, s.rw]) {
      ctx.beginPath();
      ctx.arc(w.x, w.y, sw * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private noise(): number {
    this.noiseSeed = (this.noiseSeed * 16807) % 2147483647;
    return (this.noiseSeed / 2147483647 - 0.5) * 2 * this.noisePx;
  }

  detect(): PixelLandmark[] | null {
    if (!this.current.visible) return null;
    const s = skeleton(this.current);
    const lm: PixelLandmark[] = Array.from({ length: 33 }, () => ({ ...s.head, visibility: 0.99 }));
    const put = (i: number, p: Vec2, v = 0.98) => (lm[i] = { x: p.x + this.noise(), y: p.y + this.noise(), visibility: v });
    put(11, s.ls);
    put(12, s.rs);
    put(13, s.le);
    put(14, s.re);
    put(15, s.lw);
    put(16, s.rw);
    for (const i of [17, 19, 21]) put(i, { x: s.lw.x, y: s.lw.y + this.current.sw * 0.1 });
    for (const i of [18, 20, 22]) put(i, { x: s.rw.x, y: s.rw.y + this.current.sw * 0.1 });
    put(23, s.lh);
    put(24, s.rh);
    return lm;
  }

  segment(): CategoryMask | null {
    const m = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
    const { width, height } = this.maskCanvas;
    const rgba = m.getImageData(0, 0, width, height).data;
    const data = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) {
      const r = rgba[4 * i];
      const g = rgba[4 * i + 1];
      const b = rgba[4 * i + 2];
      data[i] =
        r > 127 && g > 127 ? SEG.clothes : r > 127 ? SEG.bodySkin : g > 127 ? SEG.faceSkin : b > 127 ? SEG.hair : SEG.background;
    }
    return { width, height, data };
  }

  async downgrade(): Promise<boolean> {
    return false;
  }

  close(): void {}
}
```

## src/shared/tracking/vision.ts

```ts
import { FilesetResolver, ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { CategoryMask, PixelLandmark } from "../lib/types";

export type Delegate = "GPU" | "CPU";
export type DelegatePref = Delegate | "auto";
export type PoseModel = "full" | "lite";

/** Anything that can turn a frame into landmarks (MediaPipe, or the synthetic test scene). */
export interface PoseProvider {
  readonly label: string;
  readonly canSegment: boolean;
  detect(frame: TexImageSource & { width?: number }, width: number, height: number, tsMs: number): PixelLandmark[] | null;
  segment(frame: TexImageSource, tsMs: number): CategoryMask | null;
  /** Switch to a cheaper configuration. Returns false when nothing cheaper exists. */
  downgrade(): Promise<boolean>;
  close(): void;
}

export const MODEL_BASE = "/static/models/mediapipe";
export const WASM_BASE = "/mediapipe/wasm";

const poseUrl = (m: PoseModel) => `${MODEL_BASE}/pose_landmarker_${m}.task`;
const SEG_URL = `${MODEL_BASE}/selfie_multiclass_256x256.tflite`;

async function urlExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

export class MediaPipeVision implements PoseProvider {
  private lastTs = 0;
  private constructor(
    private pose: PoseLandmarker,
    private seg: ImageSegmenter | null,
    public delegate: Delegate,
    public poseModel: PoseModel,
    private fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    private liteAvailable: boolean,
  ) {}

  get label(): string {
    return `MediaPipe pose ${this.poseModel} · ${this.delegate}${this.seg ? " · segmentation" : ""}`;
  }

  get canSegment(): boolean {
    return this.seg !== null;
  }

  static async create(opts: {
    delegate: DelegatePref;
    poseModel: PoseModel;
    segmentation: boolean;
    onProgress?: (msg: string) => void;
  }): Promise<MediaPipeVision> {
    const p = opts.onProgress ?? (() => {});
    p("Loading MediaPipe runtime (local WASM)…");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const [fullOk, liteOk, segOk] = await Promise.all([
      urlExists(poseUrl("full")),
      urlExists(poseUrl("lite")),
      urlExists(SEG_URL),
    ]);
    let model: PoseModel = opts.poseModel;
    if (model === "full" && !fullOk && liteOk) model = "lite";
    if (model === "lite" && !liteOk && fullOk) model = "full";
    if (!fullOk && !liteOk) {
      throw new Error(
        "Pose model files are missing. Run the download_models script once while online (see README → Setup).",
      );
    }
    const delegates: Delegate[] = opts.delegate === "auto" ? ["GPU", "CPU"] : [opts.delegate];
    let lastErr: unknown = null;
    for (const delegate of delegates) {
      try {
        p(`Loading pose model (${model}, ${delegate})…`);
        const pose = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: poseUrl(model), delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        let seg: ImageSegmenter | null = null;
        if (opts.segmentation && segOk) {
          try {
            p(`Loading segmentation model (${delegate})…`);
            seg = await ImageSegmenter.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: SEG_URL, delegate },
              runningMode: "VIDEO",
              outputCategoryMask: true,
              outputConfidenceMasks: false,
            });
          } catch (e) {
            console.warn("segmentation unavailable", e);
          }
        }
        return new MediaPipeVision(pose, seg, delegate, model, fileset, liteOk);
      } catch (e) {
        console.warn(`MediaPipe ${delegate} delegate failed`, e);
        lastErr = e;
      }
    }
    throw new Error(`Could not start pose tracking: ${String(lastErr)}`);
  }

  private ts(tsMs: number): number {
    // MediaPipe requires strictly increasing timestamps per task.
    this.lastTs = Math.max(this.lastTs + 1, Math.round(tsMs));
    return this.lastTs;
  }

  detect(frame: TexImageSource, width: number, height: number, tsMs: number): PixelLandmark[] | null {
    const res = this.pose.detectForVideo(frame as HTMLVideoElement, this.ts(tsMs));
    const lm = res.landmarks?.[0];
    if (!lm) return null;
    return lm.map((p) => ({ x: p.x * width, y: p.y * height, visibility: p.visibility ?? 0 }));
  }

  segment(frame: TexImageSource, tsMs: number): CategoryMask | null {
    if (!this.seg) return null;
    let out: CategoryMask | null = null;
    this.seg.segmentForVideo(frame as HTMLVideoElement, this.ts(tsMs), (r) => {
      const m = r.categoryMask;
      if (m) {
        // Copy: the mask's memory is only valid inside this callback.
        out = { width: m.width, height: m.height, data: new Uint8Array(m.getAsUint8Array()) };
      }
    });
    return out;
  }

  async downgrade(): Promise<boolean> {
    if (this.poseModel === "full" && this.liteAvailable) {
      const pose = await PoseLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetPath: poseUrl("lite"), delegate: this.delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      this.pose.close();
      this.pose = pose;
      this.poseModel = "lite";
      return true;
    }
    if (this.seg) {
      this.seg.close();
      this.seg = null;
      return true;
    }
    return false;
  }

  close(): void {
    this.pose.close();
    this.seg?.close();
  }
}
```

## src/shared/tryon/autofit.ts

```ts
/**
 * Auto-fit: measures where the person's shoulder OUTLINE is relative to the pose's
 * shoulder JOINT landmarks, using the segmentation mask, so the garment's shoulder-seam
 * corner can be placed on the real shoulder instead of a fixed guess.
 *
 * Per side: walk up from the landmark through person pixels to find the shoulder top, and
 * walk outward along the landmark's row to find the shoulder's outer edge. The seam corner
 * lies just inside the box corner (outer, top) of a rounded shoulder.
 */
import type { CategoryMask } from "../lib/types";
import type { BodyState } from "../tracking/bodyTracker";

export interface ShoulderFit {
  shoulderOut: number; // shoulder-widths
  shoulderUp: number;
}

const CORNER = 0.85; // seam sits slightly inside the bounding-box corner of the shoulder
const isPerson = (c: number) => c !== 0; // any class except background (hair included: it lies on the shoulder)

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** One measurement from one frame, or null when the pose isn't suitable (arms raised, edge of frame…). */
export function measureShoulders(mask: CategoryMask, frameW: number, frameH: number, body: BodyState): ShoulderFit | null {
  const sx = mask.width / frameW;
  const sy = mask.height / frameH;
  const sw = body.shoulderWidth;
  if (sw * sx < 8) return null; // person too small in the mask to measure
  const at = (x: number, y: number) => {
    const xi = Math.round(x * sx);
    const yi = Math.round(y * sy);
    if (xi < 0 || yi < 0 || xi >= mask.width || yi >= mask.height) return -1;
    return mask.data[yi * mask.width + xi];
  };
  const outs: number[] = [];
  const ups: number[] = [];
  const sides = [
    { s: body.leftShoulder, e: body.leftElbow, dir: 1 },
    { s: body.rightShoulder, e: body.rightElbow, dir: -1 },
  ];
  // the "outward" direction along the shoulder line, and "up" perpendicular to it
  const ax = (body.leftShoulder.x - body.rightShoulder.x) / sw;
  const ay = (body.leftShoulder.y - body.rightShoulder.y) / sw;
  const step = 1 / Math.max(sx, sy);
  for (const { s, e, dir } of sides) {
    // arms must hang down, otherwise the arm itself extends the "shoulder" outward
    if (!e || e.y < s.y + 0.4 * sw) return null;
    if (!isPerson(at(s.x, s.y))) return null;
    const ux = ay;
    const uy = -ax;
    // up: several columns around the landmark
    const tops: number[] = [];
    for (const off of [-0.04, 0, 0.04]) {
      const bx = s.x + dir * ax * off * sw;
      const by = s.y + dir * ay * off * sw;
      let d = 0;
      while (d < 0.45 * sw && isPerson(at(bx + ux * d, by + uy * d))) d += step;
      if (d >= 0.45 * sw || at(bx + ux * d, by + uy * d) === -1) return null; // ran off the frame / into the head
      tops.push(d);
    }
    // outward: several rows around the landmark
    const outsSide: number[] = [];
    for (const off of [-0.02, 0.03, 0.08]) {
      const bx = s.x - ux * off * sw;
      const by = s.y - uy * off * sw;
      let d = 0;
      while (d < 0.45 * sw && isPerson(at(bx + dir * ax * d, by + dir * ay * d))) d += step;
      if (d >= 0.45 * sw || at(bx + dir * ax * d, by + dir * ay * d) === -1) return null;
      outsSide.push(d);
    }
    ups.push((median(tops) / sw) * CORNER);
    outs.push((median(outsSide) / sw) * CORNER);
  }
  const fit = { shoulderOut: (outs[0] + outs[1]) / 2, shoulderUp: (ups[0] + ups[1]) / 2 };
  // reject implausible values (segmentation glitches, loose hair, bags on the shoulder)
  if (fit.shoulderOut < -0.05 || fit.shoulderOut > 0.35 || fit.shoulderUp < 0 || fit.shoulderUp > 0.3) return null;
  return fit;
}

/** Robust combination of several per-frame measurements. */
export function combineFits(samples: ShoulderFit[]): ShoulderFit | null {
  if (samples.length < 5) return null;
  return { shoulderOut: median(samples.map((s) => s.shoulderOut)), shoulderUp: median(samples.map((s) => s.shoulderUp)) };
}
```

## src/shared/tryon/camera.ts

```ts
export interface CameraInfo {
  deviceId: string;
  label: string;
}

export class CameraError extends Error {
  constructor(
    message: string,
    readonly kind: "insecure" | "unsupported" | "denied" | "notfound" | "busy" | "constraints" | "unknown",
  ) {
    super(message);
  }
}

export function describeCameraError(e: unknown): CameraError {
  if (e instanceof CameraError) return e;
  const name = (e as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return new CameraError(
        "Camera permission was denied. Click the camera icon in the address bar, allow access for this site, then press Start camera again.",
        "denied",
      );
    case "NotFoundError":
    case "OverconstrainedError":
      return name === "NotFoundError"
        ? new CameraError("No camera was found. Connect a webcam and press Refresh cameras.", "notfound")
        : new CameraError("The selected camera can't provide the requested resolution. Try another camera.", "constraints");
    case "NotReadableError":
    case "AbortError":
      return new CameraError(
        "The camera is in use by another application (Teams, Zoom, OBS…) or the driver failed. Close the other app and retry.",
        "busy",
      );
    default:
      return new CameraError(`Could not start the camera: ${String((e as Error)?.message ?? e)}`, "unknown");
  }
}

export async function listCameras(): Promise<CameraInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export async function startCamera(video: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError(
      "Camera access needs a secure context. Open the app at http://localhost or http://127.0.0.1, not a LAN IP.",
      "insecure",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("This browser does not support camera access.", "unsupported");
  }
  const video720 = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }),
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: video720, audio: false });
  } catch (e) {
    if ((e as { name?: string }).name === "OverconstrainedError") {
      stream = await navigator.mediaDevices
        .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false })
        .catch((e2) => {
          throw describeCameraError(e2);
        });
    } else {
      throw describeCameraError(e);
    }
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  if (!video.videoWidth) {
    await new Promise<void>((res) => video.addEventListener("loadedmetadata", () => res(), { once: true }));
  }
  return stream;
}

export function stopCamera(video: HTMLVideoElement | null, stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
  if (!video) return;
  video.pause();
  video.srcObject = null;
}
```

## src/shared/tryon/engine.ts

```ts
/**
 * Per-frame pipeline: frame -> pose -> (segmentation) -> smoothing -> mesh deformation ->
 * WebGL compositing. Runs on the main thread: MediaPipe's GPU delegate and our WebGL
 * renderer both need a GL context, and measured stage timings are shown in the HUD so the
 * bottleneck is visible before deciding to move work elsewhere.
 */
import { garmentUrl } from "../lib/api";
import type { CategoryMask, Garment, PixelLandmark } from "../lib/types";
import { CapsulePainter } from "../render/occlusion";
import { alphaGridFromImage, DEFAULT_CALIBRATION, GarmentMesh, type Calibration } from "../render/garmentMesh";
import { Renderer } from "../render/renderer";
import { BodyTracker, type BodyState } from "../tracking/bodyTracker";
import type { PoseProvider } from "../tracking/vision";
import { combineFits, measureShoulders, type ShoulderFit } from "./autofit";

export interface FrameSource {
  /** element passed to the pose model and uploaded as the camera texture */
  readonly element: HTMLVideoElement | HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  /** called before processing; synthetic sources draw their frame here */
  prepare?(tSec: number): void;
}

export interface StageTimes {
  pose: number;
  seg: number;
  track: number;
  deform: number;
  render: number;
  total: number;
}

export interface EngineStats {
  fps: number;
  times: StageTimes;
  /** capture -> composited, when the browser reports capture time (Chrome webcams) */
  latencyMs: number | null;
  tracking: BodyState["tracking"] | "searching";
  confidence: number;
  hipsEstimated: boolean;
  segInterval: number;
  provider: string;
  qualityNote: string | null;
  frameSize: [number, number];
}

export interface EngineOptions {
  occlusion: boolean;
  folds: number;
  lighting: number;
  showSkeleton: boolean;
  adaptive: boolean;
}

const EMA = 0.1;

export class TryOnEngine {
  private renderer: Renderer;
  private tracker = new BodyTracker();
  private capsules = new CapsulePainter();
  private source: FrameSource | null = null;
  private vision: PoseProvider | null = null;
  private garment: Garment | null = null;
  private mesh: GarmentMesh | null = null;
  private running = false;
  private rafId = 0;
  private rvfcId = 0;
  private frameNo = 0;
  private lastFrameTime = 0;
  private fpsEma = 0;
  private times: StageTimes = { pose: 0, seg: 0, track: 0, deform: 0, render: 0, total: 0 };
  private latencyEma: number | null = null;
  private segInterval = 2;
  private lastMask: CategoryMask | null = null;
  private slowSince: number | null = null;
  private downgrading = false;
  private qualityNote: string | null = null;
  private lastStatsEmit = 0;
  private lastBody: BodyState | null = null;
  private lastVideoTime = -1;
  private fitCapture: {
    samples: ShoulderFit[];
    tries: number;
    until: number;
    resolve: (f: ShoulderFit | null) => void;
  } | null = null;
  /**
   * Called with every processed frame's raw landmarks and (forced, every-frame) segmentation
   * mask while set. Used by the size scan. Adaptive quality downgrades pause meanwhile.
   */
  scanTap: ((f: { landmarks: PixelLandmark[] | null; mask: CategoryMask | null; width: number; height: number; tMs: number }) => void) | null = null;
  calibration: Calibration = { ...DEFAULT_CALIBRATION };
  options: EngineOptions = { occlusion: true, folds: 0.3, lighting: 0.3, showSkeleton: false, adaptive: true };
  onStats: (s: EngineStats) => void = () => {};
  onError: (e: Error) => void = (e) => console.error(e);

  constructor(
    glCanvas: HTMLCanvasElement,
    private overlay: HTMLCanvasElement | null = null,
  ) {
    this.renderer = new Renderer(glCanvas);
  }

  setSource(src: FrameSource | null): void {
    this.source = src;
    this.tracker.reset();
    this.lastVideoTime = -1;
  }

  setVision(v: PoseProvider | null): void {
    this.vision?.close();
    this.vision = v;
    this.lastMask = null;
    this.renderer.setCategoryMask(null);
    this.qualityNote = null;
  }

  setSmoothing(s: number): void {
    this.tracker.setSmoothing(s);
  }

  recenter(): void {
    this.tracker.reset();
    this.calibration = { ...DEFAULT_CALIBRATION };
  }

  async setGarment(g: Garment | null): Promise<void> {
    this.garment = g;
    if (!g) {
      this.mesh = null;
      this.renderer.clearGarment();
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = garmentUrl(g.views.front);
    await img.decode();
    if (this.garment !== g) return; // a newer selection won the race
    const mesh = new GarmentMesh(g, alphaGridFromImage(img));
    this.mesh = mesh;
    this.renderer.setGarment(img, mesh);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    const el = this.source?.element;
    if (el instanceof HTMLVideoElement && "cancelVideoFrameCallback" in el && this.rvfcId) {
      el.cancelVideoFrameCallback(this.rvfcId);
    }
  }

  dispose(): void {
    this.stop();
    this.vision?.close();
    this.renderer.dispose();
  }

  private schedule(): void {
    if (!this.running) return;
    const el = this.source?.element;
    if (el instanceof HTMLVideoElement && "requestVideoFrameCallback" in el) {
      // Fires once per NEW camera frame, so we never process a stale/duplicate frame.
      this.rvfcId = el.requestVideoFrameCallback((now, meta) => this.tick(now, meta.captureTime ?? null));
    } else {
      this.rafId = requestAnimationFrame((now) => this.tick(now, null));
    }
  }

  /** Process exactly one frame now (used by tests and by the synthetic source). */
  step(nowMs = performance.now(), captureTime: number | null = null): void {
    this.tick(nowMs, captureTime, false);
  }

  private tick(now: number, captureTime: number | null, reschedule = true): void {
    try {
      this.process(now, captureTime);
    } catch (e) {
      this.onError(e as Error);
    }
    if (reschedule) this.schedule();
  }

  private process(now: number, captureTime: number | null): void {
    const src = this.source;
    if (!src || src.width === 0 || src.height === 0) return;
    const el = src.element;
    if (el instanceof HTMLVideoElement) {
      if (el.readyState < 2) return;
      if (el.currentTime === this.lastVideoTime && !("requestVideoFrameCallback" in el)) return;
      this.lastVideoTime = el.currentTime;
    }
    const t0 = performance.now();
    src.prepare?.(now / 1000);
    this.renderer.resize(src.width, src.height);

    let landmarks = null;
    if (this.vision) landmarks = this.vision.detect(el, src.width, src.height, now);
    const t1 = performance.now();

    const wantSeg =
      !!this.vision?.canSegment &&
      (this.fitCapture !== null || this.scanTap !== null || (this.options.occlusion && this.frameNo % this.segInterval === 0));
    if (wantSeg) {
      this.lastMask = this.vision!.segment(el, now + 0.5);
      this.renderer.setCategoryMask(this.lastMask);
    }
    const t2 = performance.now();
    this.scanTap?.({ landmarks, mask: wantSeg ? this.lastMask : null, width: src.width, height: src.height, tMs: now });

    const body = this.tracker.update(landmarks, now / 1000, src.width, src.height);
    this.lastBody = body;
    if (this.fitCapture) this.collectFit(body, wantSeg ? this.lastMask : null, src.width, src.height, now);
    const t3 = performance.now();

    let positions: Float32Array | null = null;
    if (body && this.mesh) positions = this.mesh.deform(body, this.calibration);
    const triPositions = positions && this.mesh ? this.mesh.triPositions : null;
    if (this.options.occlusion && this.lastMask && this.garment) {
      this.renderer.setCapsules(this.capsules.paint(body, src.width, src.height, this.garment.sleeve));
    }
    const t4 = performance.now();

    this.renderer.render(el, triPositions, {
      opacity: body?.opacity ?? 0,
      folds: this.options.folds,
      lighting: this.options.lighting,
      occlusion: this.options.occlusion && !!this.lastMask,
    }, triPositions && this.mesh ? this.mesh.triFade : null);
    this.drawOverlay(body, positions);
    const t5 = performance.now();

    // ---- metrics ----
    const sample: StageTimes = {
      pose: t1 - t0,
      seg: t2 - t1,
      track: t3 - t2,
      deform: t4 - t3,
      render: t5 - t4,
      total: t5 - t0,
    };
    if (wantSeg) this.times.seg = this.times.seg * (1 - EMA) + sample.seg * EMA;
    for (const k of ["pose", "track", "deform", "render", "total"] as const) {
      this.times[k] = this.frameNo === 0 ? sample[k] : this.times[k] * (1 - EMA) + sample[k] * EMA;
    }
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    if (dt > 0 && dt < 1000) this.fpsEma = this.fpsEma === 0 ? 1000 / dt : this.fpsEma * 0.9 + (1000 / dt) * 0.1;
    if (captureTime !== null) {
      const lat = performance.now() - captureTime;
      if (lat > 0 && lat < 2000) this.latencyEma = this.latencyEma === null ? lat : this.latencyEma * 0.9 + lat * 0.1;
    }
    this.frameNo++;
    this.adapt(now);

    if (now - this.lastStatsEmit > 250) {
      this.lastStatsEmit = now;
      this.onStats({
        fps: this.fpsEma,
        times: { ...this.times },
        latencyMs: this.latencyEma,
        tracking: body?.tracking ?? "searching",
        confidence: body?.confidence ?? 0,
        hipsEstimated: body?.hipsEstimated ?? false,
        segInterval: this.vision?.canSegment && this.options.occlusion ? this.segInterval : 0,
        provider: this.vision?.label ?? "no tracker",
        qualityNote: this.qualityNote,
        frameSize: [src.width, src.height],
      });
    }
  }

  /**
   * Measure the person's shoulder outline over the next frames (needs segmentation) and
   * resolve with the fitted seam offsets, or null if no good measurement was possible
   * (arms raised, out of frame, no segmentation model).
   */
  autoFit(seconds = 3): Promise<ShoulderFit | null> {
    this.fitCapture?.resolve(null);
    if (!this.vision?.canSegment) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.fitCapture = { samples: [], tries: 0, until: performance.now() + seconds * 1000, resolve };
    });
  }

  private collectFit(body: BodyState | null, mask: CategoryMask | null, w: number, h: number, now: number): void {
    const c = this.fitCapture!;
    if (body && mask && body.tracking === "tracking") {
      c.tries++;
      const m = measureShoulders(mask, w, h, body);
      if (m) c.samples.push(m);
    }
    if (c.samples.length >= 12 || now > c.until) {
      this.fitCapture = null;
      c.resolve(combineFits(c.samples));
    }
  }

  /** Measured-bottleneck adaptation: segment less often, then use a lighter pose model. */
  private adapt(now: number): void {
    if (!this.options.adaptive || !this.vision || this.downgrading || this.scanTap) return;
    const budget = 1000 / 24;
    const perFrame = this.times.pose + this.times.track + this.times.deform + this.times.render + this.times.seg / this.segInterval;
    if (perFrame > budget) {
      this.slowSince ??= now;
      if (now - this.slowSince > 2500) {
        this.slowSince = null;
        if (this.vision.canSegment && this.times.seg > 4 && this.segInterval < 6) {
          this.segInterval += 2;
          this.qualityNote = `Segmentation every ${this.segInterval} frames to keep up`;
        } else {
          this.downgrading = true;
          this.vision
            .downgrade()
            .then((ok) => {
              if (ok) this.qualityNote = `Switched to a lighter configuration: ${this.vision?.label}`;
            })
            .finally(() => (this.downgrading = false));
        }
      }
    } else {
      this.slowSince = null;
    }
  }

  private drawOverlay(body: BodyState | null, positions: Float32Array | null): void {
    const o = this.overlay;
    if (!o) return;
    const ctx = o.getContext("2d")!;
    if (!this.options.showSkeleton) {
      if (o.width) ctx.clearRect(0, 0, o.width, o.height);
      return;
    }
    const src = this.source!;
    if (o.width !== src.width || o.height !== src.height) {
      o.width = src.width;
      o.height = src.height;
    }
    ctx.clearRect(0, 0, o.width, o.height);
    if (!body) return;
    if (positions && this.mesh) {
      ctx.strokeStyle = "rgba(120,220,255,0.35)";
      ctx.lineWidth = 1;
      const idx = this.mesh.indices;
      ctx.beginPath();
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 2;
        const b = idx[i + 1] * 2;
        const c = idx[i + 2] * 2;
        ctx.moveTo(positions[a], positions[a + 1]);
        ctx.lineTo(positions[b], positions[b + 1]);
        ctx.lineTo(positions[c], positions[c + 1]);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "#ffcf5a";
    ctx.fillStyle = "#ffcf5a";
    ctx.lineWidth = 3;
    const line = (pts: ({ x: number; y: number } | null)[]) => {
      ctx.beginPath();
      let started = false;
      for (const p of pts) {
        if (!p) {
          started = false;
          continue;
        }
        if (started) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        started = true;
      }
      ctx.stroke();
    };
    line([body.rightShoulder, body.leftShoulder, body.leftHip, body.rightHip, body.rightShoulder]);
    line([body.leftShoulder, body.leftElbow, body.leftWrist]);
    line([body.rightShoulder, body.rightElbow, body.rightWrist]);
    if (body.hipsEstimated) {
      ctx.fillText("hips estimated", body.leftHip.x + 8, body.leftHip.y);
    }
  }

  get body(): BodyState | null {
    return this.lastBody;
  }
}
```

