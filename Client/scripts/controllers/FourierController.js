export class FourierController {
  constructor({
    containerId,
    frequencies = [],
    magnitudes = [],
    title = "FFT",
  }) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container #${containerId} not found`);

    this.frequencies = frequencies;
    this.magnitudes = magnitudes;
    this.title = title;

    this.zoom = 1;
    this.offset = 0;
    this.speed = 1;

    // Controls
    this.resetBtn = this.container.querySelector(".reset-btn");
    this.zoomInBtn = this.container.querySelector(".zoom-in");
    this.zoomOutBtn = this.container.querySelector(".zoom-out");
    this.zoomLabel = this.container.querySelector(".zoom-label");
    this.panSlider = this.container.querySelector(".pan-slider");
    this.speedSlider = this.container.querySelector(".speed-slider");
    this.speedLabel = this.container.querySelector(".speed-label");
    this.fftTitle = this.container.querySelector(".fft-viewer-title");
    if (this.fftTitle) this.fftTitle.textContent = this.title;

    // Plot container
    this.plotContainer = this.container.querySelector(".fft-plot-container");
    if (!this.plotContainer)
      throw new Error("Plot container element not found inside container");

    this.bindControls();
    this.render();
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
      this.render();
    });
    this.speedSlider?.addEventListener("input", (e) => {
      this.speed = parseFloat(e.target.value);
      if (this.speedLabel)
        this.speedLabel.textContent = `Speed: ${this.speed.toFixed(2)}x`;
    });
  }

  reset() {
    this.zoom = 1;
    this.offset = 0;
    this.speed = 1;
    if (this.panSlider) this.panSlider.value = 0;
    if (this.speedSlider) this.speedSlider.value = 1;
    if (this.speedLabel) this.speedLabel.textContent = `Speed: 1x`;
    this.render();
  }

  clampOffset() {
    const maxOffset = Math.max(0, 1 - 1 / this.zoom);
    this.offset = Math.min(Math.max(this.offset, 0), maxOffset);
    if (this.panSlider) this.panSlider.value = this.offset;
    if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom.toFixed(2)}x`;
  }

  getVisibleData() {
    if (!this.frequencies.length) return { visibleFreq: [], visibleMag: [] };

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
    if (!visibleFreq.length) return;

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
      displayModeBar: false, // allow mouse zoom
      staticPlot: false,
      responsive: true,
      scrollZoom: true, // zoom with mouse wheel
    };

    Plotly.react(this.plotContainer, [trace], layout, config);
  }

  updateData(frequencies, magnitudes) {
    this.frequencies = frequencies;
    this.magnitudes = magnitudes;
    this.offset = 0;
    this.zoom = 1;
    this.speed = 1;
    this.render();
  }
}
