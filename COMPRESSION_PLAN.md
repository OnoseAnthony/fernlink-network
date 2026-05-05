# Fernlink Wire Compression — Implementation Plan

## Goal
Add negotiable per-message compression to the Fernlink wire protocol.
Two codecs ship in v1: **LZ4 frame** and **zstd**. The codec byte in the
Header is extensible — future codecs (dictionary variants, etc.) are
additive, not breaking.

---

## Codec byte values (reserved)

| Value | Codec         | Status    |
|-------|---------------|-----------|
| 0x00  | none          | Always supported (default) |
| 0x01  | lz4_frame     | Ship now  |
| 0x02  | zstd          | Ship now  |
| 0x03  | lz4_dict      | Future    |
| 0x04  | zstd_dict     | Future    |

---

## Wire format change

Add one field to `Header` in `message.rs` (Rust) and `types.ts` (TypeScript):

```
compression: u8   // CompressionCodec enum
```

### Current Header (Rust, message.rs)
```rust
pub struct Header {
    pub version:      u8,
    pub message_type: MessageType,
    pub message_id:   Uuid,
    pub timestamp_ms: u64,
    pub ttl:          u8,
    // ADD:
    pub compression:  CompressionCodec,
}
```

New enum to add above Header:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[repr(u8)]
pub enum CompressionCodec {
    #[default]
    None  = 0x00,
    Lz4   = 0x01,
    Zstd  = 0x02,
}
```

### Current types (TypeScript, types.ts)
Add to `VerificationRequest` and `VerificationProof` interfaces:
```typescript
compression?: CompressionCodec;  // defaults to "none"
```

New type:
```typescript
export type CompressionCodec = "none" | "lz4" | "zstd";
```

---

## Step 1 — fernlink-core (Rust)

### 1a. Cargo.toml
Add under `[dependencies]` (feature-gated so RPC-free builds stay lean):

```toml
lz4_flex = { version = "0.11", features = ["frame"], optional = true }
zstd     = { version = "0.13", optional = true }

[features]
default     = ["compression"]
compression = ["dep:lz4_flex", "dep:zstd"]
rpc         = ["dep:reqwest", "dep:tokio"]
```

### 1b. src/compression.rs (new file)
```rust
#[cfg(feature = "compression")]
use lz4_flex::frame::{FrameDecoder, FrameEncoder};
#[cfg(feature = "compression")]
use std::io::{Read, Write};

use crate::message::CompressionCodec;

pub fn compress(codec: CompressionCodec, data: &[u8]) -> Vec<u8> {
    match codec {
        CompressionCodec::None => data.to_vec(),
        #[cfg(feature = "compression")]
        CompressionCodec::Lz4  => {
            let mut enc = FrameEncoder::new(Vec::new());
            enc.write_all(data).unwrap();
            enc.finish().unwrap()
        }
        #[cfg(feature = "compression")]
        CompressionCodec::Zstd => zstd::encode_all(data, 3).unwrap(),
        #[allow(unreachable_patterns)]
        _ => data.to_vec(),   // compression feature disabled — fall back to none
    }
}

pub fn decompress(codec: CompressionCodec, data: &[u8]) -> anyhow::Result<Vec<u8>> {
    match codec {
        CompressionCodec::None => Ok(data.to_vec()),
        #[cfg(feature = "compression")]
        CompressionCodec::Lz4  => {
            let mut dec = FrameDecoder::new(data);
            let mut out = Vec::new();
            dec.read_to_end(&mut out)?;
            Ok(out)
        }
        #[cfg(feature = "compression")]
        CompressionCodec::Zstd => Ok(zstd::decode_all(data)?),
        #[allow(unreachable_patterns)]
        _ => Ok(data.to_vec()),
    }
}
```

### 1c. src/message.rs changes
- Add `CompressionCodec` enum (above Header definition)
- Add `pub compression: CompressionCodec` field to `Header`
- Update `Header::new()` to set `compression: CompressionCodec::None`

### 1d. src/lib.rs
```rust
pub mod compression;
```

### 1e. Tests to add in src/compression.rs
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::CompressionCodec;

    const SAMPLE: &[u8] = b"5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp...confirmed..."; // ~250 bytes

    #[test] fn roundtrip_none() { ... }
    #[test] fn roundtrip_lz4()  { ... }
    #[test] fn roundtrip_zstd() { ... }
    #[test] fn lz4_smaller_than_input()  { ... }  // assert compressed.len() < input.len()
    #[test] fn zstd_smaller_than_input() { ... }
    #[test] fn unknown_codec_falls_back() { ... }
}
```

