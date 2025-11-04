/**
 * Test QR Code Generator
 * 
 * Utility to generate test QR codes for development and testing.
 * This can be used to create sample QR code data that follows
 * the streaming protocol.
 */

import { createQRChunk, splitDataIntoChunks } from './qrStreamProtocol.js';

/**
 * Generate test data and split it into QR code chunks
 */
export function generateTestQRChunks(dataSize = 5000, chunkSize = 2000) {
  // Generate test data
  const testData = generateTestData(dataSize);
  
  // Split into chunks
  const chunks = splitDataIntoChunks(testData, chunkSize);
  
  return {
    originalData: testData,
    chunks: chunks,
    streamId: chunks[0] ? JSON.parse(chunks[0]).id : null
  };
}

/**
 * Generate test data of specified size
 */
function generateTestData(size) {
  const lines = [];
  lines.push(`Test Data Stream\n`);
  lines.push(`Generated: ${new Date().toISOString()}\n`);
  lines.push(`Size: ${size} characters\n`);
  lines.push(`\n`);
  
  // Add some sample content
  const sampleText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. `;
  
  while (lines.join('').length < size) {
    lines.push(sampleText);
  }
  
  // Trim to exact size
  const result = lines.join('').substring(0, size);
  return result;
}

/**
 * Create a simple test message split into chunks
 */
export function createTestMessage(message) {
  return splitDataIntoChunks(message, 2000);
}

