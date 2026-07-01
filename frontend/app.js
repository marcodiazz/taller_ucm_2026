const audioFileInput = document.querySelector("#audioFile");
const dropZone = document.querySelector("#dropZone");
const audioSelection = document.querySelector("#audioSelection");
const audioName = document.querySelector("#audioName");
const audioMeta = document.querySelector("#audioMeta");
const audioPreview = document.querySelector("#audioPreview");
const removeAudioButton = document.querySelector("#removeAudioButton");
const analyzeButton = document.querySelector("#analyzeButton");
const recordButton = document.querySelector("#recordButton");
const stopButton = document.querySelector("#stopButton");
const resultsSection = document.querySelector("#resultsSection");
const detectionsContainer = document.querySelector("#detections");
const resultCount = document.querySelector("#resultCount");
const statusElement = document.querySelector("#status");
const topKInput = document.querySelector("#topK");
const minConfidenceInput = document.querySelector("#minConfidence");
const drawer = document.querySelector("#speciesDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const closeDrawerButton = document.querySelector("#closeDrawerButton");
const speciesCardContainer = document.querySelector("#speciesCard");

const birdImageCache = new Map();
let selectedAudioBlob = null;
let selectedAudioName = "";
let audioObjectUrl = null;
let mediaRecorder = null;
let recordedChunks = [];
let lastFocusedElement = null;

audioFileInput.addEventListener("change", () => {
  const file = audioFileInput.files[0];
  if (file) prepareAudio(file, file.name);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) prepareAudio(file, file.name);
});

removeAudioButton.addEventListener("click", clearAudio);

recordButton.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      setBusy(true, "Preparando la grabación…");
      try {
        const recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        const wavBlob = await convertToWav(recordedBlob);
        selectAudio(wavBlob, `grabacion-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.wav`);
        setStatus("Grabación lista para analizar.");
      } catch (error) {
        setStatus(`No se pudo preparar la grabación: ${error.message}`, true);
      } finally {
        setBusy(false);
        stream.getTracks().forEach((track) => track.stop());
      }
    });

    mediaRecorder.start();
    recordButton.hidden = true;
    stopButton.hidden = false;
    stopButton.disabled = false;
    analyzeButton.disabled = true;
    setStatus("Grabando… Pulsa detener cuando hayas terminado.");
  } catch (error) {
    setStatus(`No se pudo acceder al micrófono: ${error.message}`, true);
  }
});

stopButton.addEventListener("click", () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  stopButton.disabled = true;
  stopButton.hidden = true;
  recordButton.hidden = false;
});

analyzeButton.addEventListener("click", analyzeAudio);
closeDrawerButton.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
});

