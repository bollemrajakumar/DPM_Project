/**
 * Turns a product photo into a try-on garment: a PNG with a transparent background, cropped
 * to the garment, plus the anchor points the renderer warps from. Runs entirely in the
 * extension with the MediaPipe models it already uses for tracking.
 *
 * Three kinds of photo are handled:
 * - "person": a model wearing the top. The pose model finds shoulders, elbows, wrists and
 *   hips; the segmentation model's "clothes" class gives the garment pixels. Trousers are
 *   separated from the top by colour (they share the "clothes" class), anything above the
 *   collar (hats) is dropped, and only the largest connected piece is kept. Anchors come from
 *   the pose, which is more reliable than guessing from the outline.
 * - "transparent": the photo already has a transparent background; only anchors are found.
 * - "background": a garment on its own on a plain backdrop. The backdrop is flood-filled
 *   from the border (port of backend/app/garment_prep.py) and anchors come from the outline.
 */
import { FilesetResolver, ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LM, SEG, type Anchors, type SleeveType, type Vec2 } from "@shared/lib/types";
import { loadModel, WASM_BASE } from "./vision-ext";

export type PrepMethod = "person" | "transparent" | "background";

export interface PreparedGarment {
  blob: Blob;
  anchors: Anchors;
  sleeve: SleeveType;
  size: [number, number];
  method: PrepMethod;
  warnings: string[];
}

const WORK_MAX = 1024; // longest side the photo is processed (and stored) at
const PAD_FRAC = 0.04;

interface Work {
  w: number;
  h: number;
  rgba: Uint8ClampedArray; // straight RGBA of the (downscaled) photo
  alpha: Uint8Array; // garment alpha being built
}

/* ------------------------------------------------------------------ entry point */

export async function prepareGarment(
  input: Blob,
  onProgress: (msg: string) => void = () => {},
): Promise<PreparedGarment> {
  const bitmap = await createImageBitmap(input);
  const k = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  if (Math.min(w, h) < 64) throw new Error(`Image is too small (${bitmap.width}×${bitmap.height}).`);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const work: Work = { w, h, rgba, alpha: new Uint8Array(w * h) };
  const warnings: string[] = [];

  let method: PrepMethod;
  let pose: PosePoints | null = null;

  if (hasMeaningfulAlpha(rgba)) {
    method = "transparent";
    for (let i = 0; i < w * h; i++) work.alpha[i] = rgba[4 * i + 3];
  } else {
    onProgress("Looking for the garment…");
    pose = await detectPose(canvas, onProgress).catch((e) => {
      console.warn("pose detection on garment photo failed", e);
      return null;
    });
    // The pose model can "see" a person in a garment laid flat, so a person also needs a face
    // where the pose puts the head; otherwise treat it as a garment on its own.
    if (pose) {
      onProgress("Cutting out the top…");
      if (!(await personCutout(work, canvas, pose, onProgress, warnings))) {
        pose = null;
        work.alpha.fill(0);
      }
    }
    if (pose) {
      method = "person";
    } else {
      method = "background";
      onProgress("Removing the background…");
      const conf = removeUniformBackground(work, warnings);
      if (conf < 0.9) warnings.push("The background isn't plain, so the cut-out may be rough.");
    }
  }

  const cover = countAbove(work.alpha, 127) / (w * h);
  if (cover < 0.01) throw new Error("Couldn't find a garment in this image.");

  const crop = cropBox(work.alpha, w, h);
  const cut = cropWork(work, crop);
  if (pose) pose = shiftPose(pose, crop.x0, crop.y0);

  const found = pose ? anchorsFromPose(cut, pose, warnings) : anchorsFromSilhouette(cut, warnings);

  onProgress("Saving garment…");
  const blob = await toPng(cut);
  return { blob, anchors: found.anchors, sleeve: found.sleeve, size: [cut.w, cut.h], method, warnings };
}

/* ------------------------------------------------------------------ helpers */

function hasMeaningfulAlpha(rgba: Uint8ClampedArray): boolean {
  let transparent = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < n; i++) if (rgba[4 * i + 3] < 16) transparent++;
  return transparent / n > 0.05;
}

