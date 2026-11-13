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
