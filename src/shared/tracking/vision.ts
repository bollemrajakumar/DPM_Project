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
