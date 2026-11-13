/** Message the permission tab broadcasts once the user has allowed the camera. */
export const CAMERA_GRANTED = "CAMERA_GRANTED";

export type CameraPermission = "granted" | "prompt" | "denied" | "unknown";

/** Current camera permission for the extension's origin, without triggering a prompt. */
export async function cameraPermissionState(): Promise<CameraPermission> {
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

/** Opens the tab that asks for camera access, or focuses it if it's already open. */
export async function openPermissionTab(): Promise<void> {
  const url = chrome.runtime.getURL("permission.html");
  const [existing] = await chrome.tabs.query({ url });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}
