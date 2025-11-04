<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { BrowserMultiFormatReader } from "@zxing/library";
import { QRStreamProtocol } from "./utils/qrStreamProtocol.js";

const protocol = new QRStreamProtocol();
const scanner = ref(null);
const scanning = ref(false);
const videoRef = ref(null);
const decodedData = ref("");
const currentStream = ref(null);
const progress = ref(null);
const error = ref("");
const logs = ref([]);
const codeReader = ref(null);

let streamId = null;
let codeReaderInstance = null;

function addLog(message, type = "info") {
  logs.value.unshift({
    message,
    type,
    timestamp: new Date().toLocaleTimeString()
  });
  if (logs.value.length > 50) {
    logs.value.pop();
  }
}

async function startScanning() {
  try {
    error.value = "";
    decodedData.value = "";
    currentStream.value = null;
    progress.value = null;
    protocol.clearAll();

    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment", // Use back camera on mobile
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
      scanning.value = true;
      addLog("Camera started", "success");

      // Initialize ZXing reader
      codeReaderInstance = new BrowserMultiFormatReader();
      
      // Start continuous scanning
      scanLoop();
    }
  } catch (err) {
    error.value = "Failed to access camera: " + err.message;
    addLog("Camera error: " + err.message, "error");
    scanning.value = false;
  }
}

function scanLoop() {
  if (!scanning.value || !codeReaderInstance || !videoRef.value) {
    return;
  }

  codeReaderInstance
    .decodeFromVideoDevice(null, videoRef.value, (result, err) => {
      if (result) {
        handleQRCode(result.getText());
      } else if (err && err.name !== "NotFoundException") {
        // NotFoundException is normal when no QR code is in view
        // Only log other errors
        console.debug("Scan error:", err);
      }
    })
    .catch((err) => {
      if (scanning.value) {
        addLog("Scan error: " + err.message, "error");
      }
    });
}

function handleQRCode(qrText) {
  try {
    const result = protocol.processChunk(qrText);
    
    if (result.error) {
      addLog(`Error: ${result.error}`, "error");
      return;
    }

    if (result.status === "duplicate") {
      addLog(`Duplicate chunk ${result.sequence} (${result.progress.received}/${result.progress.total})`, "warning");
      return;
    }

    // Update current stream info
    if (!streamId || streamId !== result.streamId) {
      streamId = result.streamId;
      currentStream.value = {
        id: streamId,
        total: protocol.getProgress(streamId).total
      };
      addLog(`New stream detected: ${streamId} (${result.progress.total} chunks)`, "info");
    }

    progress.value = result.progress;
    addLog(`Chunk ${result.sequence + 1}/${result.progress.total} received`, "success");

    // If complete, reconstruct the data
    if (result.isComplete) {
      addLog("Stream complete! Reconstructing data...", "success");
      reconstructStream(result.streamId);
    }
  } catch (err) {
    addLog("Error processing QR code: " + err.message, "error");
  }
}

function reconstructStream(streamId) {
  const result = protocol.reconstruct(streamId);
  
  if (result.error) {
    error.value = result.error;
    addLog(`Reconstruction error: ${result.error}`, "error");
    return;
  }

  decodedData.value = result.data;
  addLog(`Data reconstructed: ${result.size} bytes from ${result.chunks} chunks in ${result.duration}ms`, "success");
  
  // Optionally stop scanning after successful reconstruction
  // stopScanning();
}

function stopScanning() {
  scanning.value = false;
  
  if (codeReaderInstance) {
    codeReaderInstance.reset();
    codeReaderInstance = null;
  }

  if (videoRef.value && videoRef.value.srcObject) {
    const tracks = videoRef.value.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }

  addLog("Scanning stopped", "info");
}

function clearData() {
  decodedData.value = "";
  currentStream.value = null;
  progress.value = null;
  error.value = "";
  protocol.clearAll();
  streamId = null;
  addLog("Data cleared", "info");
}