function countAbove(a: Uint8Array, t: number): number {
  let c = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > t) c++;
  return c;
}

function cropBox(alpha: Uint8Array, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * PAD_FRAC);
  return { x0: x0 - pad, y0: y0 - pad, w: x1 - x0 + 1 + 2 * pad, h: y1 - y0 + 1 + 2 * pad };
}

/** Copies a box out of the work image (out-of-range pixels become transparent). */
function cropWork(src: Work, box: { x0: number; y0: number; w: number; h: number }): Work {
  const out: Work = { w: box.w, h: box.h, rgba: new Uint8ClampedArray(box.w * box.h * 4), alpha: new Uint8Array(box.w * box.h) };
  for (let y = 0; y < box.h; y++) {
    const sy = y + box.y0;
    if (sy < 0 || sy >= src.h) continue;
    for (let x = 0; x < box.w; x++) {
      const sx = x + box.x0;
      if (sx < 0 || sx >= src.w) continue;
      const si = sy * src.w + sx;
      const di = y * box.w + x;
      out.rgba[4 * di] = src.rgba[4 * si];
      out.rgba[4 * di + 1] = src.rgba[4 * si + 1];
      out.rgba[4 * di + 2] = src.rgba[4 * si + 2];
      out.alpha[di] = src.alpha[si];
      out.rgba[4 * di + 3] = src.alpha[si];
    }
  }
  return out;
}

async function toPng(work: Work): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = work.w;
  c.height = work.h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(work.w, work.h);
  img.data.set(work.rgba);
  for (let i = 0; i < work.w * work.h; i++) img.data[4 * i + 3] = work.alpha[i];
  ctx.putImageData(img, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("PNG encoding failed"))), "image/png"));
}

/** Keeps only the largest 8-connected region of alpha > 127; everything else becomes 0. */
function keepLargestComponent(alpha: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = 0, bestSize = 0, next = 0;
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] <= 127 || label[i]) continue;
    next++;
    let size = 0, sp = 0;
    stack[sp++] = i;
    label[i] = next;
    while (sp) {
      const p = stack[--sp];
      size++;
      const px = p % w, py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (alpha[q] > 127 && !label[q]) {
            label[q] = next;
            stack[sp++] = q;
          }
        }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  // Soft edge pixels (alpha <= 127) next to the kept region stay; isolated ones go.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (label[i] === best) continue;
      if (label[i]) { alpha[i] = 0; continue; }
      if (!alpha[i]) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -2; dx <= 2 && !near; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && label[ny * w + nx] === best) near = true;
        }
      if (!near) alpha[i] = 0;
    }
}

/* ------------------------------------------------------------------ person photos */

interface PosePoints {
  // Image pixel coordinates in the work image. "left" = the wearer's left.
  nose: Vec2 | null; // null when the photo crops the head off (common in shop photos)
  ls: Vec2; rs: Vec2; lh: Vec2; rh: Vec2;
  le: Vec2 | null; re: Vec2 | null; lw: Vec2 | null; rw: Vec2 | null;
  hipsEstimated: boolean;
}

async function detectPose(canvas: HTMLCanvasElement, onProgress: (m: string) => void): Promise<PosePoints | null> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const data = await loadModel("pose_full", onProgress);
  const pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(data), delegate: "CPU" },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
  });
  try {
    const lm = pose.detect(canvas).landmarks?.[0];
    if (!lm) return null;
    const { width: w, height: h } = canvas;
    const pt = (i: number, minVis = 0.5): Vec2 | null =>
      (lm[i].visibility ?? 0) >= minVis ? { x: lm[i].x * w, y: lm[i].y * h } : null;
    const nose = pt(LM.nose, 0.5);
    // Without a head in frame, only trust clearly visible shoulders.
    const ls = pt(LM.leftShoulder, nose ? 0.5 : 0.8), rs = pt(LM.rightShoulder, nose ? 0.5 : 0.8);
    if (!ls || !rs) return null;
    const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (sw < 0.08 * Math.max(w, h)) return null; // person too small to cut out usefully
    let lh = pt(LM.leftHip, 0.3), rh = pt(LM.rightHip, 0.3);
    let hipsEstimated = false;
    if (!lh || !rh) {
      // Photo cropped above the hips: typical torso is ~1.3 shoulder-joint widths tall.
      hipsEstimated = true;
      lh = { x: ls.x - 0.12 * (ls.x - rs.x), y: ls.y + 1.3 * sw };
      rh = { x: rs.x + 0.12 * (ls.x - rs.x), y: rs.y + 1.3 * sw };
    }
    return {
      nose, ls, rs, lh, rh, hipsEstimated,
      le: pt(LM.leftElbow, 0.4), re: pt(LM.rightElbow, 0.4),
      lw: pt(LM.leftWrist, 0.4), rw: pt(LM.rightWrist, 0.4),
    };
  } finally {
    pose.close();
  }
}

