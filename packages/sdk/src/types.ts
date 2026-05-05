export type Commitment = "processed" | "confirmed" | "finalized";

export type TxStatus = "confirmed" | "failed" | "unknown";

/** Wire compression codec. Defaults to "none" for backwards compatibility. */
export type CompressionCodec = "none" | "lz4" | "zstd";

export const PROTOCOL_VERSION = 2;

export interface VerificationRequest {
  messageId: string;
  txSignature: string;
  commitment: Commitment;
  timeoutMs: number;
  originatorPublicKey: string;
  timestampMs: number;
  ttl: number;
  compression?: CompressionCodec;
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
  compression?: CompressionCodec;
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
  /** Compression codec to use when sending messages. Default: "lz4" */
  compression?: CompressionCodec;
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

/** Common interface implemented by SimulatedPeer and WebBluetoothPeer. */
export interface FernlinkPeer {
  info: PeerInfo;
  /** Codecs this peer can decompress. Always includes "none". */
  supportedCodecs?: CompressionCodec[];
  onProof(handler: (proof: VerificationProof) => void): void;
  handleRequest(req: VerificationRequest): Promise<void>;
}
