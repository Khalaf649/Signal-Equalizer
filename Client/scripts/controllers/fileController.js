import "../appState";
function handleJsonUpload(event) {
  const file = event.target.files[0];
  const statusEl = document.getElementById("fileStatus");
  const fileLabel = document.querySelector(".header-file-label");
  const fileNameDisplay = document.querySelector(".header-file-name");
  const uploaderCard = document.getElementById("uploaderCard");
  const mainApp = document.getElementById("mainApp");
  if (!file) {
    statusEl.textContent = "No file selected.";
    return;
  }

  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    statusEl.textContent = "❌ Please upload a valid JSON file.";
    statusEl.style.color = "var(--color-destructive)";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const jsonData = JSON.parse(e.target.result);
      statusEl.textContent = `✅ Loaded: ${file.name}`;
      fileLabel.textContent = "Loaded File:";
      fileNameDisplay.textContent = file.name;
      statusEl.style.color = "var(--color-accent)";
      window.currJson = jsonData;
      uploaderCard.style.display = "none";
      mainApp.style.display = "grid";
    } catch (err) {
      statusEl.textContent = "❌ Invalid JSON structure.";
      statusEl.style.color = "var(--color-destructive)";
      console.error("JSON Parse Error:", err);
    }
  };

  reader.readAsText(file);
}
