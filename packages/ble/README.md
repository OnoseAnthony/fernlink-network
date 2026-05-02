# @fernlink/ble

Real BLE transport layer for the Fernlink mesh verification network.

Implements the Fernlink GATT profile over Bluetooth Low Energy using:
- **`@abandonware/noble`** — central role (scanning, connecting, sending requests)
- **`@abandonware/bleno`** — peripheral role (advertising, GATT server, sending proofs)

## Architecture

```
Device A (needs verification)          Device B (has RPC access)
┌─────────────────────────┐            ┌──────────────────────────┐
│  FernlinkCentral        │            │  FernlinkPeripheral      │
│  - scans for peers      │            │  - advertises service    │
│  - writes REQUEST char  │───BLE─────▶│  - receives REQUEST      │
│  - subscribes to PROOF  │            │  - queries Solana RPC    │
│  - verifies signature   │◀───BLE─────│  - signs + notifies PROOF│
└─────────────────────────┘            └──────────────────────────┘
```

## BLE GATT Profile

| UUID | Type | Role |
|---|---|---|
| `fern0000-…` | Service | Fernlink mesh service |
| `fern0001-…` | Characteristic (Write) | VerificationRequest |
| `fern0002-…` | Characteristic (Notify) | VerificationProof |
| `fern0003-…` | Characteristic (Read) | Peer status/capabilities |

Messages larger than the BLE MTU (512 bytes) are split into fragments with a 2-byte header `[index, total]` and reassembled on the receiving side.

## Running the two-device demo

**Terminal 1 — the verifier (peripheral):**
```bash
npm run peripheral
```

**Terminal 2 — the requester (central):**
```bash
npm run central
```

The central scans for Fernlink peripherals, connects, sends a VerificationRequest for a real devnet transaction, and receives a cryptographically signed proof back over BLE.

## Platform support

| Platform | Central (scan) | Peripheral (advertise) |
|---|---|---|
| macOS (Node.js ≤ 18) | ✓ | ✓ |
| macOS (Node.js ≥ 20) | ✓ | build issues (use mobile) |
| Linux | ✓ | ✓ |
| Android (React Native) | ✓ | ✓ via `react-native-ble-plx` |
| iOS (React Native) | ✓ | ✓ via `react-native-ble-plx` |

## BlePeer — drop-in replacement for SimulatedPeer

```typescript
import { BlePeer } from "@fernlink/ble";

const peer = new BlePeer("https://api.mainnet-beta.solana.com");

// Connect to the nearest Fernlink peripheral over BLE
const discovered = await peer.connect(10_000);
console.log(`Connected to ${discovered.name} at ${discovered.address}`);

// Now use it exactly like SimulatedPeer in FernlinkClient
client.addPeer(peer);
```

When no BLE peripheral is nearby, `BlePeer` falls back to direct RPC — identical behaviour to `SimulatedPeer`.
