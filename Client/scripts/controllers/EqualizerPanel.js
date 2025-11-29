import { appState } from "../appState.js";
import { extractSignalFromAudio } from "../utils/extractSignalFromAudio.js";
import { calcFFT } from "../utils/calcFFT.js";
import { SignalViewer } from "./SignalViewer.js";
import { FourierController } from "./FourierController.js";
import { SpectogramController } from "./SpectogramController.js";
import { applyEQ } from "../utils/applyEQ.js";
import { saveEQToServer } from "../utils/saveEQToServer.js";
import { calcSpectrogram } from "../utils/calcSpectrogram.js";
import { ApplyAi } from "../utils/ApplyAi.js";

export class EqualizerPanel {
  constructor(panelId = "control-panel") {
    return (async () => {
      this.panel = document.getElementById(panelId);
      if (!this.panel) throw new Error(`#${panelId} not found`);

      // ===  DOM elements ===
      this.modeSelect = this.panel.querySelector("#modeSelect");
      this.controlsContainer = this.panel.querySelector(".equalizer-controls"); // placeholder for sliders
      this.resetBtn = this.panel.querySelector("#btnReset");
      this.saveBtn = this.panel.querySelector("#btnSave");
      this.addSliderBtn = this.panel.querySelector("#open-dialog");
      this.dialog = this.panel.querySelector("#dialog-overlay");
      this.closeDialogBtn = this.panel.querySelector("#close-dialog");
      this.addSliderForm = this.panel.querySelector("#add-slider-form");
      this.showPrecomputedCheckbox =
        this.panel.querySelector("#show-spectrograms");
      this.aiModeContainer = this.panel.querySelector("#ai-mode-container");
      this.aiModeToggle = this.panel.querySelector("#ai-mode-toggle");

      this.minFreqInput = this.panel.querySelector("#min-freq");
      this.minFreqValue = this.panel.querySelector("#min-freq-value");
      this.maxFreqInput = this.panel.querySelector("#max-freq");
      this.maxFreqValue = this.panel.querySelector("#max-freq-value");
      this.sliderNameInput = this.panel.querySelector("#slider-name");
      // suspense div shown while applying or switching modes
      this.applySuspense = this.panel.querySelector("#apply-eq-suspense");

      // AI mode state
      this.useAI = true; // Default to AI mode enabled

      this._styleSliderTrack(this.minFreqInput);
      this._styleSliderTrack(this.maxFreqInput);

      if (!this.controlsContainer || !this.modeSelect)
        throw new Error("Required UI elements not found");

      this._attachEvents();
      await this._updateViewersForMode();
      await this.renderSliders();

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
    this.showPrecomputedCheckbox.addEventListener("change", () => {
      const isVisible = this.showPrecomputedCheckbox.checked;
      const spectrogramContainers = document.querySelector("#Spectrograms");
      spectrogramContainers.style.display = isVisible ? "grid" : "none";
    });

    // AI Mode Toggle Handler
    this.aiModeToggle.addEventListener("change", async () => {
      this.useAI = this.aiModeToggle.checked;
      await this.renderSliders();
    });

    this.resetBtn.addEventListener("click", () => this.reset());
    this.saveBtn.addEventListener("click", () => this.downloadJson());

    this.addSliderBtn.addEventListener("click", () =>
      this.openAddSliderDialog()
    );
    this.closeDialogBtn.addEventListener("click", () =>
      this.closeAddSliderDialog()
    );

    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.closeAddSliderDialog();
    });

    this.addSliderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddSlider();
    });

    // ✅ Corrected min/max input event listeners
    this.minFreqInput.addEventListener("input", () => {
      this.minFreqValue.textContent = `${this.minFreqInput.value} Hz`;
      this._styleSliderTrack(this.minFreqInput);
    });

    this.maxFreqInput.addEventListener("input", () => {
      this.maxFreqValue.textContent = `${this.maxFreqInput.value} Hz`;
      this._styleSliderTrack(this.maxFreqInput);
    });
  }

  openAddSliderDialog() {
    this.dialog.classList.remove("hidden");
  }

  closeAddSliderDialog() {
    this.dialog.classList.add("hidden");
  }

  async handleAddSlider() {
    const name = this.sliderNameInput.value || "Untitled";
    const min = parseFloat(this.minFreqInput.value);
    const max = parseFloat(this.maxFreqInput.value);

    if (min > max) {
      alert("Please enter a valid band");
      return;
    }

    const modeData = appState.renderedJson[appState.mode];
    const isAIMode =
      (appState.mode === "musical" || appState.mode === "human_voices") &&
      this.useAI;
    const sliderArray = isAIMode ? "AI_sliders" : "sliders";

    if (!modeData[sliderArray]) modeData[sliderArray] = [];

    const newSlider = {
      name,
      low: min,
      high: max,
      value: 1, // default
    };

    modeData[sliderArray].push(newSlider);

    // Await renderSliders in case it's async (for music_model fetching)
    if (typeof this.renderSliders === "function") {
      await this.renderSliders();
    }

    this.closeAddSliderDialog();
  }

  // =================================================================
  // 2. Viewers: helpers to initialize / update viewers per mode
  // =================================================================
  async _updateViewersForMode() {
    if (!appState.renderedJson) throw new Error("JSON not loaded");
    const modeName = appState.mode;

    const modeData = appState.renderedJson[modeName] || {};
    // Per-mode input signal path. Fall back to legacy `original_signal` if present.
    const inputPath =
      modeData.input_signal || appState.renderedJson.original_signal || null;

    const input = await extractSignalFromAudio(inputPath);
    const inputFFT = await calcFFT(input.amplitudes, input.sampleRate);
    const inputSpectrogram = await calcSpectrogram(
      input.amplitudes,
      input.sampleRate
    );

    if (!appState.inputViewer) {
      appState.inputViewer = new SignalViewer({
        containerId: "input-signal-viewer",
        title: "Input Signal",
        samples: input.amplitudes,
        sampleRate: input.sampleRate,
        audioSrc: inputPath,
        color: "#666",
      });
    } else {
      appState.inputViewer.updateSamples(
        input.amplitudes,
        input.sampleRate,
        inputPath
      );
    }

    if (!appState.inputFFT) {
      appState.inputFFT = new FourierController({
        containerId: "input-fft",
        frequencies: inputFFT.frequencies,
        magnitudes: inputFFT.magnitudes,
        title: "Input FFT",
      });
    } else {
      appState.inputFFT.updateData(inputFFT.frequencies, inputFFT.magnitudes);
    }

    if (!appState.inputSpectogram) {
      appState.inputSpectogram = new SpectogramController({
        containerId: "input-spectrogram",
        title: "Input Spectrogram",
        times: inputSpectrogram.x,
        frequencies: inputSpectrogram.y,
        magnitudes: inputSpectrogram.z,
      });
    } else {
      appState.inputSpectogram.updateData(
        inputSpectrogram.x,
        inputSpectrogram.y,
        inputSpectrogram.z
      );
    }

    // After input is ready, load precomputed output for the same mode
    await this._loadPrecomputedOutput();
  }

  async _loadPrecomputedOutput() {
    const path = appState.renderedJson[appState.mode]?.output_signal;
    const out = await extractSignalFromAudio(path);
    const outFFT = await calcFFT(out.amplitudes, out.sampleRate);
    const outSpectrogram = await calcSpectrogram(
      out.amplitudes,
      out.sampleRate
    );

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
    if (!appState.outputSpectogram) {
      appState.outputSpectogram = new SpectogramController({
        containerId: "output-spectrogram",
        title: "Output Spectrogram",
        times: outSpectrogram.x,
        frequencies: outSpectrogram.y,
        magnitudes: outSpectrogram.z,
      });
    } else {
      appState.outputSpectogram.updateData(
        outSpectrogram.x,
        outSpectrogram.y,
        outSpectrogram.z
      );
    }
  }

  // Apply EQ and update outputs (used by sliders' 'change' events)
  async _applyEQAndUpdate() {
    if (!appState.inputViewer) return;
    try {
      // show suspense indicator
      if (this.applySuspense) this.applySuspense.style.display = "flex";
      // disable controls while applying
      if (this.controlsContainer)
        this.controlsContainer.style.pointerEvents = "none";
      if (this.saveBtn) this.saveBtn.disabled = true;

      let modifiedSamples, frequencies, magnitudes, sampleRate;

      // Check if AI mode is enabled for musical or human_voices
      const isAIMode =
        (appState.mode === "musical" || appState.mode === "human_voices") &&
        this.useAI;

      if (isAIMode) {
        // Call AI API with sliders
        const modeData = appState.renderedJson[appState.mode];
        const sliders = modeData?.AI_sliders || [];

        // Send the original audio file (URL) and the sliders to the server
        const fileUrl =
          appState.inputViewer?.audioSrc ||
          appState.renderedJson[appState.mode]?.input_signal;
        const result = await ApplyAi(fileUrl, sliders);

        modifiedSamples = result.samples;
        frequencies = result.frequencies;
        magnitudes = result.magnitudes;
        sampleRate = result.sampleRate || appState.inputViewer.sampleRate;
      } else {
        // Use normal EQ apply
        const result = await applyEQ();
        modifiedSamples = result.samples;
        frequencies = result.frequencies;
        magnitudes = result.magnitudes;
        sampleRate = result.sampleRate || appState.inputViewer.sampleRate;
      }

      const filePath = await saveEQToServer(modifiedSamples, sampleRate);
      appState.renderedJson[appState.mode].output_signal = filePath;

      // Update output viewer (time domain)
      appState.outputViewer?.updateSamples(
        modifiedSamples,
        sampleRate,
        filePath
      );

      // Update FFT
      appState.outputFFT?.updateData(frequencies, magnitudes);

      // Update Spectrogram
      const spectrogram = await calcSpectrogram(
        modifiedSamples,
        appState.inputViewer.sampleRate
      );
      appState.outputSpectogram?.updateData(
        spectrogram.x,
        spectrogram.y,
        spectrogram.z
      );
    } catch (err) {
      console.error("Failed to apply EQ:", err);
      alert(err.message);
    } finally {
      if (this.controlsContainer)
        this.controlsContainer.style.pointerEvents = "";
      if (this.saveBtn) this.saveBtn.disabled = false;
      // hide suspense indicator
      if (this.applySuspense) this.applySuspense.style.display = "none";
    }
  }

  // =================================================================
  // 3. Render sliders & sync
  // =================================================================
  async renderSliders() {
    const modeData = appState.renderedJson[appState.mode];
    let sliders = await this._getSlidersForMode();

    this._renderSliderUI(sliders);
  }

  /**
   * Get sliders for the current mode, fetching if necessary
   */
  async _getSlidersForMode() {
    const modeData = appState.renderedJson[appState.mode];
    const isAIMode =
      (appState.mode === "musical" || appState.mode === "human_voices") &&
      this.useAI;

    // Determine which property to use
    const sliderProperty = isAIMode ? "AI_sliders" : "sliders";
    let sliders = modeData?.[sliderProperty] || [];

    return sliders;
  }

  /**
   * Render slider UI elements
   */
  _renderSliderUI(sliders) {
    this.controlsContainer.innerHTML = sliders.length
      ? ""
      : "<p class='text-gray-500'>No bands defined</p>";

    sliders.forEach((band, i) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("frequency-slider");
      wrapper.dataset.index = i;

      wrapper.innerHTML = `
        <div class="frequency-slider-header">
          <label class="frequency-slider-label">${band.name} (${band.low}-${
        band.high
      })</label>
          <div class="flex items-center gap-2">
            <span class="frequency-slider-value">${band.value.toFixed(
              2
            )}x</span>
            <button class="btn frequency-slider-delete">
              <svg class="icon-sm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M6 6 L18 18 M6 18 L18 6" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="slider-container w-full relative">
          <input type="range" min="0" max="2" step="0.1" value="${
            band.value
          }" class="slider-input w-full"/>
        </div>
        <div class="frequency-slider-scale"><span>0x</span><span>1x</span><span>2x</span></div>
      `;

      const input = wrapper.querySelector(".slider-input");
      const valueSpan = wrapper.querySelector(".frequency-slider-value");
      const deleteBtn = wrapper.querySelector(".frequency-slider-delete");

      this._styleSliderTrack(input);

      input.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        valueSpan.textContent = `${val.toFixed(2)}x`;
        this._styleSliderTrack(input);

        // sync to appState
        const modeData = appState.renderedJson[appState.mode];
        const isAIMode =
          (appState.mode === "musical" || appState.mode === "human_voices") &&
          this.useAI;
        const sliderArray = isAIMode ? modeData?.AI_sliders : modeData?.sliders;

        if (sliderArray) {
          sliderArray[i].value = val;
        }

        // call external function to update design
        if (typeof this.onSliderChange === "function") {
          this.onSliderChange(i, val);
        }
      });

      // When the user finishes adjusting (change event), apply EQ and update outputs
      input.addEventListener("change", async () => {
        await this._applyEQAndUpdate();
      });

      deleteBtn.addEventListener("click", () => this.removeBand(i));

      this.controlsContainer.appendChild(wrapper);
    });
  }

  // =================================================================
  // 4. Slider styling
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
  async setMode(modeName) {
    appState.mode = modeName;
    appState.inputViewer.reset();
    appState.inputFFT.reset();
    appState.inputSpectogram.reset();
    if (modeName === "generic") this.addSliderBtn.style.display = "block";
    else this.addSliderBtn.style.display = "none";

    // Show/hide AI mode toggle based on mode
    if (this.aiModeContainer) {
      this.aiModeContainer.style.display =
        modeName === "musical" || modeName === "human_voices" ? "flex" : "none";
    }

    if (this.applySuspense) this.applySuspense.style.display = "flex";

    try {
      await this._updateViewersForMode();
      await this.renderSliders(); // renderSliders should now be async
    } catch (err) {
      console.error("Error setting mode:", err);
    } finally {
      if (this.applySuspense) this.applySuspense.style.display = "none";
    }
  }

  removeBand(index) {
    const modeData = appState.renderedJson[appState.mode];
    const isAIMode =
      (appState.mode === "musical" || appState.mode === "human_voices") &&
      this.useAI;
    const sliderArray = isAIMode ? modeData?.AI_sliders : modeData?.sliders;

    if (!sliderArray) return;

    sliderArray.splice(index, 1);
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
