export async function separateAudio(samples, fs) {
  try {
    const response = await fetch("http://localhost:8000/separate_audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        samples: Array.from(samples), // convert Float32Array to regular array if needed
        fs: fs,
      }),
    });
    console.log(response);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("Received separation result:", result);
    // result is an array of objects: [{ stem: 'vocals', dominantFrequency: 440 }, ...]
    return result;
  } catch (err) {
    console.error("Error calling /separate_audio:", err);
    throw err;
  }
}