function shiftPose(p: PosePoints, dx: number, dy: number): PosePoints {
  const s = (v: Vec2 | null) => (v ? { x: v.x - dx, y: v.y - dy } : null);
  return {
    nose: s(p.nose), ls: s(p.ls)!, rs: s(p.rs)!, lh: s(p.lh)!, rh: s(p.rh)!,
    le: s(p.le), re: s(p.re), lw: s(p.lw), rw: s(p.rw), hipsEstimated: p.hipsEstimated,
  };
}

/** Cuts the top out of a photo of someone wearing it. Returns false if there's no real face
 *  at the head (the pose was a false detection), leaving the caller to try another method. */
async function personCutout(
  work: Work,
  canvas: HTMLCanvasElement,
  p: PosePoints,
  onProgress: (m: string) => void,
  warnings: string[],
): Promise<boolean> {
  const { w, h } = work;
  const sw = Math.hypot(p.ls.x - p.rs.x, p.ls.y - p.rs.y);
  const shoulderY = (p.ls.y + p.rs.y) / 2;
  const hipY = (p.lh.y + p.rh.y) / 2;
  const torso = Math.max(0.5 * sw, hipY - shoulderY);

  // Segment a crop around the upper body (and the face, for the check below): the model works
  // at 256×256, so a tight crop keeps garment edges sharper than segmenting a full-length photo.
  const xs = [p.nose, p.ls, p.rs, p.lh, p.rh, p.le, p.re, p.lw, p.rw].filter(Boolean).map((v) => v!.x);
  const bx0 = Math.max(0, Math.floor(Math.min(...xs) - 0.45 * sw));
  const bx1 = Math.min(w, Math.ceil(Math.max(...xs) + 0.45 * sw));
  const by0 = Math.max(0, Math.floor(Math.min(shoulderY - 0.7 * sw, (p.nose?.y ?? h) - 0.3 * sw)));
  const by1 = Math.min(h, Math.ceil(hipY + 0.9 * torso));
  const cw = bx1 - bx0, ch = by1 - by0;
  const crop = document.createElement("canvas");
  crop.width = cw;
  crop.height = ch;
  crop.getContext("2d")!.drawImage(canvas, bx0, by0, cw, ch, 0, 0, cw, ch);

  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const segData = await loadModel("selfie_multiclass", onProgress);
  const seg = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(segData), delegate: "CPU" },
    runningMode: "IMAGE",
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
  let clothes: Float32Array, face: Float32Array, hair: Float32Array, skin: Float32Array, mw: number, mh: number;
  try {
    const r = seg.segment(crop);
    const masks = r.confidenceMasks;
    const m = masks?.[SEG.clothes];
    if (!m || !masks?.[SEG.faceSkin] || !masks?.[SEG.hair] || !masks?.[SEG.bodySkin])
      throw new Error("segmentation returned no masks");
    clothes = new Float32Array(m.getAsFloat32Array());
    face = new Float32Array(masks[SEG.faceSkin].getAsFloat32Array());
    hair = new Float32Array(masks[SEG.hair].getAsFloat32Array());
    skin = new Float32Array(masks[SEG.bodySkin].getAsFloat32Array());
    mw = m.width;
    mh = m.height;
    r.close();
  } finally {
    seg.close();
  }
  const maskAt = (arr: Float32Array, x: number, y: number) => {
    const mx = Math.min(mw - 1, Math.max(0, Math.floor(((x - bx0) / cw) * mw)));
    const my = Math.min(mh - 1, Math.max(0, Math.floor(((y - by0) / ch) * mh)));
    return arr[my * mw + mx];
  };

  // Is this really a person? With a head in frame: face skin or hair around the nose. With the
  // head cropped off: skin at the neck (a garment on its own shows backdrop there).
  const probe = p.nose ?? { x: (p.ls.x + p.rs.x) / 2, y: shoulderY - 0.12 * sw };
  let score = 0, samples = 0;
  const rr = (p.nose ? 0.12 : 0.06) * sw;
  for (let dy = -rr; dy <= rr; dy += rr / 4)
    for (let dx = -rr; dx <= rr; dx += rr / 4) {
      const x = probe.x + dx, y = probe.y + dy;
      score += p.nose ? maskAt(face, x, y) + maskAt(hair, x, y) : maskAt(skin, x, y) + maskAt(face, x, y);
      samples++;
    }
  // Measured: a flat jersey the pose model mistook for a person scored 0.04 (no head, neck
  // check); a face under coloured stage light 0.14; a face in daylight 0.57.
  console.debug(`[garmentPrep] person check: ${p.nose ? "head" : "neck"} score ${(score / samples).toFixed(3)}`);
  if (score / samples < (p.nose ? 0.1 : 0.25)) return false;

  // Clothes confidence -> alpha, with a soft ramp for smooth edges.
  const alpha = work.alpha;
  for (let y = by0; y < by1; y++)
    for (let x = bx0; x < bx1; x++) {
      const c = maskAt(clothes, x, y);
      alpha[y * w + x] = Math.round(255 * Math.min(1, Math.max(0, (c - 0.35) / 0.3)));
    }

  // Nothing above the collar (caps, hats, hair accessories).
  const topCut = Math.max(0, Math.floor(shoulderY - 0.45 * sw));
  alpha.fill(0, 0, topCut * w);

  // Below the waist, "clothes" also covers trousers/skirts. Keep a pixel there only if its
  // colour is more like the top (sampled on the chest) than like the bottoms (sampled on
  // the thighs). Colour histograms handle patterned fabric better than a single mean.
  const BINS = 8;
  const binOf = (i: number) =>
    ((work.rgba[4 * i] >> 5) * BINS + (work.rgba[4 * i + 1] >> 5)) * BINS + (work.rgba[4 * i + 2] >> 5);
  const hist = (y0: number, y1: number, x0: number, x1: number) => {
    const hgt = new Float32Array(BINS ** 3);
    let n = 0;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, y1); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, x1); x++) {
        const i = y * w + x;
        if (alpha[i] < 200) continue;
        hgt[binOf(i)]++;
        n++;
      }
    if (n) for (let b = 0; b < hgt.length; b++) hgt[b] /= n;
    return { hgt, n };
  };
  const cx0 = Math.min(p.ls.x, p.rs.x), cx1 = Math.max(p.ls.x, p.rs.x);
  const top = hist(shoulderY + 0.15 * torso, shoulderY + 0.75 * torso, cx0, cx1);
  const bottom = hist(hipY + 0.45 * torso, hipY + 0.9 * torso, cx0, cx1);
  const hemCut = Math.min(h, Math.ceil(hipY + 0.6 * torso)); // longest untucked top we allow
  const splitFrom = Math.max(0, Math.floor(hipY - 0.15 * torso));
  for (let y = splitFrom; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!alpha[i]) continue;
      if (y >= hemCut) { alpha[i] = 0; continue; }
      if (bottom.n < 50 || top.n < 50) continue;
      const b = binOf(i);
      if (bottom.hgt[b] > 1.5 * top.hgt[b] + 0.002) alpha[i] = 0;
    }
  if (top.n < 50) warnings.push("Couldn't see much of the top; check the cut-out.");

  keepLargestComponent(alpha, w, h);
  if (p.hipsEstimated) warnings.push("The photo is cropped above the hips; the hem may be off.");
  return true;
}

