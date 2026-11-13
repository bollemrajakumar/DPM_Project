import type { Anchors, Garment, Vec2 } from "../lib/types";
import type { BodyState } from "../tracking/bodyTracker";
import { applyArm, bilinear, forearmWeight, inverseBilinear, smoothstep, solveArm, type ArmPose, type ArmRest, type Quad } from "./deform";
import { fillNearest, sampleField, segmentSleeve, type SideSegmentation } from "./sleeveSegmentation";

export interface AlphaGrid {
  width: number;
  height: number;
  /** alpha 0..255, row-major, width*height */
  data: Uint8Array | Uint8ClampedArray;
}

export interface Calibration {
  /** uniform scale multiplier */
  scale: number;
  /** offsets in shoulder-widths */
  offsetX: number;
  offsetY: number;
  /** extra width multiplier (loose/tight fit) */
  width: number;
  /** extra length multiplier (cropped / long fit) */
  length: number;
  /**
   * Where the garment's shoulder-seam corner sits relative to the pose's shoulder JOINT
   * landmark, in shoulder-widths: outward along the shoulder line, and upward. The joint
   * is inside the body, the seam is on its outline, so both are positive. Defaults are a
   * starting guess; "Auto-fit" measures them from the person's silhouette.
   */
  shoulderOut: number;
  shoulderUp: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  width: 1,
  length: 1,
  shoulderOut: 0.06,
  shoulderUp: 0.08,
};

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const norm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};

/** Mesh layers, drawn in this order: 0 torso, then 1 the wearer's left and 2 right sleeve. */
export const LAYERS = 3;
/**
 * Which layer draws a pixel, by its sleeve weight w (renderer FS_MESH uses the same values):
 * a sleeve from w > SLEEVE_FROM, the torso while w < TORSO_UNTIL. At every w at least one of
 * them is fully opaque, so the cut between torso and sleeve never shows a see-through seam.
 */
export const SLEEVE_FROM = 0.35;
export const TORSO_UNTIL = 0.65;

/**
 * Triangulated grids covering the garment's visible pixels, one layer each for the torso
 * and the two sleeves, with per-vertex torso coordinates and sleeve weights precomputed
 * once at load time.
 *
 * Separate layers let a raised sleeve pull away from the torso along the armpit gap. With a
 * single grid, every cell holding both sleeve and torso pixels (the gap in a product photo
 * is often narrower than a cell) was torn apart and faded, leaving see-through, jagged
 * sleeves and stair-stepped torso sides. The renderer cuts each layer down to its own
 * pixels with `parts`.
 */
export class GarmentMesh {
  readonly vertexCount: number;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly positions: Float32Array; // body-space output, updated per frame
  /** per-TRIANGLE opacity, updated per frame: hides fabric folded under itself */
  fade: Float32Array;
  /** Un-indexed copies for the GPU (each triangle owns its 3 vertices so a faded
   *  triangle never affects its neighbours). Sizes: triangles*3 vertices. */
  triUVs: Float32Array = new Float32Array(0);
  triPositions: Float32Array = new Float32Array(0);
  triFade: Float32Array = new Float32Array(0);
  triLayers: Float32Array = new Float32Array(0);
  /** Sleeve weights of the garment image (R = left, G = right), which the renderer uses to
   *  cut each layer to its own pixels. */
  readonly parts: { width: number; height: number; data: Uint8Array };
  private fadeSum: Float32Array | null = null;
  private fadeCnt: Uint16Array | null = null;
  private garmentPx: Float32Array;
  private torsoUV: Float32Array;
  /** torsoUV of the sleeve reshaped for a raised arm (see raisedSleeve) */
  private raisedUV: Float32Array;
  private layer: Uint8Array;
  /** a sleeve vertex's sleeve weight at rest and its forearm weight (0 on the torso) */
  private restW: Float32Array;
  private fore: Float32Array;
  /** sleeve/forearm weights in effect this frame */
  private wL: Float32Array;
  private wR: Float32Array;
  private fL: Float32Array;
  private fR: Float32Array;
  private gq: Quad;
  private armL: ArmRest | null;
  private armR: ArmRest | null;
  readonly gShoulderWidth: number;
  readonly segL: SideSegmentation | null;
  readonly segR: SideSegmentation | null;

