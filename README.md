# Fernlink Network

Fernlink is a decentralized peer‑to‑peer protocol for distributing Solana transaction verification proofs across local networks (BLE, Wi‑Fi Direct, NFC), allowing nearby devices to help each other confirm transactions without relying solely on centralized RPC infrastructure.

> For full protocol details, see the technical whitepaper: [`whitepaper.md`](./whitepaper.md).

---

## Overview

Fernlink addresses a core bottleneck in the Solana ecosystem: **transaction verification is tightly coupled to centralized RPC providers**. Wallets and apps typically poll RPC endpoints in a tight loop (every 500ms–1s) to check whether a transaction has been confirmed. At scale this:

- **Burns RPC credits** for mobile apps and wallets  
- **Struggles in low‑bandwidth environments** or during network congestion  
- **Creates reliability risk** when public RPCs are rate‑limited or premium RPC providers have outages  

Fernlink turns nearby connected devices into **verification nodes in a local mesh network**. When a user submits a transaction:

1. Their device broadcasts a lightweight verification request (containing the transaction signature and a few parameters) over BLE / Wi‑Fi Direct / NFC.  
2. Peers with good connectivity and available RPC quota query Solana, build a **cryptographically signed verification proof**, and broadcast it back into the mesh.  
3. The originating device receives one or more signed proofs—even if its own internet connection is poor or offline—and can accept the result using configurable trust rules.  

This creates a **resilient, low‑cost, and locality‑aware verification layer** that complements traditional RPC.

---

## Why Fernlink?

- **Reduced RPC load**: Mesh‑level verification removes the need for every device to poll RPC endpoints directly.  
- **Better UX on mobile**: Nearby devices with good connectivity can confirm transactions for users with weak or intermittent connections.  
- **Resilience under congestion**: During high‑load events, proofs can still propagate through local clusters even when centralized RPC is degraded.  
- **Public good for Solana**: Any well‑connected device can contribute verification capacity to the network.

---

## How Fernlink Works (High Level)

Fernlink operates in three phases:

1. **Request Phase**  
   - After sending a Solana transaction, the originating device broadcasts a **verification request** containing:  
     - Transaction signature  
     - Desired commitment level (processed / confirmed / finalized)  
     - Timeout and routing metadata  
   - Messages are compact binary payloads optimized for BLE.

2. **Verification Phase**  
   - Peers receiving the request query their configured RPC endpoints.  
   - Devices with internet and available RPC credits act as **verification nodes**.  
   - Each verifier produces a **signed proof** bundling:  
     - Transaction signature and status (confirmed / failed / unknown)  
     - Slot and block time  
     - Optional error code  
     - Verifier public key + Ed25519 signature over the proof.

3. **Propagation Phase**  
   - Proofs propagate back through the mesh via an **epidemic gossip protocol** with TTL and deduplication.  
   - Devices validate signatures, cache proofs, and forward them to peers.  
   - Multiple matching proofs increase confidence; conflicting proofs can trigger RPC fallback.

---

## Network & Protocol Highlights

- **Transport‑agnostic design**  
  - BLE 5.0: background mesh, low power, ~30–50m range  
  - Wi‑Fi Direct: high‑throughput bursts, cluster‑to‑cluster bridging  
  - NFC: very‑short‑range bootstrapping and secure peer discovery  

- **Peer discovery & topology**  
  - Standardized Fernlink service UUID and characteristics (`REQUEST`, `PROOF`, `STATUS`) for BLE.  
  - Devices act as both central and peripheral to form dynamic clusters:  
    - Local clusters, bridge nodes, gateway nodes (with internet), and verification nodes (gateways with RPC resources).

- **Message format**  
  - Versioned, compact binary envelope with:  
    - Version, type (REQUEST / PROOF / ACK), UUID message ID, timestamp, TTL, and payload.  
  - Gossip protocol maintains a **seen‑message cache**, decrements TTL per hop, and prioritizes proofs over new requests.

