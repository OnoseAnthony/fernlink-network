# Fernlink Packages

| Package | Language | Description |
|---|---|---|
| [`fernlink-core`](./fernlink-core) | Rust | Core cryptographic primitives, message types, gossip protocol, consensus |
| [`@fernlink/sdk`](./sdk) | TypeScript | Developer SDK with `FernlinkClient`, peer simulation, proof validation |
| [`@fernlink/demo`](./demo) | TypeScript | End-to-end devnet demo — runs `npx @fernlink/demo` |

## Quick start

```bash
# TypeScript / Node.js
npm install @fernlink/sdk

# Rust
cargo add fernlink-core

# Run the live devnet demo
npx @fernlink/demo
```

## Build all packages

```bash
# Rust core
cd fernlink-core && cargo build && cargo test

# TypeScript SDK
cd sdk && npm install && npm run build && npm test

# Demo
cd demo && npm install && npm run dev
```
