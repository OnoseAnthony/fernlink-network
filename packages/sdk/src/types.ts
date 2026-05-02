export type Commitment = "processed" | "confirmed" | "finalized";

export type TxStatus = "confirmed" | "failed" | "unknown";

export interface VerificationRequest {
  messageId: string;
  txSignature: string;
  commitment: Commitment;
  timeoutMs: number;
  originatorPublicKey: string;
  timestampMs: number;
  ttl: number;
}

export interface VerificationProof {
  messageId: string;
  txSignature: string;
  status: TxStatus;
  slot: number;
  blockTime: number;
  errorCode: number;
  verifierPublicKey: string;
  /** Hex-encoded Ed25519 signature over the proof payload. */
  signature: string;
  timestampMs: number;
}

export interface ConsensusResult {
  settled: boolean;
  status?: TxStatus;
  slot?: number;
  blockTime?: number;
  proofCount: number;
}

export interface FernlinkClientOptions {
  /** Solana RPC endpoint to use when this node acts as a verifier. */
  rpcEndpoint: string;
  /** Ed25519 keypair seed (32 bytes). Generated automatically if omitted. */
  keypairSeed?: Uint8Array;
  /** Minimum number of matching proofs required before settling. Default: 2 */
  minProofs?: number;
}

export interface VerifyOptions {
  commitment?: Commitment;
  /** Milliseconds to wait for mesh proofs before falling back to direct RPC. */
  timeoutMs?: number;
  minProofs?: number;
}

export interface PeerInfo {
  id: string;
  publicKey: string;
  rpcEndpoint: string;
}
