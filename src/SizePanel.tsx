import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { TryOnEngine } from "@shared/tryon/engine";
import { CHARTS, GIRTH_LABEL, type ChartId } from "./sizing/charts";
import { recommendSize, type FitPreference } from "./sizing/fit";
import { GIRTHS, type BodyMeasurements, type Measurement } from "./sizing/measure";
import { SizeScan, type ScanState } from "./sizing/scan";

export interface SizeProfile {
  heightCm: number | null;
  unit: "cm" | "ftin";
  chart: ChartId;
  fit: FitPreference;
}

interface SavedResult {
  measurements: BodyMeasurements;
  date: string;
}

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(`fabstudio.${k}`);
    return v === null ? d : { ...d, ...(JSON.parse(v) as T) };
  } catch {
    return d;
  }
};
const store = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(`fabstudio.${k}`);
    else localStorage.setItem(`fabstudio.${k}`, JSON.stringify(v));
  } catch {}
};

const validHeight = (h: number | null): h is number => h !== null && h >= 120 && h <= 230;

/** Owns the live scan: hooks it into the engine's frame stream and exposes its state. */
export function useSizeScan(engineRef: RefObject<TryOnEngine | null>) {
  const [state, setState] = useState<ScanState | null>(null);
  const scanRef = useRef<SizeScan | null>(null);
  const lastEmit = useRef(0);

  const detach = useCallback(() => {
    if (engineRef.current) engineRef.current.scanTap = null;
    scanRef.current = null;
  }, [engineRef]);

  const start = useCallback((heightCm: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const scan = new SizeScan(heightCm, "full", (s) => {
      // React doesn't need every frame; finished/failed states always go through.
      const now = performance.now();
      if (s.phase === "done" || s.phase === "failed" || now - lastEmit.current > 120) {
        lastEmit.current = now;
        setState(s);
      }
      if (s.phase === "done" || s.phase === "failed") {
        if (engineRef.current) engineRef.current.scanTap = null;
      }
    });
    scanRef.current = scan;
    engine.scanTap = (f) => scan.feed(f);
  }, [engineRef]);

  const cancel = useCallback(() => {
    detach();
    setState(null);
  }, [detach]);

  useEffect(() => detach, [detach]);

  return {
    state,
    start,
    cancel,
    clear: () => setState(null),
    skipSide: () => scanRef.current?.skipSide(),
    useQuick: () => scanRef.current?.useQuick(),
  };
}

/** Instruction banner + progress drawn over the camera stage while scanning. */
export function ScanGuide({ state }: { state: ScanState | null }) {
  if (!state || state.phase === "done") return null;
  const step = state.mode === "quick" ? "Quick estimate" : state.phase === "side" ? "Step 2 of 2 · Side" : "Step 1 of 2 · Front";
  return (
    <div className="scan-guide" aria-live="polite">
      <div className="scan-banner">
        <span className="scan-step">{step}</span>
        <span>{state.error ?? state.instruction}</span>
      </div>
      {state.phase !== "failed" && (
        <div className="scan-progress"><span style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
      )}
    </div>
  );
}

