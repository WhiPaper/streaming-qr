# Streaming Code Decoder

A Tauri + Vue 3 application that reads and decodes streamed data transmitted through sequences of Aztec, QR Code, or Data Matrix symbols.

## Features

- **Selectable 2D Formats**: Switch between Aztec, QR Code, and Data Matrix scanning on the fly
- **Stream Reconstruction**: Automatically assembles data chunks from multiple symbols
- **Progress Tracking**: Visual indicators showing which chunks have been received and which are missing
- **Duplicate Detection**: Automatically handles duplicate scans
- **Data Validation**: Validates and reconstructs complete data streams
- **Modern UI**: Clean, responsive interface with activity logging

## How It Works

The app uses a protocol where each symbol contains:
- **Stream ID**: Unique identifier for the data stream
- **Sequence Number**: Position of the chunk in the stream
- **Total Chunks**: Total number of chunks in the stream
- **Data**: Base64-encoded chunk of the original data

When you scan multiple symbols:
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
- `CAMERA` - For 2D barcode scanning

Note: The Android project is generated in `src-tauri/gen/android/`. If you regenerate the Android project, you may need to re-add custom permissions to the `AndroidManifest.xml` file.

## Usage

1. Click "Start Scanning" to activate the camera
1. Pick the desired code format (Aztec, QR Code, or Data Matrix)
1. Point the camera at symbols that contain streamed data
1. The app will automatically detect and process chunks
1. Once all chunks are received, the data will be reconstructed and displayed
1. You can copy, download, or save the decoded data

## Protocol Format

Each symbol should contain a JSON object:

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
- Creating protocol-compliant chunks (`src/utils/codeStreamProtocol.js`)
- Legacy compatibility shims for QR/Aztec naming (`src/utils/qrStreamProtocol.js`, `src/utils/aztecStreamProtocol.js`)

## Technology Stack

- **Frontend**: Vue 3 + Vite
- **Backend**: Rust + Tauri 2.0
- **2D Scanning**: @zxing/library
- **Styling**: Scoped CSS with dark mode support
