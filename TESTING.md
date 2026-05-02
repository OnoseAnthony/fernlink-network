# Testing Guide

This document covers how to run every test suite in the Fernlink monorepo.

---

## Rust core (`packages/fernlink-core`)

```bash
cd packages/fernlink-core
cargo test                              # all 7 unit tests
cargo test crypto::tests               # just the crypto module tests
cargo test --all-features              # include rpc feature
```

---

## TypeScript SDK (`packages/sdk`)

```bash
cd packages/sdk
npm ci
npm run lint     # tsc --noEmit type-check
npm run build    # tsup → dist/
npm test         # vitest — src/index.test.ts
```

---

## BLE simulator (`packages/ble`)

Pure TypeScript — no BLE hardware required.

```bash
cd packages/ble
npm ci --ignore-scripts   # skip native addon builds (bleno/noble not needed for tests)
npx tsc --noEmit          # type-check
npm test                  # vitest run src/simulator.test.ts (8 tests)
```

Tests cover:
- Ed25519 key generation and proof signing
- Proof verification (accept own proof, reject tampered)
- Consensus: settle with 2+ matching proofs, not settle below `minProofs`
- Deterministic keypairs from seed

---

## Demo CLI (`packages/demo`)

Type-check only (the demo makes live devnet calls, so tests run manually):

```bash
cd packages/demo
npm ci
npx tsc --noEmit
npm run dev     # runs live against Solana devnet
```

---

## Android JNI (`packages/android`)

**Instrumented tests** (require a connected device or emulator):

```bash
cd packages/android
gradle :fernlink-sdk:connectedAndroidTest --no-daemon
```

Tests in `fernlink-sdk/src/androidTest/kotlin/xyz/fernlink/sdk/FernlinkJniTest.kt`:
- `generateKeypair` — 64-byte output
- `signProof` — returns valid JSON
- `verifyProof` — accepts own proof, rejects tampered proof
- `evaluateProofs` — settles at threshold, rejects below `minProofs`
- `deterministicKeypair` — same seed → same keys

**Kotlin build only (no device needed):**

```bash
gradle :fernlink-sdk:assembleRelease --no-daemon
gradle :fernlink-demo-app:assembleDebug --no-daemon
```

---

## Android FFI type-check (`packages/android/fernlink-core-ffi`)

Checks the Rust JNI bindings compile for all three Android ABIs without needing the NDK:

```bash
cd packages/android/fernlink-core-ffi
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
cargo check --target aarch64-linux-android
cargo check --target armv7-linux-androideabi
cargo check --target x86_64-linux-android
```

---

## CI

All suites above run automatically via GitHub Actions on push/PR:

| Workflow | File | Triggers on |
|---|---|---|
| Rust | `.github/workflows/rust.yml` | `packages/fernlink-core/**`, `packages/android/fernlink-core-ffi/**` |
| TypeScript SDK | `.github/workflows/sdk.yml` | `packages/sdk/**`, `packages/demo/**`, `packages/ble/**` |
| Android | `.github/workflows/android.yml` | `packages/android/**` |
