#!/usr/bin/env node
/**
 * run-peripheral
 *
 * Run this on the device that will ACT AS A VERIFIER in the mesh.
 * It advertises the Fernlink BLE service, waits for a VerificationRequest
 * from a nearby central, queries Solana devnet, signs the proof, and
 * sends it back over BLE.
 *
 * Usage:
 *   npm run peripheral
 *
 * On macOS: Bluetooth permission required. Run from a terminal with BT access.
 */

import nacl from "tweetnacl";
import { v4 as uuidv4 } from "uuid";
import { FernlinkPeripheral } from "./peripheral.js";

const RPC = "https://api.devnet.solana.com";
const keypair = nacl.sign.keyPair();

function bytesToHex(b: Uint8Array) {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

type TxStatus = "confirmed" | "failed" | "unknown";

async function queryRpc(txSig: string): Promise<{ status: TxStatus; slot: number }> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "getSignatureStatuses",
      params: [[txSig], { searchTransactionHistory: true }],
    }),
  });
  const json = await res.json() as { result?: { value: Array<{ slot: number; err?: unknown } | null> } };
  const value = json.result?.value?.[0];
  if (!value) return { status: "unknown", slot: 0 };
  return { status: value.err ? "failed" : "confirmed", slot: value.slot };
}

function buildSignableBytes(txSig: string, status: TxStatus, slot: number, verifierPk: string) {
  const enc = new TextEncoder();
  const txBytes = enc.encode(txSig);
  const pkBytes = Buffer.from(verifierPk, "hex");
  const statusByte = status === "confirmed" ? 0 : status === "failed" ? 1 : 2;
  const buf = new Uint8Array(txBytes.length + 1 + 8 + 8 + 2 + 32);
  let off = 0;
  buf.set(txBytes, off); off += txBytes.length;
  buf[off++] = statusByte;
  const dv = new DataView(buf.buffer, off);
  dv.setBigUint64(0, BigInt(slot), true);   off += 8;
  dv.setBigUint64(8, BigInt(0), true);       off += 8;
  dv.setUint16(16, 0, true);                 off += 2;
  buf.set(pkBytes.slice(0, 32), off);
  return buf;
}

const peripheral = new FernlinkPeripheral("Fernlink Verifier");
const verifierPk = bytesToHex(keypair.publicKey);

console.log("\n\x1b[32m\x1b[1m[Fernlink Peripheral]\x1b[0m");
console.log(`  Verifier public key: ${verifierPk.slice(0, 24)}…`);
console.log("  Waiting for Bluetooth to power on…\n");

peripheral.on("stateChange", (state: string) => {
  console.log(`  BLE state: ${state}`);
  if (state === "poweredOn") {
    console.log("  \x1b[32m✓\x1b[0m Advertising Fernlink service — waiting for central to connect…");
  }
});

peripheral.on("accept", (address: string) => {
  console.log(`  \x1b[36m→\x1b[0m Central connected: ${address}`);
});

peripheral.on("request", async (payload: Buffer) => {
  let req: { txSignature: string; commitment: string };
  try {
    req = JSON.parse(payload.toString());
  } catch {
    console.error("  malformed request — ignoring");
    return;
  }

  console.log(`\n  \x1b[36m→\x1b[0m VerificationRequest received`);
  console.log(`    tx_signature: ${req.txSignature}`);
  console.log(`    commitment  : ${req.commitment}`);
  console.log("  Querying Solana devnet…");

  const { status, slot } = await queryRpc(req.txSignature);
  const msg = buildSignableBytes(req.txSignature, status, slot, verifierPk);
  const sig = nacl.sign.detached(msg, keypair.secretKey);

  const proof = {
    messageId: uuidv4(),
    txSignature: req.txSignature,
    status, slot, blockTime: 0, errorCode: 0,
    verifierPublicKey: verifierPk,
    signature: bytesToHex(sig),
    timestampMs: Date.now(),
  };

  peripheral.sendProof(proof);
  console.log(`  \x1b[32m✓\x1b[0m Proof sent — status: \x1b[32m${status}\x1b[0m  slot: ${slot}`);
});

process.on("SIGINT", () => {
  peripheral.stop();
  process.exit(0);
});
