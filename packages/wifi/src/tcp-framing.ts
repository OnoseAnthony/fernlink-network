import { Socket } from "node:net";

export const TYPE_REQUEST = 0x01;
export const TYPE_PROOF   = 0x02;

/** Write one framed message to a socket. Thread-safe per socket with external sequencing. */
export function writeFrame(socket: Socket, typeTag: number, payload: Buffer): void {
  const header = Buffer.allocUnsafe(5);
  header.writeUInt8(typeTag, 0);
  header.writeUInt32BE(payload.length, 1);
  socket.write(Buffer.concat([header, payload]));
}

/**
 * Returns a stateful frame reader. Feed each incoming `data` buffer into it;
 * it emits complete frames via `onFrame` as they arrive, handling partial reads
 * transparently.
 *
 * Each frame: [1 byte typeTag][4 bytes BE length][payload bytes]
 */
export function createFrameReader(
  onFrame: (typeTag: number, payload: Buffer) => void
): (data: Buffer) => void {
  let buf = Buffer.alloc(0);

  return (data: Buffer) => {
    buf = Buffer.concat([buf, data]);
    while (buf.length >= 5) {
      const length = buf.readUInt32BE(1);
      if (length > 1_048_576) { buf = Buffer.alloc(0); return; }  // sanity cap 1 MB
      if (buf.length < 5 + length) break;                           // not enough bytes yet
      const typeTag = buf.readUInt8(0);
      const payload = buf.slice(5, 5 + length);
      onFrame(typeTag, Buffer.from(payload));
      buf = buf.slice(5 + length);
    }
  };
}