---

## Step 2 — fernlink-sdk (TypeScript)

### 2a. package.json — add deps
```json
"lz4js": "^0.3.0",
"fzstd": "^0.3.2"
```

### 2b. src/compression.ts (new file)
```typescript
import * as lz4   from "lz4js";
import * as fzstd from "fzstd";
import type { CompressionCodec } from "./types.js";

export function compress(codec: CompressionCodec, data: Uint8Array): Uint8Array {
  switch (codec) {
    case "lz4":  return lz4.compress(data);
    case "zstd": return fzstd.compress(data);
    default:     return data;
  }
}

export function decompress(codec: CompressionCodec, data: Uint8Array): Uint8Array {
  switch (codec) {
    case "lz4":  return lz4.decompress(data);
    case "zstd": return fzstd.decompress(data);
    default:     return data;
  }
}
```

### 2c. src/types.ts changes
- Add `export type CompressionCodec = "none" | "lz4" | "zstd";`
- Add optional `compression?: CompressionCodec` to `VerificationRequest` and `VerificationProof`
- Add `supportedCodecs?: CompressionCodec[]` to `PeerInfo`

### 2d. src/peer.ts — SimulatedPeer
- Add `preferredCodec: CompressionCodec = "lz4"` option
- Compress proof payload before handing back, set `proof.compression`
- Decompress incoming request payload based on `req.compression`

### 2e. src/client.ts — FernlinkClient
- Accept `compression?: CompressionCodec` in `FernlinkClientOptions` (default `"lz4"`)
- Compress `VerificationRequest` before broadcasting
- Decompress `VerificationProof` on receipt before passing to consensus

### 2f. Tests (src/compression.test.ts — new file)
- Roundtrip tests for both codecs
- Verify compressed size < input size on a realistic proof payload
- Cross-compat test: compress in TS, decompress values match expected

---

## Step 3 — Codec negotiation via STATUS characteristic

The STATUS characteristic already returns:
```json
{"version":1,"commitment":["confirmed","finalized"]}
```

Extend to:
```json
{"version":1,"commitment":["confirmed","finalized"],"compression":["lz4","zstd"]}
```

### Files to update:

**packages/ble-desktop/src/peripheral.rs** — line ~113:
```rust
Ok(br#"{"version":1,"commitment":["confirmed","finalized"],"compression":["lz4","zstd"]}"#.to_vec())
```

**packages/android/.../ble/GattServerManager.kt** — STATUS characteristic value:
Same JSON string update.

**packages/android/.../ble/GattClientManager.kt** — on STATUS read:
Parse `compression` array, store highest shared codec per peer connection.

**packages/ios/.../BleTransport.swift** — STATUS response:
Same JSON string update. Parse on central side, store per-CBPeripheral.

**packages/wifi/src/tcp-server.ts** — STATUS handshake frame:
Add `compression` field to the JSON STATUS frame sent on connect.

**packages/wifi/src/tcp-client.ts** — on STATUS receive:
Parse compression array, negotiate codec for this connection.

### Negotiation algorithm (both BLE and WiFi):
```
peer_codecs   = parse STATUS.compression   // ["lz4", "zstd"] or []
local_codecs  = ["lz4", "zstd"]            // ordered by preference
chosen_codec  = first local_codec that is in peer_codecs, else "none"
```
Store `chosen_codec` per active peer connection. Use it when sending.
Receiver always reads `header.compression` to decompress — no assumption.

