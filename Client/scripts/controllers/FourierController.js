export class FourierController {
  constructor({
    containerId,
    frequencies = [],
    magnitudes = [],
    title = "FFT",
    parentId = "frequency-domain", // Default parent container
  }) {
    this.containerId = containerId;
    this.parentId = parentId;
    this.frequencies = frequencies;
    this.magnitudes = magnitudes;
    this.title = title;

    this.zoom = 1;
    this.offset = 0;

    // ✅ Create DOM if missing
    this._createViewerElement();
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container #${containerId} not found`);

    // Controls
    this.resetBtn = this.container.querySelector(".reset-btn");
    this.zoomInBtn = this.container.querySelector(".zoom-in");
    this.zoomOutBtn = this.container.querySelector(".zoom-out");
    this.zoomLabel = this.container.querySelector(".zoom-label");
    this.panSlider = this.container.querySelector(".pan-slider");
    this.fftTitle = this.container.querySelector(".fft-viewer-title");

    if (this.fftTitle) this.fftTitle.textContent = this.title;

    // Plot container
    this.plotContainer = this.container.querySelector(".fft-plot-container");
    if (!this.plotContainer)
      throw new Error("Plot container element not found inside container");

    // Initialize
    this._initSliders();
    this.bindControls();
    this.render();
  }

  _createViewerElement() {
    const parent = document.getElementById(this.parentId);
    if (!parent) throw new Error(`Parent container ${this.parentId} not found`);

    if (document.getElementById(this.containerId)) return;

    const wrapper = document.createElement("div");
    wrapper.id = this.containerId;
    wrapper.className = "card card-backdrop-blur fft-viewer";
    wrapper.innerHTML = `
      <div class="fft-viewer-header">
        <h3 class="fft-viewer-title">${this.title}</h3>
      </div>
      <div class="fft-plot-container" style="width: 100%; height: 300px;"></div>
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

  _initSliders() {
    [this.panSlider].filter(Boolean).forEach((slider) => {
      this._styleSliderTrack(slider);
      slider.addEventListener("input", () => this._styleSliderTrack(slider));
    });
  }

  _styleSliderTrack(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min || 0);
    const max = parseFloat(slider.max || 1);
    const val = parseFloat(slider.value || 0);
    const percent = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #1FD5F9 0%, #1FD5F9 ${percent}%, #a0a0a0 ${percent}%, #a0a0a0 100%)`;
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

  getVisibleData() {
    if (!this.frequencies.length || !this.magnitudes.length)
      return { visibleFreq: [], visibleMag: [] };

    const totalPoints = this.frequencies.length;
    const visibleCount = Math.floor(totalPoints / this.zoom);
    const start = Math.floor(this.offset * (totalPoints - visibleCount));
    const end = Math.min(start + visibleCount, totalPoints);

    const maxPoints = 2000;
    const step = Math.ceil((end - start) / maxPoints);

    const visibleFreq = [];
    const visibleMag = [];
    for (let i = start; i < end; i += step) {
      visibleFreq.push(this.frequencies[i]);
      visibleMag.push(this.magnitudes[i]);
    }

    return { visibleFreq, visibleMag };
  }

  render() {
    const { visibleFreq, visibleMag } = this.getVisibleData();
    if (!visibleFreq.length) {
      if (this.plotContainer) Plotly.purge(this.plotContainer);
      return;
    }

    const trace = {
      x: visibleFreq,
      y: visibleMag,
      type: "scatter",
      mode: "lines",
      line: { color: "#1FD5F9", width: 2 },
      showlegend: false,
    };

    const layout = {
      title: false,
      xaxis: {
        showgrid: false,
        zeroline: false,
        showline: true,
        linewidth: 1,
        mirror: true,
      },
      yaxis: {
        showgrid: false,
        zeroline: false,
        showline: true,
        linewidth: 1,
        mirror: true,
      },
      margin: { l: 30, r: 10, t: 0, b: 30 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      dragmode: "pan",
      hovermode: false,
    };

    const config = {
      displayModeBar: false,
      staticPlot: false,
      responsive: true,
      scrollZoom: true,
    };

    Plotly.react(this.plotContainer, [trace], layout, config);
  }

  updateData(frequencies, magnitudes) {
    // Update data safely
    this.frequencies = frequencies;
    this.magnitudes = magnitudes;
    this.offset = 0;
    this.zoom = 1;

    if (this.panSlider) this.panSlider.value = 0;
    if (this.zoomLabel) this.zoomLabel.textContent = "1x";

    this._styleSliderTrack(this.panSlider);

    this.render();
  }
}
