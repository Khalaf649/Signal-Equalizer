export async function calcSpectrogram(signal, fs) {
  try {
    if (!fs || !signal) {
      return { x: [], y: [], z: [] };
    }
    const response = await fetch("http://localhost:8080/spectrogram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        samples: Array.from(signal),
        fs: fs,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();

    // Should contain: x = time, y = frequency, z = magnitudes [freq][time]
    return {
      x: data.x || [],
      y: data.y || [],
      z: data.z || [],
    };
  } catch (err) {
    console.error("Error calculating spectrogram:", err);
    return { x: [], y: [], z: [] };
  }
}