function downloadData() {
  if (!decodedData.value) {
    error.value = "No data to download";
    return;
  }

  const blob = new Blob([decodedData.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `decoded-stream-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  addLog("Data downloaded", "success");
}

function copyToClipboard() {
  if (!decodedData.value) {
    error.value = "No data to copy";
    return;
  }

  navigator.clipboard.writeText(decodedData.value).then(() => {
    addLog("Data copied to clipboard", "success");
  }).catch(err => {
    error.value = "Failed to copy: " + err.message;
  });
}

onUnmounted(() => {
  stopScanning();
});
</script>

<template>
  <main class="container">
    <h1>QR Stream Decoder</h1>
    <p class="subtitle">Scan multiple QR codes to reconstruct streamed data</p>

    <div class="controls">
      <button 
        v-if="!scanning" 
        @click="startScanning" 
        class="btn btn-primary"
      >
        Start Scanning
      </button>
      <button 
        v-else 
        @click="stopScanning" 
        class="btn btn-secondary"
      >
        Stop Scanning
      </button>
      <button 
        @click="clearData" 
        class="btn btn-secondary"
        :disabled="!decodedData && !currentStream"
      >
        Clear
      </button>
    </div>

    <div v-if="error" class="error-box">
      {{ error }}
    </div>

    <div class="video-container">
      <video 
        ref="videoRef" 
        autoplay 
        playsinline
        muted
        class="video-preview"
        v-show="scanning"
      ></video>
      <div v-if="!scanning" class="video-placeholder">
        <p>Camera will appear here when scanning starts</p>
      </div>
    </div>

    <div v-if="currentStream" class="stream-info">
      <h3>Current Stream</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Stream ID:</span>
          <span class="value">{{ currentStream.id }}</span>
        </div>
        <div v-if="progress" class="info-item">
          <span class="label">Progress:</span>
          <span class="value">{{ progress.received }} / {{ progress.total }} chunks</span>
        </div>
        <div v-if="progress" class="progress-bar-container">
          <div class="progress-bar" :style="{ width: progress.percentage + '%' }"></div>
          <span class="progress-text">{{ progress.percentage }}%</span>
        </div>
        <div v-if="progress && progress.missing.length > 0" class="info-item">
          <span class="label">Missing chunks:</span>
          <span class="value">{{ progress.missing.join(', ') }}</span>
        </div>
      </div>
    </div>

    <div v-if="decodedData" class="decoded-data">
      <div class="data-header">
        <h3>Decoded Data</h3>
        <div class="data-actions">
          <button @click="copyToClipboard" class="btn btn-small">Copy</button>
          <button @click="downloadData" class="btn btn-small">Download</button>
        </div>
      </div>
      <div class="data-content">
        <pre>{{ decodedData }}</pre>
      </div>
      <div class="data-stats">
        <span>Size: {{ decodedData.length }} characters</span>
      </div>
    </div>

    <div class="logs-container">
      <h3>Activity Log</h3>
      <div class="logs">
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          :class="['log-entry', 'log-' + log.type]"
        >
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">
          No activity yet
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 10px;
  color: #2c3e50;
}

.subtitle {
  text-align: center;
  color: #7f8c8d;
  margin-bottom: 30px;
}

.controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2980b9;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #7f8c8d;
}

.btn-small {
  padding: 6px 12px;
  font-size: 14px;
  background-color: #34495e;
  color: white;
}

.btn-small:hover {
  background-color: #2c3e50;
}

.error-box {
  background-color: #e74c3c;
  color: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
}

.video-container {
  position: relative;
  width: 100%;
  max-width: 640px;
  margin: 0 auto 30px;
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4/3;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #7f8c8d;
}

.stream-info {
  background-color: #ecf0f1;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.stream-info h3 {
  margin-top: 0;
  color: #2c3e50;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  gap: 10px;
}

.label {
  font-weight: 600;
  color: #34495e;
}

.value {
  color: #2c3e50;
  font-family: monospace;
}

.progress-bar-container {
  position: relative;
  width: 100%;
  height: 30px;
  background-color: #bdc3c7;
  border-radius: 15px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-bar {
  height: 100%;
  background-color: #27ae60;
  transition: width 0.3s ease;
  border-radius: 15px;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.decoded-data {
  background-color: #f8f9fa;
  border: 2px solid #3498db;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.data-header h3 {
  margin: 0;
  color: #2c3e50;
}

.data-actions {
  display: flex;
  gap: 10px;
}

.data-content {
  background-color: white;
  border: 1px solid #bdc3c7;
  border-radius: 8px;
  padding: 15px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.data-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.data-stats {
  color: #7f8c8d;
  font-size: 14px;
}

.logs-container {
  background-color: #2c3e50;
  border-radius: 12px;
  padding: 20px;
  color: white;
}

.logs-container h3 {
  margin-top: 0;
  color: white;
}

.logs {
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 13px;
}

.log-entry {
  padding: 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  display: flex;
  gap: 10px;
}

.log-info {
  background-color: rgba(52, 152, 219, 0.2);
}

.log-success {
  background-color: rgba(39, 174, 96, 0.2);
}

.log-error {
  background-color: rgba(231, 76, 60, 0.2);
}

.log-warning {
  background-color: rgba(241, 196, 15, 0.2);
}

.log-time {
  color: #95a5a6;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-empty {
  text-align: center;
  color: #7f8c8d;
  padding: 20px;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  .container {
    background-color: #1e1e1e;
  }

  h1 {
    color: #f6f6f6;
  }

  .subtitle {
    color: #95a5a6;
  }

  .stream-info {
    background-color: #34495e;
  }

  .stream-info h3 {
    color: #ecf0f1;
  }

  .label {
    color: #bdc3c7;
  }

  .value {
    color: #ecf0f1;
  }

  .decoded-data {
    background-color: #2c3e50;
    border-color: #3498db;
  }

  .data-header h3 {
    color: #ecf0f1;
  }

  .data-content {
    background-color: #1e1e1e;
    border-color: #555;
  }

  .data-content pre {
    color: #f6f6f6;
  }
}
</style>
