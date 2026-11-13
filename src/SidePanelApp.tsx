import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Garment } from "@shared/lib/types";
import { alphaGridFromImage, DEFAULT_CALIBRATION, GarmentMesh, type Calibration } from "@shared/render/garmentMesh";
import { SyntheticScene, type SyntheticScript } from "@shared/tracking/synthetic";
import { CameraError, listCameras, startCamera, stopCamera, type CameraInfo } from "@shared/tryon/camera";
import { TryOnEngine, type EngineStats, type FrameSource } from "@shared/tryon/engine";
import { ExtensionVision, type DelegatePref, type PoseModel } from "./lib/vision-ext";
import { CAMERA_GRANTED, cameraPermissionState, openPermissionTab } from "./lib/cameraPermission";
import { prepareGarment } from "./lib/garmentPrep";
import { ScanGuide, SizePanel, useSizeScan } from "./SizePanel";
import {
  deleteGarment,
  garmentFromImage,
  getAllGarments,
  getGarmentImageBlob,
  saveGarment,
} from "./lib/store";

type Mode = "idle" | "starting" | "camera" | "demo";

const pref = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(`fabstudio.${k}`);
    return v === null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(`fabstudio.${k}`, JSON.stringify(v));
  } catch {}
};

function softwareGL(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|softpipe/i.test(r);
  } catch {
    return true;
  }
}
const SOFTWARE_GL = typeof document !== "undefined" && softwareGL();

const CATEGORY_LABEL: Record<string, string> = {
  tshirt: "T-shirts", shirt: "Shirts", hoodie: "Hoodies", jacket: "Jackets",
  dress: "Dresses", trousers: "Trousers", other: "Other",
};

