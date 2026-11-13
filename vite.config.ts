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
