/**
 * LC-3 .obj Binary Image Loader
 *
 * LC-3 object files use a big-endian format:
 * - First 16-bit word specifies the 16-bit origin address in memory (e.g. 0x3000)
 * - Subsequent 16-bit words represent consecutive instruction and data words.
 */

export interface LoadedObjImage {
  origin: number;
  words: number[];
}

export function parseObjBinary(arrayBuffer: ArrayBuffer): LoadedObjImage {
  const dataView = new DataView(arrayBuffer);
  if (dataView.byteLength < 2) {
    throw new Error('Invalid .obj file: buffer too short to contain an origin header.');
  }

  // First 16-bit word is the origin address (big-endian)
  const origin = dataView.getUint16(0, false);
  const words: number[] = [];

  for (let offset = 2; offset + 1 < dataView.byteLength; offset += 2) {
    words.push(dataView.getUint16(offset, false));
  }

  return { origin, words };
}

export async function fetchExampleObj(filename: string): Promise<LoadedObjImage> {
  const response = await fetch(`/examples/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return parseObjBinary(buffer);
}
