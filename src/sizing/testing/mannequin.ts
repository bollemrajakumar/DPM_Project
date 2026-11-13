/**
 * Test-only full-body mannequin with exactly known dimensions, rasterised into a category mask
 * (at a different resolution from the frame, like the real segmentation model) plus the 33
 * MediaPipe-style landmarks. Not used by the extension at runtime.
 */
import type { CategoryMask, PixelLandmark } from "@shared/lib/types";

export interface Body {
  heightCm: number;
  shoulderCm: number; // seam to seam
  chestW: number; chestD: number;
  waistW: number; waistD: number;
  hipW: number; hipD: number;
}

export interface MannequinOpts {
  view: "front" | "side";
  frameW: number;
  frameH: number;
  maskW: number;
  maskH: number;
  /** person height in frame pixels */
  personPx: number;
  /** frame y of the soles (default: 5% above the bottom edge) */
  floorY?: number;
  /** horizontal centre in frame px (default: middle) */
  centerX?: number;
}

type Shape = (x: number, y: number) => boolean; // body coords: cm, x from centre, y up from floor

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** piecewise-linear profile through (y, value) knots (y descending) */
function profile(knots: [number, number][], y: number): number | null {
  for (let i = 0; i < knots.length - 1; i++) {
    const [y0, v0] = knots[i];
    const [y1, v1] = knots[i + 1];
    if (y <= y0 && y >= y1) return lerp(v0, v1, (y0 - y) / (y0 - y1));
  }
  return null;
}

function capsule(ax: number, ay: number, bx: number, by: number, r: number): Shape {
  return (x, y) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= r;
  };
}

export function levels(b: Body) {
  const H = b.heightCm;
  return {
    shoulder: 0.818 * H,
    chest: 0.72 * H,
    waist: 0.62 * H,
    hip: 0.52 * H,
    crotch: 0.47 * H,
    knee: 0.285 * H,
    ankle: 0.04 * H,
  };
}

const ARM_ANGLE = (25 * Math.PI) / 180;
const UPPER = 30;
const FORE = 27;

