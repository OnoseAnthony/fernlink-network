import { v4 as uuidv4 } from "uuid";
import type { FernlinkPeer, PeerInfo, VerificationProof, VerificationRequest } from "@fernlink/sdk";
import { MdnsDiscovery, type WifiPeerInfo } from "./mdns-discovery.js";
import { TcpClient } from "./tcp-client.js";
import { TcpServer } from "./tcp-server.js";
import { signProof, generateKeypair, verifyProof } from "@fernlink/sdk";
import { getSignatureStatus } from "@fernlink/sdk";

/**
 * A WiFi/TCP Fernlink peer for Node.js desktop environments.
 *
 * Implements the FernlinkPeer interface so it can be passed directly to
 * FernlinkClient.addPeer(), alongside SimulatedPeer and WebBluetoothPeer.
 *
 * When handleRequest() is called, the request is broadcast to all TCP-connected
 * peers over LAN. Incoming proofs are forwarded to registered onProof() handlers.
 *
 * Usage:
 * ```typescript
 * const peer = new WifiPeer({ rpcEndpoint: "https://api.mainnet-beta.solana.com" });
 * await peer.start();
 * client.addPeer(peer);
 * ```
 */
export class WifiPeer implements FernlinkPeer {
  readonly info: PeerInfo;

  private server     = new TcpServer();
  private client     = new TcpClient();
  private discovery  = new MdnsDiscovery();
  private keypair    = generateKeypair();
  private proofHandlers: Array<(proof: VerificationProof) => void> = [];
  private rpcEndpoint: string;
  private localPubKey: string;
  private started = false;

  constructor(opts: { rpcEndpoint: string }) {
    this.rpcEndpoint = opts.rpcEndpoint;
    this.localPubKey = Buffer.from(this.keypair.publicKey).toString("hex");
    this.info = {
      id:          uuidv4(),
      publicKey:   this.localPubKey,
      rpcEndpoint: this.rpcEndpoint,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;
    await this.server.start();

    // Incoming requests from remote peers → verify locally and send proof back
    this.server.on("request", (payload: Buffer) => {
      this.handleIncomingRequest(payload).catch(() => {});
    });

    // Incoming proofs from remote peers → forward to FernlinkClient
    this.server.on("proof",   (payload: Buffer) => this.forwardProof(payload));
    this.client.on("proof",   (payload: Buffer) => this.forwardProof(payload));

    // mDNS: advertise ourselves and discover peers
    this.discovery.advertise(this.server.port, this.localPubKey);
    this.discovery.browse();
    this.discovery.on("peer", (peerInfo: WifiPeerInfo) => {
      this.onPeerDiscovered(peerInfo).catch(() => {});
    });

    this.started = true;
  }

  stop(): void {
    this.server.stop();
    this.client.disconnectAll();
    this.discovery.stop();
    this.started = false;
  }

  get connectedPeerCount(): number {
    return this.server.connectedCount + this.client.connectedCount;
  }

  // ── FernlinkPeer ─────────────────────────────────────────────────────────

  onProof(handler: (proof: VerificationProof) => void): void {
    this.proofHandlers.push(handler);
  }

  async handleRequest(req: VerificationRequest): Promise<void> {
    const payload = Buffer.from(JSON.stringify(req));
    this.client.sendRequest(payload);
    this.server.sendProof(payload);  // also broadcast to server-side connections
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async handleIncomingRequest(payload: Buffer): Promise<void> {
    try {
      const req = JSON.parse(payload.toString()) as VerificationRequest;
      const status = await getSignatureStatus(this.rpcEndpoint, req.txSignature);
      const proof = signProof(
        this.keypair,
        req.txSignature,
        status.status,
        status.slot,
        status.blockTime,
        0,
      );
      const proofBuf = Buffer.from(JSON.stringify(proof));
      this.server.sendProof(proofBuf);
      this.client.sendRequest(proofBuf);
      this.forwardProof(proofBuf);
    } catch {
      // No internet or parse error — TTL decrement forwarding handled externally
    }
  }

  private forwardProof(payload: Buffer): void {
    try {
      const proof = JSON.parse(payload.toString()) as VerificationProof;
      if (!verifyProof(proof)) return;
      this.proofHandlers.forEach((h) => h(proof));
    } catch { /* ignore malformed */ }
  }

  private async onPeerDiscovered(peerInfo: WifiPeerInfo): Promise<void> {
    // Same deterministic connection rule: lower pubkey connects
    if (this.localPubKey < peerInfo.pk) {
      await this.client.connect(peerInfo.host, peerInfo.port).catch(() => {});
    }
    // else: wait for the other side to connect to our TcpServer
  }
}
