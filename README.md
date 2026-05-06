# Fernlink Network

[![CI — Rust](https://github.com/Fernlink-Protocol/fernlink-network/actions/workflows/rust.yml/badge.svg)](https://github.com/Fernlink-Protocol/fernlink-network/actions/workflows/rust.yml)
[![CI — TypeScript SDK](https://github.com/Fernlink-Protocol/fernlink-network/actions/workflows/sdk.yml/badge.svg)](https://github.com/Fernlink-Protocol/fernlink-network/actions/workflows/sdk.yml)
[![CI — Android](https://github.com/Fernlink-Protocol/fernlink-network/actions/workflows/android.yml/badge.svg)](https://github.com/Fernlink-Protocol/fernlink-network/actions/workflows/android.yml)
[![fernlink-core on crates.io](https://img.shields.io/crates/v/fernlink-core.svg)](https://crates.io/crates/fernlink-core)
[![fernlink-sdk on npm](https://img.shields.io/npm/v/fernlink-sdk.svg)](https://www.npmjs.com/package/fernlink-sdk)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

Fernlink is a decentralized, open-source protocol for peer-to-peer Solana transaction verification. Nearby devices collaborate over BLE, Wi-Fi/TCP, and NFC to share cryptographically signed verification proofs, removing the dependency on centralized RPC infrastructure.

> Full protocol specification: [`whitepaper.md`](./whitepaper.md)  
> Live website: [fernlink.vercel.app](https://fernlink.vercel.app)

---

## The Problem

Every wallet and dApp on Solana polls centralized RPC providers to confirm transactions. At scale this:

- Burns RPC credits for every mobile user and developer
- Fails in low-bandwidth or offline environments
- Creates reliability risk when public RPCs are rate-limited or down

Fernlink lets nearby devices act as verification nodes — peers with internet fetch, sign, and return proofs to devices that can't or don't want to hit RPC directly.

---

## How It Works

1. **Request** — A device broadcasts a lightweight verification request (tx signature + commitment level) over BLE, Wi-Fi/TCP, or NFC.
2. **Verify** — Peers with internet query Solana RPC, build an Ed25519-signed proof, and broadcast it back into the mesh.
3. **Propagate** — Proofs spread via gossip with TTL and UUID deduplication. Two matching proofs settle consensus; conflicting proofs trigger direct RPC fallback.

All proofs are Ed25519-signed. Consensus requires 2+ independent matching proofs. There is no trusted coordinator.

---

## What's Shipped

### Packages

| Package | Language | Registry | Description |
|---|---|---|---|
| [`packages/fernlink-core`](./packages/fernlink-core) | Rust | [crates.io](https://crates.io/crates/fernlink-core) | Ed25519 signing/verification, gossip deduplication, stateless consensus, RPC client |
| [`packages/sdk`](./packages/sdk) | TypeScript | [npm](https://www.npmjs.com/package/fernlink-sdk) | Full SDK: `FernlinkClient`, `SimulatedPeer`, Web Bluetooth peer, consensus, RPC |
| [`packages/demo`](./packages/demo) | TypeScript | [npm](https://www.npmjs.com/package/fernlink-demo) | End-to-end devnet demo CLI (`npx fernlink-demo`) |
| [`packages/android`](./packages/android) | Kotlin + Rust (JNI) | — | Android SDK: BLE GATT service/client, Wi-Fi Direct, NFC bootstrapping, JNI bridge to Rust core |
| [`packages/ios`](./packages/ios) | Swift | — | iOS SDK: CoreBluetooth BLE, Multipeer Connectivity, CoreNFC bootstrapping |
| [`packages/ble`](./packages/ble) | TypeScript | — | Desktop BLE transport (bleno/noble) + hardware-free BLE simulator for CI |
| [`packages/wifi`](./packages/wifi) | TypeScript | — | Wi-Fi/TCP transport with mDNS peer discovery (`_fernlink._tcp.local.`) |
| [`packages/ble-desktop`](./packages/ble-desktop) | Rust | — | Rust desktop binary: BLE + Wi-Fi simultaneously via btleplug/bluer |

### Transports

| Transport | Android | iOS | TypeScript | Rust |
|---|---|---|---|---|
| BLE (GATT) | ✅ Native Kotlin | ✅ CoreBluetooth | ✅ bleno/noble + simulator | ✅ btleplug/bluer |
| Wi-Fi / TCP | ✅ Wi-Fi Direct | ✅ Multipeer Connectivity | ✅ TCP + mDNS | ✅ mdns-sd |
| NFC (bootstrap) | ✅ Android Beam / NFC | ✅ CoreNFC (read-only) | — | — |

All transports support **negotiable LZ4 + zstd wire compression** (Protocol v2). A 1-byte codec prefix wraps each payload; peers advertise supported codecs via the STATUS characteristic. Backwards-compatible with uncompressed v1 messages.

### Protocol

- **Ed25519** throughout — Rust (`ed25519-dalek`), TypeScript (`tweetnacl`), Android via JNI to Rust core, iOS via CryptoKit
- **Wire compression** — negotiable LZ4 + zstd on every transport (codec byte: `0x00` none, `0x01` LZ4, `0x02` zstd)
- **Store-and-forward** — `ProofStore` queues up to 64 requests when no peers are connected; drains automatically on reconnect
- **Multi-transport orchestration** — `TransportManager` on Android, iOS, and TypeScript coordinates transports simultaneously; falls back to direct RPC if no peers respond within the timeout
- **Gossip deduplication** — UUID-based seen-cache with TTL eviction prevents message storms

---

## Quick Start

### TypeScript / Node.js

```sh
npm install fernlink-sdk
```

```ts
import { FernlinkClient } from "fernlink-sdk";
import { TransportManager } from "@fernlink/wifi";

const client = new FernlinkClient({
  rpcEndpoint: "https://api.mainnet-beta.solana.com",
  minProofs: 2,
});

// Discovers peers automatically via mDNS on the local network
const transport = new TransportManager(client, "https://api.mainnet-beta.solana.com");
await transport.start();

const result = await client.verifyTransaction(txSignature, {
  commitment: "confirmed",
  timeoutMs: 15_000,
});

console.log(result.status, result.slot, result.proofCount);
// "confirmed"  312847291  3
```

### Rust

```sh
cargo add fernlink-core
```

```rust
use fernlink_core::{crypto::Keypair, consensus::evaluate, message::VerificationProof};

let keypair = Keypair::generate();
let proof = fernlink_core::crypto::sign_proof(&keypair, &request)?;
let verdict = evaluate(&[proof1, proof2, proof3]);
```

### Try the live devnet demo

```sh
npx fernlink-demo
```

### Android

Add the `fernlink-sdk` AAR to your Gradle project (see [`packages/android/README.md`](./packages/android/README.md)):

```kotlin
val client = FernlinkClient(context, rpcEndpoint = "https://api.devnet.solana.com")
client.attachBleService(bleService)
val result = client.verifyTransaction(signature)
```

### iOS

```swift
import FernlinkSDK

let client = FernlinkClient(rpcEndpoint: "https://api.devnet.solana.com")
try await client.start()
let result = try await client.verifyTransaction(signature: sig)
```

---

## Monorepo Structure

```
/                              # Marketing website (Vite + React + Tailwind)
  src/pages/                   # Index, About, Docs, UseCases, Downloads, Contact
  whitepaper.md                # Full technical specification

packages/
  fernlink-core/               # Rust crate — core protocol (crates.io)
  sdk/                         # TypeScript SDK (npm: fernlink-sdk)
  demo/                        # Devnet demo CLI (npm: fernlink-demo)
  ble/                         # Desktop BLE transport + CI simulator
  wifi/                        # Wi-Fi/TCP transport with mDNS
  ble-desktop/                 # Rust desktop binary (BLE + Wi-Fi)
  android/
    fernlink-sdk/              # Android library (Kotlin + JNI)
    fernlink-demo-app/         # Android demo app
    fernlink-core-ffi/         # Rust cdylib — JNI exports for Android
  ios/
    Sources/FernlinkSDK/       # Swift SDK (CoreBluetooth + Multipeer + NFC)
```

---

## Development

### Website

```sh
npm install
npm run dev        # dev server at http://localhost:8080
npm run build      # production build → dist/
npm test           # Vitest unit tests
```

### TypeScript SDK (`packages/sdk/`)

```sh
cd packages/sdk
npm install
npm run build      # tsup → dist/ (CJS + ESM + .d.ts)
npm test           # Vitest
npm run lint       # tsc --noEmit
```

### Rust core (`packages/fernlink-core/`)

```sh
cd packages/fernlink-core
cargo build
cargo test         # runs all unit tests
```

### Android (`packages/android/`)

```sh
cd packages/android
./gradlew :fernlink-sdk:assembleRelease
./gradlew :fernlink-demo-app:assembleDebug
```

Rebuild native `.so` files (requires NDK 28 + cargo-ndk):

```sh
cd packages/android/fernlink-core-ffi
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 \
  -o ../fernlink-sdk/src/main/jniLibs build --release
```

---

## CI / CD

| Workflow | Trigger | Jobs |
|---|---|---|
| [`rust.yml`](./.github/workflows/rust.yml) | Push/PR to `packages/fernlink-core/**`, `packages/ble-desktop/**`, `packages/android/fernlink-core-ffi/**` | `cargo test` (core), `cargo build` (desktop), `cargo check` (Android FFI targets), auto-publish to crates.io on merge to main |
| [`sdk.yml`](./.github/workflows/sdk.yml) | Push/PR to `packages/sdk/**`, `packages/demo/**`, `packages/ble/**`, `packages/wifi/**` | `npm test` (SDK + BLE simulator), `tsc --noEmit` (demo + wifi), auto-publish `fernlink-sdk` and `fernlink-demo` to npm on merge to main |
| [`android.yml`](./.github/workflows/android.yml) | Push/PR to `packages/android/**` | `gradle assembleRelease`, uploads debug APK as artifact |

Publishing uses [npm Trusted Publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/) for npm packages and `CARGO_REGISTRY_TOKEN` for crates.io. No long-lived npm tokens are stored.

---

## Testing

```sh
# Rust (no hardware needed)
cd packages/fernlink-core && cargo test

# TypeScript SDK
cd packages/sdk && npm test

# BLE simulator (8 tests, no hardware needed)
cd packages/ble && npm test

# Android JNI (instrumented, requires device or emulator)
cd packages/android
./gradlew :fernlink-sdk:connectedAndroidTest
```

See [`TESTING.md`](./TESTING.md) for the full test matrix.

---

## Contributing

Contributions are welcome. Please open an issue or pull request describing:

- The problem you're solving
- Any protocol or security assumptions your change makes
- How it affects existing transport compatibility or the wire format

All transports must remain backwards-compatible with Protocol v1 (uncompressed) peers.

---

## License

[Apache 2.0](./LICENSE)
