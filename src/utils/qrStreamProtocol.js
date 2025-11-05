// Legacy re-exports for compatibility while the codebase transitions to Aztec terminology
export {
  AztecStreamProtocol as QRStreamProtocol,
  createAztecChunk as createQRChunk,
  splitDataIntoAztecChunks as splitDataIntoChunks
} from "./aztecStreamProtocol.js";