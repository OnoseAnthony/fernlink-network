import { v4 as uuidv4 } from "uuid";
import { generateKeypair, signProof, bytesToHex } from "./crypto.js";
import { getSignatureStatus } from "./rpc.js";
import type { VerificationRequest, VerificationProof, PeerInfo } from "./types.js";

type ProofHandler = (proof: VerificationProof) => void;

/**
 * SimulatedPeer models a Fernlink mesh node in-process.
 * In production this would be a BLE/WiFi-Direct peer; here it
 * runs locally to demonstrate and test the full protocol flow.
 */
export class SimulatedPeer {
  readonly info: PeerInfo;
  private keypair = generateKeypair();
  private handlers: ProofHandler[] = [];

  constructor(rpcEndpoint: string) {
    this.info = {
      id: uuidv4(),
      publicKey: bytesToHex(this.keypair.publicKey),
      rpcEndpoint,
    };
  }

  /**
   * Register a callback to receive proofs this peer produces.
   * Mirrors the BLE NOTIFY characteristic in the real implementation.
   */
  onProof(handler: ProofHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Handle an incoming VerificationRequest: query RPC, sign proof, emit.
   * Mirrors a verification node receiving a BLE REQUEST characteristic write.
   */
  async handleRequest(req: VerificationRequest): Promise<void> {
    if (req.ttl <= 0) return;

    try {
      const conf = await getSignatureStatus(this.info.rpcEndpoint, req.txSignature);
      const proof = signProof(
        this.keypair,
        req.txSignature,
        conf.status,
        conf.slot,
        conf.blockTime,
        0
      );
      for (const h of this.handlers) h(proof);
    } catch {
      // Peer couldn't verify — silently skip (fallback to other peers)
    }
  }
}
