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

    // Canvas setup
    this.canvas = this.container.querySelector(".signal-viewer-canvas");
    if (!this.canvas)
      throw new Error("Canvas element not found inside container");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = 800;
    this.canvas.height = 200;

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
      this.offset = parseFloat(e.target.value); // 0 to 1 (full navigation)
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
    this.zoom = Math.min(this.zoom * 1.5, 2000);
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

  render() {
    if (!this.samples || !this.samples.length) return;
    const ctx = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const midY = h / 2;
    const samplesPerPixel = Math.max(
      1,
      Math.floor(this.samples.length / (w * this.zoom))
    );
    const startSample = Math.floor(this.offset * this.samples.length);
    const currentSample = Math.floor(this.currentTime * this.sampleRate);
    const currentPixel = Math.floor(
      (currentSample - startSample) / samplesPerPixel
    );

    const drawSignal = (color, startX, endX) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let x = startX; x < endX && x < w; x++) {
        const sampleIdx = startSample + x * samplesPerPixel;
        if (sampleIdx >= this.samples.length) break;

        let min = Infinity,
          max = -Infinity;
        for (
          let i = 0;
          i < samplesPerPixel && sampleIdx + i < this.samples.length;
          i++
        ) {
          const val = this.samples[sampleIdx + i];
          min = Math.min(min, val);
          max = Math.max(max, val);
        }

        const yMin = midY - min * midY * 0.9;
        const yMax = midY - max * midY * 0.9;

        if (x === startX) ctx.moveTo(x, yMax);
        else {
          ctx.lineTo(x, yMin);
          ctx.lineTo(x, yMax);
        }
      }
      ctx.stroke();
    };

    // --- Draw played portion behind progress ---
    if (currentPixel > 0) drawSignal("#1FD5F9", 0, currentPixel);

    // --- Draw unplayed portion ---
    if (currentPixel < w) drawSignal(this.color, currentPixel, w);

    // Center line
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Progress indicator (optional thin line)
    if (currentPixel >= 0 && currentPixel < w) {
      ctx.strokeStyle = "#1FD5F9"; // you can make it darker or same as bg
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(currentPixel, 0);
      ctx.lineTo(currentPixel, h);
      ctx.stroke();
    }

    this.updateDuration();
  }
}
