<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { BrowserMultiFormatReader } from "@zxing/library";
import { QRStreamProtocol } from "./utils/qrStreamProtocol.js";

const protocol = new QRStreamProtocol();
const scanning = ref(false);
const videoRef = ref(null);
const decodedData = ref("");
const currentStream = ref(null);
const progress = ref(null);
const error = ref("");
const overlayMessage = ref("");

let streamId = null;
let codeReaderInstance = null;

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
      overlayMessage.value = "Camera ready. Point to QR stream.";

      // Initialize ZXing reader
      codeReaderInstance = new BrowserMultiFormatReader();
      
      // Start continuous scanning
      scanLoop();
    }
  } catch (err) {
    error.value = "Failed to access camera: " + err.message;
    overlayMessage.value = "Camera error: " + err.message;
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
        overlayMessage.value = "Scan error: " + err.message;
      }
    });
}

function handleQRCode(qrText) {
  try {
    const result = protocol.processChunk(qrText);
    
    if (result.error) {
      overlayMessage.value = `Error: ${result.error}`;
      return;
    }

    if (result.status === "duplicate") {
      overlayMessage.value = `Duplicate chunk ${result.sequence + 1}/${result.progress.total}`;
      return;
    }

    // Update current stream info
    if (!streamId || streamId !== result.streamId) {
      streamId = result.streamId;
      currentStream.value = {
        id: streamId,
        total: protocol.getProgress(streamId).total
      };
      overlayMessage.value = `Stream ${streamId} detected (${result.progress.total} chunks).`;
    }

    progress.value = result.progress;
    overlayMessage.value = `Chunk ${result.sequence + 1}/${result.progress.total} received (${result.progress.percentage}% complete).`;

    // If complete, reconstruct the data
    if (result.isComplete) {
      overlayMessage.value = "All chunks received. Reconstructing...";
      reconstructStream(result.streamId);
    }
  } catch (err) {
    overlayMessage.value = "Error processing QR code: " + err.message;
  }
}

function reconstructStream(streamId) {
  const result = protocol.reconstruct(streamId);
  
  if (result.error) {
    error.value = result.error;
    overlayMessage.value = `Reconstruction error: ${result.error}`;
    return;
  }

  decodedData.value = result.data;
  overlayMessage.value = `Data reconstructed: ${result.size} bytes via ${result.chunks} chunks in ${result.duration}ms.`;
  
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

  overlayMessage.value = "Scanning stopped.";
}

function clearData() {
  decodedData.value = "";
  currentStream.value = null;
  progress.value = null;
  error.value = "";
  protocol.clearAll();
  streamId = null;
  overlayMessage.value = "Data cleared.";
}

function downloadData() {
  if (!decodedData.value) {
    error.value = "No data to download";
    overlayMessage.value = "No data available for download.";
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
  overlayMessage.value = "Data downloaded.";
}

function copyToClipboard() {
  if (!decodedData.value) {
    error.value = "No data to copy";
    overlayMessage.value = "No data available to copy.";
    return;
  }

  navigator.clipboard.writeText(decodedData.value).then(() => {
    overlayMessage.value = "Data copied to clipboard.";
  }).catch(err => {
    error.value = "Failed to copy: " + err.message;
    overlayMessage.value = "Failed to copy: " + err.message;
  });
}

onMounted(() => {
  // Automatically start scanning when component mounts
  startScanning();
});

onUnmounted(() => {
  stopScanning();
});
</script>

<template>
  <main class="app-container">
    <!-- Full-screen camera preview -->
    <div class="camera-container">
      <video 
        ref="videoRef" 
        autoplay 
        playsinline
        muted
        class="camera-preview"
        v-show="scanning"
      ></video>
      <div v-if="!scanning" class="camera-placeholder">
        <p>Starting camera...</p>
      </div>
    </div>

    <!-- Bottom overlay box -->
    <div v-if="overlayMessage || decodedData" class="bottom-overlay">
      <div class="overlay-content">
        <p v-if="overlayMessage" class="status-text">
          {{ overlayMessage }}
        </p>
        <div v-if="decodedData" class="decoded-text">
          {{ decodedData }}
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Full-screen container */
.app-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* Full-screen camera preview */
.camera-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  z-index: 1;
}

.camera-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #fff;
  gap: 20px;
}

/* Bottom overlay box */
.bottom-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2;
  max-height: 60vh;
  overflow-y: auto;
  overflow-x: hidden;
  /* 동적 높이: 내용에 따라 자동 조정, 최대 60vh */
  display: flex;
  flex-direction: column;
}

.overlay-content {
  padding: 20px;
  color: #fff;
  /* 내용이 최소 높이를 가지도록 */
  min-height: fit-content;
}

.status-text {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.decoded-text {
  /* 공백과 줄바꿈 보존 */
  white-space: pre-wrap;
  /* 긴 단어도 줄바꿈되도록 */
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #fff;
}

/* Scrollbar styling for overlay */
.bottom-overlay::-webkit-scrollbar {
  width: 8px;
}

.bottom-overlay::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.bottom-overlay::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.bottom-overlay::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>

<style>
/* Global styles for full-screen layout */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
