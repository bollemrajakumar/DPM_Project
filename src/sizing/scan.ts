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
