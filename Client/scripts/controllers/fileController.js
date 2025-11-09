import { appState } from "../appState.js";
import { extractSignalFromAudio } from "../utils/extractSignalFromAudio.js";
import { calcFFT } from "../utils/calcFFT.js";
import { SignalViewer } from "./SignalViewer.js";
import { FourierController } from "./FourierController.js"; // <-- IMPORTANT

export async function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fileLabel = document.querySelector(".header-file-label");
  const fileNameDisplay = document.querySelector(".header-file-name");
  const uploaderCard = document.getElementById("uploaderCard");
  const mainApp = document.getElementById("mainApp");
  const loadingSuspense = document.getElementById("loadingSuspense"); // Add this

  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    alert("❌ Please upload a valid JSON file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const jsonData = JSON.parse(e.target.result);
      fileLabel.textContent = "Loaded File:";
      fileNameDisplay.textContent = file.name;

      appState.originalJson = jsonData;
      appState.renderedJson = JSON.parse(JSON.stringify(jsonData));

      uploaderCard.style.display = "none";
      loadingSuspense.style.display = "block"; // Show loading

      const mode = appState.mode;

      // 1️⃣ LOAD INPUT SIGNAL
      const input = await extractSignalFromAudio(
        appState.renderedJson.original_signal
      );

      // Compute FFT
      const inputFFT = await calcFFT(input.amplitudes, input.sampleRate);

      // Store & Draw Input Signal
      appState.inputViewer = new SignalViewer({
        containerId: "input-signal-viewer",
        title: "Input Signal",
        samples: input.amplitudes,
        sampleRate: input.sampleRate,
        audioSrc: appState.renderedJson.original_signal,
        color: "#666",
      });

      // Store & Draw Input FFT
      appState.inputFFT = new FourierController({
        containerId: "input-fft",
        frequencies: inputFFT.frequencies,
        magnitudes: inputFFT.magnitudes,
        title: "Input FFT",
      });

      // 2️⃣ LOAD OUTPUT SIGNAL (according to mode)
      const outputPath = jsonData[mode].output_signal;
      const output = await extractSignalFromAudio(outputPath);

      // Compute FFT
      const outputFFT = await calcFFT(output.amplitudes, input.sampleRate);

      // Store & Draw Output Signal
      appState.outputViewer = new SignalViewer({
        containerId: "output-signal-viewer",
        title: "Output Signal",
        samples: output.amplitudes,
        sampleRate: input.sampleRate,
        audioSrc: outputPath,
        color: "#666",
      });

      // Store & Draw Output FFT
      appState.outputFFT = new FourierController({
        containerId: "output-fft",
        frequencies: outputFFT.frequencies,
        magnitudes: outputFFT.magnitudes,
        title: "Output FFT",
      });
      console.log(appState);
      mainApp.style.display = "grid";
      loadingSuspense.style.display = "none";
    } catch (err) {
      console.error("Error parsing JSON or loading audio:", err);
      alert("❌ Failed to load JSON or audio files.");
    }
  };

  reader.readAsText(file);
}

// Attach event listener
document
  .getElementById("jsonFile")
  .addEventListener("change", handleJsonUpload);
