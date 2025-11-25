import { appState } from "../appState.js";
export async function ApplyAi(samples, sampleRate, sliders) {
  try {
    // TODO: Replace with actual AI API endpoint
    // For now, this is a placeholder that will be implemented later
    const url = appState.mode === "musical" ? "MusicAi" : "HumanAi";

    const payload = {
      samples: Array.from(samples),
      sampleRate: sampleRate,
      sliders: sliders,
    };
    console.log("Sending payload to AI API:", payload);

    // Placeholder API call
    const response = await fetch(`http://localhost:8000/${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI API Error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("AI API response:", data);

    return {
      samples: new Float32Array(data.samples || []),
      frequencies: data.frequencies || [],
      magnitudes: data.magnitudes || [],
    };
  } catch (err) {
    console.error("Failed to call AI API:", err);
    throw new Error("Failed to process audio with AI: " + err.message);
  }
}
