import type { Anchors, Garment, MeshConfig } from "@shared/lib/types";

const DB_NAME = "fabstudio-extension";
const DB_VERSION = 1;
const GARMENTS_STORE = "garments";
const IMAGES_STORE = "images";
const MODELS_STORE = "models";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(GARMENTS_STORE)) {
        db.createObjectStore(GARMENTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE);
      }
      if (!db.objectStoreNames.contains(MODELS_STORE)) {
        db.createObjectStore(MODELS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function getAllGarments(): Promise<Garment[]> {
  return tx<Garment[]>(GARMENTS_STORE, "readonly", (s) => s.getAll());
}

export async function saveGarment(garment: Garment, imageBlob: Blob): Promise<void> {
  const db = await openDB();
  const t = db.transaction([GARMENTS_STORE, IMAGES_STORE], "readwrite");
  t.objectStore(GARMENTS_STORE).put(garment);
  t.objectStore(IMAGES_STORE).put(imageBlob, garment.id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteGarment(id: string): Promise<void> {
  const db = await openDB();
  const t = db.transaction([GARMENTS_STORE, IMAGES_STORE], "readwrite");
  t.objectStore(GARMENTS_STORE).delete(id);
  t.objectStore(IMAGES_STORE).delete(id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getGarmentImageUrl(id: string): Promise<string | null> {
  const blob = await tx<Blob | undefined>(IMAGES_STORE, "readonly", (s) => s.get(id));
  return blob ? URL.createObjectURL(blob) : null;
}

export async function getGarmentImageBlob(id: string): Promise<Blob | null> {
  const blob = await tx<Blob | undefined>(IMAGES_STORE, "readonly", (s) => s.get(id));
  return blob ?? null;
}

export async function cacheModel(key: string, data: ArrayBuffer): Promise<void> {
  await tx(MODELS_STORE, "readwrite", (s) => s.put(data, key));
}

export async function getCachedModel(key: string): Promise<ArrayBuffer | null> {
  const data = await tx<ArrayBuffer | undefined>(MODELS_STORE, "readonly", (s) => s.get(key));
  return data ?? null;
}

export function defaultAnchors(): Anchors {
  return {
    neck: { x: 0.5, y: 0.12 },
    left_shoulder: { x: 0.18, y: 0.18 },
    right_shoulder: { x: 0.82, y: 0.18 },
    left_hip: { x: 0.28, y: 0.85 },
    right_hip: { x: 0.72, y: 0.85 },
  };
}

export function defaultMesh(): MeshConfig {
  return { cols: 12, rows: 16, sleeve_blend: 0.15, elbow_blend: 0.3 };
}

export function garmentFromImage(
  imageUrl: string,
  name: string,
  imageSize: [number, number],
  prep?: { anchors: Anchors; sleeve: Garment["sleeve"] },
): Garment {
  const id = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    category: "other",
    body_region: "upper_body",
    sleeve: prep?.sleeve ?? "short",
    anchors: prep?.anchors ?? defaultAnchors(),
    mesh: defaultMesh(),
    source: { origin: imageUrl, license: "user-captured", demo: false },
    views: { front: id },
    preview: id,
    image_size: imageSize,
    renderable: true,
    sizes: [],
  };
}
