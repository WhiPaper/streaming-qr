# Streaming QR Decoder

A Tauri + Vue 3 application that reads and decodes streamed data through multiple series of QR codes.

## Features

- **Real-time QR Code Scanning**: Uses camera to scan QR codes in real-time
- **Stream Reconstruction**: Automatically assembles data chunks from multiple QR codes
- **Progress Tracking**: Visual progress indicators showing which chunks have been received
- **Duplicate Detection**: Automatically handles duplicate QR code scans
- **Data Validation**: Validates and reconstructs complete data streams
- **Modern UI**: Clean, responsive interface with activity logging

## How It Works

The app uses a protocol where each QR code contains:
- **Stream ID**: Unique identifier for the data stream
- **Sequence Number**: Position of the chunk in the stream
- **Total Chunks**: Total number of chunks in the stream
- **Data**: Base64-encoded chunk of the original data

When you scan multiple QR codes:
1. The app detects chunks belonging to the same stream
2. Tracks progress and missing chunks
3. Automatically reconstructs the complete data when all chunks are received
4. Displays the decoded data

## Development

### Prerequisites

- Node.js (v18 or higher)
- Rust (latest stable)
- Tauri CLI (`npm install -g @tauri-apps/cli`)

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Android Build Configuration

#### Keystore Configuration

For Android release builds, configure the keystore using environment variables:

```bash
# Required environment variables for signing
export TAURI_ANDROID_KEYSTORE_PATH=/path/to/your/keystore.jks
export TAURI_ANDROID_KEYSTORE_PASSWORD=your_keystore_password
export TAURI_ANDROID_KEY_ALIAS=your_key_alias
export TAURI_ANDROID_KEY_PASSWORD=your_key_password

# Then build
npm run tauri android build
```

#### Permissions

The app requires the following Android permissions (configured in `AndroidManifest.xml`):
- `INTERNET` - For network access
- `CAMERA` - For QR code scanning

Note: The Android project is generated in `src-tauri/gen/android/`. If you regenerate the Android project, you may need to re-add custom permissions to the `AndroidManifest.xml` file.

## Usage

1. Click "Start Scanning" to activate the camera
2. Point the camera at QR codes that contain streamed data
3. The app will automatically detect and process chunks
4. Once all chunks are received, the data will be reconstructed and displayed
5. You can copy, download, or save the decoded data

## Protocol Format

Each QR code should contain a JSON object:

```json
{
  "id": "stream_1234567890_abc123",
  "seq": 0,
  "total": 5,
  "data": "base64_encoded_chunk_data",
  "checksum": null
}
```

## Utilities

The app includes utility functions for:
- Creating QR code chunks from data (`src/utils/qrStreamProtocol.js`)
- Generating test QR codes (`src/utils/testQRGenerator.js`)

## Technology Stack

- **Frontend**: Vue 3 + Vite
- **Backend**: Rust + Tauri 2.0
- **QR Scanning**: @zxing/library
- **Styling**: Scoped CSS with dark mode support
