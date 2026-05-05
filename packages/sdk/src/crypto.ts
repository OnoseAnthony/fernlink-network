import nacl from "tweetnacl";
import { v4 as uuidv4 } from "uuid";
import type { VerificationProof, TxStatus } from "./types.js";

export interface Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateKeypair(): Keypair {
  const { publicKey, secretKey } = nacl.sign.keyPair();
  return { publicKey, secretKey };
}

export function keypairFromSeed(seed: Uint8Array): Keypair {
  const { publicKey, secretKey } = nacl.sign.keyPair.fromSeed(seed);
  return { publicKey, secretKey };
}

/**
 * Canonical byte encoding of the fields covered by the Ed25519 signature.
 * txSignature is included as UTF-8 bytes (Solana base58 strings are safe ASCII).
 *
 * NOTE (HIGH-2): The Rust `fernlink-core` stores tx_signature as [u8; 64] and
 * therefore only encodes the first 64 bytes of the base58 string (Solana sigs
 * are 87-88 chars). This means Rust-signed proofs cannot be verified here and
 * vice versa. Resolution requires either (a) changing Rust to use [u8; 88] or
 * a String field, or (b) changing TypeScript to base58-decode. A protocol-level
 * decision is needed before cross-platform verification is deployed.
 */
function proofSignableBytes(
  txSignature: string,
  status: TxStatus,
  slot: number,
  blockTime: number,
  errorCode: number,
  verifierPublicKey: string
): Uint8Array {
  const enc = new TextEncoder();
  const txBytes = enc.encode(txSignature);
  const pkBytes = hexToBytes(verifierPublicKey);
  const statusByte = status === "confirmed" ? 0 : status === "failed" ? 1 : 2;

  // Layout: txSignature (variable) | status (1) | slot (8) | blockTime (8) | errorCode (2) | pubkey (32)
  const buf = new Uint8Array(txBytes.length + 1 + 8 + 8 + 2 + 32);
  let off = 0;
  buf.set(txBytes, off);          off += txBytes.length;
  buf[off++] = statusByte;
  setUint64LE(buf, off, slot);    off += 8;
  setUint64LE(buf, off, blockTime); off += 8;
  setUint16LE(buf, off, errorCode); off += 2;
  buf.set(pkBytes.slice(0, 32), off);
  return buf;
}

export function signProof(
  keypair: Keypair,
  txSignature: string,
  status: TxStatus,
  slot: number,
  blockTime: number,
  errorCode: number
): VerificationProof {
  const verifierPublicKey = bytesToHex(keypair.publicKey);
  const msg = proofSignableBytes(txSignature, status, slot, blockTime, errorCode, verifierPublicKey);
  const sig = nacl.sign.detached(msg, keypair.secretKey);

  return {
    messageId: uuidv4(),
    txSignature,
    status,
    slot,
    blockTime,
    errorCode,
    verifierPublicKey,
    signature: bytesToHex(sig),
    timestampMs: Date.now(),
  };
}

export function verifyProof(proof: VerificationProof): boolean {
  try {
    const msg = proofSignableBytes(
      proof.txSignature,
      proof.status,
      proof.slot,
      proof.blockTime,
      proof.errorCode,
      proof.verifierPublicKey
    );
    const sig = hexToBytes(proof.signature);
    const pk  = hexToBytes(proof.verifierPublicKey);
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}

function setUint64LE(buf: Uint8Array, offset: number, value: number): void {
  const lo = value >>> 0;
  const hi = Math.floor(value / 0x100000000) >>> 0;
  buf[offset]     = lo & 0xff;
  buf[offset + 1] = (lo >>> 8) & 0xff;
  buf[offset + 2] = (lo >>> 16) & 0xff;
  buf[offset + 3] = (lo >>> 24) & 0xff;
  buf[offset + 4] = hi & 0xff;
  buf[offset + 5] = (hi >>> 8) & 0xff;
  buf[offset + 6] = (hi >>> 16) & 0xff;
  buf[offset + 7] = (hi >>> 24) & 0xff;
}

function setUint16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset]     = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex string");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}
