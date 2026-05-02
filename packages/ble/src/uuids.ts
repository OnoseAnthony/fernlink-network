/**
 * Fernlink BLE service and characteristic UUIDs.
 * The 128-bit base UUID encodes "FERN" in the first segment.
 *
 * Devices advertising this service UUID are Fernlink mesh nodes.
 * noble/bleno expect lowercase hex without hyphens for 128-bit UUIDs.
 */

export const FERNLINK_SERVICE_UUID        = "fern000000001000800000805f9b34fb";

/** Write-only — originator sends a VerificationRequest here */
export const CHARACTERISTIC_REQUEST_UUID  = "fern000100001000800000805f9b34fb";

/** Notify — verifier emits signed VerificationProofs here */
export const CHARACTERISTIC_PROOF_UUID    = "fern000200001000800000805f9b34fb";

/** Read — peer advertises capabilities (protocol version, commitment support) */
export const CHARACTERISTIC_STATUS_UUID   = "fern000300001000800000805f9b34fb";

/** Maximum bytes per BLE packet after ATT overhead. */
export const BLE_MTU = 512;

/** Fragmentation header: 1 byte index + 1 byte total */
export const FRAG_HEADER_SIZE = 2;

export const MAX_FRAGMENT_PAYLOAD = BLE_MTU - FRAG_HEADER_SIZE;
