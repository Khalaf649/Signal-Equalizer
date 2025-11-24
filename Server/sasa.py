import soundfile as sf

def extract_first_10_seconds(input_file, output_file="first_10_seconds.wav"):
    # Read audio
    audio, sr = sf.read(input_file)

    # Duration to extract (in seconds)
    duration = 10  
    num_samples = duration * sr

    # Slice safely → in case audio is < 10 sec
    audio_slice = audio[:num_samples]

    # Save
    sf.write(output_file, audio_slice, sr)
    print(f"Saved: {output_file} (first {duration} seconds)")

# Example usage:
extract_first_10_seconds("mixed_audio.wav")