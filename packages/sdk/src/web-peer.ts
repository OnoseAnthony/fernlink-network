import { v4 as uuidv4 } from "uuid";
import { compress, decompress, SUPPORTED_CODECS } from "./compression.js";
import type { CompressionCodec, VerificationRequest, VerificationProof, PeerInfo, FernlinkPeer } from "./types.js";

// fe4e = valid hex encoding of "FeN" (Fernlink). Must match all other platform layers.
const SERVICE_UUID = "fe4e0000-0000-1000-8000-00805f9b34fb";
const CHAR_REQUEST = "fe4e0001-0000-1000-8000-00805f9b34fb";
const CHAR_PROOF   = "fe4e0002-0000-1000-8000-00805f9b34fb";
const MAX_PAYLOAD  = 510; // 512 byte MTU − 2 byte fragment header

/**
 * A real BLE peer reached via the Web Bluetooth API.
 *
 * Must be constructed from a user gesture (button click etc.):
 *   const peer = await WebBluetoothPeer.connect();
 *   client.addPeer(peer);
 *
 * The browser will prompt the user to pick a nearby Fernlink node.
 * Central-role only — the browser can connect to Android/desktop nodes
 * but cannot advertise itself as a peripheral.
 */
export class WebBluetoothPeer implements FernlinkPeer {
  readonly info: PeerInfo;
  readonly supportedCodecs: CompressionCodec[] = SUPPORTED_CODECS;
  private handlers: Array<(proof: VerificationProof) => void> = [];
  private requestChar: BluetoothRemoteGATTCharacteristic;
  private reassembler = new Reassembler();

  private constructor(
    info: PeerInfo,
    requestChar: BluetoothRemoteGATTCharacteristic,
  ) {
    this.info = info;
    this.requestChar = requestChar;
  }

  /**
   * Prompt the user to select a nearby Fernlink node and connect to it.
   * Must be called from a user gesture.
   */
  static async connect(): Promise<WebBluetoothPeer> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser (use Chrome or Edge)");
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });

    const server  = await device.gatt!.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const [requestChar, proofChar] = await Promise.all([
      service.getCharacteristic(CHAR_REQUEST),
      service.getCharacteristic(CHAR_PROOF),
    ]);

    const peer = new WebBluetoothPeer(
      { id: device.id, publicKey: "", rpcEndpoint: "" },
      requestChar,
    );

    await proofChar.startNotifications();
    proofChar.addEventListener("characteristicvaluechanged", (e) => {
      const char = e.target as BluetoothRemoteGATTCharacteristic;
      const data = new Uint8Array(char.value!.buffer);
      const complete = peer.reassembler.feed(data);
      if (!complete) return;
      try {
        const decoded = decodeWirePayload(complete);
        const proof = JSON.parse(new TextDecoder().decode(decoded)) as VerificationProof;
        for (const h of peer.handlers) h(proof);
      } catch { /* malformed proof — ignore */ }
    });

    device.addEventListener("gattserverdisconnected", () => {
      peer.handlers = [];
    });

    return peer;
  }

  onProof(handler: (proof: VerificationProof) => void): void {
    this.handlers.push(handler);
  }

  /** Serialize, compress (if negotiated), fragment, and write to the peer. */
  async handleRequest(req: VerificationRequest): Promise<void> {
    const json    = new TextEncoder().encode(JSON.stringify(req));
    const payload = encodeWirePayload(req.compression ?? "none", json);
    for (const frag of fragment(payload)) {
      await this.requestChar.writeValueWithoutResponse(frag);
    }
  }

  disconnect(): void {
    this.requestChar.service.device.gatt?.disconnect();
  }
}

// ── Wire payload encoding (codec-byte prefix + compressed JSON) ───────────────
//
// Format: [1 byte: CompressionCodec (0x00–0x02)] [compressed or raw JSON bytes]
//
// Backwards compatibility: legacy messages start with '{' (0x7B), which is
// outside the codec range 0x00–0x02. Those are treated as uncompressed JSON.

const CODEC_BYTES: Record<CompressionCodec, number> = { none: 0x00, lz4: 0x01, zstd: 0x02 };
const BYTE_CODECS: Record<number, CompressionCodec>  = { 0x00: "none", 0x01: "lz4", 0x02: "zstd" };

function encodeWirePayload(codec: CompressionCodec, json: Uint8Array): Uint8Array {
  const body = compress(codec, json);
  const out  = new Uint8Array(1 + body.length);
  out[0] = CODEC_BYTES[codec];
  out.set(body, 1);
  return out;
}

function decodeWirePayload(data: Uint8Array): Uint8Array {
  const firstByte = data[0];
  if (firstByte === undefined) return data;
  // Legacy message: starts with '{' (0x7B) — uncompressed, no codec prefix
  if (firstByte === 0x7B || !(firstByte in BYTE_CODECS)) return data;
  const codec = BYTE_CODECS[firstByte]!;
  return decompress(codec, data.slice(1));
}

// ── Fragmentation (same 2-byte header protocol as Android + Rust layers) ──────

function fragment(payload: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < payload.length; i += MAX_PAYLOAD) {
    chunks.push(payload.slice(i, i + MAX_PAYLOAD));
  }
  if (chunks.length > 255) throw new Error("payload too large to fragment over BLE");
  return chunks.map((chunk, i) => {
    const frag = new Uint8Array(2 + chunk.length);
    frag[0] = i;
    frag[1] = chunks.length;
    frag.set(chunk, 2);
    return frag;
  });
}

class Reassembler {
  private slots: (Uint8Array | null)[] = [];
  private received = 0;

  feed(frag: Uint8Array): Uint8Array | null {
    if (frag.length < 2) return null;
    const index = frag[0];
    const total = frag[1];
    const payload = frag.slice(2);

    if (this.slots.length === 0) this.slots = new Array(total).fill(null);
    if (index >= this.slots.length || this.slots[index] !== null) return null;

    this.slots[index] = payload;
    this.received++;

    if (this.received === this.slots.length) {
      const complete = concat(this.slots as Uint8Array[]);
      this.reset();
      return complete;
    }
    return null;
  }

  private reset(): void { this.slots = []; this.received = 0; }
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}
