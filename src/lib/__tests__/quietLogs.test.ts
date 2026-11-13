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
