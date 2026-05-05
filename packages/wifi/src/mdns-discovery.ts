import { EventEmitter } from "node:events";
// bonjour-service has no default export in ESM — import as namespace
import * as BonjourModule from "bonjour-service";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Bonjour = (BonjourModule as any).default ?? BonjourModule;

export interface WifiPeerInfo {
  host: string;
  port: number;
  name: string;
  pk:   string;
}

/**
 * Advertises and browses for _fernlink._tcp services via mDNS (Bonjour/Avahi).
 *
 * On Linux, requires `avahi-daemon` to be running:
 *   sudo apt-get install avahi-daemon && sudo systemctl start avahi-daemon
 *
 * Emits "peer" when a new Fernlink node is discovered.
 * Emits "lost" when a previously seen node disappears.
 */
export class MdnsDiscovery extends EventEmitter {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bonjour: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private browser: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private service: any = null;

  constructor() {
    super();
    this.bonjour = new Bonjour();
  }

  advertise(port: number, localPubKey: string): void {
    this.service = this.bonjour.publish({
      name: `fernlink-${localPubKey.slice(0, 8)}`,
      type: "fernlink",
      port,
      txt:  { pk: localPubKey, v: "1" },
    });
  }

  browse(): void {
    this.browser = this.bonjour.find({ type: "fernlink" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.browser.on("up", (service: any) => {
      const pk = (service.txt as Record<string, string>)?.pk;
      if (!pk) return;
      const host = service.addresses?.[0] ?? service.host;
      this.emit("peer", { host, port: service.port, name: service.name, pk } as WifiPeerInfo);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.browser.on("down", (service: any) => {
      this.emit("lost", service.name);
    });
  }

  stop(): void {
    this.browser?.stop();
    this.service?.stop();
    this.bonjour.destroy();
  }
}
