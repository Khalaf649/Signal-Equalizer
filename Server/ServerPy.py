# server/main.py
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from scipy.io.wavfile import write
import os
import sys
import requests  # <-- make sure to import this
import httpx
from demucs import pretrained
from demucs.apply import apply_model
from datetime import datetime
import torch
import torchaudio
from typing import List
import io
import json

app = FastAPI()

# Allow CORS so client can fetch
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class EQRequestSave(BaseModel):
    samples: list[float]
    sampleRate: int
    mode: str

# ---------- Request Models ----------
class FFTRequest(BaseModel):
    samples: List[float]
    fs: float


class EQSlider(BaseModel):
    low: float
    high: float
    value: float


class EQRequest(BaseModel):
    samples: List[float]
    fs: float
    sliders: List[EQSlider]


class SpectrogramRequest(BaseModel):
    samples: List[float]
    fs: float

class GainItem(BaseModel):
    name: str
    value: float

class AudioRequest(BaseModel):
    samples: List[float]
    sampleRate: int
    sliders: List[GainItem]


# ---------- Utils ----------
def next_power_of_2(n):
    return 1 << (n - 1).bit_length()


# ===============================================================
#   1️⃣ /calculatefft
# ===============================================================
@app.post("/calculatefft")
def calculate_fft(req: FFTRequest):

    samples = np.array(req.samples, dtype=float)
    fs = req.fs

    n_original = len(samples)
    n = next_power_of_2(n_original)

    # Zero-pad
    data = np.zeros(n, dtype=complex)
    data[:n_original] = samples

    # FFT
    fft_data = np.fft.fft(data)

    # Frequencies & magnitudes
    freqs = np.fft.fftfreq(n, d=1/fs)[: n//2 + 1]
    mags = np.abs(fft_data[: n//2 + 1])

    return {
        "frequencies": freqs.tolist(),
        "magnitudes": mags.tolist()
    }


# ===============================================================
#   2️⃣ /applyEqualizer
# ===============================================================
@app.post("/applyEqualizer")
def apply_equalizer(req: EQRequest):
    samples = np.array(req.samples, dtype=float)
    fs = req.fs

    n_original = len(samples)
    n = next_power_of_2(n_original)

    # Zero-pad
    data = np.zeros(n)
    data[:n_original] = samples

    # FFT
    fft_data = np.fft.fft(data)

    # Frequency array
    freqs = np.fft.fftfreq(n, 1/fs)

    # Apply gain to selected bands
    for band in req.sliders:
        # Positive frequency mask
        mask = (freqs >= band.low) & (freqs <= band.high)
        fft_data[mask] *= band.value

        # Negative frequency mask (mirrored)
        neg_mask = (freqs <= -band.low) & (freqs >= -band.high)
        fft_data[neg_mask] *= band.value

    # BEFORE inverse FFT → for visualization
    vis_freqs = freqs[: n//2 + 1]
    vis_mags = np.abs(fft_data[: n//2 + 1])

    # Inverse FFT → time domain
    output = np.fft.ifft(fft_data).real[:n_original]

    return {
        "samples": output.tolist(),
        "frequencies": vis_freqs.tolist(),
        "magnitudes": vis_mags.tolist()
    }


# ===============================================================
#   3️⃣ /spectrogram
# ===============================================================
@app.post("/spectrogram")
def spectrogram(req: SpectrogramRequest):

    samples = np.array(req.samples)
    fs = req.fs

    window_size = 2048
    hop_size = window_size // 4

    nfft = window_size
    num_freq_bins = nfft // 2 + 1

    # Window function
    window = np.hanning(window_size)

    frames = []
    pos = 0

    # Sliding window
    while pos + window_size <= len(samples):
        frame = samples[pos : pos + window_size] * window
        fft_vals = np.fft.rfft(frame)
        frames.append(np.abs(fft_vals))
        pos += hop_size

    magnitude_frames = np.array(frames)  # shape: [time][omega]

    # Axes
    num_frames = magnitude_frames.shape[0]

    x = np.arange(num_frames) * hop_size / fs                # time
    y = np.arange(num_freq_bins) * fs / nfft                # freq
    z = magnitude_frames.T                                  # freq × time

    return {
        "x": x.tolist(),
        "y": y.tolist(),
        "z": z.tolist()
    }




@app.post("/saveEQ")
def save_eq(req: EQRequestSave):
    
    try:
        samples = np.array(req.samples, dtype=np.float32)
        sample_rate = req.sampleRate
        mode = req.mode

        # Scale to int16 for WAV
        samples_int16 = np.int16(np.clip(samples, -1, 1) * 32767)

        # Prepare output path
        public_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "client", "public"))
        os.makedirs(public_dir, exist_ok=True)
        output_filename = f"{mode}_output.wav"
        output_path = os.path.join(public_dir, output_filename)

        # Save WAV
        write(output_path, sample_rate, samples_int16)

        # Return relative path from project root
        relative_path = os.path.join("public", output_filename).replace("\\", "/")
        return {"url": relative_path}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def rms(x):
    return np.sqrt(np.mean(x**2))

# --------------------
# Load Demucs model globally
# --------------------
model_music = pretrained.get_model('htdemucs_6s')
model_music.eval()


@app.post("/MusicAi")
async def process_audio(file: UploadFile = File(...), sliders: str = Form(...)):
    # Parse sliders (expected JSON string)
    try:
        slider_items = json.loads(sliders)
    except Exception:
        slider_items = []

    # Read uploaded audio file
    data_bytes = await file.read()
    try:
        import soundfile as sf
        audio_np, fs = sf.read(io.BytesIO(data_bytes), dtype='float32')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    samples = np.array(audio_np, dtype=np.float32)
    # Ensure 2D audio
    if samples.ndim == 1:
        samples = np.stack([samples, samples], axis=1)

    # Normalize
    denom = np.max(np.abs(samples)) if np.max(np.abs(samples)) > 0 else 1.0
    samples = samples / denom
    audio_tensor = torch.from_numpy(samples.T).float()

    # Separate
    with torch.no_grad():
        sources = apply_model(model_music, audio_tensor.unsqueeze(0), device='cpu')[0]

    # Map slidername to stem index (adjust based on Demucs output)
    stem_names = ['drums', 'vocals', 'violin', 'bass_guitar']
    stem_indices = [0, 2, 3, 5]
    stem_map = dict(zip(stem_names, stem_indices))

    # Apply gains
    final_mix = np.zeros_like(samples)
    for gain_item in slider_items:
        name = gain_item.get('name') if isinstance(gain_item, dict) else getattr(gain_item, 'name', None)
        gain_val = gain_item.get('value') if isinstance(gain_item, dict) else getattr(gain_item, 'value', 1.0)
        if name in stem_map:
            idx = stem_map[name]
            mono_audio = sources[idx].mean(dim=0).numpy()
            gained_audio = mono_audio * gain_val
            final_mix[:, 0] += gained_audio
            final_mix[:, 1] += gained_audio

    # Normalize final mix
    max_val = np.max(np.abs(final_mix))
    if max_val > 0:
        final_mix = final_mix / max_val

    # Compute FFT
    N = final_mix.shape[0]
    fft_vals = np.fft.fft(final_mix[:, 0])  # left channel
    fft_freqs = np.fft.fftfreq(N, 1 / fs)
    positive_freqs = fft_freqs[: N // 2].tolist()
    magnitudes = np.abs(fft_vals[: N // 2]).tolist()

    return {
        "samples": final_mix[:, 0].tolist(),  # left channel
        "sampleRate": int(fs),
        "frequencies": positive_freqs,
        "magnitudes": magnitudes,
    }







import soundfile as sf


@app.post("/HumanAi")
async def HumanAi(file: UploadFile = File(...), sliders: str = Form(...)):
    SAMPLE_URL = "https://josephzhu.com/Multi-Decoder-DPRNN/examples/2_mixture.wav"
    MODEL_DEF_URL = "https://raw.githubusercontent.com/asteroid-team/asteroid/master/egs/wsj0-mix-var/Multi-Decoder-DPRNN/model.py"

    from model import MultiDecoderDPRNN

    import pytorch_lightning.callbacks.model_checkpoint
    import pytorch_lightning.callbacks.early_stopping
    torch.serialization.add_safe_globals([
    pytorch_lightning.callbacks.model_checkpoint.ModelCheckpoint,
    pytorch_lightning.callbacks.early_stopping.EarlyStopping
])
    print("Loading pre-trained model from Hugging Face...")
    model_human = MultiDecoderDPRNN.from_pretrained("JunzheJosephZhu/MultiDecoderDPRNN")
    model_human.eval()
    
    # Use GPU if available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model_human.to(device)
    print(f"Model loaded on {device}")

    # Read uploaded file
    data_bytes = await file.read()
    try:
        audio_np, fs = sf.read(io.BytesIO(data_bytes), dtype='float32')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    # Convert to torch tensor with shape (channels, time)
    if audio_np.ndim == 1:
        mixture = torch.tensor(audio_np).unsqueeze(0)
    else:
        mixture = torch.tensor(audio_np.T)
    mixture = mixture.to(device)

    # ✅ 2. SEPARATE SOURCES (same as original script)
    with torch.no_grad():
        # separate() returns the estimated sources tensor
        est_sources = model_human.separate(mixture)

    est_sources = est_sources.cpu()

    if est_sources.ndim == 3 and est_sources.shape[0] == 1:
        est_sources = est_sources.squeeze(0)

    for i in range(est_sources.shape[0]):
        output_filename = rf"output_source_{i+1}.wav"
        # torchaudio.save expects (channels, time). Unsqueeze if needed.
        source = est_sources[i].unsqueeze(0)
        
        torchaudio.save(output_filename, source, fs)
        print(f"Saved: {output_filename}")

    # ✅ 4. APPLY SLIDER GAINS
    final_mix = torch.zeros(est_sources.shape[1], dtype=est_sources.dtype)

    try:
        slider_items = json.loads(sliders)
    except Exception:
        slider_items = []

    for i, slider in enumerate(slider_items):
        if i < est_sources.shape[0]:
            val = slider.get('value') if isinstance(slider, dict) else getattr(slider, 'value', 1.0)
            final_mix += est_sources[i] * val

    # ✅ 5. FFT (positive frequencies only)
    n = final_mix.shape[0]
    fft_data = torch.fft.fft(final_mix)
    magnitudes = torch.abs(fft_data)[: n // 2].numpy()
    frequencies = np.fft.fftfreq(n, d=1 / fs)[: n // 2]

    samples_out = final_mix.numpy().tolist()

    return {
        "samples": samples_out,
        "frequencies": frequencies.tolist(),
        "magnitudes": magnitudes.tolist(),
        "sampleRate": int(fs)
    }