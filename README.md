# 🎵 HarmoniX — AI-Powered Interactive Audio Equalizer

![Logo placeholder](./assets/Logo.png)

HarmoniX is a modern, real-time signal equalizer that blends precision DSP controls with AI-assisted audio enhancement.
Visualize waveforms, FFTs, and spectrograms, tweak frequency bands with surgical detail, or let HarmoniX intelligently mix music, vocals, speech, or generic audio with one click.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#)
[![Demo](https://img.shields.io/badge/demo-video-orange.svg)](#)

## Demo

<video width="640" height="360" controls>
  <source src="./assets/demo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

---

## Screenshot Gallery

### 🎛️ Core Interface

These screenshots show the main HarmoniX workspace in action:

![Main Interface (Full Workspace)](./assets/Main%20UI.png)
![Equalizer + AI Panel](./assets/Equalizer%20Panel.jpeg)

---

### 📈 Signal Visualization

HarmoniX includes multiple real-time viewers for analysis and mixing:

- ![Waveform Viewer (Input/Output)](./assets/Time%20domain%20viewers.png)
- ![FFT Spectrum (Linear)](./assets/Linear%20frequency%20domain%20viewers.png)
- ![FFT Spectrum (Audiogram)](./assets/Logarthmic%20frequency%20domain%20viewers.png)
- ![Spectrogram Viewer (Live, Scroll)](./assets/Spectogram%20domain%20viewers.png)

---

### 🎚️ Modes & Controls

Screens demonstrating interaction and workflow:

- **Mode Selector (Music / Human / Generic / Animal)** — Users can choose between different EQ modes to match the input type.
- **AI Mix Enabled (Auto-EQ Applied)** — The AI automatically adjusts EQ settings for optimal sound.
- **Custom EQ Controls (Add / Remove Sliders)** — Users can customize the EQ by adding or removing sliders as needed.
  - **Add Sliders Window** — ![Add Sliders Window](./assets/Sliders%20CRUD.png)
- **Spectrogram Viewer (Live, Scroll)** — Displays the frequency content of the signal over time. Can be **shown or hidden** depending on user preference.
- **Project Export / Reset** — Users can export their current project or reset all settings to default.

---

---

## Quick Pitch — Meet HarmoniX

**HarmoniX** is an interactive, browser-based audio equalizer built for both **research** and **creative production**.  
It combines precise DSP visualizers with optional AI-powered enhancement modes—giving you a complete environment for understanding, shaping, and improving audio.

### It includes:

- **AI-Assisted Music & Voice Modes**  
  Send audio to a configurable backend and receive _processed audio_, _FFT graphs_, and _spectrograms_ tailored for vocals or music stems.

- **Per-Mode Input/Output Pipelines**  
  Maintain separate mixes or stems for instruments, speech, or generic audio—each mode has its own input/output signal flow.

- **Real-Time Signal Visualizers**  
  Waveform viewer, FFT spectrum, and spectrogram with a **linear vs audiogram (log-frequency/dB)** toggle for educational or professional analysis.

- **Lightweight Project Sharing**  
  A clean JSON project format to save EQ settings, AI parameters, stems, and presets for easy sharing or reproducibility.

---

## Use Cases

- **Music Producers & Sound Designers**  
  Quickly shape instruments, isolate vocals, rebalance mixes, or try AI-suggested EQ curves.

- **Speech & Audio Engineers**  
  Preprocess recordings for ASR, podcasts, voice-overs, and broadcast clarity.

- **Students & Researchers in DSP**  
  Visualize FFTs, explore frequency bands, interpret spectrograms, experiment with filters, and understand real-time DSP concepts.

---

**Table of contents**

- **Installation**
- **Quick Start**
- **Usage**
- **Project JSON Format**
- **AI endpoints**
- **Development & Contributing**
- **License & Contact**

---

**Installation**

Prerequisites

- Node.js (for the client frontend dev server)
- Python 3.10+ with a virtual environment for the backend
- Optional: CUDA / GPU drivers for faster AI inference

Install backend dependencies (from `Server` folder):

```powershell
cd "HarmoniX\Server"
python -m venv .venv
& .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Install client dependencies (if using dev server):

```powershell
cd "HarmoniX\Client"
npm install
```

**Run**

Start the backend (example using uvicorn):

```powershell
cd "HarmoniX\Server"
uvicorn ServerPy:app --reload --port 8000
```

Open the client by serving the `Client` folder (use any static server or open `index.html` in a browser). If you're using a Node dev server, run `python -m http.server 5500` from `Client`.

---

**Quick Start**

1. Open the app in your browser.
2. Load a project JSON or use `public/test.json` as an example project.
3. Select a mode (e.g., `musical` or `human_voices`).
4. Toggle the `AI` switch to enable AI sliders, then press `Apply` after adjusting sliders.
5. Download the project JSON or export the processed audio.

---

**Project JSON format (summary)**

Projects store modes and per-mode I/O. Key fields:

- `modes.<mode_name>.input_signal` — path to the input audio (e.g., `public/song.wav`)
- `modes.<mode_name>.output_signal` — path to the processed output
- `modes.<mode_name>.sliders` — manual slider bands
- `modes.<mode_name>.AI_sliders` — sliders used by AI mode

Example snippet (abbreviated):

```json
{
  "musical": {
    "input_signal": "public/song.wav",
    "output_signal": "public/song_output.wav",
    "sliders": [],
    "AI_sliders": [{ "name": "vocals", "low": 0, "high": 8000, "value": 1.2 }]
  }
}
```

---

**AI endpoints (backend)**

The project expects two AI endpoints on the server:

- `POST /MusicAi` — accepts `multipart/form-data` with fields `file` (audio) and `sliders` (JSON string). Returns `{ samples, frequencies, magnitudes }`.
- `POST /HumanAi` — same contract for human-voice models.

These endpoints are implemented in `Server/ServerPy.py` and currently use placeholder or research models (Demucs, MultiDecoderDPRNN). Feel free to replace the model with your preferred pipeline.

Additionally, the backend exposes DSP endpoints used by the client and tests. Aliases are provided so client code can call the name it expects:

- `POST /calculatefft` and alias `POST /CalcFFT` — compute FFT from `samples` + `fs`.
- `POST /spectrogram` and alias `POST /spectogram` — compute spectrogram frames.
- `POST /applyEqualizer` and alias `POST /ApplyEq` — apply band gains in frequency domain and return modified samples + FFT.
- `POST /saveEQ` and alias `POST /saveEq` — save processed samples to `client/public` and return a URL.

The AI endpoints and DSP endpoints are implemented in `Server/ServerPy.py`. The repo also includes a C++ server (`Server/Cppserver.cpp`) that implements the same DSP endpoints using a header-only HTTP library and an in-repo FFT implementation — useful for performance comparisons.

---

**Two-server comparison (Python vs C++)**

This project ships two server implementations for comparison:

- **Python (default)**: `Server/ServerPy.py` — FastAPI-based, uses `numpy`/`scipy` for FFTs and research AI models (Demucs, etc.). Run with `uvicorn ServerPy:app --reload --port 8000`.
- **C++ (native)**: `Server/Cppserver.cpp` — header-only HTTP server + recursive FFT implementation (in-source). Compile & run to serve on port 8080.

Quick C++ build instructions (minimal):

1. Install a C++17 compiler (g++/clang) and download the single-file headers for [`cpp-httplib`](https://github.com/yhirose/cpp-httplib) and [`nlohmann/json`](https://github.com/nlohmann/json).
2. Place `httplib.h` and `json.hpp` in the `Server/` folder (they are referenced by `Cppserver.cpp`).
3. Compile:

```powershell
cd "c:\SBME\Third Year\DSP\Signal-Equalizer\Server"
g++ -std=c++17 Cppserver.cpp -O2 -o server_cpp -lpthread
```

4. Run:

```powershell
.\server_cpp.exe
# or on Linux/macOS: ./server_cpp
```

The C++ server listens on port `8080` by default. The Python server listens on `8000` in our examples.

---

**Client: choosing which server to use**

The frontend exposes a simple switch via `appState.ServerMode` (in `Client/scripts/appState.js`) to choose which backend the client will target for DSP endpoints:

- `appState.ServerMode = 0` (default) → use Python FastAPI server (`port 8000`).
- `appState.ServerMode = 1` → use C++ native server (`port 8080`).

You can set this from the browser console for quick testing:

```javascript
// Use C++ server (if running)
window.appState.ServerMode = 1;

// Use Python server
window.appState.ServerMode = 0;
```

Client utilities will pick the appropriate base URL when making DSP calls (FFT, spectrogram, applyEQ, saveEQ) according to `appState.ServerMode`.

---

**Features (at a glance)**

- Real-time signal and FFT viewers (Plotly)
- Spectrogram visualization
- Audiogram (log-frequency / dB) toggle for FFT
- AI-assisted instrument/human mode that uploads audio and sliders to the server
- Per-mode project structure for easy presets and comparisons

---

**Development Notes**

- Frontend files live in `Client/` and are plain JavaScript modules (no heavy framework). Key files:

  - `Client/scripts/controllers/EqualizerPanel.js`
  - `Client/scripts/utils/ApplyAi.js` (multipart upload to AI endpoints)
  - `Client/scripts/utils/applyEQ.js` (local EQ math)

- Backend lives in `Server/ServerPy.py` (FastAPI) with AI model code and DSP helpers.

**Testing**

- Use `public/test.json` as an example project file.
- Manually test AI mode by ensuring the audio path is reachable from the browser (e.g., `public/*.wav`).

---

**Contributing**

Contributions are welcome! Suggested areas:

- Add more robust model selection (configurable model registry).
- Add streaming/more efficient uploads for large audio files.
- Add unit tests around core DSP utilities.

Please open issues or pull requests and include a clear description and minimal repro.

---

---

## Contact & Acknowledgements

- **Author:** Abdelrahman Reda
  - Email: **abdlrhman.mohamed02@eng-st.cu.edu.eg**
  - GitHub : [My GitHub](https://github.com/Khalaf649)