export function SidePanelApp() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<TryOnEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneRef = useRef<SyntheticScene | null>(null);
  const garmentImageUrls = useRef<Map<string, string>>(new Map());

  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  // True while the camera needs to be allowed in the permission tab (side panels can't prompt).
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>(pref("camera", ""));
  const [mirror, setMirror] = useState<boolean>(pref("mirror", true));
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [cal, setCal] = useState<Calibration>({ ...DEFAULT_CALIBRATION, ...pref<Partial<Calibration>>("calibration", {}) });
  const [smoothing, setSmoothing] = useState<number>(pref("smoothing", 0.5));
  const [occlusion, setOcclusion] = useState<boolean>(pref("occlusion", true));
  const [folds, setFolds] = useState<number>(pref("folds2", 0.3));
  const [lighting, setLighting] = useState<number>(pref("lighting", 0.3));
  const [skeleton, setSkeleton] = useState<boolean>(false);
  const [delegate, setDelegate] = useState<DelegatePref>(pref("delegate", SOFTWARE_GL ? "CPU" : "auto"));
  const [poseModel, setPoseModel] = useState<PoseModel>(pref("poseModel", SOFTWARE_GL ? "lite" : "full"));
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"tryon" | "catalog">("tryon");
  const [showSize, setShowSize] = useState(false);
  const [mySize, setMySize] = useState<string | null>(null);
  const sizeScan = useSizeScan(engineRef);
  const cancelScan = sizeScan.cancel;

  const ensureEngine = useCallback((): TryOnEngine => {
    if (engineRef.current) return engineRef.current;
    const engine = new TryOnEngine(glRef.current!, overlayRef.current!);
    engine.onStats = setStats;
    engine.onError = (e) => setError(`Render error: ${e.message}`);
    engine.calibration = cal;
    engine.setSmoothing(smoothing);
    engine.options = { ...engine.options, occlusion, folds, lighting, showSkeleton: skeleton };
    engineRef.current = engine;
    return engine;
  }, [cal, smoothing, occlusion, folds, lighting, skeleton]);

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    stopCamera(videoRef.current, streamRef.current);
    streamRef.current = null;
    engineRef.current = null;
    setMode("idle");
    setStats(null);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      stopCamera(videoRef.current, streamRef.current);
    };
  }, []);

  const loadGarments = useCallback(async () => {
    const gs = await getAllGarments();
    setGarments(gs);
    if (gs.length > 0 && !selected) setSelected(gs[0].id);

    for (const g of gs) {
      const blob = await getGarmentImageBlob(g.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        garmentImageUrls.current.set(g.id, url);
      }
    }
  }, [selected]);

  useEffect(() => { loadGarments(); }, []);

  useEffect(() => {
    const consumePending = () => {
      chrome.storage.local.get("pendingGarment", async (result) => {
        const pending = result.pendingGarment;
        if (!pending) return;
        chrome.storage.local.remove("pendingGarment");
        chrome.action.setBadgeText({ text: "" });
        await captureGarmentFromUrl(pending.imageUrl, pending.pageUrl);
      });
    };
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes.pendingGarment?.newValue) consumePending();
    };
    chrome.storage.onChanged.addListener(listener);
    // The panel is open, so the "waiting garment" badge on the icon has done its job.
    chrome.action.setBadgeText({ text: "" });
    consumePending();
    listCameras().then(setCameras).catch(() => {});
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Cuts the garment out of a photo (person wearing it, or the garment on a plain backdrop),
  // finds its anchors and adds it to the catalog.
  const addGarmentFromPhoto = async (photo: Blob, origin: string, name: string) => {
    setNotice(null);
    const prep = await prepareGarment(photo, setProgress);
    const garment = garmentFromImage(origin, name, prep.size, prep);
    await saveGarment(garment, prep.blob);
    garmentImageUrls.current.set(garment.id, URL.createObjectURL(prep.blob));
    setGarments((prev) => [...prev, garment]);
    setSelected(garment.id);
    setTab("tryon");
    const how =
      prep.method === "person" ? "Cut the top out of the model photo." :
      prep.method === "background" ? "Removed the background." : "Used the photo's transparency.";
    setNotice([how, ...prep.warnings].join(" "));
  };

  const captureGarmentFromUrl = async (imageUrl: string, pageUrl: string) => {
    try {
      setProgress("Capturing garment image…");
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`download failed (${resp.status})`);
      const blob = await resp.blob();
      const name = pageUrl
        ? new URL(pageUrl).pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ?? "Captured garment"
        : "Captured garment";
      await addGarmentFromPhoto(blob, imageUrl, name);
    } catch (e) {
      setError(`Failed to capture garment: ${(e as Error).message}`);
    } finally {
      setProgress("");
    }
  };

  const garment = useMemo(() => garments.find((g) => g.id === selected) ?? null, [garments, selected]);

  const loadGarmentIntoEngine = useCallback(async (engine: TryOnEngine, g: Garment | null) => {
    if (!g) {
      engine.setGarment(null);
      return;
    }
    const blob = await getGarmentImageBlob(g.id);
    if (!blob) return;
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    const mesh = new GarmentMesh(g, alphaGridFromImage(img));
    (engine as any).garment = g;
    (engine as any).mesh = mesh;
    (engine as any).renderer.setGarment(img, mesh);
  }, []);

  useEffect(() => {
    const e = engineRef.current;
    if (!e || !garment) return;
    loadGarmentIntoEngine(e, garment).catch((err) =>
      setError(`Could not load garment: ${String(err)}`),
    );
  }, [garment, loadGarmentIntoEngine]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.calibration = cal;
    e.setSmoothing(smoothing);
    e.options = { ...e.options, occlusion, folds, lighting, showSkeleton: skeleton };
    save("calibration", cal);
    save("smoothing", smoothing);
    save("occlusion", occlusion);
    save("folds2", folds);
    save("lighting", lighting);
  }, [cal, smoothing, occlusion, folds, lighting, skeleton]);

  useEffect(() => save("mirror", mirror), [mirror]);

  const stopAll = useCallback(() => {
    cancelScan();
    engineRef.current?.stop();
    engineRef.current?.setVision(null);
    engineRef.current?.setSource(null);
    stopCamera(videoRef.current, streamRef.current);
    streamRef.current = null;
    sceneRef.current = null;
    setMode("idle");
    setStats(null);
  }, [cancelScan]);

  // afterGrant: called because the permission tab just reported success. Then skip the
  // pre-check and try the camera directly, so a grant that didn't persist ("Allow this time")
  // ends in a clear message instead of reopening the tab in a loop.
  const startLive = useCallback(async (afterGrant = false) => {
    setError(null);
    setCameraBlocked(false);
    // getUserMedia() in a side panel can't show Chrome's prompt; it would just fail.
    // Ask in a normal tab instead, and start automatically once that tab reports success.
    const permission = afterGrant ? "granted" : await cameraPermissionState();
    if (permission === "prompt" || permission === "denied") {
      setCameraBlocked(true);
      setError(
        permission === "denied"
          ? "Camera access is blocked for FabStudio. A tab has opened with the camera settings: allow the camera there."
          : "Allow the camera in the tab that just opened. The try-on starts here as soon as you do.",
      );
      openPermissionTab().catch((err) => setError(`Could not open the permission tab: ${String(err)}`));
      return;
    }
    setMode("starting");
    try {
      const e = ensureEngine();
      if (garment) await loadGarmentIntoEngine(e, garment);
      setProgress("Requesting camera permission…");
      const video = videoRef.current!;
      streamRef.current = await startCamera(video, cameraId || undefined);
      const cams = await listCameras();
      setCameras(cams);
      const track = streamRef.current.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        stopAll();
        setError("Camera stopped. Reconnect and press Start camera.");
      });
      const actualId = track.getSettings().deviceId;
      if (actualId) { setCameraId(actualId); save("camera", actualId); }
      const source: FrameSource = {
        element: video,
        get width() { return video.videoWidth; },
        get height() { return video.videoHeight; },
      };
      e.setSource(source);
      const vision = await ExtensionVision.create({
        delegate,
        poseModel,
        segmentation: true,
        onProgress: setProgress,
      });
      e.setVision(vision);
      e.start();
      setMode("camera");
    } catch (err) {
      stopAll();
      if (err instanceof CameraError && err.kind === "denied") {
        setCameraBlocked(true);
        setError(
          afterGrant
            ? "The camera was allowed only for that tab. Click Allow camera and choose \"Allow on every visit\" (or \"Allow\") so the panel can use it."
            : "Chrome didn't let the side panel use the camera. Click Allow camera to grant it in a tab.",
        );
      } else {
        setError((err as Error).message);
      }
    } finally {
      setProgress("");
    }
  }, [cameraId, delegate, poseModel, stopAll, ensureEngine, garment, loadGarmentIntoEngine]);

  // When the permission tab reports success, start the camera without another click.
  const startLiveRef = useRef(startLive);
  startLiveRef.current = startLive;
  useEffect(() => {
    const onMessage = (msg: { type?: string }) => {
      if (msg?.type !== CAMERA_GRANTED) return;
      setCameraBlocked(false);
      setError(null);
      void startLiveRef.current(true);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const startDemo = useCallback(() => {
    stopAll();
    setError(null);
    let e: TryOnEngine;
    try { e = ensureEngine(); } catch (err) { setError((err as Error).message); return; }
    if (garment) loadGarmentIntoEngine(e, garment).catch(() => {});
    const scene = new SyntheticScene("wave");
    sceneRef.current = scene;
    e.setSource({ element: scene.canvas, width: scene.width, height: scene.height, prepare: (t) => scene.drawFrame(t) });
    e.setVision(scene);
    e.start();
    setMode("demo");
  }, [stopAll, ensureEngine, garment, loadGarmentIntoEngine]);

  const handleUpload = async (file: File) => {
    try {
      await addGarmentFromPhoto(file, "local-upload", file.name.replace(/\.\w+$/, ""));
    } catch (e) {
      setError(`Failed to add garment: ${(e as Error).message}`);
    } finally {
      setProgress("");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteGarment(id);
    const url = garmentImageUrls.current.get(id);
    if (url) { URL.revokeObjectURL(url); garmentImageUrls.current.delete(id); }
    setGarments((prev) => prev.filter((g) => g.id !== id));
    if (selected === id) setSelected(garments.find((g) => g.id !== id)?.id ?? null);
  };

  const conf = stats?.confidence ?? 0;
  const trackingLabel =
    mode === "idle" ? "Camera off" : stats?.tracking === "tracking" ? "Tracking" : stats?.tracking === "holding" ? "Re-acquiring…" : "Looking for you…";

  return (
    <div className="ext-app">
      <header className="ext-header">
        <div className="brand">
          <span className="mark" aria-hidden>◐</span>
          FabStudio
        </div>
        <div className="ext-tabs">
          <button className={tab === "tryon" ? "pill active" : "pill"} onClick={() => setTab("tryon")}>Try-On</button>
          <button className={tab === "catalog" ? "pill active" : "pill"} onClick={() => setTab("catalog")}>Garments</button>
        </div>
      </header>

      {tab === "tryon" && (
        <div className="ext-tryon">
          <div className={`ext-stage ${mirror ? "mirrored" : ""}`}>
            <video ref={videoRef} className="hidden-video" playsInline muted />
            <canvas ref={glRef} className="gl" />
            <canvas ref={overlayRef} className="overlay" />
            {mode === "camera" && <ScanGuide state={sizeScan.state} />}
            {mode === "idle" && (
              <div className="stage-empty">
                <h2>Virtual Try-On</h2>
                <p className="hero-sub">
                  See clothes on you in real time. Everything runs on your device.
                </p>
                <div className="row">
                  <button className="primary" onClick={() => void startLive()}>Start camera</button>
                  <button onClick={startDemo}>Demo</button>
                </div>
              </div>
            )}
            {mode === "starting" && (
              <div className="stage-empty">
                <div className="spinner" />
                <p>{progress || "Starting…"}</p>
              </div>
            )}
          </div>

          {mode !== "idle" && mode !== "starting" && (
            <div className="ext-hud">
              <span className={`chip ${stats?.tracking === "tracking" ? "ok" : "warn"}`}>
                <span className="dot" /> {trackingLabel}
                <span className="meter"><span style={{ width: `${Math.round(conf * 100)}%` }} /></span>
              </span>
              <span className="chip mono">{stats ? `${stats.fps.toFixed(0)} fps` : "–"}</span>
              {mySize && <span className="chip size-chip">Your size: <b>{mySize}</b></span>}
            </div>
          )}

          <div className="ext-controls">
            {mode === "camera" || mode === "demo" ? (
              <button onClick={stopAll}>Stop</button>
            ) : (
              <button className="primary" onClick={() => void startLive()} disabled={mode === "starting"}>Start camera</button>
            )}
            <select value={cameraId} onChange={(e) => { setCameraId(e.target.value); save("camera", e.target.value); }} title="Camera">
              <option value="">Default camera</option>
              {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
            </select>
            <label className="toggle"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror</label>
            <button onClick={() => setShowSettings((s) => !s)}>{showSettings ? "Hide" : "Settings"}</button>
            <button className={showSize ? "active" : ""} onClick={() => setShowSize((s) => !s)} aria-expanded={showSize}>
              {mySize ? `Size: ${mySize}` : "Find my size"}
            </button>
          </div>

          {/* stays mounted (hidden) so the saved result and "Your size" chip survive closing it */}
          <div hidden={!showSize}>
            <SizePanel
              cameraOn={mode === "camera"}
              onStartCamera={() => void startLive()}
              scan={sizeScan}
              onSize={setMySize}
            />
          </div>

          {progress && mode !== "starting" && (
            <div className="ext-notice" role="status"><span className="spinner small" /> {progress}</div>
          )}
          {notice && !progress && (
            <div className="ext-notice" role="status">
              {notice}
              <button onClick={() => setNotice(null)}>OK</button>
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              {error}
              {cameraBlocked && <button className="primary" onClick={() => { openPermissionTab().catch(() => {}); }}>Allow camera</button>}
              {error.includes("WebGL") && <button onClick={() => { disposeEngine(); setError(null); }}>Retry</button>}
              <button onClick={() => { setError(null); setCameraBlocked(false); }}>Dismiss</button>
            </div>
          )}

          {showSettings && (
            <div className="ext-settings">
              <fieldset>
                <legend>Fit</legend>
                <Slider label="Size" min={0.7} max={1.4} step={0.01} value={cal.scale} onChange={(v) => setCal({ ...cal, scale: v })} />
                <Slider label="Width" min={0.7} max={1.4} step={0.01} value={cal.width} onChange={(v) => setCal({ ...cal, width: v })} />
                <Slider label="Shift ↕" min={-0.5} max={0.5} step={0.01} value={cal.offsetY} onChange={(v) => setCal({ ...cal, offsetY: v })} />
                <button onClick={() => setCal(DEFAULT_CALIBRATION)}>Reset</button>
              </fieldset>
              <fieldset>
                <legend>Quality</legend>
                <Slider label="Smoothing" min={0} max={1} step={0.05} value={smoothing} onChange={setSmoothing} />
                <Slider label="Fold shading" min={0} max={1} step={0.05} value={folds} onChange={setFolds} />
                <label className="toggle">
                  <input type="checkbox" checked={occlusion} onChange={(e) => setOcclusion(e.target.checked)} /> Occlusion
                </label>
              </fieldset>
              <fieldset>
                <legend>Engine</legend>
                <label>
                  Pose model{" "}
                  <select value={poseModel} onChange={(e) => { setPoseModel(e.target.value as PoseModel); save("poseModel", e.target.value); }}>
                    <option value="full">Full</option>
                    <option value="lite">Lite</option>
                  </select>
                </label>
                <label>
                  Inference{" "}
                  <select value={delegate} onChange={(e) => { setDelegate(e.target.value as DelegatePref); save("delegate", e.target.value); }}>
                    <option value="auto">Auto</option>
                    <option value="GPU">GPU</option>
                    <option value="CPU">CPU</option>
                  </select>
                </label>
              </fieldset>
            </div>
          )}

          {garments.length > 0 && (
            <div className="ext-garment-strip">
              {garments.map((g) => (
                <button
                  key={g.id}
                  className={`ext-garment-thumb ${g.id === selected ? "selected" : ""}`}
                  onClick={() => setSelected(g.id)}
                  title={g.name}
                >
                  {garmentImageUrls.current.get(g.id) ? (
                    <img src={garmentImageUrls.current.get(g.id)} alt={g.name} />
                  ) : (
                    <span className="muted">?</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {garments.length === 0 && mode === "idle" && (
            <div className="ext-empty-hint">
              <p>No garments yet. Right-click a product image on any shopping site, or upload one below.</p>
              <label className="filebtn">
                Upload garment image
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </div>
          )}
        </div>
      )}

      {tab === "catalog" && (
        <div className="ext-catalog">
          <div className="ext-catalog-actions">
            <label className="filebtn primary">
              + Upload garment
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            </label>
            <p className="muted small">Or right-click any product image on a shopping site.</p>
          </div>
          <div className="ext-garment-list">
            {garments.map((g) => (
              <div key={g.id} className={`ext-garment-card ${g.id === selected ? "selected" : ""}`}>
                <div className="ext-garment-card-img" onClick={() => { setSelected(g.id); setTab("tryon"); }}>
                  {garmentImageUrls.current.get(g.id) ? (
                    <img src={garmentImageUrls.current.get(g.id)} alt={g.name} />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
                <div className="ext-garment-card-info">
                  <span className="card-name">{g.name}</span>
                  <span className="card-meta">{CATEGORY_LABEL[g.category] ?? g.category}</span>
                </div>
                <button className="ext-garment-delete" onClick={() => handleDelete(g.id)} title="Remove">×</button>
              </div>
            ))}
            {garments.length === 0 && (
              <p className="muted">No garments captured yet. Browse a shopping site and right-click a product image to get started.</p>
            )}
          </div>
        </div>
      )}

      <footer className="ext-footer">
        <span className="muted small">100% on-device · nothing uploaded · your data stays here</span>
      </footer>
    </div>
  );
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))} />
      <span className="mono">{props.value.toFixed(2)}</span>
    </label>
  );
}
