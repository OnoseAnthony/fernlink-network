import type { FernlinkClient } from "@fernlink/sdk";
import { WifiPeer } from "./wifi-peer.js";

/**
 * Convenience class that attaches a WiFi/TCP transport to an existing
 * FernlinkClient, adding LAN-local peer discovery via mDNS.
 *
 * ```typescript
 * import { FernlinkClient } from "@fernlink/sdk";
 * import { TransportManager } from "@fernlink/wifi";
 *
 * const client  = new FernlinkClient({ rpcEndpoint: "https://api.mainnet-beta.solana.com" });
 * const manager = new TransportManager(client);
 *
 * await client.start();
 * await manager.start();  // boots WifiPeer and registers it with the client
 *
 * const result = await client.verifyTransaction(txSignature);
 *
 * manager.stop();
 * await client.stop();
 * ```
 */
export class TransportManager {
  private peer: WifiPeer | null = null;

  constructor(
    private readonly client:      FernlinkClient,
    private readonly rpcEndpoint: string,
  ) {}

  /**
   * Create a WifiPeer, start it (binds TCP server + mDNS), and register it
   * with the FernlinkClient. Idempotent — safe to call more than once.
   */
  async start(): Promise<void> {
    if (this.peer) return;
    this.peer = new WifiPeer({ rpcEndpoint: this.rpcEndpoint });
    await this.peer.start();
    this.client.addPeer(this.peer);
  }

  /**
   * Stop the WiFi peer (closes TCP connections and removes mDNS advertisement).
   * The FernlinkClient keeps its peer reference but the peer no longer handles
   * requests, so subsequent verifyTransaction() calls fall back to direct RPC.
   */
  stop(): void {
    this.peer?.stop();
    this.peer = null;
  }

  /** Number of currently connected LAN peers. */
  get connectedPeerCount(): number {
    return this.peer?.connectedPeerCount ?? 0;
  }
}
