/**
 * QR Stream Protocol
 * 
 * Each QR code contains a JSON object with:
 * - id: unique stream identifier
 * - seq: sequence number (0-based)
 * - total: total number of chunks
 * - data: base64 encoded chunk data
 * - checksum: CRC32 checksum of the chunk data
 */

export class QRStreamProtocol {
  constructor() {
    this.streams = new Map(); // Map<streamId, StreamData>
  }

  /**
   * Parse a QR code string and extract stream data
   */
  parseQRCode(qrString) {
    try {
      const chunk = JSON.parse(qrString);

      // Support alternative field names and numeric strings from mixed protocol sources
      const streamId = chunk.id ?? chunk.streamId ?? chunk.stream_id ?? chunk.streamID ?? null;
      const sequenceRaw = chunk.seq ?? chunk.sequence ?? chunk.index ?? chunk.chunkIndex ?? chunk.chunk ?? null;
      const totalRaw = chunk.total ?? chunk.totalChunks ?? chunk.total_chunks ?? chunk.chunkCount ?? null;
      const data = chunk.data ?? chunk.payload ?? chunk.body ?? chunk.content ?? null;
      const checksum = chunk.checksum ?? chunk.crc ?? null;

      const sequence = typeof sequenceRaw === 'number' ? sequenceRaw : (sequenceRaw != null ? Number(sequenceRaw) : NaN);
      const total = typeof totalRaw === 'number' ? totalRaw : (totalRaw != null ? Number(totalRaw) : NaN);
      const streamIdStr = streamId != null ? String(streamId).trim() : '';

      if (!streamIdStr || !Number.isFinite(sequence) || !Number.isFinite(total) || typeof data !== 'string' || !data.length) {
        return { error: 'Invalid chunk format' };
      }

      if (!Number.isInteger(sequence) || sequence < 0 || !Number.isInteger(total) || total <= 0) {
        return { error: 'Invalid chunk format' };
      }

      return {
        streamId: streamIdStr,
        sequence: sequence,
        total: total,
        data: data,
        checksum: checksum || null
      };
    } catch (error) {
      return { error: 'Failed to parse QR code: ' + error.message };
    }
  }

  /**
   * Process a chunk and add it to the stream
   */
  processChunk(qrString) {
    const parsed = this.parseQRCode(qrString);
    if (parsed.error) {
      return parsed;
    }

    const { streamId, sequence, total, data, checksum } = parsed;

    // Get or create stream
    if (!this.streams.has(streamId)) {
      this.streams.set(streamId, {
        id: streamId,
        total,
        chunks: new Map(),
        receivedChunks: new Set(),
        startTime: Date.now()
      });
    }

    const stream = this.streams.get(streamId);

    // Validate total matches
    if (stream.total !== total) {
      return { error: `Total mismatch: expected ${stream.total}, got ${total}` };
    }

    // Check if already received
    if (stream.receivedChunks.has(sequence)) {
      return { 
        streamId,
        sequence,
        status: 'duplicate',
        progress: this.getProgress(streamId)
      };
    }

    // Add chunk
    stream.chunks.set(sequence, data);
    stream.receivedChunks.add(sequence);

    // Check if complete
    const isComplete = stream.receivedChunks.size === total;
    
    return {
      streamId,
      sequence,
      status: isComplete ? 'complete' : 'progress',
      progress: this.getProgress(streamId),
      isComplete
    };
  }

  /**
   * Get progress for a stream
   */
  getProgress(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return null;

    return {
      received: stream.receivedChunks.size,
      total: stream.total,
      percentage: Math.round((stream.receivedChunks.size / stream.total) * 100),
      missing: this.getMissingChunks(streamId)
    };
  }

  /**
   * Get missing chunk indices
   */
  getMissingChunks(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return [];

    const missing = [];
    for (let i = 0; i < stream.total; i++) {
      if (!stream.receivedChunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  /**
   * Reconstruct the complete data from all chunks
   */
  reconstruct(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return { error: 'Stream not found' };
    }

    if (stream.receivedChunks.size !== stream.total) {
      return { 
        error: `Incomplete stream: ${stream.receivedChunks.size}/${stream.total} chunks received`,
        progress: this.getProgress(streamId)
      };
    }

    // Reconstruct by concatenating chunks in order
    let reconstructed = '';
    for (let i = 0; i < stream.total; i++) {
      const chunkData = stream.chunks.get(i);
      if (!chunkData) {
        return { error: `Missing chunk ${i}` };
      }
      reconstructed += chunkData;
    }

    // Decode base64
    try {
      const decoded = atob(reconstructed);
      return {
        streamId,
        data: decoded,
        size: decoded.length,
        chunks: stream.total,
        duration: Date.now() - stream.startTime
      };
    } catch (error) {
      return { error: 'Failed to decode data: ' + error.message };
    }
  }

  /**
   * Clear a stream
   */
  clearStream(streamId) {
    this.streams.delete(streamId);
  }

  /**
   * Clear all streams
   */
  clearAll() {
    this.streams.clear();
  }

  /**
   * Get all active streams
   */
  getActiveStreams() {
    return Array.from(this.streams.values()).map(stream => ({
      id: stream.id,
      progress: this.getProgress(stream.id)
    }));
  }
}

/**
 * Helper function to create a QR code chunk from data
 * This is useful for generating test data
 */
export function createQRChunk(streamId, sequence, total, chunkData) {
  return JSON.stringify({
    id: streamId,
    seq: sequence,
    total: total,
    data: btoa(chunkData), // base64 encode
    checksum: null // Could add CRC32 here
  });
}

/**
 * Split data into chunks that fit in QR codes
 * QR codes can hold ~3000 alphanumeric characters, but we'll use 2000 for safety
 */
export function splitDataIntoChunks(data, maxChunkSize = 2000) {
  const streamId = 'stream_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const chunks = [];
  const totalChunks = Math.ceil(data.length / maxChunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * maxChunkSize;
    const end = Math.min(start + maxChunkSize, data.length);
    const chunkData = data.substring(start, end);
    chunks.push(createQRChunk(streamId, i, totalChunks, chunkData));
  }

  return chunks;
}

