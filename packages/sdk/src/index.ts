export { FernlinkClient } from "./client.js";
export { SimulatedPeer } from "./peer.js";
export { evaluate } from "./consensus.js";
export { verifyProof, signProof, generateKeypair, keypairFromSeed, bytesToHex, hexToBytes } from "./crypto.js";
export { getSignatureStatus } from "./rpc.js";
export type {
  FernlinkClientOptions,
  VerifyOptions,
  VerificationRequest,
  VerificationProof,
  ConsensusResult,
  PeerInfo,
  Commitment,
  TxStatus,
} from "./types.js";