  constructor(
    readonly garment: Garment,
    alpha: AlphaGrid,
  ) {
    const [W, H] = garment.image_size;
    const a = garment.anchors;
    const px = (p: Vec2): Vec2 => ({ x: p.x * W, y: p.y * H });
    // Quad order: [image-left shoulder, image-right shoulder, image-right hip, image-left hip]
    // = [right_shoulder, left_shoulder, left_hip, right_hip] (wearer's left is image right).
    this.gq = [px(a.right_shoulder), px(a.left_shoulder), px(a.left_hip), px(a.right_hip)];
    this.gShoulderWidth = Math.hypot(this.gq[1].x - this.gq[0].x, this.gq[1].y - this.gq[0].y);
    this.armL = armRest(a, "left", px, garment.sleeve);
    this.armR = armRest(a, "right", px, garment.sleeve);

    const { cols, rows, sleeve_blend, elbow_blend } = garment.mesh;
    this.segL = this.armL
      ? segmentSleeve(alpha, garment.image_size, this.armL, this.gq[2], 1, this.gShoulderWidth, sleeve_blend)
      : null;
    this.segR = this.armR
      ? segmentSleeve(alpha, garment.image_size, this.armR, this.gq[3], -1, this.gShoulderWidth, sleeve_blend)
      : null;

    const aw = alpha.width;
    const ah = alpha.height;
    const sx = aw / W;
    const sy = ah / H;
    const sL = this.segL?.field;
    const sR = this.segR?.field;
    const visible = (p: number) => alpha.data[p] > 8;
    const owns = (l: number, p: number) => {
      const wl = sL ? sL[p] : 0;
      const wr = sR ? sR[p] : 0;
      return l === 0 ? Math.max(wl, wr) < TORSO_UNTIL : (l === 1 ? wl : wr) > SLEEVE_FROM;
    };
    this.parts = { width: aw, height: ah, data: new Uint8Array(aw * ah * 2) };
    for (let p = 0; p < aw * ah; p++) {
      this.parts.data[2 * p] = Math.round((sL ? sL[p] : 0) * 255);
      this.parts.data[2 * p + 1] = Math.round((sR ? sR[p] : 0) * 255);
    }
    const hasLayer = [true, !!sL, !!sR];
    // Rest sleeve weight of each sleeve layer: a hinge along the seam that joins the sleeve to
    // the torso, rising from 0 at the seam to 1 at HINGE shoulder-widths from it, measured
    // through the fabric (a sleeve merely hanging next to the torso across a gap isn't sewn
    // to it). Near rest the sleeve thus turns with the arm while the seam stays closed, its
    // stretch spread over the hinge instead of tearing one row of cells. The values extend
    // from the sleeve's pixels into the rest of the image, so a sleeve vertex lying over torso
    // pixels moves with the sleeve. The torso layer follows the torso only: rotating its
    // shoulder edge with the arm tore it, and a raised arm opens the underarm instead.
    const solid = (p: number) => alpha.data[p] > 96;
    const seamDist = new Float32Array(aw * ah).fill(Infinity);
    const queue = new Int32Array(aw * ah);
    let qt = 0;
    for (let p = 0; p < aw * ah; p++)
      if (solid(p) && Math.max(sL ? sL[p] : 0, sR ? sR[p] : 0) < 0.5) (seamDist[p] = 0), (queue[qt++] = p);
    for (let qh = 0; qh < qt; qh++) {
      const p = queue[qh];
      const x = p % aw;
      for (const q of [x > 0 ? p - 1 : -1, x < aw - 1 ? p + 1 : -1, p - aw, p + aw]) {
        if (q < 0 || q >= aw * ah || !solid(q) || seamDist[q] <= seamDist[p] + 1) continue;
        seamDist[q] = seamDist[p] + 1;
        queue[qt++] = q;
      }
    }
    const hinge = HINGE * this.gShoulderWidth * sx;
    const fields = [null, sL, sR].map((s, l) => {
      if (!s) return null;
      const f = new Float32Array(aw * ah).fill(NaN);
      for (let p = 0; p < aw * ah; p++) if (solid(p) && owns(l, p)) f[p] = smoothstep(0, hinge, seamDist[p]);
      return fillNearest(f, aw, ah);
    });

    const gAcross = norm(sub(this.gq[1], this.gq[0]));
    const gDown = { x: -gAcross.y, y: gAcross.x };
    const jointAt = (seam: Vec2, inward: 1 | -1): Vec2 => ({
      x: seam.x + (inward * gAcross.x * DEFAULT_CALIBRATION.shoulderOut + gDown.x * DEFAULT_CALIBRATION.shoulderUp) * this.gShoulderWidth,
      y: seam.y + (inward * gAcross.y * DEFAULT_CALIBRATION.shoulderOut + gDown.y * DEFAULT_CALIBRATION.shoulderUp) * this.gShoulderWidth,
    });
    const owned = (s: Float32Array) => (x: number, y: number) => alpha.data[y * aw + x] > 96 && s[y * aw + x] >= 0.5;
    const reshape = [
      null,
      this.armL && sL ? raisedSleeve(this.armL, jointAt(this.gq[1], -1), owned(sL), aw, ah, sx, sy, this.gShoulderWidth) : null,
      this.armR && sR ? raisedSleeve(this.armR, jointAt(this.gq[0], 1), owned(sR), aw, ah, sx, sy, this.gShoulderWidth) : null,
    ];

    const nGrid = (cols + 1) * (rows + 1);
    const nv = LAYERS * nGrid;
    this.vertexCount = nv;
    this.uvs = new Float32Array(nv * 2);
    this.garmentPx = new Float32Array(nv * 2);
    this.torsoUV = new Float32Array(nv * 2);
    this.raisedUV = new Float32Array(nv * 2);
    this.positions = new Float32Array(nv * 2);
    this.fade = new Float32Array(0);
    this.layer = new Uint8Array(nv);
    this.restW = new Float32Array(nv);
    this.fore = new Float32Array(nv);
    this.wL = new Float32Array(nv);
    this.wR = new Float32Array(nv);
    this.fL = new Float32Array(nv);
    this.fR = new Float32Array(nv);

    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const v = j / rows;
        const g = { x: u * W, y: v * H };
        const tuv = inverseBilinear(g, this.gq);
        const foreL = this.armL ? forearmWeight(g, this.armL, elbow_blend) : 0;
        const foreR = this.armR ? forearmWeight(g, this.armR, elbow_blend) : 0;
        for (let l = 0; l < LAYERS; l++) {
          const k = l * nGrid + j * (cols + 1) + i;
          this.layer[k] = l;
          this.uvs[2 * k] = u;
          this.uvs[2 * k + 1] = v;
          this.garmentPx[2 * k] = g.x;
          this.garmentPx[2 * k + 1] = g.y;
          this.torsoUV[2 * k] = tuv.x;
          this.torsoUV[2 * k + 1] = tuv.y;
          const r = reshape[l];
          const ruv = r ? inverseBilinear(r(g), this.gq) : tuv;
          this.raisedUV[2 * k] = ruv.x;
          this.raisedUV[2 * k + 1] = ruv.y;
          const f = fields[l];
          if (!f) continue;
          this.restW[k] = sampleField(f, aw, ah, g.x * sx, g.y * sy);
          this.fore[k] = l === 1 ? foreL : foreR;
          this.setWeights(k, 0);
        }
      }
    }

    // Keep only cells that contain pixels of the layer (dilated by one cell so edges aren't clipped).
    const cells = cols * rows;
    const occupied = new Uint8Array(LAYERS * cells);
    for (let j = 0; j < rows; j++) {
      const y0 = Math.floor((j / rows) * ah);
      const y1 = Math.max(y0 + 1, Math.ceil(((j + 1) / rows) * ah));
      for (let i = 0; i < cols; i++) {
        const x0 = Math.floor((i / cols) * aw);
        const x1 = Math.max(x0 + 1, Math.ceil(((i + 1) / cols) * aw));
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const p = y * aw + x;
            if (!visible(p)) continue;
            for (let l = 0; l < LAYERS; l++) if (hasLayer[l] && owns(l, p)) occupied[l * cells + j * cols + i] = 1;
          }
      }
    }
    const idx: number[] = [];
    for (let l = 0; l < LAYERS; l++) {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let on = false;
          for (let dj = -1; dj <= 1 && !on; dj++)
            for (let di = -1; di <= 1 && !on; di++) {
              const jj = j + dj;
              const ii = i + di;
              if (jj >= 0 && jj < rows && ii >= 0 && ii < cols && occupied[l * cells + jj * cols + ii]) on = true;
            }
          if (!on) continue;
          const k0 = l * nGrid + j * (cols + 1) + i;
          const k1 = k0 + 1;
          const k2 = k0 + cols + 1;
          const k3 = k2 + 1;
          idx.push(k0, k2, k1, k1, k2, k3);
        }
      }
    }
    this.indices = new Uint32Array(idx);
    const nt = idx.length / 3;
    this.fade = new Float32Array(nt).fill(1);
    this.triUVs = new Float32Array(idx.length * 2);
    this.triPositions = new Float32Array(idx.length * 2);
    this.triFade = new Float32Array(idx.length).fill(1);
    this.triLayers = new Float32Array(idx.length);
    for (let i = 0; i < idx.length; i++) {
      this.triUVs[2 * i] = this.uvs[2 * idx[i]];
      this.triUVs[2 * i + 1] = this.uvs[2 * idx[i] + 1];
      this.triLayers[i] = this.layer[idx[i]];
    }
  }

  /**
   * Body quad matching the garment quad [R seam, L seam, L hip, R hip].
   *
   * - Top corners: the shoulder-seam corners, placed outward/upward of the shoulder joint
   *   landmarks (Calibration.shoulderOut/Up).
   * - Horizontal scale comes from the shoulder seams only; the garment keeps its own
   *   width proportions down the torso (a boxy tee stays boxy). The hip landmarks are
   *   joint centres, much narrower than the hips' outline, so they must not set the width.
   * - Vertical scale and lean come from the torso axis (shoulders -> hips). This stays
   *   stable when the person turns and the shoulder width shrinks.
   */
  bodyQuad(body: BodyState, cal: Calibration = DEFAULT_CALIBRATION): Quad {
    const sw = body.shoulderWidth;
    const across = norm(sub(body.leftShoulder, body.rightShoulder));
    const up = { x: across.y, y: -across.x }; // perpendicular, pointing up (image y grows down)
    const seamR = {
      x: body.rightShoulder.x - across.x * cal.shoulderOut * sw + up.x * cal.shoulderUp * sw,
      y: body.rightShoulder.y - across.y * cal.shoulderOut * sw + up.y * cal.shoulderUp * sw,
    };
    const seamL = {
      x: body.leftShoulder.x + across.x * cal.shoulderOut * sw + up.x * cal.shoulderUp * sw,
      y: body.leftShoulder.y + across.y * cal.shoulderOut * sw + up.y * cal.shoulderUp * sw,
    };
    const bTop = mid(seamR, seamL);
    const hipMid = mid(body.leftHip, body.rightHip);
    const bAxis = sub(hipMid, bTop);
    const bLen = Math.hypot(bAxis.x, bAxis.y);
    const bDown = norm(bAxis);
    const hipAcross = norm(sub(body.leftHip, body.rightHip));
    const Sw = Math.hypot(seamL.x - seamR.x, seamL.y - seamR.y) * cal.scale * cal.width;
    const Sh = bLen * cal.scale * cal.length;

    const g = this.gq;
    const gTop = mid(g[0], g[1]);
    const gAcross = norm(sub(g[1], g[0]));
    const gDown = { x: -gAcross.y, y: gAcross.x };
    const gSeam = Math.hypot(g[1].x - g[0].x, g[1].y - g[0].y);
    const gLen = dot(sub(mid(g[2], g[3]), gTop), gDown);

    const off = {
      x: (across.x * cal.offsetX + bDown.x * cal.offsetY) * sw,
      y: (across.y * cal.offsetX + bDown.y * cal.offsetY) * sw,
    };
    return g.map((p, i) => {
      const d = sub(p, gTop);
      const a = dot(d, gAcross) / gSeam; // shoulder-seam widths
      const b = dot(d, gDown) / gLen; // torso lengths
      const ax = i < 2 ? across : hipAcross; // hem follows the hip line's tilt
      // centre of this row on the body's torso axis, scaled about the seam centre
      return {
        x: bTop.x + bDown.x * b * Sh + ax.x * a * Sw + off.x,
        y: bTop.y + bDown.y * b * Sh + ax.y * a * Sw + off.y,
      };
    }) as Quad;
  }

  /** Recompute body-space vertex positions for the current pose. Returns this.positions. */
  deform(body: BodyState, cal: Calibration = DEFAULT_CALIBRATION): Float32Array {
    const bq = this.bodyQuad(body, cal);
    const toBody = (g: Vec2) => bilinear(inverseBilinear(g, this.gq), bq);
    const poseL = this.armL
      ? solveArm(
          this.armL,
          {
            shoulder: body.leftShoulder,
            elbow: body.leftElbow,
            wrist: body.leftWrist,
            armConf: body.leftArmConf,
            forearmConf: body.leftForearmConf,
          },
          toBody,
        )
      : null;
    const poseR = this.armR
      ? solveArm(
          this.armR,
          {
            shoulder: body.rightShoulder,
            elbow: body.rightElbow,
            wrist: body.rightWrist,
            armConf: body.rightArmConf,
            forearmConf: body.rightForearmConf,
          },
          toBody,
        )
      : null;

    // How far each sleeve is set up for a raised arm: none near the rest angle, fully from
    // about 50 degrees of upper-arm rotation. A raised sleeve is reshaped (raisedSleeve) and
    // turns as one rigid piece: hinging its root to the torso there would smear a "cape"
    // across the underarm. Near rest the hinge keeps the seam closed.
    const raisedBy = (pose: ArmPose | null) => (pose ? smoothstep(0.3, 0.9, Math.abs(pose.upper.phi)) : 0);
    const raised = [0, raisedBy(poseL), raisedBy(poseR)];
    for (let k = 0; k < this.vertexCount; k++) if (this.layer[k]) this.setWeights(k, raised[this.layer[k]]);
    const out = this.positions;
    const T = this.torsoUV;
    const R = this.raisedUV;
    for (let k = 0; k < this.vertexCount; k++) {
      const a = raised[this.layer[k]];
      let p = bilinear({ x: T[2 * k] + a * (R[2 * k] - T[2 * k]), y: T[2 * k + 1] + a * (R[2 * k + 1] - T[2 * k + 1]) }, bq);
      if (poseL && this.wL[k] > 0) p = applyArm(p, this.wL[k], this.fL[k], poseL);
      if (poseR && this.wR[k] > 0) p = applyArm(p, this.wR[k], this.fR[k], poseR);
      out[2 * k] = p.x;
      out[2 * k + 1] = p.y;
    }
    this.updateFade();
    return out;
  }

  /**
   * Triangles turned over relative to the photo are fabric folded under itself, e.g. on the
   * inside of a bent elbow; they are hidden so the fold doesn't poke out past the crease. A
   * bent elbow otherwise just stretches the outside of the sleeve, like real fabric.
   */
  private updateFade(): void {
    const { fade, positions: P, garmentPx: G, indices: I, triPositions: TP, triFade: TF } = this;
    const area = (A: Float32Array, a: number, b: number, c: number) =>
      (A[2 * b] - A[2 * a]) * (A[2 * c + 1] - A[2 * a + 1]) - (A[2 * c] - A[2 * a]) * (A[2 * b + 1] - A[2 * a + 1]);
    const nv = this.vertexCount;
    const sum = (this.fadeSum ??= new Float32Array(nv));
    const cnt = (this.fadeCnt ??= new Uint16Array(nv));
    sum.fill(0);
    cnt.fill(0);
    for (let t = 0, i = 0; i < I.length; t++, i += 3) {
      const a = I[i];
      const b = I[i + 1];
      const c = I[i + 2];
      const f = this.layer[a] && area(P, a, b, c) * area(G, a, b, c) < 0 ? 0 : 1;
      fade[t] = f;
      for (const v of [a, b, c]) {
        sum[v] += f;
        cnt[v]++;
      }
      TP[2 * i] = P[2 * a];
      TP[2 * i + 1] = P[2 * a + 1];
      TP[2 * i + 2] = P[2 * b];
      TP[2 * i + 3] = P[2 * b + 1];
      TP[2 * i + 4] = P[2 * c];
      TP[2 * i + 5] = P[2 * c + 1];
    }
    // A folded triangle disappears completely (no translucent "ghost"); its neighbours are
    // softened toward it at the shared corners, so the crease is feathered, not saw-toothed.
    for (let t = 0, i = 0; i < I.length; t++, i += 3) {
      for (let j = 0; j < 3; j++) {
        const v = I[i + j];
        TF[i + j] = fade[t] * (0.35 + (0.65 * sum[v]) / cnt[v]);
      }
    }
  }


  /** Smallest fade among the triangles that use vertex k (tests/debugging). */
  vertexFade(k: number): number {
    let m = 1;
    for (let i = 0; i < this.indices.length; i++) if (this.indices[i] === k) m = Math.min(m, this.fade[(i / 3) | 0]);
    return m;
  }

  /** Weights of sleeve vertex k for a sleeve raised by `raised` (0 rest .. 1 raised). */
  private setWeights(k: number, raised: number): void {
    const w = this.restW[k] + raised * (1 - this.restW[k]);
    if (this.layer[k] === 1) {
      this.wL[k] = w;
      this.fL[k] = w * this.fore[k];
    } else {
      this.wR[k] = w;
      this.fR[k] = w * this.fore[k];
    }
  }

  /** Layer of vertex k: 0 torso, 1 left sleeve, 2 right sleeve. */
  vertexLayer(k: number): number {
    return this.layer[k];
  }

  /** Sleeve weights, exposed for debugging overlays and tests. */
  weightsAt(k: number) {
    return { wL: this.wL[k], wR: this.wR[k], fL: this.fL[k], fR: this.fR[k] };
  }
  garmentPoint(k: number): Vec2 {
    return { x: this.garmentPx[2 * k], y: this.garmentPx[2 * k + 1] };
  }
}