async function prepareAudio(file, filename) {
  const supportedExtensions = ["wav", "mp3", "flac", "ogg", "opus"];
  const extension = filename.split(".").pop().toLowerCase();

  if (supportedExtensions.includes(extension)) {
    selectAudio(file, filename);
    setStatus("Audio listo para analizar.");
    return;
  }

  setBusy(true, "Convirtiendo el audio a WAV…");
  try {
    const wavBlob = await convertToWav(file);
    selectAudio(wavBlob, `${filename.replace(/\.[^.]+$/, "")}.wav`);
    setStatus("Audio convertido y listo para analizar.");
  } catch (error) {
    clearAudio();
    setStatus(`Formato de audio no compatible: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

function selectAudio(blob, filename) {
  selectedAudioBlob = blob;
  selectedAudioName = filename;
  audioName.textContent = filename;
  audioMeta.textContent = `${formatBytes(blob.size)} · Audio listo`;
  audioSelection.hidden = false;
  analyzeButton.disabled = false;

  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = URL.createObjectURL(blob);
  audioPreview.src = audioObjectUrl;
}

function clearAudio() {
  selectedAudioBlob = null;
  selectedAudioName = "";
  audioFileInput.value = "";
  audioSelection.hidden = true;
  analyzeButton.disabled = true;
  audioPreview.removeAttribute("src");
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = null;
  setStatus("");
}

async function analyzeAudio() {
  if (!selectedAudioBlob) return;

  setBusy(true, "BirdNET está escuchando el audio…");
  showAnalysisSkeletons();

  const formData = new FormData();
  formData.append("file", selectedAudioBlob, selectedAudioName || "recording.wav");
  formData.append("top_k", topKInput.value);
  formData.append("min_confidence", minConfidenceInput.value);

  try {
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Error analizando el audio.");
    }

    const data = await response.json();
    renderDetections(data.detections);
    setStatus(data.detections.length ? "Análisis completado." : "No se encontraron coincidencias.");
  } catch (error) {
    renderAnalysisError(error.message);
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

function showAnalysisSkeletons() {
  resultsSection.hidden = false;
  resultCount.textContent = "Analizando";
  detectionsContainer.innerHTML = Array.from({ length: 3 }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-image"></div>
      <div class="skeleton-copy">
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
      </div>
      <div class="skeleton-button"></div>
    </div>
  `).join("");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDetections(detections) {
  resultCount.textContent = `${detections.length} ${detections.length === 1 ? "resultado" : "resultados"}`;
  detectionsContainer.innerHTML = "";

  if (detections.length === 0) {
    detectionsContainer.innerHTML = `
      <div class="empty-results">
        <strong>No hemos encontrado ninguna especie</strong>
        Prueba con un fragmento más limpio o reduce la confianza mínima.
      </div>`;
    return;
  }

  detections.forEach((detection, index) => {
    const item = document.createElement("article");
    item.className = "detection";
    item.innerHTML = `
      <div class="bird-image" data-image-for="${escapeHtml(detection.scientific_name)}">
        ${birdPlaceholder()}
      </div>
      <div class="detection-main">
        <div class="detection-title-row">
          <span class="rank">${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(detection.common_name)}</h3>
        </div>
        <p class="scientific-name">${escapeHtml(detection.scientific_name)}</p>
        <div class="detection-meta">
          <span class="confidence">${sparklesIcon()} ${(detection.score * 100).toFixed(1)}% de confianza</span>
          <span>${clockIcon()} ${formatSegment(detection.start_time, detection.end_time)}</span>
        </div>
      </div>
      <button class="button generate-button" type="button">${arrowIcon()} Ver ficha</button>
    `;

    item.querySelector(".generate-button").addEventListener("click", () => generateSpeciesCard(detection));
    detectionsContainer.append(item);
    loadBirdImage(item.querySelector(".bird-image"), detection.scientific_name);
  });
}

async function loadBirdImage(container, scientificName) {
  const imageData = await getBirdImage(scientificName);
  if (!imageData?.src) return;

  const image = document.createElement("img");
  image.src = imageData.src;
  image.alt = scientificName;
  image.loading = "lazy";
  image.addEventListener("error", () => image.remove());
  container.replaceChildren(image);
}

async function getBirdImage(scientificName) {
  if (birdImageCache.has(scientificName)) return birdImageCache.get(scientificName);

  for (const language of ["es", "en"]) {
    try {
      const parameters = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        redirects: "1",
        prop: "pageimages|info",
        inprop: "url",
        piprop: "thumbnail",
        pithumbsize: "900",
        titles: scientificName,
      });
      const endpoint = `https://${language}.wikipedia.org/w/api.php?${parameters}`;
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const pages = (await response.json()).query?.pages;
      const page = pages ? Object.values(pages)[0] : null;
      if (!page?.thumbnail?.source) continue;

      const result = {
        src: page.thumbnail.source,
        pageUrl: page.fullurl,
      };
      birdImageCache.set(scientificName, result);
      return result;
    } catch (_) {
      // La imagen es una mejora opcional: el resultado de BirdNET sigue visible.
    }
  }

  birdImageCache.set(scientificName, null);
  return null;
}

async function generateSpeciesCard(detection) {
  openDrawer();
  showDrawerSkeleton();
  setStatus("Generando la ficha con IA…");

  try {
    const [response, imageData] = await Promise.all([
      fetch("/api/species-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detection),
      }),
      getBirdImage(detection.scientific_name),
    ]);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Error generando la ficha.");
    }

    renderSpeciesCard(await response.json(), imageData);
    setStatus("Ficha generada.");
  } catch (error) {
    speciesCardContainer.innerHTML = `<div class="empty-results"><strong>No se pudo generar la ficha</strong>${escapeHtml(error.message)}</div>`;
    setStatus(error.message, true);
  }
}

