import { v4 as uuidv4 } from "uuid";
import { generateKeypair, keypairFromSeed, signProof, verifyProof, bytesToHex } from "./crypto.js";
import { evaluate } from "./consensus.js";
import { getSignatureStatus } from "./rpc.js";
import { SimulatedPeer } from "./peer.js";
import { negotiateCodec, SUPPORTED_CODECS } from "./compression.js";
import type {
  CompressionCodec,
  FernlinkClientOptions,
  FernlinkPeer,
  VerifyOptions,
  VerificationRequest,
  VerificationProof,
  ConsensusResult,
  PeerInfo,
} from "./types.js";

export class FernlinkClient {
  private keypair;
  private rpcEndpoint: string;
  private minProofs: number;
  private compression: CompressionCodec;
  private peers: FernlinkPeer[] = [];
  private started = false;

  constructor(opts: FernlinkClientOptions) {
    this.rpcEndpoint = opts.rpcEndpoint;
    this.minProofs   = opts.minProofs ?? 2;
    this.compression = opts.compression ?? "lz4";
    this.keypair     = opts.keypairSeed
      ? keypairFromSeed(opts.keypairSeed)
      : generateKeypair();
  }

  get publicKey(): string {
    return bytesToHex(this.keypair.publicKey);
  }

  /**
   * Start the Fernlink mesh. In the real implementation this boots BLE
   * scanning and advertising; here it initializes the simulated transport.
   */
  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
    this.peers = [];
  }

  /**
   * Register a simulated peer (stand-in for a BLE neighbour device).
   * Each peer will independently query RPC and return a signed proof.
   */
  addPeer(peer: FernlinkPeer): void {
    this.peers.push(peer);
  }

  connectedPeers(): PeerInfo[] {
    return this.peers.map(p => p.info);
  }

  /**
   * Verify a Solana transaction through the mesh network.
   *
   * Broadcasts a VerificationRequest to all connected peers, collects
   * their signed proofs, applies consensus rules, and settles once
   * minProofs matching proofs arrive or the timeout elapses.
   *
   * Falls back to a direct RPC call if mesh proofs don't arrive in time.
   */
  async verifyTransaction(
    txSignature: string,
    opts: VerifyOptions = {}
  ): Promise<ConsensusResult & { proofs: VerificationProof[] }> {
    if (!this.started) throw new Error("Call fernlink.start() before verifyTransaction()");

    const commitment = opts.commitment ?? "confirmed";
    const timeoutMs  = opts.timeoutMs  ?? 30_000;
    const minProofs  = opts.minProofs  ?? this.minProofs;

    // Negotiate the best codec each connected peer supports
    const peerCodecs = this.peers.flatMap(p => p.supportedCodecs ?? (["none"] as CompressionCodec[]));
    const codec = negotiateCodec(this.compression, peerCodecs.length ? peerCodecs : SUPPORTED_CODECS);

    const request: VerificationRequest = {
      messageId:           uuidv4(),
      txSignature,
      commitment,
      timeoutMs,
      originatorPublicKey: this.publicKey,
      timestampMs:         Date.now(),
      ttl:                 8,
      compression:         codec,
    };

    const collectedProofs: VerificationProof[] = [];

    const meshResult = await Promise.race([
      this._broadcastAndCollect(request, collectedProofs, minProofs),
      new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
    ]);

    const consensus = evaluate(collectedProofs, minProofs);
    if (consensus.settled) {
      return { ...consensus, proofs: collectedProofs };
    }

    // Fallback: direct RPC query
    const conf = await getSignatureStatus(this.rpcEndpoint, txSignature);
    const fallbackProof = signProof(
      this.keypair,
      txSignature,
      conf.status,
      conf.slot,
      conf.blockTime,
      0
    );
    collectedProofs.push(fallbackProof);

    const fallbackConsensus = evaluate(collectedProofs, 1);
    return { ...fallbackConsensus, proofs: collectedProofs };
  }

  private async _broadcastAndCollect(
    request: VerificationRequest,
    proofs: VerificationProof[],
    minProofs: number
  ): Promise<void> {
    return new Promise(resolve => {
      let settled = false;

      const onProof = (proof: VerificationProof) => {
        if (!verifyProof(proof)) return;
        proofs.push(proof);
        const result = evaluate(proofs, minProofs);
        if (result.settled && !settled) {
          settled = true;
          resolve();
        }
      };

      for (const peer of this.peers) {
        peer.onProof(onProof);
        peer.handleRequest(request);
      }
    });
  }
}
