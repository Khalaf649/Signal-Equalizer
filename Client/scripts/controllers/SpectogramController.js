export class SpectogramController {
  constructor({
    containerId,
    parentId = "Spectrograms",
    title,
    times = [],
    frequencies = [],
    magnitudes = [[]],
  }) {
    this.containerId = containerId;
    this.parentId = parentId;
    this.title = title;
    this.times = times;
    this.frequencies = frequencies;
    this.magnitudes = magnitudes;

    this.zoom = 1;
    this.offset = 0;

    this._createViewerElement();

    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container #${containerId} not found`);

    // Controls
    this.resetBtn = this.container.querySelector(".reset-btn");
    this.zoomInBtn = this.container.querySelector(".zoom-in");
    this.zoomOutBtn = this.container.querySelector(".zoom-out");
    this.zoomLabel = this.container.querySelector(".zoom-label");
    this.panSlider = this.container.querySelector(".pan-slider");
    this.spectrogramTitle = this.container.querySelector(
      ".spectrogram-viewer-title"
    );

    if (this.title) this.spectrogramTitle.textContent = this.title;

    // Plot container
    this.plotContainer = this.container.querySelector(
      ".spectrogram-plot-container"
    );
    if (!this.plotContainer)
      throw new Error("Plot container element not found inside container");
    this._initSliders();
    this.bindControls();
    // Initial render if data provided
    if (
      this.times.length &&
      this.frequencies.length &&
      this.magnitudes.length
    ) {
      this.render();
    }
  }
  _createViewerElement() {
    const parent = document.getElementById(this.parentId);
    if (!parent) throw new Error(`Parent container ${this.parentId} not found`);

    if (document.getElementById(this.containerId)) return;

    const wrapper = document.createElement("div");
    wrapper.id = this.containerId;
    wrapper.className = "card card-backdrop-blur spectrogram-viewer";
    wrapper.innerHTML = `
      <div class="spectrogram-viewer-header">
        <h3 class="spectrogram-viewer-title">${this.title}</h3>
      </div>
      <div class="spectrogram-plot-container" style="width: 100%; height: 300px;"></div>
      <div class="playback-controls">
        <div class="playback-controls-group">
          <button class="btn btn-secondary btn-sm reset-btn">↺</button>
        </div>
        <div class="playback-controls-slider">
          <span class="playback-controls-label pan-label">Pos</span>
          <input type="range" min="0" max="1" step="0.001" value="0" class="pan-slider slider-input">
        </div>
        <div class="playback-controls-zoom">
          <button class="btn btn-secondary btn-sm zoom-out">-</button>
          <span class="playback-controls-zoom-label zoom-label">1x</span>
          <button class="btn btn-secondary btn-sm zoom-in">+</button>
        </div>
      </div>
    `;
    parent.appendChild(wrapper);
  }
  bindControls() {
    this.resetBtn?.addEventListener("click", () => this.reset());
    this.zoomInBtn?.addEventListener("click", () => {
      this.zoom *= 1.5;
      this.clampOffset();
      this.render();
    });
    this.zoomOutBtn?.addEventListener("click", () => {
      this.zoom = Math.max(this.zoom / 1.5, 1);
      this.clampOffset();
      this.render();
    });
    this.panSlider?.addEventListener("input", (e) => {
      this.offset = parseFloat(e.target.value);
      this._styleSliderTrack(this.panSlider);
      this.render();
    });
  }

  reset() {
    this.zoom = 1;
    this.offset = 0;
    if (this.panSlider) this.panSlider.value = 0;
    if (this.zoomLabel) this.zoomLabel.textContent = "1x";
    this._styleSliderTrack(this.panSlider);
    this.render();
  }

  clampOffset() {
    const maxOffset = Math.max(0, 1 - 1 / this.zoom);
    this.offset = Math.min(Math.max(this.offset, 0), maxOffset);
    if (this.panSlider) {
      this.panSlider.value = this.offset;
      this._styleSliderTrack(this.panSlider);
    }
    if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom.toFixed(2)}x`;
  }
  _initSliders() {
    const slider = this.panSlider;
    if (!slider) return;

    this._styleSliderTrack(slider);
    slider.addEventListener("input", () => this._styleSliderTrack(slider));
  }

  _styleSliderTrack(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min || 0);
    const max = parseFloat(slider.max || 1);
    const val = parseFloat(slider.value || 0);
    const percent = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #1FD5F9 0%, #1FD5F9 ${percent}%, #a0a0a0 ${percent}%, #a0a0a0 100%)`;
  }

  getVisibleData() {
    if (!this.magnitudes.length) return { x: [], y: [], z: [] };

    const numTimes = this.magnitudes[0].length; // time dimension
    const visibleFrames = Math.floor(numTimes / this.zoom);

    const startIdx = Math.floor(this.offset * (numTimes - visibleFrames));
    const endIdx = Math.min(startIdx + visibleFrames, numTimes);

    const x = this.times.slice(startIdx, endIdx);
    const y = this.frequencies;

    // z[freq][time] for Plotly
    const z = this.frequencies.map((_, fIdx) =>
      this.magnitudes[fIdx].slice(startIdx, endIdx)
    );

    return { x, y, z };
  }

  render() {
    if (!this.plotContainer) return;

    const { x, y, z } = this.getVisibleData();
    if (!x.length || !y.length || !z.length) return;

    Plotly.react(
      this.plotContainer,
      [
        {
          z,
          x,
          y,
          type: "heatmap",
          colorscale: "Viridis",
          showscale: true,
        },
      ],
      {
        margin: { t: 20, l: 50, r: 20, b: 50 },
        xaxis: { title: "Time (s)" },
        yaxis: { title: "Frequency (Hz)" },
        autosize: true,
      }
    );
  }

  updateData(times = [], frequencies = [], magnitudes = [[]]) {
    this.times = times;
    this.frequencies = frequencies;
    this.magnitudes = magnitudes;
    this.render();
  }
}