function anchorsFromPose(work: Work, p: PosePoints, warnings: string[]): { anchors: Anchors; sleeve: SleeveType } {
  const { w, h, alpha } = work;
  const at = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h ? alpha[yi * w + xi] : 0;
  };
  const covered = (v: Vec2, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (at(v.x + dx, v.y + dy) > 127) return true;
    return false;
  };
  const sw = Math.hypot(p.ls.x - p.rs.x, p.ls.y - p.rs.y);
  const out = Math.sign(p.ls.x - p.rs.x) || 1; // wearer's left side is +out in x
  // Arm points far outside the cut-out belong to someone else (busy photos can pull an elbow
  // onto a bystander); treat them as unknown so the arm is assumed to hang naturally.
  const inReach = (v: Vec2 | null) =>
    v && v.x > -0.25 * w && v.x < 1.25 * w && v.y > -0.25 * h && v.y < 1.25 * h ? v : null;
  p = { ...p, le: inReach(p.le), re: inReach(p.re), lw: inReach(p.lw), rw: inReach(p.rw) };
  const norm = (v: Vec2): Vec2 => ({ x: v.x / w, y: v.y / h });
  // Topmost garment pixel in a column between y0 and y1.
  const topIn = (x: number, y0: number, y1: number): number | null => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, y1); y++) if (at(x, y) > 127) return y;
    return null;
  };

  // Shoulder anchors are the shoulder-seam corners: a little outward of the joint, on the
  // garment's top edge (same definition as the Garment Studio).
  const seam = (j: Vec2, dir: number): Vec2 => {
    // Start a little outward of the joint; if that's past the fabric (arm turned away, or the
    // photo taken at an angle), step back inward until there's garment in the column.
    for (let off = 0.06 * sw; off >= -0.35 * sw; off -= 0.01 * sw) {
      const x = j.x + dir * off;
      const y = topIn(x, j.y - 0.5 * sw, j.y + 0.3 * sw);
      if (y !== null) return { x, y };
    }
    warnings.push("Couldn't find a shoulder edge; placed it from the pose.");
    return { x: j.x + dir * 0.06 * sw, y: j.y - 0.08 * sw };
  };
  const lsA = seam(p.ls, out);
  const rsA = seam(p.rs, -out);
  // Shop models stand upright; a steep shoulder line means one seam was misplaced (turned
  // body, arm across the shoulder). Level it rather than warp the garment.
  const tilt = Math.atan2(Math.abs(lsA.y - rsA.y), Math.abs(lsA.x - rsA.x));
  if (tilt > (15 * Math.PI) / 180) {
    const y = Math.min(lsA.y, rsA.y);
    lsA.y = rsA.y = y;
    warnings.push("The shoulders looked tilted, so they were levelled; check the fit.");
  }

  const ncx = (p.ls.x + p.rs.x) / 2;
  let neckY = Infinity;
  for (let x = Math.round(ncx - 0.15 * sw); x <= Math.round(ncx + 0.15 * sw); x++) {
    const y = topIn(x, Math.min(p.ls.y, p.rs.y) - 0.6 * sw, Math.max(p.ls.y, p.rs.y) + 0.2 * sw);
    if (y !== null) neckY = Math.min(neckY, y);
  }
  if (!Number.isFinite(neckY)) neckY = (lsA.y + rsA.y) / 2 - 0.1 * sw;

  const anchors: Anchors = {
    neck: norm({ x: ncx, y: neckY }),
    left_shoulder: norm(lsA),
    right_shoulder: norm(rsA),
    left_hip: norm(p.lh),
    right_hip: norm(p.rh),
  };

  // Sleeves: walk down the arm (shoulder -> elbow -> wrist) while it's still covered by the
  // garment. Where coverage ends is the cuff; past the elbow means a long sleeve.
  const rank: Record<SleeveType, number> = { none: 0, short: 1, long: 2 };
  let sleeve: SleeveType = "none";
  const r = Math.max(1, Math.round(0.02 * sw));
  for (const side of ["left", "right"] as const) {
    const S = side === "left" ? p.ls : p.rs;
    const dir = side === "left" ? out : -out;
    const E = (side === "left" ? p.le : p.re) ?? { x: S.x + dir * 0.1 * sw, y: S.y + 0.82 * sw };
    const Wp = (side === "left" ? p.lw : p.rw) ?? { x: E.x + (E.x - S.x) * 0.9, y: E.y + (E.y - S.y) * 0.9 };
    const point = (t: number): Vec2 =>
      t <= 1 ? { x: S.x + (E.x - S.x) * t, y: S.y + (E.y - S.y) * t } : { x: E.x + (Wp.x - E.x) * (t - 1), y: E.y + (Wp.y - E.y) * (t - 1) };
    let end = 0, gap = 0;
    for (let t = 0; t <= 2; t += 0.02) {
      if (covered(point(t), r)) { end = t; gap = 0; }
      else if ((gap += 0.02) > 0.1) break;
    }
    let s: SleeveType = "none";
    if (end >= 0.25) {
      anchors[`${side}_cuff`] = norm(point(end));
      if (end > 1.3) {
        s = "long";
        anchors[`${side}_elbow`] = norm(E);
      } else s = "short";
    }
    if (rank[s] > rank[sleeve]) sleeve = s;
  }
  return { anchors, sleeve };
}

