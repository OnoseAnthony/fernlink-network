import { Leaf, Server, Wifi, Users, Scale, TreePine } from "lucide-react";

const problems = [
  { icon: Server, title: "Centralized RPC Dependency", desc: "Every wallet and dApp relies on a handful of RPC providers, creating single points of failure and escalating costs." },
  { icon: Scale, title: "Cost at Scale", desc: "High transaction volumes on Solana mean millions of RPC calls daily — costs that are passed on to developers and users." },
  { icon: Wifi, title: "Connectivity Gaps", desc: "Billions of people in emerging markets face unreliable internet, locking them out of the Solana ecosystem." },
];

export default function About() {
  return (
    <div className="mesh-bg">
      {/* Hero */}
      <section className="section-container pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-6 animate-fade-up">
            About <span className="text-gradient">Fernlink</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Fernlink is a decentralized, open-source protocol that brings peer-to-peer
            transaction verification to the Solana ecosystem. By enabling nearby devices
            to collaboratively verify and share cryptographic proofs, Fernlink removes the
            dependency on centralized RPC infrastructure.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="section-container pb-20">
        <h2 className="text-3xl font-display font-bold mb-10">
          The <span className="text-gradient">Problem</span>
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {problems.map((p, i) => (
            <div key={i} className="rounded-xl border-glow bg-card/60 p-6 animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <p.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-display font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fern Analogy */}
      <section className="section-container pb-20">
        <div className="rounded-2xl border-glow bg-card/40 p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <TreePine className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-display font-bold">The Fern Analogy</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 text-muted-foreground">
            <div>
              <h3 className="font-display font-semibold text-foreground mb-2 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-primary" /> Airborne Spores → Wireless Transport
              </h3>
              <p className="text-sm leading-relaxed">
                Just as ferns release spores into the air that drift to new locations,
                Fernlink broadcasts verification proofs wirelessly via BLE, WiFi Direct,
                and NFC. Proofs travel from device to device without infrastructure,
                reaching wherever the mesh extends.
              </p>
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground mb-2 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-accent" /> Rhizome Network → Mesh Propagation
              </h3>
              <p className="text-sm leading-relaxed">
                Underground rhizomes let ferns spread across vast areas through
                interconnected root networks. Similarly, Fernlink's gossip protocol
                propagates proofs through overlapping device meshes, creating resilient
                underground channels that survive even when individual nodes disconnect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-container pb-20">
        <h2 className="text-3xl font-display font-bold mb-6">
          Open Source <span className="text-gradient">Community</span>
        </h2>
        <div className="rounded-xl border-glow bg-card/60 p-8">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-6 w-6 text-primary" />
            <p className="text-muted-foreground">
              Fernlink is built in the open under the <strong className="text-foreground">Apache 2.0 License</strong>.
              We welcome contributions from developers, researchers, and anyone passionate
              about decentralized infrastructure.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Join our Discord, open an issue on GitHub, or submit a pull request.
            Together we can make Solana more resilient and accessible.
          </p>
        </div>
      </section>
    </div>
  );
}
