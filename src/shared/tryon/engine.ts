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
