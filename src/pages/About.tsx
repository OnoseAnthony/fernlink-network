const problems = [
  {
    code: "ERR_CENTRALIZED_RPC",
    title: "Centralized RPC Dependency",
    desc: "Every wallet and dApp relies on a handful of RPC providers, creating single points of failure and escalating costs.",
  },
  {
    code: "ERR_COST_AT_SCALE",
    title: "Cost at Scale",
    desc: "High transaction volumes on Solana mean millions of RPC calls daily — costs that are passed on to developers and users.",
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
    desc: "Just as ferns release spores into the air that drift to new locations, Fernlink broadcasts verification proofs wirelessly via BLE, WiFi Direct, and NFC. Proofs travel from device to device without infrastructure, reaching wherever the mesh extends.",
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
            We welcome contributions from developers, researchers, and anyone passionate
            about decentralized infrastructure.
          </p>
          <p className="font-mono text-sm text-[#166534]">
            Join our Discord, open an issue on GitHub, or submit a pull request.
            Together we can make Solana more resilient and accessible.
          </p>
          <div className="mt-6 pt-6 border-t border-[#064e3b]">
            <a
              href="https://github.com/Fernlink-Protocol/fernlink-network"
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
