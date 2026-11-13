/**
 * Decides, for any point of a garment image, how much it belongs to the left/right sleeve.
 *
 * Primary rule (uses the garment silhouette): in product photos sleeves are separated from
 * the torso by a transparent gap below the armpit. Scanning each row outward from the
 * torso side (hip anchor x), the first opaque run is torso and anything past the gap is
 * sleeve. Above the armpit (where sleeve and torso are joined) the cut is the line from the
 * armpit point to the shoulder anchor.
 *
 * Fallback (no gap found, e.g. arms pressed against the body): an angular rule around the
 * shoulder, which is less precise for sleeves that hang close to the torso.
 */
import type { Vec2 } from "../lib/types";
import type { AlphaGrid } from "./garmentMesh";
import { smoothstep, sleeveWeight, type ArmRest } from "./deform";

export interface SideSegmentation {
  mode: "gap" | "angular";
  armpit: Vec2 | null; // garment px
  /** Sleeve weight on the alpha grid; empty pixels carry their nearest garment pixel's value. */
  field: Float32Array;
  weight(p: Vec2): number;
}

const OPAQUE = 96;

/** Fill every NaN cell with the value of its nearest (BFS) non-NaN cell, in place. */
export function fillNearest(field: Float32Array, aw: number, ah: number): Float32Array {
  const queue = new Int32Array(aw * ah);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < field.length; i++) if (!Number.isNaN(field[i])) queue[qt++] = i;
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % aw;
    const y = (i - x) / aw;
    const v = field[i];
    if (x > 0 && Number.isNaN(field[i - 1])) (field[i - 1] = v), (queue[qt++] = i - 1);
    if (x < aw - 1 && Number.isNaN(field[i + 1])) (field[i + 1] = v), (queue[qt++] = i + 1);
    if (y > 0 && Number.isNaN(field[i - aw])) (field[i - aw] = v), (queue[qt++] = i - aw);
    if (y < ah - 1 && Number.isNaN(field[i + aw])) (field[i + aw] = v), (queue[qt++] = i + aw);
  }
  return field;
}

/** Bilinear sample of an alpha-grid field at pixel coordinates (pixel centres at +0.5). */
export function sampleField(field: Float32Array, aw: number, ah: number, px: number, py: number): number {
  const x = px - 0.5;
  const y = py - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const f = (xi: number, yi: number) => {
    const v = field[Math.min(ah - 1, Math.max(0, yi)) * aw + Math.min(aw - 1, Math.max(0, xi))];
    return Number.isNaN(v) ? 0 : v;
  };
  return f(x0, y0) * (1 - tx) * (1 - ty) + f(x0 + 1, y0) * tx * (1 - ty) + f(x0, y0 + 1) * (1 - tx) * ty + f(x0 + 1, y0 + 1) * tx * ty;
}

