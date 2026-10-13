import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Serve Excalidraw's fonts from this app (works offline).
window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
