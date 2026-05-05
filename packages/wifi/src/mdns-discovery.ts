import { EventEmitter } from "node:events";
import Bonjour from "bonjour-service";

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

  private bonjour: Bonjour;
  private browser: ReturnType<Bonjour["find"]> | null = null;
  private service: ReturnType<Bonjour["publish"]> | null = null;

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
    this.browser.on("up", (service) => {
      const pk = (service.txt as Record<string, string>)?.pk;
      if (!pk) return;
      const host = service.addresses?.[0] ?? service.host;
      this.emit("peer", { host, port: service.port, name: service.name, pk } as WifiPeerInfo);
    });
    this.browser.on("down", (service) => {
      this.emit("lost", service.name);
    });
  }

  stop(): void {
    this.browser?.stop();
    this.service?.stop();
    this.bonjour.destroy();
  }
}
