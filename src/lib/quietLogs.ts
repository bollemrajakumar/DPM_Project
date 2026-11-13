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
