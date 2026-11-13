/**
 * Synthetic test scene: an animated 2D mannequin with exact landmarks and an exact
 * category mask. Used for automated render tests and as a no-camera demo. It exercises
 * tracking, smoothing, deformation, occlusion and rendering, but NOT the pose model.
 */
import { SEG, type CategoryMask, type PixelLandmark, type Vec2 } from "../lib/types";
import type { PoseProvider } from "./vision";

export interface SyntheticPose {
  centre: Vec2;
  sw: number;
  /** arm angles from straight-down, radians (positive = outward) */
  leftUpper: number;
  leftFore: number;
  rightUpper: number;
  rightFore: number;
  /** when true the left forearm crosses in front of the chest */
  crossLeft: boolean;
  /** visibility of everything (to simulate tracking loss) */
  visible: boolean;
}

export type SyntheticScript = "wave" | "static" | "cross" | "lost" | "raise" | "flex";

export function poseAt(tSec: number, script: SyntheticScript = "wave"): SyntheticPose {
  const base: SyntheticPose = {
    centre: { x: 640, y: 390 },
    sw: 200,
    leftUpper: 0.25,
    leftFore: 0.1,
    rightUpper: 0.25,
    rightFore: 0.1,
    crossLeft: false,
    visible: true,
  };
  if (script === "static") return base;
  if (script === "cross") return { ...base, crossLeft: true };
  if (script === "raise") return { ...base, leftUpper: 1.45, leftFore: 1.9, rightUpper: 0.9, rightFore: 0.9 };
  // both upper arms out to the sides, forearms pointing up (like a "flex")
  if (script === "flex") return { ...base, leftUpper: 1.35, leftFore: 3.0, rightUpper: 1.35, rightFore: 3.0 };
  if (script === "lost") return { ...base, visible: Math.floor(tSec) % 2 === 0 };
  const s = Math.sin(tSec * 1.3);
  return {
    ...base,
    centre: { x: 640 + 90 * Math.sin(tSec * 0.5), y: 390 + 10 * Math.sin(tSec * 0.9) },
    sw: 200 * (1 + 0.15 * Math.sin(tSec * 0.35)),
    leftUpper: 0.3 + 1.1 * (0.5 + 0.5 * s),
    leftFore: 0.3 + 1.6 * (0.5 + 0.5 * s),
    rightUpper: 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(tSec * 0.8 + 1)),
    rightFore: 0.2,
  };
}

interface Skeleton {
  ls: Vec2;
  rs: Vec2;
  lh: Vec2;
  rh: Vec2;
  le: Vec2;
  re: Vec2;
  lw: Vec2;
  rw: Vec2;
  head: Vec2;
}

function skeleton(p: SyntheticPose): Skeleton {
  const { centre: c, sw } = p;
  const ls = { x: c.x + sw / 2, y: c.y - sw * 0.6 };
  const rs = { x: c.x - sw / 2, y: c.y - sw * 0.6 };
  const lh = { x: c.x + sw * 0.34, y: c.y + sw * 0.7 };
  const rh = { x: c.x - sw * 0.34, y: c.y + sw * 0.7 };
  const ua = sw * 0.62;
  const fa = sw * 0.58;
  const limb = (o: Vec2, ang: number, len: number, side: 1 | -1) => ({
    x: o.x + side * Math.sin(ang) * len,
    y: o.y + Math.cos(ang) * len,
  });
  const le = limb(ls, p.leftUpper, ua, 1);
  const re = limb(rs, p.rightUpper, ua, -1);
  let lw = limb(le, p.leftFore, fa, 1);
  if (p.crossLeft) lw = { x: c.x - sw * 0.25, y: c.y - sw * 0.05 };
  const rw = limb(re, p.rightFore, fa, -1);
  return { ls, rs, lh, rh, le, re, lw, rw, head: { x: c.x, y: c.y - sw * 1.15 } };
}

export class SyntheticScene implements PoseProvider {
  readonly label = "Synthetic mannequin (no camera, no pose model)";
  readonly canSegment = true;
  readonly canvas: HTMLCanvasElement;
  private maskCanvas: HTMLCanvasElement;
  private current: SyntheticPose = poseAt(0);
  private t0 = performance.now();
  private noiseSeed = 1;

  constructor(
    public script: SyntheticScript = "wave",
    public width = 1280,
    public height = 720,
    public noisePx = 2.5,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = width / 4;
    this.maskCanvas.height = height / 4;
  }

  /** Advance the animation and draw the frame. Returns the time used, in seconds. */
  drawFrame(tSec?: number): number {
    const t = tSec ?? (performance.now() - this.t0) / 1000;
    this.current = poseAt(t, this.script);
    const ctx = this.canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, "#5d6470");
    g.addColorStop(1, "#2f343c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.current.visible) this.paint(ctx, false, 1);
    const m = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
    m.fillStyle = "rgb(0,0,0)";
    m.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    if (this.current.visible) this.paint(m, true, 0.25);
    return t;
  }

