chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fabstudio-tryon",
    title: "Try on with FabStudio",
    contexts: ["image"],
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "fabstudio-tryon" || !info.srcUrl) return;

  if (tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
      chrome.action.setBadgeText({ text: "1" });
      chrome.action.setBadgeBackgroundColor({ color: "#e8a55a" });
    });
  }

  chrome.storage.local.set({
    pendingGarment: { imageUrl: info.srcUrl, pageUrl: info.pageUrl ?? "", timestamp: Date.now() },
  });
});

// Messages from content scripts are NOT user gestures — cannot call sidePanel.open().
// Instead, store the garment and show a badge so the user clicks the icon to open the panel.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CAPTURE_IMAGE") {
    chrome.storage.local.set({
      pendingGarment: { imageUrl: msg.imageUrl, pageUrl: msg.pageUrl ?? "", timestamp: Date.now() },
    });
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#e8a55a" });
    sendResponse({ ok: true });
  }
  return false;
});
// The side panel clears the badge itself when it opens.
