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