export function renderMannequin(b: Body, o: MannequinOpts): { mask: CategoryMask; landmarks: PixelLandmark[] } {
  const H = b.heightCm;
  const L = levels(b);
  const S = b.shoulderCm / 2;
  const side = o.view === "side";
  const pxPerCm = o.personPx / H;
  const floorY = o.floorY ?? o.frameH * 0.95;
  const cx = o.centerX ?? o.frameW / 2;
  const toFrame = (x: number, y: number) => ({ x: cx + x * pxPerCm, y: floorY - y * pxPerCm });

  // ---- torso half-width (front) or half-depth (side) profile ----
  const torsoKnots: [number, number][] = side
    ? [
        [L.shoulder + 2, b.chestD / 2 - 3],
        [L.shoulder - 8, b.chestD / 2 - 1],
        [L.chest, b.chestD / 2],
        [L.waist, b.waistD / 2],
        [L.hip, b.hipD / 2],
        [L.crotch, b.hipD / 2 - 1],
      ]
    : [
        [L.shoulder - 8, b.chestW / 2 - 1],
        [L.chest, b.chestW / 2],
        [L.waist, b.waistW / 2],
        [L.hip, b.hipW / 2],
        [L.crotch, b.hipW / 2 - 0.5],
      ];

  const shapes: Shape[] = [];
  // head + neck
  const headR = side ? 10 : 8;
  shapes.push((x, y) => (x / headR) ** 2 + ((y - (H - 11.5)) / 11.5) ** 2 <= 1);
  shapes.push((x, y) => Math.abs(x) <= 6 && y <= H - 18 && y >= L.shoulder);
  // torso
  shapes.push((x, y) => {
    const hw = profile(torsoKnots, y);
    return hw !== null && Math.abs(x) <= hw;
  });
  if (!side) {
    // shoulder slope from the neck to the seam points
    shapes.push((x, y) => {
      if (y < L.shoulder - 8 || y > L.shoulder + 5) return false;
      const ax = Math.abs(x);
      if (ax > S) return false;
      const top = ax <= 6 ? L.shoulder + 5 : lerp(L.shoulder + 5, L.shoulder - 1, (ax - 6) / (S - 6));
      return y <= top;
    });
    // arms in an A-pose
    for (const s of [1, -1]) {
      const jx = s * (S - 4);
      const jy = L.shoulder - 3;
      const ex = jx + s * Math.sin(ARM_ANGLE) * UPPER;
      const ey = jy - Math.cos(ARM_ANGLE) * UPPER;
      const wx = ex + s * Math.sin(ARM_ANGLE) * FORE;
      const wy = ey - Math.cos(ARM_ANGLE) * FORE;
      shapes.push(capsule(jx, jy, ex, ey, 5));
      shapes.push(capsule(ex, ey, wx, wy, 4));
    }
    // legs, apart
    for (const s of [1, -1]) {
      shapes.push(capsule(s * b.hipW / 4, L.crotch + 4, s * 11, L.ankle, 7));
      shapes.push(capsule(s * 11, L.ankle, s * 12, 2, 4.5));
    }
  } else {
    shapes.push(capsule(0, L.crotch + 4, 0, L.ankle, 7)); // legs overlap in profile
    shapes.push(capsule(0, L.ankle, 8, 2, 4.5));
  }

  // ---- rasterise into the mask ----
  const data = new Uint8Array(o.maskW * o.maskH);
  for (let my = 0; my < o.maskH; my++) {
    for (let mx = 0; mx < o.maskW; mx++) {
      const fx = ((mx + 0.5) / o.maskW) * o.frameW;
      const fy = ((my + 0.5) / o.maskH) * o.frameH;
      const x = (fx - cx) / pxPerCm;
      const y = (floorY - fy) / pxPerCm;
      if (y < 0) continue;
      if (shapes.some((s) => s(x, y))) data[my * o.maskW + mx] = 4; // "clothes"
    }
  }

  // ---- landmarks (person's LEFT on image RIGHT when facing the camera) ----
  const lm: PixelLandmark[] = Array.from({ length: 33 }, () => ({ x: cx, y: floorY, visibility: 0.2 }));
  const set = (i: number, x: number, y: number, v = 0.95) => {
    const p = toFrame(x, y);
    lm[i] = { x: p.x, y: p.y, visibility: v };
  };
  const k = side ? 0.08 : 1; // in profile, left/right collapse onto the centre line
  set(0, side ? 9 : 0, H - 12);
  set(2, 3.2 * k, H - 9);
  set(5, -3.2 * k, H - 9);
  set(9, 2.5 * k, H - 17);
  set(10, -2.5 * k, H - 17);
  const jx = (S - 4) * k;
  set(11, jx, L.shoulder - 3);
  set(12, -jx, L.shoulder - 3);
  const ang = side ? 0 : ARM_ANGLE;
  set(13, jx + Math.sin(ang) * UPPER, L.shoulder - 3 - Math.cos(ang) * UPPER);
  set(14, -jx - Math.sin(ang) * UPPER, L.shoulder - 3 - Math.cos(ang) * UPPER);
  set(15, jx + Math.sin(ang) * (UPPER + FORE), L.shoulder - 3 - Math.cos(ang) * (UPPER + FORE));
  set(16, -jx - Math.sin(ang) * (UPPER + FORE), L.shoulder - 3 - Math.cos(ang) * (UPPER + FORE));
  set(23, (b.hipW / 4) * k, L.hip + 3);
  set(24, -(b.hipW / 4) * k, L.hip + 3);
  set(25, 11 * k, L.knee);
  set(26, -11 * k, L.knee);
  set(27, 11 * k, L.ankle);
  set(28, -11 * k, L.ankle);
  set(29, 11 * k, 1);
  set(30, -11 * k, 1);
  set(31, 12 * k + (side ? 8 : 0), 1);
  set(32, -12 * k + (side ? 8 : 0), 1);

  return { mask: { width: o.maskW, height: o.maskH, data }, landmarks: lm };
}
