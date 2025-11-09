export class SignalViewer {
  constructor({
    containerId,
    samples = [],
    sampleRate,
    audioSrc = null,
    color,
    title,
  }) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);

    this.sampleRate = sampleRate;
    this.samples = samples;
    this.time = this.samples.map((_, i) => i / sampleRate);
    this.audio = audioSrc ? new Audio(audioSrc) : null;
    this.color = color;
    this.title = title;

    this.isPlaying = false;
    this.isMuted = false;
    this.speed = 1;
    this.zoom = 1;
    this.offset = 0;
    this.currentTime = 0;

    // Plot container
    this.plotContainer = this.container.querySelector(".signal-plot-container");
    if (!this.plotContainer)
      throw new Error("Plot container element not found inside container");

    // Child controls
    this.playBtn = this.container.querySelector(".play-btn");
    this.stopBtn = this.container.querySelector(".stop-btn");
    this.resetBtn = this.container.querySelector(".reset-btn");
    this.muteBtn = this.container.querySelector(".mute-toggle-btn");
    this.speedSlider = this.container.querySelector(".speed-slider");
    this.speedLabel = this.container.querySelector(".speed-label");
    this.zoomInBtn = this.container.querySelector(".zoom-in");
    this.zoomOutBtn = this.container.querySelector(".zoom-out");
    this.zoomLabel = this.container.querySelector(".zoom-label");
    this.signalTitle = this.container.querySelector(".signal-viewer-title");
    this.signalDuration = this.container.querySelector(
      ".signal-viewer-duration"
    );
    this.panSlider = this.container.querySelector(".pan-slider");
    this.signalTitle.textContent = this.title;

    // Plotly data
    this.plotData = [];
    this.plotLayout = {};
    this.plotConfig = {
      displayModeBar: false,
      staticPlot: false,
      responsive: true,
    };

    this.bindControls();
    this.render();

    if (this.audio) {
      this.audio.addEventListener(
        "timeupdate",
        this._onAudioTimeUpdate.bind(this)
      );
    }
  }

  _onAudioTimeUpdate() {
    this.currentTime = this.audio.currentTime;
    this.render();
  }

  clampOffset() {
    const maxOffset = Math.max(0, 1 - 1 / this.zoom);
    this.offset = Math.min(Math.max(this.offset, 0), maxOffset);

    if (this.panSlider) {
      this.panSlider.value = this.offset;
    }
  }

  updateDuration() {
    if (!this.signalDuration) return;

    const totalSeconds = this.samples.length / this.sampleRate;
    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    this.signalDuration.textContent = `${formatTime(
      this.currentTime
    )} / ${formatTime(totalSeconds)}`;
  }

  bindControls() {
    this.playBtn?.addEventListener("click", () => this.togglePlayPause());
    this.stopBtn?.addEventListener("click", () => this.stop());
    this.resetBtn?.addEventListener("click", () => this.reset());
    this.muteBtn?.addEventListener("click", () => this.toggleMute());
    this.zoomInBtn?.addEventListener("click", () => this.zoomIn());
    this.zoomOutBtn?.addEventListener("click", () => this.zoomOut());
    this.speedSlider?.addEventListener("input", (e) =>
      this.setSpeed(parseFloat(e.target.value))
    );
    this.panSlider?.addEventListener("input", (e) => {
      this.offset = parseFloat(e.target.value);
      this.render();
    });
  }

  togglePlayPause() {
    if (!this.audio) return;
    if (this.isPlaying) this.audio.pause();
    else {
      this.audio.playbackRate = this.speed;
      this.audio.play();
    }
    this.isPlaying = !this.isPlaying;
    if (this.playBtn) this.playBtn.textContent = this.isPlaying ? "⏸" : "▶";
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTime = 0;
    this.isPlaying = false;
    if (this.playBtn) this.playBtn.textContent = "▶";
    this.render();
  }

  reset() {
    this.stop();
    this.zoom = 1;
    this.offset = 0;
    this.render();
  }

  toggleMute() {
    if (!this.audio) return;
    this.audio.muted = !this.audio.muted;
    this.isMuted = this.audio.muted;
    if (this.muteBtn) this.muteBtn.textContent = this.isMuted ? "🔇" : "🔊";
  }

  zoomIn() {
    this.zoom = Math.min(this.zoom * 1.5, 4000);
    this.zoomLabel.textContent = `${this.zoom.toFixed(2)}x`;
    this.clampOffset();
    this.render();
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom / 1.5, 1);
    this.zoomLabel.textContent = `${this.zoom.toFixed(2)}x`;
    this.clampOffset();
    this.render();
  }

  setSpeed(value) {
    this.speed = value;
    if (this.audio) this.audio.playbackRate = value;
    if (this.speedLabel)
      this.speedLabel.textContent = `Speed: ${value.toFixed(2)}x`;
  }

  updateData(samples, time = null, audioSrc = null) {
    this.samples = samples;
    this.time = time || this.samples.map((_, i) => i / this.sampleRate);
    this.currentTime = 0;

    if (audioSrc) {
      if (this.audio)
        this.audio.removeEventListener(
          "timeupdate",
          this._onAudioTimeUpdate.bind(this)
        );
      this.audio = new Audio(audioSrc);
      this.audio.addEventListener(
        "timeupdate",
        this._onAudioTimeUpdate.bind(this)
      );
    }

    this.render();
  }

  getVisibleData() {
    if (!this.samples.length) return { visibleTime: [], visibleSamples: [] };

    const totalSamples = this.samples.length;
    const visibleSamplesCount = Math.floor(totalSamples / this.zoom);
    const startSample = Math.floor(
      this.offset * (totalSamples - visibleSamplesCount)
    );
    const endSample = Math.min(startSample + visibleSamplesCount, totalSamples);

    // Downsample for better performance with large datasets
    const maxPoints = 2000; // Maximum points to display for performance
    const step = Math.ceil((endSample - startSample) / maxPoints);

    const visibleTime = [];
    const visibleSamples = [];

    for (let i = startSample; i < endSample; i += step) {
      visibleTime.push(this.time[i]);
      visibleSamples.push(this.samples[i]);
    }

    return { visibleTime, visibleSamples };
  }

  render() {
    if (!this.samples || !this.samples.length) return;

    const { visibleTime, visibleSamples } = this.getVisibleData();
    const currentTime = this.currentTime;

    // Create traces for played and unplayed portions
    const playedTrace = {
      x: [],
      y: [],
      type: "scatter",
      mode: "lines",
      line: {
        color: "#1FD5F9",
        width: 2,
      },
      name: "Played",
      showlegend: false,
    };

    const unplayedTrace = {
      x: [],
      y: [],
      type: "scatter",
      mode: "lines",
      line: {
        color: this.color,
        width: 2,
      },
      name: "Unplayed",
      showlegend: false,
    };

    // Split data into played and unplayed portions
    let isPlayingSection = true;
    for (let i = 0; i < visibleTime.length; i++) {
      if (visibleTime[i] <= currentTime) {
        playedTrace.x.push(visibleTime[i]);
        playedTrace.y.push(visibleSamples[i]);
      } else {
        unplayedTrace.x.push(visibleTime[i]);
        unplayedTrace.y.push(visibleSamples[i]);
      }
    }

    this.plotData = [playedTrace, unplayedTrace];

    // Add progress line
    if (
      currentTime >= visibleTime[0] &&
      currentTime <= visibleTime[visibleTime.length - 1]
    ) {
      const progressTrace = {
        x: [currentTime, currentTime],
        y: [Math.min(...visibleSamples), Math.max(...visibleSamples)],
        type: "scatter",
        mode: "lines",
        line: {
          color: "#1FD5F9",
          width: 2,
          dash: "dash",
        },
        name: "Progress",
        showlegend: false,
      };
      this.plotData.push(progressTrace);
    }

    this.plotLayout = {
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
      margin: { l: 30, r: 10, t: 0, b: 20 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      hovermode: false,
      dragmode: "pan",
    };

    this.plotConfig = {
      displayModeBar: false,
      staticPlot: false,
      responsive: true,
      scrollZoom: true, 
    };

    // Render plot
    Plotly.react(
      this.plotContainer,
      this.plotData,
      this.plotLayout,
      this.plotConfig
    );

    this.updateDuration();
  }
}
