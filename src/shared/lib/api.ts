import type { Anchors, Garment, SleeveType } from "./types";

export const garmentUrl = (rel: string) => `/static/garments/${rel}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(message);
  }
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let detail: unknown = null;
    try {
      detail = (await r.json()).detail;
    } catch {
      /* not JSON */
    }
    const msg =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "message" in detail
          ? String((detail as { message: unknown }).message)
          : Array.isArray(detail)
            ? detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ")
            : `${r.status} ${r.statusText}`;
    throw new ApiError(msg, r.status, detail);
  }
  return r.json() as Promise<T>;
}

export interface CatalogResponse {
  garments: Garment[];
  errors: string[];
}

export const fetchCatalog = () => fetch("/api/catalog").then((r) => json<CatalogResponse>(r));

export interface ModelEntry {
  id: string;
  purpose: string;
  file: string;
  license: string;
  required: boolean;
  runtime: string;
  present: boolean;
  size_bytes?: number;
  checksum?: "ok" | "unpinned" | "MISMATCH";
}

export interface ModelsStatus {
  manifest: boolean;
  models: ModelEntry[];
  missing_required: string[];
  ready: boolean;
  tryon_image: { available: boolean; reasons: string[] };
}

export const fetchModels = () => fetch("/api/models/status").then((r) => json<ModelsStatus>(r));
export const fetchSystem = () => fetch("/api/system/status").then((r) => json<Record<string, unknown>>(r));
export const fetchHealth = () => fetch("/health").then((r) => json<{ status: string; version: string }>(r));

export interface PreprocessResult {
  image_png_base64: string;
  width: number;
  height: number;
  anchors: Anchors | null;
  sleeve: SleeveType;
  confidence: number;
  needs_review: boolean;
  used_existing_alpha: boolean;
  warnings: string[];
}

export function preprocessGarment(file: File, threshold: number): Promise<PreprocessResult> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("threshold", String(threshold));
  return fetch("/api/garments/preprocess", { method: "POST", body: fd }).then((r) => json<PreprocessResult>(r));
}

export function importGarment(png: Blob, metadata: Record<string, unknown>): Promise<{ garment: Garment; warnings: string[] }> {
  const fd = new FormData();
  fd.append("image", png, "garment.png");
  fd.append("metadata", JSON.stringify(metadata));
  fd.append("preprocessed", "true");
  return fetch("/api/catalog/import", { method: "POST", body: fd }).then((r) => json(r));
}

export function patchGarment(id: string, patch: Record<string, unknown>): Promise<Garment> {
  return fetch(`/api/catalog/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => json<Garment>(r));
}
