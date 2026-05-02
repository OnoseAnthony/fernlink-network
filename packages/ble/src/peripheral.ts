import bleno from "@abandonware/bleno";
import { EventEmitter } from "events";
import {
  FERNLINK_SERVICE_UUID,
  CHARACTERISTIC_REQUEST_UUID,
  CHARACTERISTIC_PROOF_UUID,
  CHARACTERISTIC_STATUS_UUID,
} from "./uuids.js";
import { fragment, Reassembler } from "./fragmentation.js";

const { Characteristic, PrimaryService } = bleno;

export interface PeripheralEvents {
  request: (payload: Buffer) => void;
  stateChange: (state: string) => void;
  accept: (address: string) => void;
}

/**
 * FernlinkPeripheral advertises the Fernlink GATT service and accepts
 * VerificationRequest writes from connected central devices.
 *
 * Callers subscribe to "request" events to handle incoming requests,
 * then call sendProof() to notify the connected central with the result.
 */
export class FernlinkPeripheral extends EventEmitter {
  private proofUpdateValueCallback: ((data: Buffer) => void) | null = null;
  private reassembler = new Reassembler();

  constructor(private readonly deviceName = "Fernlink Node") {
    super();
    this.setupBleno();
  }

  private setupBleno(): void {
    bleno.on("stateChange", (state: string) => {
      this.emit("stateChange", state);
      if (state === "poweredOn") {
        this.startAdvertising();
      } else {
        bleno.stopAdvertising();
      }
    });

    bleno.on("accept", (address: string) => {
      this.emit("accept", address);
    });

    (bleno as any).on("advertisingStart", (err?: Error) => {
      if (err) {
        console.error("[peripheral] advertising start error:", err.message);
        return;
      }
      this.setupServices();
    });
  }

  private startAdvertising(): void {
    bleno.startAdvertising(this.deviceName, [FERNLINK_SERVICE_UUID]);
  }

  private setupServices(): void {
    const self = this;

    // REQUEST characteristic — write-only, central sends VerificationRequest here
    const requestChar = new Characteristic({
      uuid: CHARACTERISTIC_REQUEST_UUID,
      properties: ["write", "writeWithoutResponse"],
      onWriteRequest(data: Buffer, _offset: number, _withoutResponse: boolean, callback: (result: number) => void) {
        const complete = self.reassembler.push(data);
        if (complete) {
          self.reassembler.reset();
          self.emit("request", complete);
        }
        callback(Characteristic.RESULT_SUCCESS);
      },
    });

    // PROOF characteristic — notify, peripheral pushes signed proofs here
    const proofChar = new Characteristic({
      uuid: CHARACTERISTIC_PROOF_UUID,
      properties: ["notify"],
      onSubscribe(_maxValueSize: number, updateValueCallback: (data: Buffer) => void) {
        self.proofUpdateValueCallback = updateValueCallback;
      },
      onUnsubscribe() {
        self.proofUpdateValueCallback = null;
      },
    });

    // STATUS characteristic — read-only, exposes protocol version + capabilities
    const statusChar = new Characteristic({
      uuid: CHARACTERISTIC_STATUS_UUID,
      properties: ["read"],
      onReadRequest(_offset: number, callback: (result: number, data?: Buffer) => void) {
        const status = Buffer.from(
          JSON.stringify({ version: 1, commitment: ["confirmed", "finalized"] })
        );
        callback(Characteristic.RESULT_SUCCESS, status);
      },
    });

    bleno.setServices([
      new PrimaryService({
        uuid: FERNLINK_SERVICE_UUID,
        characteristics: [requestChar, proofChar, statusChar],
      }),
    ]);
  }

  /**
   * Push a signed VerificationProof to the connected central.
   * The proof is serialised to JSON and fragmented if needed.
   */
  sendProof(proof: object): void {
    if (!this.proofUpdateValueCallback) return;
    const payload = Buffer.from(JSON.stringify(proof));
    const fragments = fragment(payload);
    for (const frag of fragments) {
      this.proofUpdateValueCallback(frag);
    }
  }

  stop(): void {
    bleno.stopAdvertising();
    bleno.disconnect();
  }
}
