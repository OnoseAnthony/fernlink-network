import nacl from "tweetnacl";
import { v4 as uuidv4 } from "uuid";
import { FernlinkCentral, DiscoveredPeer, ProofEvent } from "./central.js";

type TxStatus = "confirmed" | "failed" | "unknown";

interface VerificationProof {
  messageId: string;
  txSignature: string;
  status: TxStatus;
  slot: number;
  blockTime: number;
  errorCode: number;
  verifierPublicKey: string;
  signature: string;
  timestampMs: number;
}

interface VerificationRequest {
  txSignature: string;
  commitment: string;
  timeoutMs: number;
}

type ProofHandler = (proof: VerificationProof) => void;

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

async function queryRpc(rpcEndpoint: string, txSig: string): Promise<{ status: TxStatus; slot: number }> {
  const res = await fetch(rpcEndpoint, {
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

function buildSignableBytes(
  txSig: string, status: TxStatus, slot: number,
  blockTime: number, errorCode: number, verifierPk: string
): Uint8Array {
  const enc = new TextEncoder();
  const txBytes = enc.encode(txSig);
  const pkBytes = hexToBytes(verifierPk);
  const statusByte = status === "confirmed" ? 0 : status === "failed" ? 1 : 2;
  const buf = new Uint8Array(txBytes.length + 1 + 8 + 8 + 2 + 32);
  let off = 0;
  buf.set(txBytes, off); off += txBytes.length;
  buf[off++] = statusByte;
  const dv = new DataView(buf.buffer, off);
  dv.setBigUint64(0, BigInt(slot), true);      off += 8;
  dv.setBigUint64(8, BigInt(blockTime), true); off += 8;
  dv.setUint16(16, errorCode, true);
  buf.set(pkBytes.slice(0, 32), off + 2);
  return buf;
}

/**
 * BlePeer connects to a real nearby Fernlink peripheral over BLE,
 * sends VerificationRequests, and receives signed proofs back.
 *
 * Mirrors the SimulatedPeer interface from @fernlink/sdk so it is a
 * drop-in replacement — no changes to FernlinkClient required.
 */
export class BlePeer {
  readonly info: { id: string; publicKey: string; rpcEndpoint: string };
  private keypair = nacl.sign.keyPair();
  private handlers: ProofHandler[] = [];
  private central: FernlinkCentral;
  private sendRequest: ((req: object) => Promise<void>) | null = null;
  private connected = false;

  constructor(private readonly rpcEndpoint: string) {
    this.info = {
      id: uuidv4(),
      publicKey: bytesToHex(this.keypair.publicKey),
      rpcEndpoint,
    };
    this.central = new FernlinkCentral();
  }

  onProof(handler: ProofHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Scan for the nearest Fernlink peripheral and connect to it.
   * Resolves once the first peer is found and connected.
   */
  async connect(timeoutMs = 10_000): Promise<DiscoveredPeer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.central.stopScan();
        reject(new Error("BLE scan timed out — no Fernlink peers found nearby"));
      }, timeoutMs);

      this.central.on("peer", async (peer: DiscoveredPeer) => {
        clearTimeout(timer);
        this.central.stopScan();

        this.central.on("proof", (event: ProofEvent) => {
          try {
            const proof: VerificationProof = JSON.parse(event.payload.toString());
            for (const h of this.handlers) h(proof);
          } catch { /* malformed proof — ignore */ }
        });

        this.sendRequest = await this.central.connect(peer.id);
        this.connected = true;
        resolve(peer);
      });

      this.central.scan();
    });
  }

  /**
   * Handle an outgoing VerificationRequest.
   *
   * In local/sim mode (no BLE connection): queries RPC directly and
   * emits a signed proof — identical to SimulatedPeer behaviour.
   *
   * In BLE mode (connected peripheral): forwards the request over BLE
   * and the peripheral's response comes back via the proof handler.
   */
  async handleRequest(req: VerificationRequest): Promise<void> {
    if (this.connected && this.sendRequest) {
      await this.sendRequest(req);
    } else {
      // Fallback: behave like SimulatedPeer when no BLE peer is nearby
      try {
        const { status, slot } = await queryRpc(this.rpcEndpoint, req.txSignature);
        const verifierPk = bytesToHex(this.keypair.publicKey);
        const msg = buildSignableBytes(req.txSignature, status, slot, 0, 0, verifierPk);
        const sig = nacl.sign.detached(msg, this.keypair.secretKey);
        const proof: VerificationProof = {
          messageId: uuidv4(),
          txSignature: req.txSignature,
          status, slot, blockTime: 0, errorCode: 0,
          verifierPublicKey: verifierPk,
          signature: bytesToHex(sig),
          timestampMs: Date.now(),
        };
        for (const h of this.handlers) h(proof);
      } catch { /* peer couldn't verify */ }
    }
  }

  disconnect(): void {
    if (this.connected) {
      this.central.disconnect(this.info.id).catch(() => {});
      this.connected = false;
    }
  }
}
