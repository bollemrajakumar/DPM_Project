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
