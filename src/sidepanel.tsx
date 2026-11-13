import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { quietMediaPipeLogs } from "./lib/quietLogs";
import { SidePanelApp } from "./SidePanelApp";
import "./styles.css";

quietMediaPipeLogs();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>,
);
