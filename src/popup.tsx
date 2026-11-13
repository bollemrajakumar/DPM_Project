import { createRoot } from "react-dom/client";
import "./styles.css";

function Popup() {
  return (
    <div className="popup">
      <div className="popup-brand">
        <span className="mark" aria-hidden>◐</span>
        FabStudio
      </div>
      <p>Virtual try-on right in your browser. Open the side panel to start.</p>
      <button
        className="primary"
        onClick={() => {
          chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
          window.close();
        }}
      >
        Open Try-On Panel
      </button>
      <p className="muted small">
        Right-click any garment image on a shopping site and select
        "Try on with FabStudio" to try it on instantly.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
