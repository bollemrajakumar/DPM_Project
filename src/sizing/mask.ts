/**
 * Geometry on a binary person mask (ported from FitSize `vision/geometry.py`).
 *
 * The segmentation model's category mask can be smaller than the camera frame and doesn't
 * have to share its aspect ratio, so a mask column and a mask row may cover different
 * numbers of frame pixels. `fx` / `fy` (mask px per frame px) keep track of that. Frame
 * pixels are square, so all real-world distances are converted through frame pixels.
 */
import type { CategoryMask } from "@shared/lib/types";

export type Run = [number, number]; // inclusive [x0, x1] in mask columns

/** Masks wider than this are subsampled before analysis (speed; the model output is ~256 px anyway). */
const MAX_WIDTH = 480;

export class PersonMask {
  private constructor(
    readonly w: number,
    readonly h: number,
    readonly data: Uint8Array, // 1 = person
    /** mask columns per frame pixel */
    readonly fx: number,
    /** mask rows per frame pixel */
    readonly fy: number,
  ) {}

  /**
   * Binary person mask from a category mask: any class but background counts as person,
   * only the largest connected blob is kept, and holes inside it are filled.
   */
  static fromCategoryMask(m: CategoryMask, frameW: number, frameH: number): PersonMask {
    const stride = Math.max(1, Math.ceil(m.width / MAX_WIDTH));
    const w = Math.floor(m.width / stride);
    const h = Math.floor(m.height / stride);
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const src = y * stride * m.width;
      for (let x = 0; x < w; x++) bin[y * w + x] = m.data[src + x * stride] !== 0 ? 1 : 0;
    }
    keepLargestComponent(bin, w, h);
    fillHoles(bin, w, h);
    return new PersonMask(w, h, bin, w / frameW, h / frameH);
  }

  /** For tests: wrap an already-binary mask. */
  static fromBinary(data: Uint8Array, w: number, h: number, frameW = w, frameH = h): PersonMask {
    return new PersonMask(w, h, data, w / frameW, h / frameH);
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  /** First and last rows that contain person pixels. */
  verticalExtent(): [number, number] | null {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < this.h; y++) {
      const row = this.data.subarray(y * this.w, (y + 1) * this.w);
      if (row.includes(1)) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    return top < 0 ? null : [top, bottom];
  }

  /** Contiguous person runs in row y. */
  runs(y: number): Run[] {
    if (y < 0 || y >= this.h) return [];
    const out: Run[] = [];
    let start = -1;
    const base = y * this.w;
    for (let x = 0; x < this.w; x++) {
      const v = this.data[base + x];
      if (v && start < 0) start = x;
      if (!v && start >= 0) {
        out.push([start, x - 1]);
        start = -1;
      }
    }
    if (start >= 0) out.push([start, this.w - 1]);
    return out;
  }

  /** The run in row y that contains column x, or the nearest one within maxGap columns. */
  runContaining(y: number, x: number, maxGap: number): Run | null {
    let best: Run | null = null;
    let bestD = Infinity;
    for (const r of this.runs(Math.round(y))) {
      if (r[0] <= x && x <= r[1]) return r;
      const d = Math.min(Math.abs(x - r[0]), Math.abs(x - r[1]));
      if (d <= maxGap && d < bestD) {
        best = r;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * For each column from xFrom to xTo (either direction), the first person row at or below
   * yMin. Stops at the first empty column. Returns [col, row] pairs.
   */
  upperContour(xFrom: number, xTo: number, yMin: number): [number, number][] {
    const pts: [number, number][] = [];
    const step = xTo >= xFrom ? 1 : -1;
    const y0 = Math.max(0, Math.round(yMin));
    for (let x = Math.round(xFrom); step > 0 ? x <= xTo : x >= xTo; x += step) {
      if (x < 0 || x >= this.w) break;
      let found = -1;
      for (let y = y0; y < this.h; y++) {
        if (this.data[y * this.w + x]) {
          found = y;
          break;
        }
      }
      if (found < 0) break;
      pts.push([x, found]);
      if (found >= this.h - 1) break;
    }
    return pts;
  }

  /**
   * Top of the gap between the legs: the first row scanning down from yStart where the
   * centre column is background but there is person on both sides.
   */
  findCrotch(xCenter: number, yStart: number, yEnd: number): number | null {
    const xc = Math.round(xCenter);
    const end = Math.min(Math.round(yEnd), this.h - 1);
    for (let y = Math.max(0, Math.round(yStart)); y <= end; y++) {
      const x0 = Math.max(0, xc - 1);
      const x1 = Math.min(this.w - 1, xc + 1);
      let centreEmpty = true;
      for (let x = x0; x <= x1; x++) if (this.data[y * this.w + x]) centreEmpty = false;
      if (!centreEmpty) continue;
      let left = false;
      let right = false;
      for (let x = 0; x < x0; x++) if (this.data[y * this.w + x]) { left = true; break; }
      for (let x = x1 + 1; x < this.w; x++) if (this.data[y * this.w + x]) { right = true; break; }
      if (left && right) return y;
    }
    return null;
  }
}

export const runWidth = (r: Run | null): number => (r ? r[1] - r[0] + 1 : 0);

/** Ramanujan's second approximation of an ellipse perimeter (semi-axes a, b). */
export function ellipsePerimeter(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  const h = (a - b) ** 2 / (a + b) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** Circumference of an ellipse with FULL axes width/depth, and its 1σ by error propagation. */
export function ellipseCircumference(width: number, depth: number, sigmaW: number, sigmaD: number): [number, number] {
  const c = ellipsePerimeter(width / 2, depth / 2);
  const ew = Math.max(width * 1e-4, 1e-6);
  const ed = Math.max(depth * 1e-4, 1e-6);
  const dcdw = (ellipsePerimeter((width + ew) / 2, depth / 2) - c) / ew;
  const dcdd = (ellipsePerimeter(width / 2, (depth + ed) / 2) - c) / ed;
  return [c, Math.hypot(dcdw * sigmaW, dcdd * sigmaD)];
}

/** Index of the point farthest from the chord between the first and last point (the "bend"). */
export function kneePoint(pts: { x: number; y: number }[]): number | null {
  if (pts.length < 5) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const norm = Math.hypot(abx, aby);
  if (norm < 1e-9) return null;
  let best = -1;
  let bestD = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.abs(abx * (pts[i].y - a.y) - aby * (pts[i].x - a.x)) / norm;
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return best <= 0 || best === pts.length - 1 ? null : best;
}

export function median(v: number[]): number {
  if (v.length === 0) return NaN;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function keepLargestComponent(bin: Uint8Array, w: number, h: number): void {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let next = 0;
  let bestLabel = 0;
  let bestSize = 0;
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || label[i]) continue;
    next++;
    let size = 0;
    let sp = 0;
    stack[sp++] = i;
    label[i] = next;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      // 8-connectivity
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (bin[q] && !label[q]) {
            label[q] = next;
            stack[sp++] = q;
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
  }
  for (let i = 0; i < bin.length; i++) bin[i] = bin[i] && label[i] === bestLabel ? 1 : 0;
}

/** Background regions not connected to the border are holes: fill them. */
function fillHoles(bin: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const seed = (p: number) => {
    if (!bin[p] && !outside[p]) {
      outside[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }
  for (let i = 0; i < bin.length; i++) if (!outside[i]) bin[i] = 1;
}