/* ------------------------------------------------------------------ plain-background photos */

/** Flood-fills the backdrop from the border by colour distance. Returns border uniformity. */
function removeUniformBackground(work: Work, warnings: string[], threshold = 28): number {
  const { w, h, rgba } = work;
  const bw = Math.max(2, Math.floor(Math.min(w, h) / 100));
  const border: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (y < bw || y >= h - bw || x < bw || x >= w - bw) border.push(y * w + x);
  const med = [0, 1, 2].map((c) => {
    const v = border.map((i) => rgba[4 * i + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const dist = (i: number) =>
    Math.hypot(rgba[4 * i] - med[0], rgba[4 * i + 1] - med[1], rgba[4 * i + 2] - med[2]);
  const uniformity = border.filter((i) => dist(i) < threshold).length / border.length;

  // Grow the backdrop from the border through pixels close to the backdrop colour (connected
  // only, so a white logo inside the garment survives). Tolerating gradual shading instead was
  // tried and leaks into light garments on light walls, so uneven backdrops get a warning.
  const bg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (i: number) => {
    if (!bg[i] && dist(i) < threshold) { bg[i] = 1; stack[sp++] = i; }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp];
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // Hard mask, then feather inward by one pixel so no backdrop-coloured fringe survives.
  for (let i = 0; i < w * h; i++) work.alpha[i] = bg[i] ? 0 : 255;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      if (bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w]) work.alpha[i] = 128;
    }
  const fg = countAbove(work.alpha, 127) / (w * h);
  if (fg > 0.95) warnings.push("Almost nothing was removed; a transparent PNG will work better.");
  keepLargestComponent(work.alpha, w, h);
  return uniformity;
}

/** Shoulder-seam corner on one side of a front-view outline (port of _seam_corner). */
function seamCorner(mask: Uint8Array, w: number, h: number, cx: number, outward: number, torsoW: number): Vec2 | null {
  const topy = new Float64Array(w).fill(h);
  let minX = w, maxX = -1;
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (mask[y * w + x]) { topy[x] = y; if (x < minX) minX = x; if (x > maxX) maxX = x; break; }
  if (maxX < 0) return null;
  const k = Math.max(1, Math.floor(0.006 * w));
  const sm = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let j = x - k; j <= x + k; j++) if (j >= 0 && j < w) { s += topy[j]; n++; }
    sm[x] = s / n;
  }
  const extreme = outward > 0 ? maxX : minX;
  const start = Math.floor(cx + outward * 0.12 * torsoW);
  if ((extreme - start) * outward <= 0) return null;
  const step = Math.max(1, Math.floor(0.015 * w));
  let steepSeen = false;
  for (let x = extreme - outward * step; (x - start) * outward > 0; x -= outward) {
    const xIn = x - outward * step;
    if (xIn < 0 || xIn >= w) break;
    const slope = (sm[x] - sm[xIn]) / step;
    if (slope > 0.6) { steepSeen = true; continue; }
    if (steepSeen && slope < 0.45) return { x, y: topy[x] };
  }
  return null;
}

