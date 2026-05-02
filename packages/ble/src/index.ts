export { FernlinkPeripheral } from "./peripheral.js";
export { FernlinkCentral } from "./central.js";
export { BlePeer } from "./ble-peer.js";
export { fragment, Reassembler } from "./fragmentation.js";
export {
  FERNLINK_SERVICE_UUID,
  CHARACTERISTIC_REQUEST_UUID,
  CHARACTERISTIC_PROOF_UUID,
  CHARACTERISTIC_STATUS_UUID,
  BLE_MTU,
} from "./uuids.js";
export type { DiscoveredPeer, ProofEvent } from "./central.js";