  private paint(ctx: CanvasRenderingContext2D, mask: boolean, k: number): void {
    const s = skeleton(this.current);
    const sw = this.current.sw;
    // In the mask pass each class gets its own colour channel so anti-aliased edges can't
    // decode to a wrong class (they just fall below the threshold).
    const MASK_COL: Record<number, string> = {
      [SEG.bodySkin]: "rgb(255,0,0)",
      [SEG.faceSkin]: "rgb(0,255,0)",
      [SEG.hair]: "rgb(0,0,255)",
      [SEG.clothes]: "rgb(255,255,0)",
    };
    const col = (cls: number, color: string) => (mask ? MASK_COL[cls] : color);
    ctx.save();
    ctx.scale(k, k);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const limb = (a: Vec2, b: Vec2, w: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const skin = col(SEG.bodySkin, "#c99a7b");
    // right arm (behind nothing)
    limb(s.rs, s.re, sw * 0.24, skin);
    limb(s.re, s.rw, sw * 0.2, skin);
    // neck + head
    limb({ x: this.current.centre.x, y: s.ls.y }, s.head, sw * 0.28, skin);
    ctx.fillStyle = col(SEG.faceSkin, "#d4a585");
    ctx.beginPath();
    ctx.ellipse(s.head.x, s.head.y, sw * 0.32, sw * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col(SEG.hair, "#2a1d16");
    ctx.beginPath();
    ctx.ellipse(s.head.x, s.head.y - sw * 0.18, sw * 0.34, sw * 0.26, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    // torso in the user's own (grey) shirt
    ctx.fillStyle = col(SEG.clothes, "#8c949c");
    ctx.beginPath();
    ctx.moveTo(s.rs.x - sw * 0.08, s.rs.y - sw * 0.04);
    ctx.lineTo(s.ls.x + sw * 0.08, s.ls.y - sw * 0.04);
    ctx.lineTo(s.lh.x + sw * 0.12, s.lh.y + sw * 0.2);
    ctx.lineTo(s.rh.x - sw * 0.12, s.rh.y + sw * 0.2);
    ctx.closePath();
    ctx.fill();
    if (!mask) {
      // a plaid pattern on the user's own shirt, to check it doesn't print through garments
      ctx.save();
      ctx.clip();
      const step = sw * 0.09;
      ctx.lineWidth = sw * 0.025;
      ctx.strokeStyle = "rgba(150,20,30,0.75)";
      for (let x = s.rh.x - sw; x < s.lh.x + sw; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, s.rs.y - sw);
        ctx.lineTo(x, s.rh.y + sw);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(20,20,40,0.6)";
      for (let y = s.rs.y - sw; y < s.rh.y + sw; y += step) {
        ctx.beginPath();
        ctx.moveTo(s.rh.x - sw, y);
        ctx.lineTo(s.lh.x + sw, y);
        ctx.stroke();
      }
      ctx.restore();
    }
    // left arm (may cross in front of the torso)
    limb(s.ls, s.le, sw * 0.24, skin);
    limb(s.le, s.lw, sw * 0.2, skin);
    ctx.fillStyle = skin;
    for (const w of [s.lw, s.rw]) {
      ctx.beginPath();
      ctx.arc(w.x, w.y, sw * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private noise(): number {
    this.noiseSeed = (this.noiseSeed * 16807) % 2147483647;
    return (this.noiseSeed / 2147483647 - 0.5) * 2 * this.noisePx;
  }

  detect(): PixelLandmark[] | null {
    if (!this.current.visible) return null;
    const s = skeleton(this.current);
    const lm: PixelLandmark[] = Array.from({ length: 33 }, () => ({ ...s.head, visibility: 0.99 }));
    const put = (i: number, p: Vec2, v = 0.98) => (lm[i] = { x: p.x + this.noise(), y: p.y + this.noise(), visibility: v });
    put(11, s.ls);
    put(12, s.rs);
    put(13, s.le);
    put(14, s.re);
    put(15, s.lw);
    put(16, s.rw);
    for (const i of [17, 19, 21]) put(i, { x: s.lw.x, y: s.lw.y + this.current.sw * 0.1 });
    for (const i of [18, 20, 22]) put(i, { x: s.rw.x, y: s.rw.y + this.current.sw * 0.1 });
    put(23, s.lh);
    put(24, s.rh);
    return lm;
  }

  segment(): CategoryMask | null {
    const m = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
    const { width, height } = this.maskCanvas;
    const rgba = m.getImageData(0, 0, width, height).data;
    const data = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) {
      const r = rgba[4 * i];
      const g = rgba[4 * i + 1];
      const b = rgba[4 * i + 2];
      data[i] =
        r > 127 && g > 127 ? SEG.clothes : r > 127 ? SEG.bodySkin : g > 127 ? SEG.faceSkin : b > 127 ? SEG.hair : SEG.background;
    }
    return { width, height, data };
  }

  async downgrade(): Promise<boolean> {
    return false;
  }

  close(): void {}
}