---

## Step 4 — Android JNI FFI bridge

`fernlink-core-ffi` already exports `sign_proof` / `verify_proof`.
Add two new exports:

```rust
// packages/android/fernlink-core-ffi/src/lib.rs

#[no_mangle]
pub extern "C" fn Java_xyz_fernlink_sdk_FernlinkJni_compress(
    env: JNIEnv, _: JObject,
    codec: jint, data: jbyteArray,
) -> jbyteArray { ... }

#[no_mangle]
pub extern "C" fn Java_xyz_fernlink_sdk_FernlinkJni_decompress(
    env: JNIEnv, _: JObject,
    codec: jint, data: jbyteArray,
) -> jbyteArray { ... }
```

Kotlin bridge in `FernlinkJni.kt`:
```kotlin
external fun compress(codec: Int, data: ByteArray): ByteArray
external fun decompress(codec: Int, data: ByteArray): ByteArray

companion object {
    const val CODEC_NONE = 0
    const val CODEC_LZ4  = 1
    const val CODEC_ZSTD = 2
}
```

---

## Step 5 — iOS (Swift)

Use Apple's built-in `Compression` framework (zero added dependencies):

```swift
// packages/ios/Sources/FernlinkSDK/Compression.swift (new file)
import Compression
import Foundation

public enum FernlinkCodec: UInt8 {
    case none = 0x00
    case lz4  = 0x01
    case zstd = 0x02
}

public func compress(_ data: Data, codec: FernlinkCodec) -> Data {
    switch codec {
    case .none: return data
    case .lz4:  return data.compressed(using: .lz4) ?? data
    case .zstd: return data.compressed(using: .zlib) ?? data  // use .lzfse on Apple-to-Apple paths
    }
}

public func decompress(_ data: Data, codec: FernlinkCodec) -> Data? {
    switch codec {
    case .none: return data
    case .lz4:  return data.decompressed(using: .lz4)
    case .zstd: return data.decompressed(using: .zlib)
    }
}
```

Note: Apple's `Compression` framework has `.lz4` built in. For zstd,
use `.zlib` as a placeholder until Apple adds native zstd support, or
route through the Rust JNI on iOS via a Swift-Rust bridge. Flag this
in a TODO comment.

---

## Step 6 — CI updates

### packages/fernlink-core/Cargo.toml
No CI change needed — `compression` feature is in `default`.
`cargo test --all-features` already covers it.

### packages/sdk/package.json
New deps (`lz4js`, `fzstd`) are picked up automatically on `npm ci`.
No workflow changes needed.

### packages/android/fernlink-core-ffi/Cargo.toml
Add same `lz4_flex` + `zstd` deps. The `rpc` feature is already
disabled for FFI (`default = []`), so add:
```toml
[features]
default     = ["compression"]
compression = ["dep:lz4_flex", "dep:zstd"]
```

---

## Execution order

1. `fernlink-core`: add `CompressionCodec` to `message.rs` + `compression.rs` + tests
2. `fernlink-sdk`: add `compression.ts` + update `types.ts` + tests
3. STATUS characteristic update across all transports (Rust, Android, iOS, WiFi)
4. Android FFI exports
5. iOS `Compression.swift`
6. Integration: wire compress/decompress into peer send/receive paths
7. Update `whitepaper.md` with compression section
8. Bump `PROTOCOL_VERSION` to `2` in `message.rs` and `types.ts`

---

## Definition of done

- `cargo test --all-features` passes in `fernlink-core`
- `npm test` passes in `fernlink-sdk`
- `npx fernlink-demo` shows `Codec: lz4` in peer info output
- STATUS characteristic JSON includes `"compression"` array
- A peer that sends `compression: 0x00` still works (backwards compat)
- `PROTOCOL_VERSION = 2` in both Rust and TypeScript
