// src/fileUploader.js
import { appState } from "../appState.js";
import { EqualizerPanel } from "./EqualizerPanel.js";

/**
 * Global instance – only one panel ever exists
 */
let equalizerPanel = null;

/**
 * Handles JSON file upload
 * - Parses JSON
 * - Populates appState (originalJson, renderedJson)
 * - Picks first available mode (not "original_signal")
 * - Creates EqualizerPanel **once**
 * - Syncs <select> with current mode
 */
export async function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileLabel = document.querySelector(".header-file-label");
  const fileNameDisplay = document.querySelector(".header-file-name");
  const uploaderCard = document.getElementById("uploaderCard");
  const mainApp = document.getElementById("mainApp");
  const loadingSuspense = document.getElementById("loadingSuspense");

  // ---- Validate ----
  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    alert("Please upload a valid JSON file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      // === UI: show loading ===
      fileLabel.textContent = "Loaded File:";
      fileNameDisplay.textContent = file.name;
      uploaderCard.style.display = "none";
      loadingSuspense.style.display = "block";

      const jsonData = JSON.parse(e.target.result);

      // === Populate appState ===
      appState.originalJson = jsonData;
      appState.renderedJson = structuredClone(jsonData);

      appState.mode = "generic";

      // === Create panel (only once) ===
      if (!equalizerPanel) {
        equalizerPanel = await new EqualizerPanel("control-panel");
      } else {
        // Reuse existing panel – just switch mode
        equalizerPanel.setMode(appState.mode);
      }

      // === Show main app ===
      mainApp.style.display = "grid";
      loadingSuspense.style.display = "none";

      console.log("JSON loaded & panel ready. Mode:", appState.mode);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to load JSON: " + (err.message || ""));
      loadingSuspense.style.display = "none";
      uploaderCard.style.display = "block";
    }
  };

  reader.onerror = () => {
    alert("Failed to read file.");
  };

  reader.readAsText(file);
}

// Attach listener (run once)
const fileInput = document.getElementById("jsonFile");
if (fileInput) {
  fileInput.addEventListener("change", handleJsonUpload);
}
