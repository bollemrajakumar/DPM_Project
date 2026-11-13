/**
 * Size recommendation against a BODY-measurement chart (ported from FitSize `fit_engine.py`).
 *
 * Each size's penalty grows as the body moves away from a target point inside the size's
 * range (the fit preference moves the target), steeply when the body is ABOVE the range
 * (too tight) and more gently below it (loose). Measurement uncertainty is handled with
 * Monte-Carlo sampling: values from one scan share a common scale error. The probability
 * reported is "how often this size wins across plausible versions of your measurements"
 * — decision stability, NOT validated accuracy.
 */
import type { SizeChart } from "./charts";
import { GIRTHS, type BodyMeasurements, type Girth, type Measurement } from "./measure";

export type FitPreference = "slim" | "regular" | "relaxed";
const TARGET: Record<FitPreference, number> = { slim: 0.75, regular: 0.5, relaxed: 0.3 };
const AMBIGUOUS = 0.6;
const SAMPLES = 3000;

export type SizeStatus = "confident" | "between_sizes" | "outside_range" | "insufficient_data";

export interface DimDetail {
  key: Girth;
  bodyCm: number;
  range: [number, number];
  status: "within" | "above" | "below";
}

export interface SizeRecommendation {
  status: SizeStatus;
  recommended: string | null;
  alternative: string | null;
  probability: number;
  probabilities: { label: string; p: number }[];
  details: DimDetail[];
  message: string;
}

/** Small seeded PRNG (mulberry32) + Box–Muller, so the same scan always gives the same answer. */
function rng(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
}

function rangePenalty(b: number, mn: number, mx: number, hw: number, target: number): number {
  if (b > mx) {
    const dt = (b - mx) / hw;
    return 0.5 * ((mx - target) / (2 * hw)) ** 2 + dt + 1.5 * dt * dt;
  }
  if (b < mn) {
    const dl = (mn - b) / hw;
    return 0.5 * ((mn - target) / (2 * hw)) ** 2 + 0.5 * dl + 0.5 * dl * dl;
  }
  return 0.5 * ((b - target) / (2 * hw)) ** 2;
}

/** Half-widths: half the size's range, but at least half the gap to the neighbouring sizes. */
function halfWidths(chart: SizeChart, key: Girth): number[] {
  const mids = chart.sizes.map((s) => {
    const r = s.dims[key];
    return r ? (r[0] + r[1]) / 2 : null;
  });
  return chart.sizes.map((s, i) => {
    const gaps: number[] = [];
    for (const j of [i - 1, i + 1]) {
      const a = mids[i];
      const b = mids[j];
      if (a != null && b != null) gaps.push(Math.abs(b - a) / 2);
    }
    const neighbour = Math.max(gaps.length ? Math.min(...gaps) : 2, 1);
    const r = s.dims[key];
    return r && r[1] > r[0] ? Math.max((r[1] - r[0]) / 2, neighbour) : neighbour;
  });
}

export function recommendSize(body: BodyMeasurements, chart: SizeChart, pref: FitPreference): SizeRecommendation {
  const keys = GIRTHS.filter(
    (k) => (chart.weights[k] ?? 0) > 0 && body[k] && chart.sizes.every((s) => s.dims[k]),
  );
  if (!keys.includes("chest")) {
    return {
      status: "insufficient_data", recommended: null, alternative: null, probability: 0, probabilities: [],
      details: [], message: "Couldn't measure your chest, which matters most for tops. Try the scan again.",
    };
  }
  const meas = Object.fromEntries(keys.map((k) => [k, body[k] as Measurement])) as Record<Girth, Measurement>;
  const hw = Object.fromEntries(keys.map((k) => [k, halfWidths(chart, k)])) as Record<Girth, number[]>;
  const t = TARGET[pref];

  const totalPenalty = (vals: Record<Girth, number>, si: number): number => {
    let sum = 0;
    let wsum = 0;
    for (const k of keys) {
      const [mn, mx] = chart.sizes[si].dims[k]!;
      const w = chart.weights[k]!;
      sum += w * rangePenalty(vals[k], mn, mx, hw[k][si], mn + t * (mx - mn));
      wsum += w;
    }
    return sum / wsum;
  };

  // ---- Monte Carlo: shared scale error + independent error per measurement ----
  const gauss = rng(12345);
  const wins = new Array(chart.sizes.length).fill(0);
  for (let n = 0; n < SAMPLES; n++) {
    const zShared = gauss();
    const vals = {} as Record<Girth, number>;
    for (const k of keys) {
      const m = meas[k];
      const shared = m.valueCm * m.scaleRel;
      const ind = Math.sqrt(Math.max(m.sigmaCm ** 2 - shared ** 2, 0));
      vals[k] = m.valueCm + zShared * shared + gauss() * ind;
    }
    let best = 0;
    let bestP = Infinity;
    for (let si = 0; si < chart.sizes.length; si++) {
      const p = totalPenalty(vals, si);
      if (p < bestP) {
        bestP = p;
        best = si;
      }
    }
    wins[best]++;
  }
  const probs = wins.map((w) => w / SAMPLES);
  const meanVals = Object.fromEntries(keys.map((k) => [k, meas[k].valueCm])) as Record<Girth, number>;
  const meanPen = chart.sizes.map((_, si) => totalPenalty(meanVals, si));
  const order = chart.sizes.map((_, i) => i).sort((a, b) => probs[b] - probs[a] || meanPen[a] - meanPen[b]);
  const best = order[0];
  let second: number | null = order[1] ?? null;
  if (second !== null && probs[second] === 0) {
    const rest = chart.sizes.map((_, i) => i).filter((i) => i !== best).sort((a, b) => meanPen[a] - meanPen[b]);
    second = rest[0] ?? null;
  }

  const details: DimDetail[] = keys.map((k) => {
    const r = chart.sizes[best].dims[k]!;
    const b = meanVals[k];
    return { key: k, bodyCm: b, range: r, status: b > r[1] ? "above" : b < r[0] ? "below" : "within" };
  });

  const label = (i: number | null) => (i === null ? null : chart.sizes[i].label);
  const pBest = probs[best];
  let status: SizeStatus = "confident";
  let message = `${chart.sizes[best].label} fits your measurements best.`;
  const tightChest = details.find((d) => d.key === "chest" && d.status === "above");
  if (best === chart.sizes.length - 1 && tightChest) {
    status = "outside_range";
    message = `Your chest is above this chart's largest size (${chart.sizes[best].label}). Check the brand's own chart for bigger sizes.`;
  } else if (best === 0 && details.some((d) => d.key === "chest" && d.status === "below")) {
    status = "outside_range";
    message = `Your chest is below this chart's smallest size (${chart.sizes[best].label}). Check the brand's own chart for smaller sizes.`;
  } else if (pBest < AMBIGUOUS && second !== null) {
    status = "between_sizes";
    message = `Between ${chart.sizes[best].label} and ${chart.sizes[second].label}: ${chart.sizes[best].label} wins in ${Math.round(pBest * 100)}% of plausible cases. Pick ${chart.sizes[Math.max(best, second)].label} if you like room, ${chart.sizes[Math.min(best, second)].label} for a closer fit.`;
  }

  return {
    status,
    recommended: label(best),
    alternative: label(second),
    probability: pBest,
    probabilities: chart.sizes.map((s, i) => ({ label: s.label, p: probs[i] })),
    details,
    message,
  };
}
