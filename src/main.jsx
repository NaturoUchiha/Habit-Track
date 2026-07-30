import React from "react";
import ReactDOM from "react-dom/client";
import SoloLevelingTracker from "./SoloLevelingTracker.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SoloLevelingTracker />
  </React.StrictMode>
);

// PWA service worker registration — see the instructions comment
// at the bottom of SoloLevelingTracker.jsx for the manifest.json
// and service-worker.js files this depends on.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("SW registration failed:", err));
  });
}
