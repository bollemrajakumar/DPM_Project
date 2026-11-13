import { describe, expect, it } from "vitest";
import { CHARTS } from "../charts";
import { recommendSize } from "../fit";
import { ellipsePerimeter, kneePoint, PersonMask } from "../mask";
import {
  analyseFront, analyseSide, combine, SHAPE_FACTOR,
  type BodyMeasurements, type Measurement,
} from "../measure";
import { SizeScan, type ScanState } from "../scan";
import { levels, renderMannequin, type Body, type MannequinOpts } from "../testing/mannequin";

const MAN: Body = { heightCm: 178, shoulderCm: 46, chestW: 31, chestD: 24, waistW: 29, waistD: 21, hipW: 34, hipD: 24 };
const expectedGirth = (w: number, d: number, k: keyof typeof SHAPE_FACTOR) => ellipsePerimeter(w / 2, d / 2) * SHAPE_FACTOR[k];

// 16:9 camera frame, square segmentation mask (anisotropic, like MediaPipe's 256×256 model)
const FRAME: Omit<MannequinOpts, "view"> = { frameW: 1280, frameH: 720, maskW: 512, maskH: 512, personPx: 620 };

describe("mask geometry", () => {
  it("ellipse perimeter matches a circle", () => {
    expect(ellipsePerimeter(10, 10)).toBeCloseTo(2 * Math.PI * 10, 6);
  });

  it("keeps only the largest blob and fills holes", () => {
    const w = 20;
    const h = 20;
    const d = new Uint8Array(w * h);
    for (let y = 2; y < 18; y++) for (let x = 2; x < 12; x++) d[y * w + x] = 1;
    d[10 * w + 6] = 0; // hole
    d[1 * w + 18] = 1; // speck
    const m = PersonMask.fromCategoryMask({ width: w, height: h, data: d }, w, h);
    expect(m.at(6, 10)).toBe(1);
    expect(m.at(18, 1)).toBe(0);
    expect(m.verticalExtent()).toEqual([2, 17]);
  });

  it("finds the bend of an L-shaped curve", () => {
    const pts = [...Array.from({ length: 6 }, (_, i) => ({ x: i, y: 0 })), ...Array.from({ length: 6 }, (_, i) => ({ x: 5, y: i + 1 }))];
    expect(kneePoint(pts)).toBe(5);
  });
});

describe("measurement on a synthetic mannequin", () => {
  const front = renderMannequin(MAN, { ...FRAME, view: "front" });
  const side = renderMannequin(MAN, { ...FRAME, view: "side" });

  it("finds chest, waist and hip levels near the true heights", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    expect(f).not.toBeNull();
    const L = levels(MAN);
    expect(Math.abs(f.levelCm!.chest - L.chest)).toBeLessThan(3);
    expect(Math.abs(f.levelCm!.waist - L.waist)).toBeLessThan(3);
    expect(Math.abs(f.levelCm!.hip - L.hip)).toBeLessThan(3);
    // widths are exact up to about one mask column (pixelation)
    const col = f.cmPerPx / (FRAME.maskW / FRAME.frameW);
    expect(Math.abs(f.widthCm.chest - MAN.chestW)).toBeLessThan(col * 1.2);
    expect(Math.abs(f.widthCm.waist - MAN.waistW)).toBeLessThan(col * 1.2);
    expect(Math.abs(f.widthCm.hip - MAN.hipW)).toBeLessThan(col * 1.2);
    expect(f.widthClear).toEqual({ chest: true, waist: true, hip: true });
  });

  it("measures girths from front + side within 3%", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    const s = analyseSide(side.mask, side.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm)!;
    const m = combine(Array(10).fill(f), Array(10).fill(s), MAN.heightCm, "full");
    expect(m.hasSide).toBe(true);
    const rel = (got: Measurement | null, want: number) => Math.abs(got!.valueCm - want) / want;
    expect(rel(m.chest, expectedGirth(MAN.chestW, MAN.chestD, "chest"))).toBeLessThan(0.03);
    expect(rel(m.waist, expectedGirth(MAN.waistW, MAN.waistD, "waist"))).toBeLessThan(0.03);
    expect(rel(m.hip, expectedGirth(MAN.hipW, MAN.hipD, "hip"))).toBeLessThan(0.03);
    expect(m.chest!.flags).toEqual([]);
  });

  it("measures shoulder width from the contour within 8%", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    expect(f.shoulderFromContour).toBe(true);
    expect(Math.abs(f.shoulderCm - MAN.shoulderCm) / MAN.shoulderCm).toBeLessThan(0.08);
  });

  it("is scale-independent (same body, smaller in the frame)", () => {
    const small = renderMannequin(MAN, { ...FRAME, view: "front", personPx: 450 });
    const f = analyseFront(small.mask, small.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    expect(Math.abs(f.widthCm.chest - MAN.chestW)).toBeLessThan(1.2);
  });

  it("stays within 5% at the real model's 256×256 mask and a smaller person", () => {
    const o = { ...FRAME, maskW: 256, maskH: 256, personPx: 520 };
    const fr = renderMannequin(MAN, { ...o, view: "front" });
    const sd = renderMannequin(MAN, { ...o, view: "side" });
    const f = analyseFront(fr.mask, fr.landmarks, o.frameW, o.frameH, MAN.heightCm, "full")!;
    const s = analyseSide(sd.mask, sd.landmarks, o.frameW, o.frameH, MAN.heightCm)!;
    const m = combine(Array(10).fill(f), Array(10).fill(s), MAN.heightCm, "full");
    for (const [k, w, d] of [["chest", MAN.chestW, MAN.chestD], ["waist", MAN.waistW, MAN.waistD], ["hip", MAN.hipW, MAN.hipD]] as const) {
      const want = expectedGirth(w, d, k);
      expect(Math.abs(m[k]!.valueCm - want) / want).toBeLessThan(0.05);
    }
  });

  it("front-only result is flagged low confidence", () => {
    const f = analyseFront(front.mask, front.landmarks, FRAME.frameW, FRAME.frameH, MAN.heightCm, "full")!;
    const m = combine(Array(10).fill(f), [], MAN.heightCm, "full");
    expect(m.hasSide).toBe(false);
    expect(m.chest!.confidence).toBe("low");
    expect(m.notes.join(" ")).toMatch(/No side view/);
  });
});

