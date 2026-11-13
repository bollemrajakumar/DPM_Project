export interface Vec2 {
  x: number;
  y: number;
}

export type SleeveType = "none" | "short" | "long";

/** Normalised (0..1) garment-image coordinates. Wearer's LEFT = image RIGHT. */
export interface Anchors {
  neck: Vec2;
  left_shoulder: Vec2;
  right_shoulder: Vec2;
  left_hip: Vec2;
  right_hip: Vec2;
  left_elbow?: Vec2 | null;
  right_elbow?: Vec2 | null;
  left_cuff?: Vec2 | null;
  right_cuff?: Vec2 | null;
}

export interface MeshConfig {
  cols: number;
  rows: number;
  sleeve_blend: number;
  elbow_blend: number;
}

export interface Garment {
  id: string;
  name: string;
  category: string;
  body_region: string;
  sleeve: SleeveType;
  brand?: string | null;
  color?: string | null;
  sizes: string[];
  fit?: string | null;
  price?: number | null;
  currency?: string | null;
  anchors: Anchors;
  mesh: MeshConfig;
  source: { origin: string; license: string; demo: boolean };
  views: { front: string; side?: string | null; back?: string | null };
  preview: string;
  image_size: [number, number];
  renderable: boolean;
}

/** One pose landmark in video PIXEL coordinates (un-mirrored frame). */
export interface PixelLandmark {
  x: number;
  y: number;
  visibility: number;
}

/** Category-mask classes of selfie_multiclass_256x256. */
export const SEG = {
  background: 0,
  hair: 1,
  bodySkin: 2,
  faceSkin: 3,
  clothes: 4,
  others: 5,
} as const;

export interface CategoryMask {
  width: number;
  height: number;
  data: Uint8Array;
}

/** MediaPipe pose landmark indices used by the app. */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
} as const;
