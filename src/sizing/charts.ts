/**
 * Generic BODY-measurement size charts for tops (chest/bust, waist, hip in cm).
 *
 * These are typical international (EU/UK high-street) ranges, NOT any brand's chart. Brands
 * differ by a size or more, so the result tells people to compare with the product's own chart.
 * Ranges are contiguous: a size covers [min, max].
 */
import type { Girth } from "./measure";

export type ChartId = "men" | "women" | "unisex";

export interface ChartSize {
  label: string;
  dims: Partial<Record<Girth, [number, number]>>;
}

export interface SizeChart {
  id: ChartId;
  label: string;
  /** how much each body measurement counts (FitSize: chest weighs most for tops) */
  weights: Partial<Record<Girth, number>>;
  sizes: ChartSize[];
}

const sizes = (rows: [string, ...([number, number] | null)[]][], keys: Girth[]): ChartSize[] =>
  rows.map(([label, ...ranges]) => {
    const dims: ChartSize["dims"] = {};
    keys.forEach((k, i) => {
      const r = ranges[i];
      if (r) dims[k] = r;
    });
    return { label, dims };
  });

export const CHARTS: Record<ChartId, SizeChart> = {
  men: {
    id: "men",
    label: "Men's",
    weights: { chest: 3, waist: 1 },
    sizes: sizes(
      [
        ["XS", [84, 89], [70, 75]],
        ["S", [89, 96], [75, 81]],
        ["M", [96, 104], [81, 89]],
        ["L", [104, 112], [89, 97]],
        ["XL", [112, 120], [97, 105]],
        ["XXL", [120, 128], [105, 113]],
        ["3XL", [128, 136], [113, 121]],
      ],
      ["chest", "waist"],
    ),
  },
  women: {
    id: "women",
    label: "Women's",
    weights: { chest: 3, waist: 1.5, hip: 1 },
    sizes: sizes(
      [
        ["XS", [78, 82], [60, 64], [84, 88]],
        ["S", [82, 87], [64, 69], [88, 93]],
        ["M", [87, 93], [69, 75], [93, 99]],
        ["L", [93, 100], [75, 82], [99, 106]],
        ["XL", [100, 108], [82, 90], [106, 114]],
        ["XXL", [108, 116], [90, 98], [114, 122]],
      ],
      ["chest", "waist", "hip"],
    ),
  },
  unisex: {
    id: "unisex",
    label: "Unisex",
    weights: { chest: 3, waist: 1 },
    sizes: sizes(
      [
        ["XS", [82, 88], [68, 74]],
        ["S", [88, 96], [74, 82]],
        ["M", [96, 104], [82, 90]],
        ["L", [104, 112], [90, 98]],
        ["XL", [112, 120], [98, 106]],
        ["XXL", [120, 128], [106, 114]],
      ],
      ["chest", "waist"],
    ),
  },
};

export const GIRTH_LABEL: Record<Girth, Record<ChartId, string>> = {
  chest: { men: "Chest", women: "Bust", unisex: "Chest" },
  waist: { men: "Waist", women: "Waist", unisex: "Waist" },
  hip: { men: "Hip", women: "Hip", unisex: "Hip" },
};
