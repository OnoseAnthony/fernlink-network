import { MAX_FRAGMENT_PAYLOAD, FRAG_HEADER_SIZE } from "./uuids.js";

/**
 * Split a payload into BLE-MTU-sized fragments.
 *
 * Each fragment is prefixed with a 2-byte header:
 *   byte 0 — fragment index  (0-based)
 *   byte 1 — total fragments
 *
 * Max supported message size: 255 * MAX_FRAGMENT_PAYLOAD (~130 KB).
 */
export function fragment(payload: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < payload.length) {
    chunks.push(payload.slice(offset, offset + MAX_FRAGMENT_PAYLOAD));
    offset += MAX_FRAGMENT_PAYLOAD;
  }

  if (chunks.length > 255) throw new Error("message too large to fragment over BLE");

  return chunks.map((chunk, i) => {
    const frag = Buffer.allocUnsafe(FRAG_HEADER_SIZE + chunk.length);
    frag[0] = i;
    frag[1] = chunks.length;
    chunk.copy(frag, FRAG_HEADER_SIZE);
    return frag;
  });
}

/**
 * Stateful reassembler for a single message stream.
 * Returns the complete payload once all fragments arrive.
 */
export class Reassembler {
  private received: (Buffer | null)[] = [];
  private total = 0;
  private count = 0;

  push(frag: Buffer): Buffer | null {
    if (frag.length < FRAG_HEADER_SIZE) return null;

    const index = frag[0];
    const total = frag[1];
    const payload = frag.slice(FRAG_HEADER_SIZE);

    if (this.total === 0) {
      this.total = total;
      this.received = new Array(total).fill(null);
    }

    if (this.received[index] === null) {
      this.received[index] = payload;
      this.count++;
    }

    if (this.count === this.total) {
      return Buffer.concat(this.received as Buffer[]);
    }
    return null;
  }

  reset(): void {
    this.received = [];
    this.total = 0;
    this.count = 0;
  }
}
