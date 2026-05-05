export { FernlinkClient } from "./client.js";
export { SimulatedPeer } from "./peer.js";
export { WebBluetoothPeer } from "./web-peer.js";
export { evaluate } from "./consensus.js";
export { verifyProof, signProof, generateKeypair, keypairFromSeed, bytesToHex, hexToBytes } from "./crypto.js";
export { getSignatureStatus } from "./rpc.js";
export { compress, decompress, negotiateCodec, SUPPORTED_CODECS } from "./compression.js";
export type {
  CompressionCodec,
  FernlinkClientOptions,
  FernlinkPeer,
  VerifyOptions,
  VerificationRequest,
  VerificationProof,
  ConsensusResult,
  PeerInfo,
  Commitment,
  TxStatus,
} from "./types.js";
