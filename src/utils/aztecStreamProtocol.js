/**
 * Aztec Stream Protocol
 *
 * Each Aztec code contains a JSON object with:
 * - id: unique stream identifier
 * - seq: sequence number (0-based)
 * - total: total number of chunks
 * - data: base64 encoded chunk data
 * - checksum: CRC32 checksum of the chunk data
 */

export class AztecStreamProtocol {
  constructor() {
    this.streams = new Map(); // Map<streamId, StreamData>
  }

  /**
   * Parse an Aztec code string and extract stream data
   */
  parseAztecCode(codeString) {
    try {
      const chunk = JSON.parse(codeString);

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
      return { error: 'Failed to parse Aztec code: ' + error.message };
    }
  }

  /**
   * Process a chunk and add it to the stream
   */
  processChunk(codeString) {
    const parsed = this.parseAztecCode(codeString);
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

    // Reconstruct by decoding each chunk individually and concatenating
    let decodedData = '';
    for (let i = 0; i < stream.total; i++) {
      const chunkData = stream.chunks.get(i);
      if (!chunkData) {
        return { error: `Missing chunk ${i}` };
      }
      
      try {
        decodedData += atob(chunkData);
      } catch (error) {
        return { error: `Failed to decode chunk ${i}: ${error.message}` };
      }
    }

    return {
      streamId,
      data: decodedData,
      size: decodedData.length,
      chunks: stream.total,
      duration: Date.now() - stream.startTime
    };
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
 * Helper function to create an Aztec code chunk from data
 * This is useful for generating test data
 */
export function createAztecChunk(streamId, sequence, total, chunkData) {
  return JSON.stringify({
    id: streamId,
    seq: sequence,
    total: total,
    data: btoa(chunkData),
    checksum: null
  });
}

/**
 * Split data into chunks that fit in Aztec codes
 * Practical payload limit depends on the Aztec encoder being used
 */
export function splitDataIntoAztecChunks(data, maxChunkSize = 2000) {
  const streamId = 'stream_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const chunks = [];
  const totalChunks = Math.ceil(data.length / maxChunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * maxChunkSize;
    const end = Math.min(start + maxChunkSize, data.length);
    const chunkData = data.substring(start, end);
    chunks.push(createAztecChunk(streamId, i, totalChunks, chunkData));
  }

  return chunks;
}