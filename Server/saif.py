import torch
import soundfile as sf
import numpy as np
from asteroid.models import DPRNNTasNet

INPUT = "4_mixture.wav"

# Load audio
audio, sr = sf.read(INPUT)

# Ensure mono
if audio.ndim > 1:
    audio = np.mean(audio, axis=1)

audio = torch.tensor(audio, dtype=torch.float32).unsqueeze(0).unsqueeze(0)

print("Loading model...")
model = DPRNNTasNet.from_pretrained("JorisCos/DPRNN_WSJ0_4mix")
model.eval()

print("Separating...")
with torch.no_grad():
    est_sources = model(audio)

print("Saving outputs...")
for i in range(est_sources.shape[1]):
    sf.write(f"speaker_{i+1}.wav",
             est_sources[0, i].cpu().numpy(),
             sr)
    print(f"✅ speaker_{i+1}.wav saved")

print("🎉 DONE — 4 speakers separated!")
