import os
import sys
import requests
import torch
import torchaudio
from typing import List

# --- Configuration ---
# You can change this to a path on your computer (e.g., "C:/Users/Music/my_mix.wav")
AUDIO_PATH = r"4_mixture.wav"
# URL for the sample audio if you don't have one
SAMPLE_URL = "https://josephzhu.com/Multi-Decoder-DPRNN/examples/2_mixture.wav"
# Official location of the model class definition
MODEL_DEF_URL = "https://raw.githubusercontent.com/asteroid-team/asteroid/master/egs/wsj0-mix-var/Multi-Decoder-DPRNN/model.py"

def ensure_model_file_exists():
    """
    The MultiDecoderDPRNN class is not part of the pip package.
    It exists in a specific recipe file in the Asteroid GitHub repo.
    This function downloads it locally so we can import it.
    """
    if not os.path.exists("model.py"):
        print("model.py not found. Downloading from Asteroid repository...")
        try:
            response = requests.get(MODEL_DEF_URL)
            response.raise_for_status()
            with open("model.py", "w", encoding='utf-8') as f:
                f.write(response.text)
            print("Successfully downloaded model.py")
        except Exception as e:
            print(f"Error downloading model.py: {e}")
            print("Please manually download it from:", MODEL_DEF_URL)
            sys.exit(1)

# --- Main Execution ---
def main():
    # 1. Ensure the class definition file exists
    ensure_model_file_exists()

    # 2. Import the custom model class
    # We do this inside main or after the check to avoid ImportErrors
    try:
        from model import MultiDecoderDPRNN
    except ImportError as e:
        print(f"Error importing MultiDecoderDPRNN: {e}")
        print("Make sure 'model.py' is in the same directory as this script.")
        return

    # 3. Fix for PyTorch Lightning serialization issues (common in older checkpoints)
    import pytorch_lightning.callbacks.model_checkpoint
    import pytorch_lightning.callbacks.early_stopping
    torch.serialization.add_safe_globals([
        pytorch_lightning.callbacks.model_checkpoint.ModelCheckpoint,
        pytorch_lightning.callbacks.early_stopping.EarlyStopping
    ])

    # 4. Load the pre-trained model
    print("Loading pre-trained model from Hugging Face...")
    # This automatically downloads 'best-model.ckpt' from the hub
    model = MultiDecoderDPRNN.from_pretrained("JunzheJosephZhu/MultiDecoderDPRNN")
    model.eval()
    
    # Use GPU if available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    print(f"Model loaded on {device}")

    # 5. Prepare Input Audio
    if not os.path.exists(AUDIO_PATH):
        print(f"Audio file not found at {AUDIO_PATH}. Downloading sample...")
        try:
            response = requests.get(SAMPLE_URL)
            with open(AUDIO_PATH, "wb") as f:
                f.write(response.content)
        except Exception as e:
            print(f"Failed to download sample audio: {e}")
            return

    print(f"Processing file: {AUDIO_PATH}")
    mixture, fs = torchaudio.load(AUDIO_PATH)
    mixture = mixture.to(device)

    # 6. Perform Separation
    # The model expects input shape (batch, channels, time) or just (channels, time)
    # We ensure it's just (channels, time) or (time,) for single channel
    with torch.no_grad():
        # separate() returns the estimated sources tensor
        est_sources = model.separate(mixture)

    # Move back to CPU for saving
    est_sources = est_sources.cpu()

    # 7. Save Output
    print("Saving results...")
    # est_sources is typically shape (n_sources, time) or (batch, n_sources, time)
    # We iterate to save each speaker
    
    # Remove batch dim if present and 1
    if est_sources.ndim == 3 and est_sources.shape[0] == 1:
        est_sources = est_sources.squeeze(0)

    for i in range(est_sources.shape[0]):
        output_filename = rf"output_source_{i+1}.wav"
        # torchaudio.save expects (channels, time). Unsqueeze if needed.
        source = est_sources[i].unsqueeze(0)
        
        torchaudio.save(output_filename, source, fs)
        print(f"Saved: {output_filename}")

    print("Done!")

if __name__ == "__main__":
    main()