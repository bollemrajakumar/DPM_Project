// Chrome doesn't show permission prompts inside extension side panels or popups:
// getUserMedia() there is dismissed automatically. A normal tab on the extension's own
// origin can show the prompt, and once the user allows it, the grant covers every page of
// the extension, including the side panel.
import "./styles.css";
import { CAMERA_GRANTED } from "./lib/cameraPermission";

const status = document.getElementById("status")!;
const allowBtn = document.getElementById("allow") as HTMLButtonElement;
const settingsBtn = document.getElementById("settings") as HTMLButtonElement;

function setStatus(text: string, kind: "" | "ok" | "error" = "") {
  status.textContent = text;
  status.className = kind;
}

async function closeThisTab() {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
  else window.close();
}

async function requestCamera() {
  allowBtn.disabled = true;
  settingsBtn.hidden = true;
  setStatus("Waiting for you to allow the camera…");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((t) => t.stop());
    allowBtn.hidden = true;
    setStatus("Camera allowed. Going back to the FabStudio panel…", "ok");
    // With no listener (panel closed) sendMessage rejects; that's fine.
    chrome.runtime.sendMessage({ type: CAMERA_GRANTED }).catch(() => {});
    setTimeout(() => void closeThisTab(), 1200);
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      setStatus(
        "Camera access is blocked for FabStudio. Open the camera settings, set Camera to Allow for this extension, then click Allow camera again.",
        "error",
      );
      settingsBtn.hidden = false;
    } else if (name === "NotFoundError") {
      setStatus("No camera was found. Connect a webcam and click Allow camera again.", "error");
    } else if (name === "NotReadableError" || name === "AbortError") {
      setStatus(
        "The camera is in use by another app (Teams, Zoom, OBS…). Close it and click Allow camera again.",
        "error",
      );
    } else {
      setStatus(`Could not access the camera: ${String((e as Error)?.message ?? e)}`, "error");
    }
    allowBtn.disabled = false;
  }
}

allowBtn.addEventListener("click", () => void requestCamera());
settingsBtn.addEventListener("click", () => {
  void chrome.tabs.create({
    url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}`,
  });
});

// The tab was opened on purpose to ask, so ask right away; the button is the retry.
void requestCamera();
