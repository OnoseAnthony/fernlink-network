import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Shield, Radio, Lock, Zap, Globe, TrendingDown, Users } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: Radio,
    title: "Peer-to-Peer Mesh",
    desc: "Devices form dynamic mesh networks to share and propagate transaction verification proofs without centralized infrastructure.",
  },
  {
    icon: Shield,
    title: "Cryptographic Proofs",
    desc: "Ed25519 signed verification proofs ensure authenticity. Multi-validator consensus prevents forgery and replay attacks.",
  },
  {
    icon: Wifi,
    title: "Multi-Transport",
    desc: "Seamlessly switches between BLE, WiFi Direct, and NFC based on availability, range, and throughput requirements.",
  },
  {
    icon: Lock,
    title: "Security & Privacy",
    desc: "Proof-of-verification without exposing private keys. Gossip protocol with TTL limits and duplicate detection.",
  },
];

const stats = [
  { value: "60-80%", label: "RPC Call Reduction", icon: TrendingDown },
  { value: "<2s", label: "Proof Propagation", icon: Zap },
  { value: "100m+", label: "BLE Mesh Range", icon: Globe },
  { value: "∞", label: "Offline Resilience", icon: Users },
];

const flowSteps = [
  { step: "1", title: "Request", desc: "Device A broadcasts a transaction verification request over the local mesh." },
  { step: "2", title: "Verify", desc: "Device B with RPC access verifies the transaction against the Solana ledger." },
  { step: "3", title: "Sign", desc: "Device B signs the verification proof with its Ed25519 key." },
  { step: "4", title: "Propagate", desc: "The signed proof propagates back through the mesh via gossip protocol." },
];

export default function Index() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
        <div className="relative section-container pt-20 pb-28 md:pt-32 md:pb-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6 animate-fade-up">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              Open Source · Solana Ecosystem
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Decentralized Transaction Verification for{" "}
              <span className="text-gradient">Solana</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              Collaborate locally to verify transactions offline — reduce RPC load, boost resilience,
              and extend Solana&apos;s reach to every corner of the world.
            </p>
            <div className="flex flex-wrap gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <a href="https://github.com/fernlink" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="gap-2">
                  Download SDK <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link to="/docs">
                <Button size="lg" variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
                  Read the Docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="section-container py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-2xl sm:text-3xl font-display font-bold text-gradient">{s.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Abstract */}
      <section className="section-container py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">
            Like Ferns, <span className="text-gradient">Fernlink Propagates</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Inspired by how ferns spread through airborne spores and underground rhizomes,
            Fernlink creates a decentralized peer-to-peer protocol that distributes Solana
            transaction verification proofs across local device meshes. By enabling nearby
            devices to share cryptographic proofs via BLE, WiFi Direct, and NFC, Fernlink
            reduces RPC costs by 60–80%, supports low-bandwidth environments, and ensures
            the network remains resilient even when internet connectivity fails.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mesh-bg py-20 md:py-28">
        <div className="section-container">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-14">
            Core <span className="text-gradient">Features</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="rounded-xl border-glow bg-card/60 backdrop-blur p-6 hover:bg-card/80 transition-all duration-300 animate-fade-up group"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:glow-primary transition-shadow">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verification Flow */}
      <section className="section-container py-20 md:py-28">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-4">
          How <span className="text-gradient">Verification</span> Works
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14">
          A four-phase process distributes verification across the local mesh,
          eliminating the need for every device to maintain its own RPC connection.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {flowSteps.map((s, i) => (
            <div key={i} className="relative animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="text-5xl font-display font-bold text-primary/10 mb-2">{s.step}</div>
              <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              {i < flowSteps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-8 -right-3 h-5 w-5 text-primary/30" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mesh-bg border-t border-border/50">
        <div className="section-container py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            Ready to Build with <span className="text-gradient">Fernlink</span>?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Join the open-source community shaping resilient, decentralized infrastructure for Solana.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/downloads">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="border-primary/30 hover:bg-primary/10">
                Join Community
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
