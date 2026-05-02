import noble from "@abandonware/noble";
import { EventEmitter } from "events";
import {
  FERNLINK_SERVICE_UUID,
  CHARACTERISTIC_REQUEST_UUID,
  CHARACTERISTIC_PROOF_UUID,
} from "./uuids.js";
import { fragment, Reassembler } from "./fragmentation.js";

export interface DiscoveredPeer {
  id: string;
  address: string;
  name: string;
  rssi: number;
}

export interface ProofEvent {
  peerId: string;
  payload: Buffer;
}

/**
 * FernlinkCentral scans for nearby Fernlink peripherals, connects to them,
 * sends VerificationRequests, and receives signed VerificationProofs.
 */
export class FernlinkCentral extends EventEmitter {
  private scanning = false;
  private peers = new Map<string, noble.Peripheral>();
  private reassemblers = new Map<string, Reassembler>();

  constructor() {
    super();
    noble.on("stateChange", (state: string) => {
      if (state === "poweredOn" && this.scanning) {
        this.startScan();
      }
    });

    noble.on("discover", (peripheral: noble.Peripheral) => {
      this.onDiscover(peripheral);
    });
  }

  /** Begin scanning for Fernlink peripherals. */
  scan(): void {
    this.scanning = true;
    if ((noble as any).state === "poweredOn") {
      this.startScan();
    }
  }

  private startScan(): void {
    noble.startScanning([FERNLINK_SERVICE_UUID], false);
  }

  stopScan(): void {
    this.scanning = false;
    noble.stopScanning();
  }

  private onDiscover(peripheral: noble.Peripheral): void {
    const peer: DiscoveredPeer = {
      id: peripheral.id,
      address: peripheral.address,
      name: peripheral.advertisement?.localName ?? "unknown",
      rssi: peripheral.rssi,
    };

    this.peers.set(peripheral.id, peripheral);
    this.reassemblers.set(peripheral.id, new Reassembler());
    this.emit("peer", peer);
  }

  /**
   * Connect to a discovered peer and return the send function for
   * writing VerificationRequests to its REQUEST characteristic.
   */
  async connect(peerId: string): Promise<(request: object) => Promise<void>> {
    const peripheral = this.peers.get(peerId);
    if (!peripheral) throw new Error(`peer ${peerId} not found`);

    await peripheral.connectAsync();

    const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
      [FERNLINK_SERVICE_UUID],
      [CHARACTERISTIC_REQUEST_UUID, CHARACTERISTIC_PROOF_UUID]
    );

    const requestChar = characteristics.find(c => c.uuid === CHARACTERISTIC_REQUEST_UUID);
    const proofChar   = characteristics.find(c => c.uuid === CHARACTERISTIC_PROOF_UUID);

    if (!requestChar || !proofChar) {
      throw new Error(`peer ${peerId} missing required characteristics`);
    }

    // Subscribe to proof notifications from this peer
    await proofChar.subscribeAsync();
    const reassembler = this.reassemblers.get(peerId)!;

    proofChar.on("data", (data: Buffer) => {
      const complete = reassembler.push(data);
      if (complete) {
        reassembler.reset();
        this.emit("proof", { peerId, payload: complete } as ProofEvent);
      }
    });

    peripheral.on("disconnect", () => {
      this.emit("disconnect", peerId);
    });

    // Return a function the caller uses to send requests to this peer
    return async (request: object) => {
      const payload = Buffer.from(JSON.stringify(request));
      const fragments = fragment(payload);
      for (const frag of fragments) {
        await requestChar.writeAsync(frag, true);
      }
    };
  }

  async disconnect(peerId: string): Promise<void> {
    const peripheral = this.peers.get(peerId);
    if (peripheral) await peripheral.disconnectAsync();
  }
}
