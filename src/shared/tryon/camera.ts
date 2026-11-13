export interface CameraInfo {
  deviceId: string;
  label: string;
}

export class CameraError extends Error {
  constructor(
    message: string,
    readonly kind: "insecure" | "unsupported" | "denied" | "notfound" | "busy" | "constraints" | "unknown",
  ) {
    super(message);
  }
}

export function describeCameraError(e: unknown): CameraError {
  if (e instanceof CameraError) return e;
  const name = (e as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return new CameraError(
        "Camera permission was denied. Click the camera icon in the address bar, allow access for this site, then press Start camera again.",
        "denied",
      );
    case "NotFoundError":
    case "OverconstrainedError":
      return name === "NotFoundError"
        ? new CameraError("No camera was found. Connect a webcam and press Refresh cameras.", "notfound")
        : new CameraError("The selected camera can't provide the requested resolution. Try another camera.", "constraints");
    case "NotReadableError":
    case "AbortError":
      return new CameraError(
        "The camera is in use by another application (Teams, Zoom, OBS…) or the driver failed. Close the other app and retry.",
        "busy",
      );
    default:
      return new CameraError(`Could not start the camera: ${String((e as Error)?.message ?? e)}`, "unknown");
  }
}

export async function listCameras(): Promise<CameraInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export async function startCamera(video: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError(
      "Camera access needs a secure context. Open the app at http://localhost or http://127.0.0.1, not a LAN IP.",
      "insecure",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("This browser does not support camera access.", "unsupported");
  }
  const video720 = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }),
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: video720, audio: false });
  } catch (e) {
    if ((e as { name?: string }).name === "OverconstrainedError") {
      stream = await navigator.mediaDevices
        .getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false })
        .catch((e2) => {
          throw describeCameraError(e2);
        });
    } else {
      throw describeCameraError(e);
    }
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  if (!video.videoWidth) {
    await new Promise<void>((res) => video.addEventListener("loadedmetadata", () => res(), { once: true }));
  }
  return stream;
}

export function stopCamera(video: HTMLVideoElement | null, stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
  if (!video) return;
  video.pause();
  video.srcObject = null;
}
