# Streaming QR Prototype

Streaming QR code capture prototype built with Vite + React and a Tauri shell. The UI previews the device camera, decodes changing QR frames using ZXing, and aggregates metadata about the detected stream.

> **Note**
> This repository focuses on the desktop preview workflow. To target Android/iOS you will need to pair the Tauri frontend with a Capacitor (or native) camera bridge and use the Tauri mobile toolchain (currently in beta as of late 2025).

## Prerequisites

- Node.js 18+
- Rust toolchain (stable) with `cargo`
- Tauri CLI `npm install --global @tauri-apps/cli` (optional when using the local dev dependency)
- For mobile builds: Android Studio + Xcode, plus the Tauri mobile prerequisites described in the official documentation

## Install

```bash
npm install
```

## Run (desktop preview)

```bash
npm run tauri
```

This will start Vite dev server and open the Tauri window. You can also run the web UI alone with `npm run dev`.

## Build

```bash
npm run tauri:build
```

## Android (debug) build

Prerequisites in addition to the desktop stack:

- Android Studio (or command-line SDK tools) with platform 34 and build-tools 34.0.0
- Android NDK r25c (`ndk;25.2.9519653`)
- `cargo-ndk` (`cargo install cargo-ndk`)
- Added Rust targets: `aarch64-linux-android`, `armv7-linux-androideabi`

Initialize the mobile project once:

```bash
npx tauri android init
```

Then build a debug APK:

```bash
npm run tauri:android
```

For a release build (requires signing secrets set in CI):

```bash
npm run tauri:android:release
```

## Streaming QR debugger

The React layer performs the following:

1. Requests the environment-facing camera and starts streaming frames at ~720p.
2. Uses ZXing to decode each frame and keeps the last few samples in memory.
3. Attempts to parse JSON-encoded streaming metadata (fields such as `streamId`, `sequence`, `total`, `payload`).
4. Maintains a digest with sequence tracking and displays fps along with the most recent payload.

For non-JSON QR payloads the raw text is shown without aggregation.

## Next steps (mobile)

1. Scaffold `tauri mobile init` and wire Capacitor's `CameraPreview` plugin to feed frames into the WebView.
2. Replace the `navigator.mediaDevices` access with a Tauri command that receives preview frames (base64 or shared texture).
3. Consider native-side decoding for higher throughput (e.g., OpenCV + ZXing exposed via a custom Capacitor plugin).
4. Harden the streaming protocol (checksums, de-duplication, encryption) as requirements evolve.
