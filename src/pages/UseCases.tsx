const useCases = [
  {
    icon: "smartphone",
    code: "UC_001",
    title: "Mobile Wallets",
    desc: "Reduce RPC costs by 60-80% for mobile wallet providers. Users verify transactions through nearby peers instead of hammering centralized endpoints.",
    benefits: ["Lower operational costs", "Faster confirmation UX", "Reduced server dependency"],
  },
  {
    icon: "public",
    code: "UC_002",
    title: "Emerging Markets",
    desc: "Bring Solana to billions in regions with unreliable internet. Fernlink enables transaction verification via local BLE meshes, even without a stable connection.",
    benefits: ["Offline-capable verification", "Low bandwidth usage", "Accessible to feature phones"],
  },
  {
    icon: "point_of_sale",
    code: "UC_003",
    title: "Physical Commerce",
    desc: "NFC-enabled point-of-sale verification. Tap to verify transaction proofs instantly at merchant terminals without waiting for network round-trips.",
    benefits: ["Sub-second verification", "Works in poor connectivity", "Seamless POS integration"],
  },
  {
    icon: "shield",
    code: "UC_004",
    title: "Network Resilience",
    desc: "When RPC providers experience outages, Fernlink meshes keep verification flowing. Cached proofs and peer consensus maintain continuity.",
    benefits: ["Outage protection", "Redundant verification paths", "No single point of failure"],
  },
  {
    icon: "trending_up",
    code: "UC_005",
    title: "DeFi Applications",
    desc: "High-frequency DeFi operations benefit from local proof caching and peer verification, reducing latency and costs for arbitrage and trading bots.",
    benefits: ["Lower latency", "Reduced RPC costs", "Edge-deployed verification"],
  },
  {
    icon: "memory",
    code: "UC_006",
    title: "IoT & Edge Devices",
    desc: "Resource-constrained IoT devices can offload verification to more capable peers in the mesh, enabling Solana-based IoT applications at scale.",
    benefits: ["Minimal device requirements", "Battery-efficient", "Scalable mesh architecture"],
  },
];

export default function UseCases() {
  return (
    <div className="pt-24 pb-20 px-6 max-w-[1440px] mx-auto">

      {/* Header */}
      <section className="pb-12 border-b border-[#064e3b]">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          $ ls ./use_cases/
        </div>
        <h1 className="font-mono font-bold text-4xl sm:text-5xl text-[#22C55E] mb-4 data-glow">
          Use Cases
        </h1>
        <p className="font-mono text-[#166534] text-lg max-w-2xl leading-relaxed">
          Fernlink creates positive network effects. Every new device strengthens the mesh,
          reducing costs and improving resilience for the entire Solana ecosystem.
        </p>
      </section>

      {/* Use case grid */}
      <section className="py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((uc) => (
            <div
              key={uc.code}
              className="bg-black border border-[#064e3b] p-6 flex flex-col hover:border-[#22C55E] transition-all duration-300 group terminal-border"
            >
              <div className="flex items-start justify-between mb-6">
                <span className="material-symbols-outlined text-[#22C55E] text-4xl group-hover:scale-110 transition-transform data-glow">
                  {uc.icon}
                </span>
                <span className="font-mono text-[10px] text-[#166534] uppercase">{uc.code}</span>
              </div>

              <h3 className="font-mono font-semibold text-xl text-[#22C55E] mb-3">{uc.title}</h3>
              <p className="font-mono text-sm text-[#166534] leading-relaxed mb-6 flex-grow">{uc.desc}</p>

              <ul className="space-y-2 pt-4 border-t border-[#064e3b]">
                {uc.benefits.map((b) => (
                  <li key={b} className="font-mono text-xs text-[#22C55E] flex items-center gap-2">
                    <span className="text-[#22C55E]">&gt;</span> {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section className="border-t border-[#064e3b] pt-16">
        <div className="bg-black border border-[#22C55E] p-8 md:p-12 relative terminal-border">
          <div className="absolute top-0 left-0 w-2 h-2 bg-[#22C55E]" />
          <div className="absolute top-0 right-0 w-2 h-2 bg-[#22C55E]" />
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#22C55E]" />
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#22C55E]" />

          <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4 text-center">
            // ECOSYSTEM_IMPACT
          </div>
          <h2 className="font-mono font-semibold text-3xl text-[#22C55E] mb-6 text-center data-glow">
            Ecosystem Impact
          </h2>
          <p className="font-mono text-[#166534] text-center max-w-2xl mx-auto leading-relaxed">
            Every device running Fernlink becomes a verification node. As adoption grows,
            the mesh becomes denser, proofs propagate faster, and the entire Solana network
            benefits from reduced RPC load and improved fault tolerance. Fernlink transforms
            transaction verification from a centralized service into a decentralized public good.
          </p>
        </div>
      </section>
    </div>
  );
}