function armRest(a: Anchors, side: "left" | "right", px: (p: Vec2) => Vec2, sleeve: Garment["sleeve"]): ArmRest | null {
  const cuff = a[`${side}_cuff`];
  if (sleeve === "none" || !cuff) return null;
  const elbow = a[`${side}_elbow`];
  const ls = px(a.left_shoulder);
  const rs = px(a.right_shoulder);
  // Short sleeves stop above the elbow, so the elbow isn't on the garment. Typical body:
  // shoulder-joint->elbow is about 0.82 shoulder-seam widths.
  const upperLen = 0.82 * Math.hypot(ls.x - rs.x, ls.y - rs.y);
  return { shoulder: px(a[`${side}_shoulder`]), elbow: elbow ? px(elbow) : null, cuff: px(cuff), upperLen };
}

/** Width of the hinge between sleeve and torso at rest, in shoulder-seam widths. */
const HINGE = 0.15;

/** Half the thickness of an upper arm, with a little ease, in shoulder-seam widths. */
const ARM_HALF = 0.15;

/**
 * Upper sleeve reshaped for a raised arm. In a front product photo the top of a sleeve is a
 * narrow wedge outward of the shoulder joint (the underarm panel is hidden against the
 * body), so rotated up with the arm it would cover only the top of the arm. Here the
 * sleeve's cross-section at each point along the upper arm is centred on the arm's axis and
 * widened to at least the arm's thickness. It tapers out toward the elbow, where the photo
 * shows the full sleeve. Returns the reshaped garment point.
 */
