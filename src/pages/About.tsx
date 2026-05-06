import { GITHUB } from "@/lib/constants";

const problems = [
  {
    code: "ERR_CENTRALIZED_RPC",
    title: "Centralized RPC Dependency",
    desc: "Every wallet and dApp relies on a handful of RPC providers, creating single points of failure and escalating costs.",
  },
  {
    code: "ERR_COST_AT_SCALE",
    title: "Cost at Scale",
    desc: "High transaction volumes on Solana mean millions of RPC calls daily. Those costs are passed directly to developers and users.",
  },
  {
    code: "ERR_CONNECTIVITY_GAP",
    title: "Connectivity Gaps",
    desc: "Billions of people in emerging markets face unreliable internet, locking them out of the Solana ecosystem.",
  },
];

const analogy = [
  {
    label: "Airborne Spores → Wireless Transport",
    desc: "Just as ferns release spores into the air that drift to new locations, Fernlink broadcasts verification proofs wirelessly via BLE, WiFi/TCP, and NFC. Proofs travel from device to device without infrastructure, reaching wherever the mesh extends.",
  },
  {
    label: "Rhizome Network → Mesh Propagation",
    desc: "Underground rhizomes let ferns spread across vast areas through interconnected root networks. Similarly, Fernlink's gossip protocol propagates proofs through overlapping device meshes, creating resilient channels that survive even when individual nodes disconnect.",
  },
];

export default function About() {
  return (
    <div className="pt-24 pb-20 px-6 max-w-[1440px] mx-auto">

      {/* Header */}
      <section className="pb-16 border-b border-[#064e3b]">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          $ cat ./about.md
        </div>
        <h1 className="font-mono font-bold text-4xl sm:text-5xl text-[#22C55E] mb-6 data-glow">
          About Fernlink
        </h1>
        <p className="font-mono text-[#166534] text-lg leading-relaxed max-w-3xl">
          Fernlink is a decentralized, open-source protocol that brings peer-to-peer
          transaction verification to the Solana ecosystem. By enabling nearby devices
          to collaboratively verify and share cryptographic proofs, Fernlink removes the
          dependency on centralized RPC infrastructure.
        </p>
      </section>

      {/* Problem */}
      <section className="py-16 border-b border-[#064e3b]">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          // PROBLEM_STATEMENT
        </div>
        <h2 className="font-mono font-semibold text-3xl text-[#22C55E] mb-10 data-glow">
          The Problem
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div key={p.code} className="bg-black border border-[#064e3b] p-6 terminal-border">
              <div className="font-mono text-[10px] text-[#22C55E] uppercase tracking-widest mb-4">
                {p.code}
              </div>
              <h3 className="font-mono font-semibold text-[#22C55E] text-lg mb-3">{p.title}</h3>
              <p className="font-mono text-sm text-[#166534] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fern Analogy */}
      <section className="py-16 border-b border-[#064e3b]">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          // BIOLOGICAL_ANALOGY
        </div>
        <h2 className="font-mono font-semibold text-3xl text-[#22C55E] mb-10 data-glow">
          The Fern Analogy
        </h2>
        <div className="bg-black border border-[#064e3b] p-8 terminal-border">
          <div className="grid md:grid-cols-2 gap-10">
            {analogy.map((a) => (
              <div key={a.label}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[#22C55E] animate-pulse">&gt;&gt;</span>
                  <h3 className="font-mono font-semibold text-[#22C55E]">{a.label}</h3>
                </div>
                <p className="font-mono text-sm text-[#166534] leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Been Built */}
      <section className="py-16 border-b border-[#064e3b]">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          // SHIPPED
        </div>
        <h2 className="font-mono font-semibold text-3xl text-[#22C55E] mb-10 data-glow">
          What's Been Built
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              label: "Android BLE Transport",
              desc: "Native Kotlin GATT server and client, foreground BLE service, NFC bootstrapping for sub-200ms pairing, and a TransportManager that orchestrates both BLE and WiFi simultaneously.",
            },
            {
              label: "iOS Transport",
              desc: "Swift SDK using CoreBluetooth and Multipeer Connectivity, NFC bootstrap via CoreNFC, and a unified client API matching the Android and TypeScript interfaces.",
            },
            {
              label: "WiFi / TCP Transport",
              desc: "TypeScript and Rust desktop implementations using TCP with mDNS peer discovery. Peers advertise via _fernlink._tcp.local. and connect automatically on the same LAN.",
            },
            {
              label: "Rust Core & Desktop",
              desc: "Ed25519 proof signing and verification, stateless consensus, UUID-based gossip deduplication — all in a Rust crate published to crates.io. Desktop binary runs BLE and WiFi simultaneously.",
            },
            {
              label: "Wire Compression (Protocol v2)",
              desc: "Negotiable LZ4 and zstd compression on every transport. A 1-byte codec prefix wraps each payload; peers advertise supported codecs via the STATUS characteristic. Backwards-compatible with uncompressed v1 messages. Wired into Android BLE, Android WiFi, iOS CoreBluetooth, iOS Multipeer, and the TypeScript WebBluetoothPeer.",
            },
          ].map((item) => (
            <div key={item.label} className="bg-black border border-[#064e3b] p-6 terminal-border">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#22C55E] text-xs animate-pulse">▶</span>
                <h3 className="font-mono font-semibold text-[#22C55E] text-sm">{item.label}</h3>
              </div>
              <p className="font-mono text-xs text-[#166534] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open Source */}
      <section className="py-16">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          // COMMUNITY
        </div>
        <h2 className="font-mono font-semibold text-3xl text-[#22C55E] mb-8 data-glow">
          Open Source Community
        </h2>
        <div className="bg-black border border-[#064e3b] p-8 terminal-border">
          <p className="font-mono text-[#166534] leading-relaxed mb-4">
            Fernlink is built in the open under the{" "}
            <span className="text-[#22C55E]">Apache 2.0 License</span>.
            The full monorepo — Rust core, TypeScript SDK, Android SDK, iOS SDK, BLE and WiFi transports,
            and a live devnet demo — is available on GitHub and open for contributions.
          </p>
          <p className="font-mono text-sm text-[#166534]">
            Open an issue, submit a pull request, or reach out directly. Every layer of the
            protocol is documented and testable without hardware.
          </p>
          <div className="mt-6 pt-6 border-t border-[#064e3b]">
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm uppercase tracking-widest border border-[#22C55E] text-[#22C55E] px-6 py-3 inline-block hover:bg-[#22C55E] hover:text-black transition-all"
            >
              [ VIEW ON GITHUB ]
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
