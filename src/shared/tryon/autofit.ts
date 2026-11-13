/**
 * Auto-fit: measures where the person's shoulder OUTLINE is relative to the pose's
 * shoulder JOINT landmarks, using the segmentation mask, so the garment's shoulder-seam
 * corner can be placed on the real shoulder instead of a fixed guess.
 *
 * Per side: walk up from the landmark through person pixels to find the shoulder top, and
 * walk outward along the landmark's row to find the shoulder's outer edge. The seam corner
 * lies just inside the box corner (outer, top) of a rounded shoulder.
 */
import type { CategoryMask } from "../lib/types";
import type { BodyState } from "../tracking/bodyTracker";

export interface ShoulderFit {
  shoulderOut: number; // shoulder-widths
  shoulderUp: number;
}

const CORNER = 0.85; // seam sits slightly inside the bounding-box corner of the shoulder
const isPerson = (c: number) => c !== 0; // any class except background (hair included: it lies on the shoulder)

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** One measurement from one frame, or null when the pose isn't suitable (arms raised, edge of frame…). */
export function measureShoulders(mask: CategoryMask, frameW: number, frameH: number, body: BodyState): ShoulderFit | null {
  const sx = mask.width / frameW;
  const sy = mask.height / frameH;
  const sw = body.shoulderWidth;
  if (sw * sx < 8) return null; // person too small in the mask to measure
  const at = (x: number, y: number) => {
    const xi = Math.round(x * sx);
    const yi = Math.round(y * sy);
    if (xi < 0 || yi < 0 || xi >= mask.width || yi >= mask.height) return -1;
    return mask.data[yi * mask.width + xi];
  };
  const outs: number[] = [];
  const ups: number[] = [];
  const sides = [
    { s: body.leftShoulder, e: body.leftElbow, dir: 1 },
    { s: body.rightShoulder, e: body.rightElbow, dir: -1 },
  ];
  // the "outward" direction along the shoulder line, and "up" perpendicular to it
  const ax = (body.leftShoulder.x - body.rightShoulder.x) / sw;
  const ay = (body.leftShoulder.y - body.rightShoulder.y) / sw;
  const step = 1 / Math.max(sx, sy);
  for (const { s, e, dir } of sides) {
    // arms must hang down, otherwise the arm itself extends the "shoulder" outward
    if (!e || e.y < s.y + 0.4 * sw) return null;
    if (!isPerson(at(s.x, s.y))) return null;
    const ux = ay;
    const uy = -ax;
    // up: several columns around the landmark
    const tops: number[] = [];
    for (const off of [-0.04, 0, 0.04]) {
      const bx = s.x + dir * ax * off * sw;
      const by = s.y + dir * ay * off * sw;
      let d = 0;
      while (d < 0.45 * sw && isPerson(at(bx + ux * d, by + uy * d))) d += step;
      if (d >= 0.45 * sw || at(bx + ux * d, by + uy * d) === -1) return null; // ran off the frame / into the head
      tops.push(d);
    }
    // outward: several rows around the landmark
    const outsSide: number[] = [];
    for (const off of [-0.02, 0.03, 0.08]) {
      const bx = s.x - ux * off * sw;
      const by = s.y - uy * off * sw;
      let d = 0;
      while (d < 0.45 * sw && isPerson(at(bx + dir * ax * d, by + dir * ay * d))) d += step;
      if (d >= 0.45 * sw || at(bx + dir * ax * d, by + dir * ay * d) === -1) return null;
      outsSide.push(d);
    }
    ups.push((median(tops) / sw) * CORNER);
    outs.push((median(outsSide) / sw) * CORNER);
  }
  const fit = { shoulderOut: (outs[0] + outs[1]) / 2, shoulderUp: (ups[0] + ups[1]) / 2 };
  // reject implausible values (segmentation glitches, loose hair, bags on the shoulder)
  if (fit.shoulderOut < -0.05 || fit.shoulderOut > 0.35 || fit.shoulderUp < 0 || fit.shoulderUp > 0.3) return null;
  return fit;
}

/** Robust combination of several per-frame measurements. */
export function combineFits(samples: ShoulderFit[]): ShoulderFit | null {
  if (samples.length < 5) return null;
  return { shoulderOut: median(samples.map((s) => s.shoulderOut)), shoulderUp: median(samples.map((s) => s.shoulderUp)) };
}