- **Verification & trust model**  
  - All proofs are Ed25519‑signed by the verifying device.  
  - Clients can use **multi‑proof consensus**:  
    - Accept immediately if 2+ proofs agree.  
    - Wait or fall back to RPC if proofs disagree.  
    - Prefer finalized over confirmed.  
  - Future work includes verifier reputation and accuracy scoring.

- **Security considerations**  
  - Mitigations for Sybil, replay, spam, and eclipse‑style attacks using:  
    - Signature checks, timestamps, TTL bounds, rate‑limits, and RPC fallback as ground truth.  
  - Optional Diffie‑Hellman encryption for payload privacy (transaction signatures remain public on Solana).

---

## SDK & Platform Support

Fernlink is designed as a **multi‑platform SDK** with a shared core:

- **Core components**  
  - `FernlinkClient` – main client used by apps and wallets  
  - `TransportManager` – abstracts BLE / Wi‑Fi Direct / NFC  
  - `ProofValidator` – signature and consensus logic  
  - `MessageRouter` – gossip, deduplication, TTL handling  
  - `VerificationService` – orchestrates RPC queries and proof creation  
  - `CacheManager` – local caching for requests and proofs  

- **Planned platform targets**  
  - iOS (Swift, CoreBluetooth, Multipeer)  
  - Android (Kotlin, Bluetooth LE, Wi‑Fi Direct)  
  - React Native (TypeScript, `react-native-ble-plx`)  
  - Core logic in Rust (using `solana-sdk`, `ed25519-dalek`, etc.)  

Example high‑level usage from the whitepaper:

```ts
// Initialize Fernlink
const fernlink = new FernlinkClient({
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  keypair: myKeypair,
});

// Start mesh networking
await fernlink.start();

// Send transaction and verify via mesh
const signature = await connection.sendTransaction(tx);
const proof = await fernlink.verifyTransaction(signature, {
  commitment: 'confirmed',
  timeout: 30_000,
  minProofs: 2,
});
```

---

## This Repository

This repository contains the **Fernlink Network marketing site and documentation UI**, built as a modern single‑page application.

- **Tech stack**
  - Vite + React + TypeScript  
  - Tailwind CSS + shadcn‑ui + Radix UI primitives  
  - React Router for client‑side navigation  
  - Vitest and Testing Library for unit tests  

- **Notable app routes (pages)**
  - `Index` – high‑level introduction and hero section  
  - `About` – background, mission, and design goals  
  - `UseCases` – concrete scenarios and user journeys  
  - `Docs` – protocol and SDK‑oriented documentation  
  - `Downloads` – SDK binaries / links (when available)  
  - `Contact` – contact form and communication channels  

---

## Getting Started (Local Development)

### Prerequisites

- Node.js (LTS recommended)  
- npm (comes with Node)  

### Installation

```sh
git clone <your_git_url>
cd fernlink-network
npm install
```

### Run the development server

```sh
npm run dev
```

This starts Vite’s dev server. Open the printed URL (typically `http://localhost:5173`) in your browser to view the site.

### Run tests

```sh
npm test
```

### Build for production

```sh
npm run build
```

The production‑ready assets will be output to the `dist` directory. You can serve them with any static file host or deploy via your preferred platform.

---

## Project Structure (High Level)

```text
src/
  main.tsx        # App entrypoint
  App.tsx         # Top-level routing/layout
  pages/          # Main routes (Index, About, Docs, Downloads, UseCases, Contact, NotFound)
  components/     # Shared layout + UI components
  components/ui/  # shadcn-ui / Radix-based primitives
  hooks/          # Reusable React hooks
  lib/            # Utilities
```

---

## Contributing

Contributions, feedback, and protocol discussions are welcome.  
Please open an issue or pull request describing:

- The problem you’re solving  
- Any protocol / UX assumptions you’re making  
- How your change affects existing flows or security properties  

---

## License

The license for this project has not yet been specified. Until a license is added, please treat the code as **all rights reserved** and contact the maintainers before using it in production.

