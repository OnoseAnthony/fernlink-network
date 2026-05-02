#!/usr/bin/env node
/**
 * run-central
 *
 * Run this on the device that NEEDS TO VERIFY a transaction.
 * It scans for a nearby Fernlink peripheral, sends a VerificationRequest,
 * waits for a signed VerificationProof, verifies the signature, and
 * prints the consensus result.
 *
 * Usage:
 *   npm run central
 *
 * Requires a peripheral to be running nearby (npm run peripheral on another machine).
 */

import nacl from "tweetnacl";
import { FernlinkCentral } from "./central.js";
import type { DiscoveredPeer, ProofEvent } from "./central.js";
import { Reassembler } from "./fragmentation.js";

const RPC = "https://api.devnet.solana.com";

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m",
  green: "\x1b[32m", cyan: "\x1b[36m",
  blue: "\x1b[34m",  dim: "\x1b[2m", yellow: "\x1b[33m",
};

function bytesToHex(b: Uint8Array) {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string) { return Uint8Array.from(Buffer.from(hex, "hex")); }

type TxStatus = "confirmed" | "failed" | "unknown";

function verifyProof(proof: {
  txSignature: string; status: TxStatus; slot: number; blockTime: number;
  errorCode: number; verifierPublicKey: string; signature: string;
}): boolean {
  try {
    const enc = new TextEncoder();
    const txBytes = enc.encode(proof.txSignature);
    const pkBytes = hexToBytes(proof.verifierPublicKey);
    const statusByte = proof.status === "confirmed" ? 0 : proof.status === "failed" ? 1 : 2;
    const buf = new Uint8Array(txBytes.length + 1 + 8 + 8 + 2 + 32);
    let off = 0;
    buf.set(txBytes, off); off += txBytes.length;
    buf[off++] = statusByte;
    const dv = new DataView(buf.buffer, off);
    dv.setBigUint64(0, BigInt(proof.slot), true);      off += 8;
    dv.setBigUint64(8, BigInt(proof.blockTime), true); off += 8;
    dv.setUint16(16, proof.errorCode, true);            off += 2;
    buf.set(pkBytes.slice(0, 32), off);
    return nacl.sign.detached.verify(buf, hexToBytes(proof.signature), pkBytes);
  } catch { return false; }
}

async function getRecentDevnetTx(): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "getSignaturesForAddress",
      params: ["11111111111111111111111111111111", { limit: 1 }],
    }),
  });
  const json = await res.json() as { result: Array<{ signature: string }> };
  return json.result[0].signature;
}

async function main() {
  console.log(`\n${C.green}${C.bold}[Fernlink Central]${C.reset}`);
  console.log("  Fetching a recent devnet transaction to verify…");

  const txSignature = await getRecentDevnetTx();
  console.log(`  ${C.dim}→${C.reset} tx: ${txSignature}`);

  const central = new FernlinkCentral();
  const proofs: object[] = [];

  central.on("peer", async (peer: DiscoveredPeer) => {
    console.log(`\n  ${C.cyan}→${C.reset} Peer discovered: ${C.bold}${peer.name}${C.reset}`);
    console.log(`    address: ${peer.address}  rssi: ${peer.rssi} dBm`);
    console.log("  Connecting…");

    central.stopScan();

    try {
      const send = await central.connect(peer.id);
      console.log(`  ${C.green}✓${C.reset} Connected — sending VerificationRequest`);

      central.on("proof", (event: ProofEvent) => {
        const proof = JSON.parse(event.payload.toString());
        const valid = verifyProof(proof);
        proofs.push(proof);

        console.log(`\n  ${C.cyan}Proof received from peer${C.reset}`);
        console.log(`    status    : ${proof.status === "confirmed" ? C.green : C.yellow}${proof.status}${C.reset}`);
        console.log(`    slot      : ${proof.slot}`);
        console.log(`    sig_valid : ${valid ? `${C.green}true${C.reset}` : `${C.yellow}false${C.reset}`}`);
        console.log(`    signature : ${proof.signature.slice(0, 40)}…`);

        if (valid) {
          console.log(`\n  ${C.green}${C.bold}✓ Transaction verified via BLE mesh${C.reset}`);
          console.log(`  ${C.dim}Originator used 0 RPC credits.${C.reset}\n`);
        }
      });

      await send({ txSignature, commitment: "confirmed", timeoutMs: 15000 });
      console.log("  Request sent — waiting for proof…");
    } catch (e: unknown) {
      console.error("  Connection failed:", e instanceof Error ? e.message : e);
    }
  });

  console.log("  Scanning for Fernlink peripherals…");
  central.scan();

  setTimeout(() => {
    console.log(`\n  ${C.yellow}⚠${C.reset}  No peers found within 15s. Make sure a peripheral is running nearby.`);
    process.exit(0);
  }, 15_000);
}

main().catch(err => { console.error(err); process.exit(1); });