export function segmentSleeve(
  alpha: AlphaGrid,
  imageSize: [number, number],
  arm: ArmRest,
  hip: Vec2,
  outward: 1 | -1,
  shoulderWidth: number,
  blend: number,
): SideSegmentation {
  const [W, H] = imageSize;
  const sx = alpha.width / W;
  const sy = alpha.height / H;
  const aw = alpha.width;
  const at = (x: number, y: number) => alpha.data[y * aw + x] > OPAQUE;
  const hipX = Math.round(hip.x * sx);
  const shoulderRow = Math.max(0, Math.round(arm.shoulder.y * sy));
  const swA = shoulderWidth * sx;

  // Per-row gap [gapStart, gapEnd) in alpha coords, measured outward from hipX.
  const gapStart = new Float32Array(alpha.height).fill(NaN);
  const gapEnd = new Float32Array(alpha.height).fill(NaN);
  const torsoPresent = new Uint8Array(alpha.height);
  const inRange = (x: number) => x >= 0 && x < aw;
  // Ignore hairline seams (anti-aliasing between panels, stitching): a real armpit gap is
  // a few percent of the shoulder width at least.
  const minGap = Math.max(2, 0.03 * swA);
  for (let y = shoulderRow; y < alpha.height; y++) {
    let x = Math.min(aw - 1, Math.max(0, hipX));
    if (!at(x, y)) continue;
    torsoPresent[y] = 1;
    while (inRange(x + outward) && at(x + outward, y)) x += outward;
    const edge = x;
    x += outward;
    while (inRange(x) && !at(x, y)) x += outward;
    if (inRange(x) && Math.abs(x - edge) - 1 >= minGap) {
      gapStart[y] = edge + 0.5 * outward;
      gapEnd[y] = x - 0.5 * outward;
    }
  }

  // Armpit: first row (from the shoulder down) that starts a run of >= 3 gap rows.
  let armpitRow = -1;
  for (let y = shoulderRow; y < alpha.height - 3; y++) {
    if (!Number.isNaN(gapStart[y]) && !Number.isNaN(gapStart[y + 1]) && !Number.isNaN(gapStart[y + 2])) {
      armpitRow = y;
      break;
    }
  }
  // Rows below the torso hem where a (long) sleeve continues: first opaque x outward of hipX.
  let lastTorsoRow = -1;
  for (let y = 0; y < alpha.height; y++) if (torsoPresent[y]) lastTorsoRow = y;
  const sleeveStartBelow = new Float32Array(alpha.height).fill(NaN);
  for (let y = lastTorsoRow + 1; y < alpha.height; y++) {
    for (let x = Math.min(aw - 1, Math.max(0, hipX)); inRange(x); x += outward) {
      if (at(x, y)) {
        sleeveStartBelow[y] = x * outward;
        break;
      }
    }
  }

  /** Rule-based weight at alpha-grid coordinates (meaningful on opaque pixels). */
  const gapRule = (armpitRow: number) => {
    const A = { x: gapStart[armpitRow], y: armpitRow }; // alpha coords
    const S = { x: arm.shoulder.x * sx, y: arm.shoulder.y * sy };
    // Normal of the cut line A->S, oriented outward.
    const d = { x: S.x - A.x, y: S.y - A.y };
    const len = Math.hypot(d.x, d.y) || 1;
    let n = { x: -d.y / len, y: d.x / len };
    if (n.x * outward < 0) n = { x: -n.x, y: -n.y };
    const soft = Math.max(1, 0.04 * swA);

    return (x: number, y: number): number => {
      const row = Math.min(alpha.height - 1, Math.max(0, Math.floor(y)));
      // Above the shoulder anchor only points outward of it may follow the arm (keeps the
      // collar/neckline on the torso). Below it, the armpit cut line alone decides, so the
      // sleeve's outer edge near the shoulder gets a clean weight of 1.
      const lateral = y < S.y ? smoothstep(-0.04 * swA, 0.1 * swA, (x - S.x) * outward) : 1;
      if (y < armpitRow) {
        const sd = (x - A.x) * n.x + (y - A.y) * n.y;
        return smoothstep(-soft, soft, sd) * lateral;
      }
      if (!Number.isNaN(gapStart[row])) {
        const a = gapStart[row] * outward;
        const b = gapEnd[row] * outward;
        const xo = x * outward;
        // midpoint of the gap is the boundary; soften across the gap width
        const mid = (a + b) / 2;
        const half = Math.max(soft * 0.5, (b - a) / 2);
        return smoothstep(mid - half, mid + half, xo);
      }
      if (row > lastTorsoRow) {
        // Below the hem only a sleeve can remain; empty rows stay with the torso so the hem
        // edge isn't stretched when the arm moves.
        const start = sleeveStartBelow[row];
        if (Number.isNaN(start)) return 0;
        return smoothstep(start - 2 * soft, start, x * outward);
      }
      // Rows below the sleeve's end: torso only.
      return 0;
    };
  };
  const rule =
    armpitRow < 0
      ? (x: number, y: number) => sleeveWeight({ x: x / sx, y: y / sy }, arm, hip, outward, shoulderWidth, blend)
      : gapRule(armpitRow);

  // Weight field on the alpha grid: rule on garment pixels, then every transparent pixel
  // inherits the value of its nearest garment pixel, so a vertex in the empty space next to
  // a sleeve moves WITH the sleeve.
  const ah = alpha.height;
  const field = new Float32Array(aw * ah).fill(NaN);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (at(x, y)) field[y * aw + x] = rule(x + 0.5, y + 0.5);
  fillNearest(field, aw, ah);
  return {
    mode: armpitRow < 0 ? "angular" : "gap",
    armpit: armpitRow < 0 ? null : { x: gapStart[armpitRow] / sx, y: armpitRow / sy },
    field,
    weight: (p) => sampleField(field, aw, ah, p.x * sx, p.y * sy),
  };
}
