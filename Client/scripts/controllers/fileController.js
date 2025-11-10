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
 * - Sets default mode from JSON (first non-original_signal key)
 * - Creates EqualizerPanel (once)
 * - Shows/hides UI
 * - DOES NOT modify #modeSelect – options are hard-coded in HTML
 */
export async function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileLabel = document.querySelector(".header-file-label");
  const fileNameDisplay = document.querySelector(".header-file-name");
  const uploaderCard = document.getElementById("uploaderCard");
  const mainApp = document.getElementById("mainApp");
  const loadingSuspense = document.getElementById("loadingSuspense");

  // Validate file
  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    alert("Please upload a valid JSON file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      // === Update UI ===
      fileLabel.textContent = "Loaded File:";
      fileNameDisplay.textContent = file.name;
      uploaderCard.style.display = "none";
      loadingSuspense.style.display = "block";

      const jsonData = JSON.parse(e.target.result);

      // === Populate appState ===
      appState.originalJson = jsonData;
      appState.renderedJson = structuredClone(jsonData);

      appState.mode = "generic";
      appState.bands = []; // will be filled by EqualizerPanel

      equalizerPanel = await new EqualizerPanel("control-panel");

      // === Show main app ===
      mainApp.style.display = "grid";
      loadingSuspense.style.display = "none";

      console.log("JSON loaded. Mode:", appState);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to load JSON. " + (err.message || ""));
      loadingSuspense.style.display = "none";
      uploaderCard.style.display = "block";
    }
  };

  reader.onerror = () => {
    alert("Failed to read file.");
  };

  reader.readAsText(file);
}

// Attach listener
document
  .getElementById("jsonFile")
  .addEventListener("change", handleJsonUpload);
