const MIN_IMG_SIZE = 150;

function isProductImage(img: HTMLImageElement): boolean {
  if (img.naturalWidth < MIN_IMG_SIZE || img.naturalHeight < MIN_IMG_SIZE) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_IMG_SIZE || rect.height < MIN_IMG_SIZE) return false;
  const aspect = rect.width / rect.height;
  if (aspect > 3 || aspect < 0.2) return false;
  if (img.closest("nav, footer, [role='banner'], [role='navigation']")) return false;
  return true;
}

function addTryOnButton(img: HTMLImageElement) {
  if (img.dataset.fabstudioBtn) return;
  img.dataset.fabstudioBtn = "1";

  const wrap = img.parentElement;
  if (!wrap) return;
  if (getComputedStyle(wrap).position === "static") {
    wrap.style.position = "relative";
  }

  const btn = document.createElement("button");
  btn.textContent = "Try On";
  btn.className = "fabstudio-tryon-btn";
  Object.assign(btn.style, {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    zIndex: "10000",
    background: "#e8a55a",
    color: "#1b1209",
    border: "none",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    opacity: "0",
    transition: "opacity 0.2s",
    pointerEvents: "auto",
    fontFamily: "system-ui, sans-serif",
  });

  wrap.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
  wrap.addEventListener("mouseleave", () => { btn.style.opacity = "0"; });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "CAPTURE_IMAGE",
      imageUrl: img.src,
      pageUrl: window.location.href,
    });
  });

  wrap.appendChild(btn);
}

function scan() {
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (img.complete && isProductImage(img)) addTryOnButton(img);
  });
}

const observer = new MutationObserver(() => scan());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("load", scan);
setTimeout(scan, 2000);