/** Heuristic anchors from a front-view upper-body outline (port of detect_anchors). */
function anchorsFromSilhouette(work: Work, warnings: string[]): { anchors: Anchors; sleeve: SleeveType } {
  const { w, h } = work;
  const mask = new Uint8Array(w * h);
  let top = h, bottom = -1, sumX = 0, n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (work.alpha[y * w + x] > 127) {
        mask[y * w + x] = 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        sumX += x;
        n++;
      }
  const gh = bottom - top;
  const cx = sumX / n;
  const rowExtent = (y: number): [number, number] | null => {
    let a = -1, b = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (a < 0) a = x; b = x; }
    return a < 0 ? null : [a, b];
  };
  const band: [number, number][] = [];
  for (let y = Math.floor(bottom - 0.12 * gh); y < Math.floor(bottom - 0.04 * gh); y++) {
    const e = rowExtent(y);
    if (e) band.push(e);
  }
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  const xl = band.length ? median(band.map((b) => b[0])) : cx - 0.3 * w;
  const xr = band.length ? median(band.map((b) => b[1])) : cx + 0.3 * w;
  const torsoW = xr - xl;
  if (torsoW < 0.2 * w) warnings.push("The hem looks unusually narrow; anchors may be off.");

  let neckY = Infinity;
  for (let x = Math.floor(cx - 0.05 * torsoW); x <= Math.floor(cx + 0.05 * torsoW); x++)
    for (let y = 0; y < h; y++) if (mask[y * w + x]) { neckY = Math.min(neckY, y); break; }
  if (!Number.isFinite(neckY)) neckY = top + 0.05 * gh;

  const seams: Record<"left" | "right", Vec2> = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
  for (const [side, outward] of [["left", 1], ["right", -1]] as const) {
    const s = seamCorner(mask, w, h, cx, outward, torsoW);
    if (!s) warnings.push(`Couldn't find the ${side} shoulder seam; placed a default.`);
    seams[side] = s ?? { x: outward > 0 ? xr - 0.07 * torsoW : xl + 0.07 * torsoW, y: top + 0.12 * gh };
  }
  const seamY = (seams.left.y + seams.right.y) / 2;
  const hipY = seamY + 0.75 * (bottom - seamY);
  const hipInset = 0.17 * torsoW;
  const anchors: Anchors = {
    neck: { x: cx / w, y: neckY / h },
    left_shoulder: { x: seams.left.x / w, y: seams.left.y / h },
    right_shoulder: { x: seams.right.x / w, y: seams.right.y / h },
    left_hip: { x: (xr - hipInset) / w, y: hipY / h },
    right_hip: { x: (xl + hipInset) / w, y: hipY / h },
  };

  const rank: Record<SleeveType, number> = { none: 0, short: 1, long: 2 };
  let sleeve: SleeveType = "none";
  const margin = 0.04 * torsoW;
  const shoulderW = seams.left.x - seams.right.x;
  for (const side of ["right", "left"] as const) {
    const sh = seams[side];
    const pts: Vec2[] = [];
    for (let y = top; y < top + 0.75 * gh; y++)
      for (let x = 0; x < w; x++)
        if (mask[y * w + x] && (side === "right" ? x < xl - margin : x > xr + margin)) pts.push({ x, y });
    if (pts.length < 0.002 * n) continue;
    const d = pts.map((q) => Math.hypot(q.x - sh.x, q.y - sh.y));
    const cut = [...d].sort((a, b) => a - b)[Math.floor(0.97 * (d.length - 1))];
    const far = pts.filter((_, i) => d[i] >= cut);
    const cuff = { x: far.reduce((s, q) => s + q.x, 0) / far.length, y: far.reduce((s, q) => s + q.y, 0) / far.length };
    anchors[`${side}_cuff`] = { x: cuff.x / w, y: cuff.y / h };
    let s: SleeveType = "short";
    if (Math.hypot(cuff.x - sh.x, cuff.y - sh.y) > 0.95 * shoulderW) {
      s = "long";
      anchors[`${side}_elbow`] = { x: (sh.x + 0.5 * (cuff.x - sh.x)) / w, y: (sh.y + 0.5 * (cuff.y - sh.y)) / h };
    }
    if (rank[s] > rank[sleeve]) sleeve = s;
  }
  return { anchors, sleeve };
}