function raisedSleeve(
  arm: ArmRest,
  joint: Vec2,
  owned: (x: number, y: number) => boolean,
  aw: number,
  ah: number,
  sx: number,
  sy: number,
  seamWidth: number,
): (g: Vec2) => Vec2 {
  let elbow = arm.elbow;
  if (!elbow) {
    const d = norm(sub(arm.cuff, arm.shoulder));
    const L = arm.upperLen ?? Math.hypot(arm.cuff.x - arm.shoulder.x, arm.cuff.y - arm.shoulder.y);
    elbow = { x: arm.shoulder.x + d.x * L, y: arm.shoulder.y + d.y * L };
  }
  const axis = sub(elbow, joint);
  const L = Math.hypot(axis.x, axis.y) || 1;
  const u = { x: axis.x / L, y: axis.y / L };
  const n = { x: -u.y, y: u.x };
  // The sleeve's cross-section [lo, hi] across the axis, in bins along it.
  const BINS = 24;
  const lo = new Float32Array(BINS).fill(Infinity);
  const hi = new Float32Array(BINS).fill(-Infinity);
  for (let y = 0; y < ah; y++)
    for (let x = 0; x < aw; x++) {
      if (!owned(x, y)) continue;
      const d = { x: (x + 0.5) / sx - joint.x, y: (y + 0.5) / sy - joint.y };
      const t = dot(d, u) / L;
      if (t < 0 || t >= 1) continue;
      const b = Math.floor(t * BINS);
      const p = dot(d, n);
      lo[b] = Math.min(lo[b], p);
      hi[b] = Math.max(hi[b], p);
    }
  // Empty bins (e.g. the sleeve starts below the joint) take their nearest filled bin.
  const filled = [...lo.keys()].filter((b) => hi[b] > lo[b]);
  if (!filled.length) return (g) => g;
  const centre = new Float32Array(BINS);
  const half = new Float32Array(BINS);
  for (let b = 0; b < BINS; b++) {
    const s = filled.reduce((best, f) => (Math.abs(f - b) < Math.abs(best - b) ? f : best));
    centre[b] = (lo[s] + hi[s]) / 2;
    half[b] = (hi[s] - lo[s]) / 2;
  }
  const target = ARM_HALF * seamWidth;
  return (g) => {
    const d = sub(g, joint);
    const t = dot(d, u) / L;
    const taper = 1 - smoothstep(0.65, 1, t);
    if (taper <= 0) return g;
    // linear interpolation between bin centres
    const tb = Math.min(BINS - 1, Math.max(0, t * BINS - 0.5));
    const b0 = Math.floor(tb);
    const b1 = Math.min(BINS - 1, b0 + 1);
    const fr = tb - b0;
    const c = centre[b0] + (centre[b1] - centre[b0]) * fr;
    const h = half[b0] + (half[b1] - half[b0]) * fr;
    // Spread the cross-section to the target half-width (at most 3x) with a smooth easing
    // that reaches the full extra width at the sleeve's edge and only shifts what lies
    // beyond it, so nothing outside the sleeve gets flung away and the edge has no kink.
    const H = Math.min(3 * h, Math.max(h, target));
    const q = dot(d, n) - c;
    const moved = q + (H - h) * Math.sin((Math.PI / 2) * Math.max(-1, Math.min(1, q / Math.max(1e-3, h))));
    const off = (moved - q - c) * taper;
    return { x: g.x + n.x * off, y: g.y + n.y * off };
  };
}

/** Downsample an image's alpha channel to a small grid for mesh-cell occupancy. */
export function alphaGridFromImage(img: CanvasImageSource & { width: number; height: number }, maxSide = 256): AlphaGrid {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = rgba[4 * i + 3];
  return { width: w, height: h, data };
}
