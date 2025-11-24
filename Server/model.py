# server/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from pydantic import BaseModel
import numpy as np
from scipy.io.wavfile import write
import os
import requests  # <-- make sure to import this
import httpx
from demucs import pretrained
from demucs.apply import apply_model
import torch

app = FastAPI()

# Allow CORS so client can fetch
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class EQRequest(BaseModel):
    samples: list[float]
    sampleRate: int
    mode: str

class FFTRequest(BaseModel):
    samples: list[float]
    fs: float





def calculate_fft(request: FFTRequest):
    try:
        CXX_FFT_URL = "http://localhost:8080/calculatefft"  # Your C++ server URL
        # Forward request to the C++ endpoint using requests
        response = requests.post(
            CXX_FFT_URL,
            json={"samples": request.samples, "fs": request.fs},
            timeout=10
        )
        
        # Raise exception if C++ server returned error
        response.raise_for_status()
        
        return response.json()  # Return C++ response directly

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"C++ server error: {str(e)}")

@app.post("/saveEQ")
def save_eq(req: EQRequest):
    
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

class AudioRequest(BaseModel):
    samples: list[float]  # Mono audio
    fs: float              # Sampling rate

model = pretrained.get_model('htdemucs_6s')
model.eval()

# Define stems and their indices in the Demucs output
stems = ['drums', 'vocals', 'violin', 'bass_guiter']
stem_indices = [0, 2, 3, 5]

# URL of your C++ FFT server
FFT_SERVER_URL = "http://localhost:8080/calculatefft"  # replace with your server URL
@app.post("/separate_audio")
async def separate_audio(audio: AudioRequest):
    try:
        samples = np.array(audio.samples, dtype=np.float32)
        sr = audio.fs
        
        if samples.ndim == 1:
            samples = np.stack([samples, samples], axis=1)
        
        samples = samples / np.max(np.abs(samples))
        audio_tensor = torch.from_numpy(samples.T).float()
        
        # Separate stems
        with torch.no_grad():
            sources = apply_model(model, audio_tensor.unsqueeze(0), device='cpu')[0]
        
        result = {}
        
        async with httpx.AsyncClient() as client:
            for idx, name in zip(stem_indices, stems):
                mono_audio = sources[idx].mean(dim=0).numpy()
                
                fft_payload = {"samples": mono_audio.tolist(), "fs": sr}
                response = await client.post(FFT_SERVER_URL, json=fft_payload)
                
                if response.status_code == 200:
                    fft_data = response.json()
                    frequencies = np.array(fft_data.get("frequencies", []))
                    magnitudes = np.array(fft_data.get("magnitudes", []))
                    peak_freq = float(frequencies[np.argmax(magnitudes)]) if len(frequencies) > 0 else None
                else:
                    peak_freq = None
                
                result[name] = peak_freq
        
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))