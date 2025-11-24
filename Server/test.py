import torch
from demucs import pretrained
from demucs.apply import apply_model
import soundfile as sf
import numpy as np

def separate_and_apply_gain():
    YOUR_FILE = "./khalaf.wav"
    print(f"🔊 Processing: {YOUR_FILE}")
    
    # Load model
    model = pretrained.get_model('htdemucs_6s')
    model.eval()
    
    # Load audio
    audio, sr = sf.read(YOUR_FILE)
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=1)
    
    audio = audio.astype(np.float32)
    audio = audio / np.max(np.abs(audio))
    audio_tensor = torch.from_numpy(audio.T).float()
    
    # Separate
    with torch.no_grad():
        sources = apply_model(model, audio_tensor.unsqueeze(0), device='cpu')[0]
    
    # Define stems
    stems = ['drums', 'vocals', 'violin', 'bass_guiter']
    stem_indices = [0, 2, 3, 5]  # adjust indices according to your model output
    
    # Hard-coded gains (0 = silence, 1 = original, 2 = double volume)
    gains = {
        'drums': 0,
        'vocals': 0,
        'violin': 0,
        'bass_guiter': 1
    }
    
    final_mix = np.zeros_like(audio)  # to accumulate gain-adjusted stems
    
    for idx, name in zip(stem_indices, stems):
        # Convert to mono
        mono_audio = sources[idx].mean(dim=0).numpy()
        
        # Compute and print dominant frequency BEFORE gain
        N = len(mono_audio)
        fft_vals = np.fft.fft(mono_audio)
        fft_freqs = np.fft.fftfreq(N, 1/sr)
        positive_freqs = fft_freqs[:N//2]
        positive_magnitude = np.abs(fft_vals[:N//2])
        peak_idx = np.argmax(positive_magnitude)
        peak_freq = positive_freqs[peak_idx]
        print(f"🎵 Dominant frequency for {name} (before gain): {peak_freq:.2f} Hz")
        
        # Save the raw stem
        sf.write(f"{name}.wav", mono_audio, sr)
        print(f"✅ Saved {name}.wav")
        
        # Apply gain
        gained_audio = mono_audio * gains[name]
        
        # Prevent clipping in final mix
        final_mix[:, 0] += gained_audio  # left channel
        final_mix[:, 1] += gained_audio  # right channel
    
    # Normalize final mix to prevent clipping
    final_mix = final_mix / np.max(np.abs(final_mix))
    
    # Save final mixed audio
    sf.write("final_mix.wav", final_mix, sr)
    print("🎉 Final mixed audio saved as final_mix.wav with gains applied!")

# Run
separate_and_apply_gain()
