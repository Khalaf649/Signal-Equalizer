// utils/calcFFT.js
export async function calcFFT(signal, fs) {
  try {
    const response = await fetch("http://localhost:8080/calculatefft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        samples: Array.from(signal), // Convert Float64Array → normal array
        fs: fs,
      }),
    });

    if (!response.ok) throw new Error("FFT API Request Failed");

    const { frequencies, magnitudes } = await response.json();
    return { frequencies, magnitudes };
  } catch (error) {
    console.error("FFT Error:", error);
    return null;
  }
}
