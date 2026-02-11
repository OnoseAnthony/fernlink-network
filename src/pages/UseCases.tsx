import { Smartphone, Globe, CreditCard, ShieldCheck, TrendingUp, Wifi } from "lucide-react";

const useCases = [
  {
    icon: Smartphone,
    title: "Mobile Wallets",
    desc: "Reduce RPC costs by 60-80% for mobile wallet providers. Users verify transactions through nearby peers instead of hammering centralized endpoints.",
    benefits: ["Lower operational costs", "Faster confirmation UX", "Reduced server dependency"],
  },
  {
    icon: Globe,
    title: "Emerging Markets",
    desc: "Bring Solana to billions in regions with unreliable internet. Fernlink enables transaction verification via local BLE/WiFi meshes — no stable connection required.",
    benefits: ["Offline-capable verification", "Low bandwidth usage", "Accessible to feature phones"],
  },
  {
    icon: CreditCard,
    title: "Physical Commerce",
    desc: "NFC-enabled point-of-sale verification. Tap to verify transaction proofs instantly at merchant terminals without waiting for network round-trips.",
    benefits: ["Sub-second verification", "Works in poor connectivity", "Seamless POS integration"],
  },
  {
    icon: ShieldCheck,
    title: "Network Resilience",
    desc: "When RPC providers experience outages, Fernlink meshes keep verification flowing. Cached proofs and peer consensus maintain continuity.",
    benefits: ["Outage protection", "Redundant verification paths", "No single point of failure"],
  },
  {
    icon: TrendingUp,
    title: "DeFi Applications",
    desc: "High-frequency DeFi operations benefit from local proof caching and peer verification, reducing latency and costs for arbitrage and trading bots.",
    benefits: ["Lower latency", "Reduced RPC costs", "Edge-deployed verification"],
  },
  {
    icon: Wifi,
    title: "IoT & Edge Devices",
    desc: "Resource-constrained IoT devices can offload verification to more capable peers in the mesh, enabling Solana-based IoT applications at scale.",
    benefits: ["Minimal device requirements", "Battery-efficient", "Scalable mesh architecture"],
  },
];

export default function UseCases() {
  return (
    <div className="mesh-bg">
      <div className="section-container py-16 md:py-24">
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 animate-fade-up">
          Use <span className="text-gradient">Cases</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-14 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Fernlink creates positive network effects — every new device strengthens the mesh,
          reducing costs and improving resilience for the entire Solana ecosystem.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((uc, i) => (
            <div
              key={i}
              className="rounded-xl border-glow bg-card/60 p-6 hover:bg-card/80 transition-all duration-300 animate-fade-up group"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:glow-primary transition-shadow">
                <uc.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{uc.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{uc.desc}</p>
              <ul className="space-y-1.5">
                {uc.benefits.map((b, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Impact */}
        <div className="mt-20 rounded-2xl border-glow bg-card/40 p-8 md:p-12 text-center">
          <h2 className="text-3xl font-display font-bold mb-4">
            Ecosystem <span className="text-gradient">Impact</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every device running Fernlink becomes a verification node. As adoption grows,
            the mesh becomes denser, proofs propagate faster, and the entire Solana network
            benefits from reduced RPC load and improved fault tolerance. Fernlink transforms
            transaction verification from a centralized service into a decentralized public good.
          </p>
        </div>
      </div>
    </div>
  );
}