export function SizePanel(props: {
  cameraOn: boolean;
  onStartCamera: () => void;
  scan: ReturnType<typeof useSizeScan>;
  onSize: (size: string | null) => void;
}) {
  const { scan, cameraOn } = props;
  const [profile, setProfile] = useState<SizeProfile>(() =>
    load<SizeProfile>("sizeProfile", { heightCm: null, unit: "cm", chart: "unisex", fit: "regular" }),
  );
  const [saved, setSaved] = useState<SavedResult | null>(() => {
    try {
      const v = localStorage.getItem("fabstudio.sizeResult");
      return v ? (JSON.parse(v) as SavedResult) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => store("sizeProfile", profile), [profile]);

  // A finished scan becomes the saved result.
  useEffect(() => {
    if (scan.state?.phase === "done" && scan.state.result) {
      const r = { measurements: scan.state.result, date: new Date().toISOString() };
      setSaved(r);
      store("sizeResult", r);
      scan.clear();
    }
  }, [scan.state]);

  const rec = useMemo(
    () => (saved ? recommendSize(saved.measurements, CHARTS[profile.chart], profile.fit) : null),
    [saved, profile.chart, profile.fit],
  );
  useEffect(() => props.onSize(rec?.recommended ?? null), [rec]);

  const scanning = scan.state !== null && scan.state.phase !== "done";
  const canScan = cameraOn && validHeight(profile.heightCm);

  return (
    <div className="size-panel">
      <div className="size-head">
        <h3>Find my size</h3>
        {saved && !scanning && <span className="muted small">Scanned {new Date(saved.date).toLocaleDateString()}</span>}
      </div>

      {!scanning && (
        <>
          <div className="size-form">
            <HeightField profile={profile} onChange={setProfile} />
            <label>
              Size chart
              <select value={profile.chart} onChange={(e) => setProfile({ ...profile, chart: e.target.value as ChartId })}>
                <option value="men">Men's</option>
                <option value="women">Women's</option>
                <option value="unisex">Unisex</option>
              </select>
            </label>
            <label>
              Fit
              <select value={profile.fit} onChange={(e) => setProfile({ ...profile, fit: e.target.value as FitPreference })}>
                <option value="slim">Slim</option>
                <option value="regular">Regular</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </label>
          </div>

          {rec && saved ? (
            <SizeResult rec={rec} m={saved.measurements} chart={profile.chart} />
          ) : (
            <ul className="size-tips">
              <li>Wear close-fitting clothes; baggy tops make you measure bigger.</li>
              <li>Stand 2–3 m from the camera so your whole body, head to feet, is in view.</li>
              <li>You'll face the camera, then turn sideways. It takes about 10 seconds.</li>
            </ul>
          )}

          <div className="row">
            {cameraOn ? (
              <button className="primary" disabled={!canScan} onClick={() => validHeight(profile.heightCm) && scan.start(profile.heightCm)}>
                {saved ? "Scan again" : "Start size scan"}
              </button>
            ) : (
              <button className="primary" onClick={props.onStartCamera}>Start camera to scan</button>
            )}
            {saved && (
              <button onClick={() => { setSaved(null); store("sizeResult", null); }}>Clear result</button>
            )}
          </div>
          {cameraOn && !validHeight(profile.heightCm) && <p className="muted small">Enter your height first: it's the ruler for every measurement.</p>}
        </>
      )}

      {scanning && scan.state && (
        <div className="scan-live">
          <ul className="scan-checks">
            {scan.state.checks.map((c) => (
              <li key={c.id} className={c.ok ? "ok" : "bad"}>
                <span aria-hidden>{c.ok ? "✓" : "•"}</span> {c.label}
              </li>
            ))}
          </ul>
          {scan.state.error && <p className="error">{scan.state.error}</p>}
          <div className="row">
            <button onClick={scan.cancel}>{scan.state.phase === "failed" ? "Close" : "Cancel"}</button>
            {scan.state.phase === "side" && <button onClick={scan.skipSide}>Skip side view</button>}
            {scan.state.suggestQuick && (
              <button onClick={scan.useQuick} title="Uses your torso instead of your full height as the ruler">
                Can't fit my feet in — quick estimate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeightField({ profile, onChange }: { profile: SizeProfile; onChange: (p: SizeProfile) => void }) {
  const cm = profile.heightCm;
  const totalIn = cm ? Math.round(cm / 2.54) : null;
  const ft = totalIn ? Math.floor(totalIn / 12) : "";
  const inch = totalIn ? totalIn % 12 : "";
  const setFtIn = (f: number, i: number) => onChange({ ...profile, heightCm: f || i ? Math.round((f * 12 + i) * 2.54) : null });
  return (
    <label>
      Height
      <span className="height-field">
        {profile.unit === "cm" ? (
          <input type="number" min={120} max={230} placeholder="cm" aria-label="Height in centimetres" value={cm ?? ""}
            onChange={(e) => onChange({ ...profile, heightCm: e.target.value ? Number(e.target.value) : null })} />
        ) : (
          <>
            <input type="number" min={4} max={7} placeholder="ft" aria-label="Height, feet" value={ft}
              onChange={(e) => setFtIn(Number(e.target.value) || 0, Number(inch) || 0)} />
            <input type="number" min={0} max={11} placeholder="in" aria-label="Height, inches" value={inch}
              onChange={(e) => setFtIn(Number(ft) || 0, Number(e.target.value) || 0)} />
          </>
        )}
        <select aria-label="Height unit" value={profile.unit} onChange={(e) => onChange({ ...profile, unit: e.target.value as SizeProfile["unit"] })}>
          <option value="cm">cm</option>
          <option value="ftin">ft/in</option>
        </select>
      </span>
    </label>
  );
}

function SizeResult({ rec, m, chart }: { rec: ReturnType<typeof recommendSize>; m: BodyMeasurements; chart: ChartId }) {
  const maxP = Math.max(...rec.probabilities.map((p) => p.p), 0.01);
  const row = (label: string, x: Measurement | null) =>
    x && (
      <tr key={label}>
        <td>{label}</td>
        <td className="mono">{x.valueCm.toFixed(0)} cm <span className="muted">± {x.sigmaCm.toFixed(0)}</span></td>
        <td><span className={`conf ${x.confidence}`}>{x.confidence}</span></td>
      </tr>
    );
  return (
    <div className="size-result">
      <div className="size-big">
        <span className="size-label">{rec.recommended ?? "?"}</span>
        <div>
          <div className="size-sub">
            {rec.status === "between_sizes" && rec.alternative ? `or ${rec.alternative}` : `${CHARTS[chart].label} size`}
          </div>
          <p className="small">{rec.message}</p>
        </div>
      </div>

      {rec.probabilities.length > 0 && (
        <div className="size-bars" aria-label="How often each size wins">
          {rec.probabilities.map((p) => (
            <div key={p.label} className={`size-bar ${p.label === rec.recommended ? "best" : ""}`}>
              <span className="bar"><span style={{ height: `${(p.p / maxP) * 100}%` }} /></span>
              <span className="lbl">{p.label}</span>
            </div>
          ))}
        </div>
      )}

      <table className="size-table">
        <tbody>
          {row("Shoulder", m.shoulder)}
          {GIRTHS.map((k) => row(GIRTH_LABEL[k][chart], m[k]))}
        </tbody>
      </table>

      {m.notes.map((n) => <p key={n} className="muted small">{n}</p>)}
      <p className="muted small">
        Estimated from your camera with a typical {CHARTS[chart].label.toLowerCase()} size chart. Brands differ — compare these
        measurements with the product's own size chart before you buy.
      </p>
    </div>
  );
}
