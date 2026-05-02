/**
 * Fernlink Desktop BLE Simulator
 *
 * Simulates a Fernlink BLE peripheral in-process — no real Bluetooth hardware
 * required. Useful for local development, CI testing, and demo purposes.
 *
 * The simulator:
 *   1. Accepts VerificationRequest objects via postRequest()
 *   2. Signs a VerificationProof using a local Ed25519 keypair (tweetnacl)
 *   3. Returns the proof JSON, mirroring the Android GATT flow end-to-end
 *
 * Usage (from a test or script):
 *   const sim = new FernlinkSimulator();
 *   const proof = await sim.postRequest({ txSignature, statusByte, slot, blockTime });
 *   console.log(JSON.parse(proof));
 */

import nacl from "tweetnacl";
import { v4 as uuidv4 } from "uuid";

interface VerificationRequest {
  txSignature: string;
  statusByte: number; // 0=confirmed, 1=failed, 2=unknown
  slot: number;
  blockTime: number;
}

interface VerificationProof {
  messageId: string;
  txSignature: string;
  status: string;
  slot: number;
  blockTime: number;
  errorCode: number;
  verifierPublicKey: string;
  signature: string;
  timestampMs: number;
}

function statusLabel(byte: number): string {
  if (byte === 0) return "confirmed";
  if (byte === 1) return "failed";
  return "unknown";
}

function uint64LE(value: number): Uint8Array {
  const buf = new Uint8Array(8);
  let v = BigInt(value);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function uint16LE(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
}

function buildSignableBytes(
  txSig: string,
  statusByte: number,
  slot: number,
  blockTime: number,
  errorCode: number,
  pubkey: Uint8Array,
): Uint8Array {
  const txBytes = new TextEncoder().encode(txSig);
  const parts = [
    txBytes,
    new Uint8Array([statusByte]),
    uint64LE(slot),
    uint64LE(blockTime),
    uint16LE(errorCode),
    pubkey,
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export class FernlinkSimulator {
  private readonly keypair: nacl.SignKeyPair;
  readonly publicKeyHex: string;

  constructor(seed?: Uint8Array) {
    this.keypair = seed
      ? nacl.sign.keyPair.fromSeed(seed)
      : nacl.sign.keyPair();
    this.publicKeyHex = Buffer.from(this.keypair.publicKey).toString("hex");
  }

  /** Sign a proof for the given request and return the JSON string. */
  postRequest(req: VerificationRequest, errorCode = 0): string {
    const signable = buildSignableBytes(
      req.txSignature,
      req.statusByte,
      req.slot,
      req.blockTime,
      errorCode,
      this.keypair.publicKey,
    );

    const sig = nacl.sign.detached(signable, this.keypair.secretKey);

    const proof: VerificationProof = {
      messageId:         uuidv4(),
      txSignature:       req.txSignature,
      status:            statusLabel(req.statusByte),
      slot:              req.slot,
      blockTime:         req.blockTime,
      errorCode,
      verifierPublicKey: this.publicKeyHex,
      signature:         Buffer.from(sig).toString("hex"),
      timestampMs:       Date.now(),
    };

    return JSON.stringify(proof);
  }

  /** Verify a proof JSON string against its embedded public key. */
  static verify(proofJson: string): boolean {
    try {
      const p = JSON.parse(proofJson) as VerificationProof;
      const pubkey = Buffer.from(p.verifierPublicKey, "hex");
      const sig    = Buffer.from(p.signature, "hex");

      const statusByte =
        p.status === "confirmed" ? 0 : p.status === "failed" ? 1 : 2;

      const signable = buildSignableBytes(
        p.txSignature,
        statusByte,
        p.slot,
        p.blockTime,
        p.errorCode,
        pubkey,
      );

      return nacl.sign.detached.verify(signable, sig, pubkey);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate an array of proof JSON strings for consensus.
   * Mirrors the Rust consensus::evaluate() logic:
   *   settled = at least minProofs proofs agree on (status, slot).
   */
  static evaluate(
    proofs: string[],
    minProofs = 2,
  ): { settled: boolean; status?: string; slot?: number; proofCount: number } {
    const valid = proofs.filter((p) => FernlinkSimulator.verify(p));
    const parsed = valid.map((p) => JSON.parse(p) as VerificationProof);

    const tally = new Map<string, { count: number; proof: VerificationProof }>();
    for (const p of parsed) {
      const key = `${p.status}:${p.slot}`;
      const entry = tally.get(key) ?? { count: 0, proof: p };
      entry.count++;
      tally.set(key, entry);
    }

    for (const { count, proof } of tally.values()) {
      if (count >= minProofs) {
        return { settled: true, status: proof.status, slot: proof.slot, proofCount: count };
      }
    }

    return { settled: false, proofCount: valid.length };
  }
}