function renderSpeciesCard(card, imageData) {
  const imageMarkup = imageData?.src
    ? `<div class="drawer-hero-image"><img src="${escapeHtml(imageData.src)}" alt="${escapeHtml(card.common_name)}" /></div>
       <a class="image-credit" href="${escapeHtml(imageData.pageUrl)}" target="_blank" rel="noopener noreferrer">Imagen de Wikipedia / Wikimedia Commons ↗</a>`
    : `<div class="drawer-hero-image">${birdPlaceholder()}</div>`;

  speciesCardContainer.innerHTML = `
    ${imageMarkup}
    <h2 id="drawerTitle">${escapeHtml(card.common_name)}</h2>
    <p class="species-latin">${escapeHtml(card.scientific_name)}</p>
    <p class="confidence-note">${escapeHtml(card.confidence_note)}</p>
    ${infoBlock(infoIcon(), "Descripción", card.description)}
    ${infoBlock(leafIcon(), "Hábitat", card.habitat)}
    ${infoBlock(mapIcon(), "Distribución", card.distribution)}
    <section class="info-block">
      <h3>${sparklesIcon()} Curiosidades</h3>
      <ul>${card.interesting_facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
    </section>
  `;
}

function showDrawerSkeleton() {
  speciesCardContainer.innerHTML = `
    <div class="drawer-loading" aria-label="Generando ficha">
      <div class="skeleton-image"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line medium"></div>
    </div>`;
}

function openDrawer() {
  lastFocusedElement = document.activeElement;
  drawerBackdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
  requestAnimationFrame(() => {
    drawerBackdrop.classList.add("visible");
    drawer.classList.add("open");
    closeDrawerButton.focus();
  });
}

function closeDrawer() {
  drawerBackdrop.classList.remove("visible");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
  window.setTimeout(() => {
    drawerBackdrop.hidden = true;
    lastFocusedElement?.focus();
  }, 300);
}

async function convertToWav(blob) {
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    return new Blob([encodeWav(mixToMono(audioBuffer), audioBuffer.sampleRate)], { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

function mixToMono(audioBuffer) {
  const mono = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const samples = audioBuffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) {
      mono[index] += samples[index] / audioBuffer.numberOfChannels;
    }
  }
  return mono;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function writeText(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

function setBusy(isBusy, message = "") {
  analyzeButton.disabled = isBusy || !selectedAudioBlob;
  audioFileInput.disabled = isBusy;
  recordButton.disabled = isBusy;
  if (message) setStatus(message);
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatSegment(start, end) {
  const format = (value) => value == null ? "?" : `${Number.parseFloat(value).toFixed(1)} s`;
  return `${format(start)} – ${format(end)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function renderAnalysisError(message) {
  resultCount.textContent = "Error";
  detectionsContainer.innerHTML = `<div class="empty-results"><strong>No se pudo analizar el audio</strong>${escapeHtml(message)}</div>`;
}

function infoBlock(icon, title, content) {
  return `<section class="info-block"><h3>${icon} ${title}</h3><p>${escapeHtml(content)}</p></section>`;
}

function birdPlaceholder() {
  return `<div class="bird-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 15c4.5 1 6-2 7-5 2 3 5 4 9 3-1 5-5 7-9 6-2.5-.6-4.5-2-7-4Zm7-5c0-2 1-4 3-5 .5 2 0 4-1 5" /></svg></div>`;
}

function sparklesIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Zm6 11 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" /></svg>`; }
function clockIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/></svg>`; }
function infoIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>`; }
function leafIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 9-6 9-15Z"/><path d="M5 20c2-5 5-8 10-11"/></svg>`; }
function mapIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2V6Zm5-2v14m8-12v14"/></svg>`; }
function arrowIcon() { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>`; }
