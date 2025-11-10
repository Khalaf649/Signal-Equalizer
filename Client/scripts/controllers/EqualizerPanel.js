// src/EqualizerPanel.js
import { appState } from "../appState.js";
import { extractSignalFromAudio } from "../utils/extractSignalFromAudio.js";
import { calcFFT } from "../utils/calcFFT.js";
import { applyEQ } from "../utils/applyEQ.js";
import { SignalViewer } from "./SignalViewer.js";
import { FourierController } from "./FourierController.js";

/**
 * EqualizerPanel – simplified + fixed
 * - Sliders with colored track (left = #1fd5f9, right = gray)
 * - Reset + Save work
 * - No live recomputation, no #addBand
 */
export class EqualizerPanel {
  constructor(panelId = "control-panel") {
    return (async () => {
      this.panel = document.getElementById(panelId);
      if (!this.panel) throw new Error(`#${panelId} not found`);

      // === Query DOM elements ===
      this.modeSelect = this.panel.querySelector("#modeSelect");
      this.controlsContainer = this.panel.querySelector(".equalizer-controls");
      this.resetBtn = this.panel.querySelector("#btnReset");
      this.saveBtn = this.panel.querySelector("#btnSave");

      if (!this.controlsContainer || !this.modeSelect)
        throw new Error("Required UI elements not found");

      this._attachEvents();

      await this._initViewers();
      this.renderSliders();

      return this;
    })();
  }

  // =================================================================
  // 1. Event handlers
  // =================================================================
  _attachEvents() {
    this.modeSelect.addEventListener("change", () =>
      this.setMode(this.modeSelect.value)
    );
    this.resetBtn.addEventListener("click", () => this.reset());
    this.saveBtn.addEventListener("click", () => this.downloadJson());
  }

  // =================================================================
  // 2. Initialize viewers
  // =================================================================
  async _initViewers() {
    if (!appState.renderedJson) throw new Error("JSON not loaded");

    const input = await extractSignalFromAudio(
      appState.renderedJson.original_signal
    );
    const inputFFT = await calcFFT(input.amplitudes, input.sampleRate);

    appState.inputViewer = new SignalViewer({
      containerId: "input-signal-viewer",
      title: "Input Signal",
      samples: input.amplitudes,
      sampleRate: input.sampleRate,
      audioSrc: appState.renderedJson.original_signal,
      color: "#666",
    });

    appState.inputFFT = new FourierController({
      containerId: "input-fft",
      frequencies: inputFFT.frequencies,
      magnitudes: inputFFT.magnitudes,
      title: "Input FFT",
    });

    await this._loadPrecomputedOutput();
  }

  async _loadPrecomputedOutput() {
    const path = appState.renderedJson[appState.mode]?.output_signal;

    const out = await extractSignalFromAudio(path);

    const outFFT = await calcFFT(out.amplitudes, out.sampleRate);

    if (!appState.outputViewer) {
      appState.outputViewer = new SignalViewer({
        containerId: "output-signal-viewer",
        title: "Output Signal",
        samples: out.amplitudes,
        sampleRate: out.sampleRate,
        audioSrc: path,
        color: "#666",
      });
    } else {
      appState.outputViewer.updateSamples(out.amplitudes, out.sampleRate, path);
    }

    if (!appState.outputFFT) {
      appState.outputFFT = new FourierController({
        containerId: "output-fft",
        frequencies: outFFT.frequencies,
        magnitudes: outFFT.magnitudes,
        title: "Output FFT",
      });
    } else {
      appState.outputFFT.updateData(outFFT.frequencies, outFFT.magnitudes);
    }
  }

  // =================================================================
  // 3. Render sliders (with colored track)
  // =================================================================
  renderSliders() {
    console.log(appState.mode);
    const modeData = appState.renderedJson[appState.mode];
    const sliders = modeData?.sliders || [];

    if (!sliders.length) {
      this.controlsContainer.innerHTML =
        "<p class='text-gray-500'>No bands defined</p>";
      return;
    }

    this.controlsContainer.innerHTML = "";

    sliders.forEach((band, i) => {
      const sliderHTML = `
        <div class="frequency-slider" data-index="${i}">
          <div class="frequency-slider-header">
            <label class="frequency-slider-label">
              ${band.name} (${band.low}-${band.high})
            </label>
            <div class="flex items-center gap-2">
              <span class="frequency-slider-value">${band.value}x</span>
              <button class="btn frequency-slider-delete">
                <svg class="icon-sm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M6 6 L18 18 M6 18 L18 6" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="frequency-slider-range">${band.low} - ${band.high}</div>
          <div class="slider-container w-full relative">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value="${band.value}"
              class="slider-input w-full"
            />
          </div>
          <div class="frequency-slider-scale">
            <span>0x</span>
            <span>1x</span>
            <span>2x</span>
          </div>
        </div>
      `;

      const wrapper = document.createElement("div");
      wrapper.innerHTML = sliderHTML;
      const sliderEl = wrapper.firstElementChild;

      const input = sliderEl.querySelector(".slider-input");
      const valueSpan = sliderEl.querySelector(".frequency-slider-value");
      const deleteBtn = sliderEl.querySelector(".frequency-slider-delete");

      // Colorize the slider track
      this._styleSliderTrack(input);

      input.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        valueSpan.textContent = `${val.toFixed(2)}x`;
        this._styleSliderTrack(input);
        const modeData = appState.renderedJson[appState.mode];
        if (modeData?.sliders?.[i]) {
          modeData.sliders[i].value = val;
        }
      });

      deleteBtn.addEventListener("click", () => this.removeBand(i));

      this.controlsContainer.appendChild(sliderEl);
    });
  }

  // =================================================================
  // 4. Style slider track
  // =================================================================
  _styleSliderTrack(input) {
    const value = parseFloat(input.value);
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const percent = ((value - min) / (max - min)) * 100;

    input.style.background = `linear-gradient(to right, #1fd5f9 0%, #1fd5f9 ${percent}%, #a0a0a0 ${percent}%, #a0a0a0 100%)`;
  }

  // =================================================================
  // 5. Mode / Bands / Reset / Save
  // =================================================================
  setMode(modeName) {
    appState.mode = modeName;
    appState.inputViewer.reset();
    appState.inputFFT.reset();
    const app = document.getElementById("mainApp");
    const loading = document.getElementById("loadingSuspense");

    // 1️⃣ Show loading spinner
    if (app) app.style.display = "none";
    if (loading) loading.style.display = "block";

    // 2️⃣ Precompute output signal + FFT
    this._loadPrecomputedOutput()
      .then(() => {
        // 3️⃣ Render sliders after output is ready
        this.renderSliders();
      })
      .catch((err) => {
        console.error("Failed to load output signal:", err);
      })
      .finally(() => {
        // 4️⃣ Hide loading spinner and show main app
        if (app) app.style.display = "grid"; // or your default layout
        if (loading) loading.style.display = "none";
      });
  }

  removeBand(index) {
    const modeData = appState.renderedJson[appState.mode];
    if (!modeData?.sliders) return;

    modeData.sliders.splice(index, 1);
    this.renderSliders();
  }

  reset() {
    appState.renderedJson = structuredClone(appState.originalJson);
    this.renderSliders();
  }

  downloadJson() {
    const blob = new Blob([JSON.stringify(appState.renderedJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "equalizer_project.json";
    a.click();
    URL.revokeObjectURL(url);
  }
}
