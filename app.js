const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const viewer = document.getElementById("viewer");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const voiceBtn = document.getElementById("voiceBtn");
const testVoiceBtn = document.getElementById("testVoiceBtn");
const cameraSelect = document.getElementById("cameraSelect");
const mirrorSelect = document.getElementById("mirrorSelect");
const languageSelect = document.getElementById("languageSelect");
const speedRange = document.getElementById("speedRange");
const confidenceRange = document.getElementById("confidenceRange");
const announceMode = document.getElementById("announceMode");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const snapshotBtn = document.getElementById("snapshotBtn");
const speedValue = document.getElementById("speedValue");
const confidenceValue = document.getElementById("confidenceValue");
const statusEl = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const cameraBadge = document.getElementById("cameraBadge");
const objectsEl = document.getElementById("objects");
const lastSpokenEl = document.getElementById("lastSpoken");
const placeholder = document.getElementById("placeholder");

let model = null, stream = null, running = false, voiceEnabled = true;
let rafId = null, lastInference = 0, isDetecting = false;
const inferenceIntervalMs = 350;
const stableCounts = new Map(), announced = new Set(), lastSeen = new Map();
const stableFramesRequired = 2, rearmAfterMs = 1800;

function setStatus(message, active = false) {
  statusEl.textContent = message;
  statusDot.classList.toggle("active", active);
  cameraBadge.textContent = active ? "Camera live" : (running ? "Loading / paused" : "Camera off");
  cameraBadge.classList.toggle("active", active);
}
function speak(text, updateLabel = text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = languageSelect.value;
  utterance.rate = Number(speedRange.value);
  utterance.volume = 1;
  utterance.onstart = () => { lastSpokenEl.textContent = updateLabel; };
  window.speechSynthesis.speak(utterance);
}
function resizeCanvas() {
  const w = video.videoWidth || 640, h = video.videoHeight || 480;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
function drawPredictions(predictions) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = Math.max(2, canvas.width / 500);
  ctx.font = `${Math.max(16, canvas.width / 55)}px system-ui`;
  predictions.forEach(p => {
    const [x, y, width, height] = p.bbox;
    ctx.strokeStyle = "#39e6b2"; ctx.fillStyle = "rgba(7, 25, 28, .82)";
    ctx.strokeRect(x, y, width, height);
    const label = `${p.class} ${Math.round(p.score * 100)}%`;
    const textWidth = ctx.measureText(label).width + 14;
    const labelY = Math.max(0, y - 31);
    ctx.fillRect(x, labelY, textWidth, 29);
    ctx.fillStyle = "#fff"; ctx.fillText(label, x + 7, labelY + 21);
  });
}
function updateAnnouncements(predictions) {
  const now = Date.now(), threshold = Number(confidenceRange.value);
  const visible = new Set(predictions.filter(p => p.score >= threshold).map(p => p.class));
  for (const label of visible) {
    stableCounts.set(label, (stableCounts.get(label) || 0) + 1);
    lastSeen.set(label, now);
    if (!announced.has(label) && stableCounts.get(label) >= stableFramesRequired) {
      announced.add(label);
      speak(`I see a ${label}.`, label);
    }
  }
  if (announceMode.value === "repeat") {
    for (const label of [...announced]) {
      if (now - (lastSeen.get(label) || 0) > rearmAfterMs) {
        announced.delete(label); stableCounts.delete(label);
      }
    }
  }
  for (const label of [...stableCounts.keys()]) {
    if (!visible.has(label) && !announced.has(label)) stableCounts.set(label, 0);
  }
  objectsEl.textContent = visible.size ? [...visible].sort().join(", ") : "No objects detected.";
}
async function detectLoop(timestamp) {
  if (!running) return;
  if (!isDetecting && timestamp - lastInference >= inferenceIntervalMs && video.readyState >= 2) {
    isDetecting = true; lastInference = timestamp;
    try {
      const predictions = await model.detect(video);
      drawPredictions(predictions); updateAnnouncements(predictions);
      setStatus("Camera and object detection are running.", true);
    } catch (err) { console.error(err); setStatus("Detection error: " + err.message); }
    finally { isDetecting = false; }
  }
  if (running) rafId = requestAnimationFrame(detectLoop);
}
async function loadCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === "videoinput");
    cameraSelect.innerHTML = "";
    cameras.forEach((camera, i) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${i + 1}`;
      cameraSelect.appendChild(option);
    });
    cameraSelect.disabled = false;
  } catch (e) { console.warn("Could not list cameras", e); }
}
async function start() {
  startBtn.disabled = true; setStatus("Loading object detection model...");
  try {
    if (!window.isSecureContext && location.hostname !== "localhost")
      throw new Error("Camera access requires HTTPS. Use the GitHub Pages HTTPS URL.");
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support webcam access.");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0; window.speechSynthesis.speak(unlock);
    }
    if (!model) { await tf.ready(); model = await cocoSsd.load({ base: "lite_mobilenet_v2" }); }
    const selectedId = cameraSelect.value;
    const videoConstraint = selectedId ? { deviceId: { exact: selectedId } } : { facingMode: { ideal: "environment" } };
    stream = await navigator.mediaDevices.getUserMedia({ video: { ...videoConstraint, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream; await video.play();
    await loadCameras();
    placeholder.style.display = "none";
    running = true; stopBtn.disabled = false; voiceBtn.disabled = false;
    fullscreenBtn.disabled = false; snapshotBtn.disabled = false;
    setStatus("Camera started. Point it at an object.", true);
    rafId = requestAnimationFrame(detectLoop);
  } catch (err) {
    console.error(err); setStatus(err.message || "Could not start camera.");
    startBtn.disabled = false; stopBtn.disabled = true;
  }
}
function stop() {
  running = false; if (rafId) cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; video.srcObject = null; ctx.clearRect(0, 0, canvas.width, canvas.height);
  placeholder.style.display = "grid";
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  startBtn.disabled = false; stopBtn.disabled = true; voiceBtn.disabled = true;
  fullscreenBtn.disabled = true; snapshotBtn.disabled = true;
  stableCounts.clear(); announced.clear(); lastSeen.clear();
  objectsEl.textContent = "No objects detected yet.";
  setStatus("Stopped. Press Start to run again.");
}
startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
voiceBtn.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled; voiceBtn.textContent = `Voice: ${voiceEnabled ? "ON" : "OFF"}`;
  if (!voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (voiceEnabled) speak("Voice announcements are on.", "Voice is on");
});
testVoiceBtn.addEventListener("click", () => speak("Smart Vision voice test. Object announcements are working.", "Voice test"));
mirrorSelect.addEventListener("change", () => viewer.classList.toggle("mirrored", mirrorSelect.value === "on"));
speedRange.addEventListener("input", () => speedValue.value = `${Number(speedRange.value).toFixed(2)}×`);
confidenceRange.addEventListener("input", () => confidenceValue.value = `${Math.round(Number(confidenceRange.value) * 100)}%`);
fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      if (viewer.requestFullscreen) await viewer.requestFullscreen();
      else if (viewer.webkitRequestFullscreen) viewer.webkitRequestFullscreen();
      else throw new Error("Full screen is not supported by this browser.");
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  } catch (e) {
    setStatus(e.message || "Could not open full screen.");
  }
});

// Keep the button label in sync, including when the user presses Escape.
function updateFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenBtn.textContent = isFullscreen ? "✕ Exit full screen" : "⛶ Full screen";
}
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
snapshotBtn.addEventListener("click", () => {
  if (!video.videoWidth) return;
  const shot = document.createElement("canvas");
  shot.width = video.videoWidth; shot.height = video.videoHeight;
  const c = shot.getContext("2d");
  if (mirrorSelect.value === "on") { c.translate(shot.width, 0); c.scale(-1, 1); }
  c.drawImage(video, 0, 0, shot.width, shot.height);
  c.drawImage(canvas, 0, 0);
  const a = document.createElement("a"); a.download = `smart-vision-${Date.now()}.png`;
  a.href = shot.toDataURL("image/png"); a.click();
});
window.addEventListener("beforeunload", () => { if (stream) stream.getTracks().forEach(t => t.stop()); });