const meas = (v: number, sigma = 1.5): Measurement => ({ valueCm: v, sigmaCm: sigma, scaleRel: 0.012, confidence: "high", method: "test", flags: [] });
const body = (chest: number, waist: number, hip?: number, sigma = 1.5): BodyMeasurements => ({
  heightCm: 178, mode: "full", hasSide: true, frames: { front: 20, side: 15 },
  shoulder: meas(46), chest: meas(chest, sigma), waist: meas(waist, sigma), hip: hip ? meas(hip, sigma) : null, notes: [],
});

describe("size recommendation", () => {
  it("picks M for a mid-range men's M body", () => {
    const r = recommendSize(body(100, 85), CHARTS.men, "regular");
    expect(r.recommended).toBe("M");
    expect(r.status).toBe("confident");
    expect(r.probability).toBeGreaterThan(0.8);
  });

  it("reports between sizes on a chart boundary", () => {
    const r = recommendSize(body(104, 89, undefined, 3), CHARTS.men, "regular");
    expect(r.status).toBe("between_sizes");
    expect(new Set([r.recommended, r.alternative])).toEqual(new Set(["M", "L"]));
  });

  it("a relaxed fit preference leans toward the larger size", () => {
    const pL = (pref: "slim" | "relaxed") =>
      recommendSize(body(103.5, 88.5, undefined, 2), CHARTS.men, pref).probabilities.find((p) => p.label === "L")!.p;
    expect(pL("relaxed")).toBeGreaterThan(pL("slim"));
    expect(recommendSize(body(103.5, 88.5, undefined, 2), CHARTS.men, "slim").recommended).toBe("M");
  });

  it("flags bodies outside the chart", () => {
    expect(recommendSize(body(145, 130), CHARTS.men, "regular").status).toBe("outside_range");
    expect(recommendSize(body(70, 58), CHARTS.men, "regular").status).toBe("outside_range");
  });

  it("uses bust, waist and hip for the women's chart", () => {
    const r = recommendSize(body(90, 72, 96), CHARTS.women, "regular");
    expect(r.recommended).toBe("M");
    expect(r.details.map((d) => d.key)).toEqual(["chest", "waist", "hip"]);
  });

  it("refuses without a chest measurement", () => {
    const b = body(100, 85);
    b.chest = null;
    expect(recommendSize(b, CHARTS.men, "regular").status).toBe("insufficient_data");
  });
});

describe("live scan", () => {
  const front = renderMannequin(MAN, { ...FRAME, view: "front" });
  const side = renderMannequin(MAN, { ...FRAME, view: "side" });
  const frame = (r: ReturnType<typeof renderMannequin>, t: number) => ({
    landmarks: r.landmarks, mask: r.mask, width: FRAME.frameW, height: FRAME.frameH, tMs: t,
  });

  it("guides through front and side and produces measurements", () => {
    const states: ScanState[] = [];
    const scan = new SizeScan(MAN.heightCm, "full", (s) => states.push(s));
    let t = 0;
    for (let i = 0; i < 40 && scan.current.phase === "front"; i++) scan.feed(frame(front, (t += 33)));
    expect(scan.current.phase).toBe("side");
    // still facing front: the side checks must ask to turn
    scan.feed(frame(front, (t += 33)));
    expect(scan.current.checks.find((c) => c.id === "profile")?.ok).toBe(false);
    for (let i = 0; i < 40 && scan.current.phase === "side"; i++) scan.feed(frame(side, (t += 33)));
    expect(scan.current.phase).toBe("done");
    const m = scan.current.result!;
    expect(m.hasSide).toBe(true);
    expect(Math.abs(m.chest!.valueCm - expectedGirth(MAN.chestW, MAN.chestD, "chest")) / m.chest!.valueCm).toBeLessThan(0.03);
    expect(recommendSize(m, CHARTS.men, "regular").recommended).toBeTruthy();
  });

  it("asks to step back when the feet are cut off, and offers the quick estimate", () => {
    const cut = renderMannequin(MAN, { ...FRAME, view: "front", floorY: FRAME.frameH + 60 });
    const scan = new SizeScan(MAN.heightCm, "full", () => {});
    let t = 0;
    for (let i = 0; i < 300; i++) scan.feed(frame(cut, (t += 33)));
    expect(scan.current.phase).toBe("front");
    expect(scan.current.checks.find((c) => c.id === "feet")?.ok).toBe(false);
    expect(scan.current.instruction).toMatch(/feet/);
    expect(scan.current.suggestQuick).toBe(true);
    scan.useQuick();
    for (let i = 0; i < 40 && scan.current.phase === "front"; i++) scan.feed(frame(cut, (t += 33)));
    expect(scan.current.phase).toBe("done");
    expect(scan.current.result!.mode).toBe("quick");
  });

  it("fails clearly when no segmentation mask arrives", () => {
    const scan = new SizeScan(MAN.heightCm, "full", () => {});
    for (let t = 0; t < 5000; t += 100) scan.feed({ landmarks: front.landmarks, mask: null, width: 1280, height: 720, tMs: t });
    expect(scan.current.phase).toBe("failed");
    expect(scan.current.error).toMatch(/segmentation/);
  });
});
