// Legacy re-exports for compatibility while supporting multiple barcode types
export {
  CodeStreamProtocol as QRStreamProtocol,
  createCodeChunk as createQRChunk,
  splitDataIntoCodeChunks as splitDataIntoChunks
} from "./codeStreamProtocol.js";