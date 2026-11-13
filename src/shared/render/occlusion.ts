import type { SleeveType, Vec2 } from "../lib/types";
import type { BodyState } from "../tracking/bodyTracker";

/**
 * Draws "may occlude the garment" regions from the pose: hands always, forearms when the
 * garment's sleeves don't cover them, upper arms for sleeveless garments. The renderer
 * intersects this with the segmentation's body-skin class, so only real skin pixels inside
 * these capsules are drawn in front of the garment.
 */
export class CapsulePainter {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(private scale = 0.25) {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
  }

  paint(body: BodyState | null, width: number, height: number, sleeve: SleeveType): HTMLCanvasElement {
    const w = Math.max(1, Math.round(width * this.scale));
    const h = Math.max(1, Math.round(height * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!body) return this.canvas;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "round";
    const sw = body.shoulderWidth;
    const seg = (a: Vec2 | null, b: Vec2 | null, r: number, cap: CanvasLineCap = "round") => {
      if (!a || !b) return;
      ctx.lineCap = cap;
      ctx.lineWidth = 2 * r;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const sides = [
      { sh: body.leftShoulder, el: body.leftElbow, wr: body.leftWrist, hand: body.leftHand, conf: body.leftArmConf },
      { sh: body.rightShoulder, el: body.rightElbow, wr: body.rightWrist, hand: body.rightHand, conf: body.rightArmConf },
    ];
    for (const s of sides) {
      if (s.conf < 0.3) continue;
      // hand: blob around wrist + finger landmarks, extended past them (landmarks stop
      // at the knuckles)
      if (s.wr) {
        const pts = [s.wr, ...s.hand];
        const c = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 });
        const tip = s.el ? { x: c.x + (c.x - s.el.x) * 0.25, y: c.y + (c.y - s.el.y) * 0.25 } : c;
        seg(s.wr, tip, sw * 0.17);
        for (const p of s.hand) seg(s.wr, p, sw * 0.12);
      }
      // Forearm starts a little past the elbow with a flat cap, so it never cuts into the
      // end of a short sleeve.
      if (sleeve !== "long" && s.el && s.wr) {
        const start = { x: s.el.x + (s.wr.x - s.el.x) * 0.18, y: s.el.y + (s.wr.y - s.el.y) * 0.18 };
        seg(start, s.wr, sw * 0.13, "butt");
      }
      if (sleeve === "none") seg(s.sh, s.el, sw * 0.15);
    }
    return this.canvas;
  }
}
