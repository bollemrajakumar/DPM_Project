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
