import type { CompressionCodec } from "./types.js";

// lz4js is a pure-JS LZ4 block implementation (no native deps, browser-safe).
// Both lz4js and lz4_flex (Rust) use the LZ4 block format. We prepend a
// 4-byte little-endian original size so decompress doesn't need out-of-band
// size information — matching lz4_flex::block::compress_prepend_size exactly.
//
// zstd routes through the native platform codec (Android Rust FFI /
// iOS Compression framework). In pure-TS environments zstd falls back
// to "none" — the codec field in the header tells the receiver how to
// decompress, so mixed peers negotiate correctly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lz4 = require("lz4js") as {
  compress:   (src: Uint8Array) => Uint8Array;
  decompress: (src: Uint8Array, size: number) => Uint8Array;
};

/** Codecs this runtime can both compress and decompress. */
export const SUPPORTED_CODECS: CompressionCodec[] = ["none", "lz4"];

/**
 * Negotiate the best shared codec between local preference and peer capabilities.
 * Iterates SUPPORTED_CODECS in preference order and returns the first match.
 * Falls back to "none" if no overlap.
 */
export function negotiateCodec(
  preferred: CompressionCodec,
  peerCodecs: CompressionCodec[] = ["none"]
): CompressionCodec {
  if (peerCodecs.includes(preferred)) return preferred;
  for (const codec of SUPPORTED_CODECS) {
    if (peerCodecs.includes(codec)) return codec;
  }
  return "none";
}

export function compress(codec: CompressionCodec, data: Uint8Array): Uint8Array {
  switch (codec) {
    case "lz4": {
      const compressed = lz4.compress(data);
      // Prepend 4-byte LE original size (matches lz4_flex::block::compress_prepend_size)
      const out = new Uint8Array(4 + compressed.length);
      new DataView(out.buffer).setUint32(0, data.length, true);
      out.set(compressed, 4);
      return out;
    }
    case "zstd":
      return data; // zstd compression requires native platform codec
    default:
      return data;
  }
}

export function decompress(codec: CompressionCodec, data: Uint8Array): Uint8Array {
  switch (codec) {
    case "lz4": {
      // Read the 4-byte LE original size prepended by compress_prepend_size
      const originalSize = new DataView(data.buffer, data.byteOffset).getUint32(0, true);
      return lz4.decompress(data.slice(4), originalSize);
    }
    case "zstd":
      return data; // zstd decompression requires native platform codec
    default:
      return data;
  }
}
