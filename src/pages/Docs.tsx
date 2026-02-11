import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const transports = [
  { name: "BLE 5.0", range: "~100m", throughput: "2 Mbps", latency: "Low", power: "Very Low" },
  { name: "WiFi Direct", range: "~200m", throughput: "250 Mbps", latency: "Very Low", power: "Medium" },
  { name: "NFC", range: "~10cm", throughput: "424 Kbps", latency: "Instant", power: "Minimal" },
];

const platforms = [
  { name: "iOS", lang: "Swift", status: "In Development" },
  { name: "Android", lang: "Kotlin", status: "In Development" },
  { name: "React Native", lang: "TypeScript", status: "Planned" },
  { name: "Rust (Core)", lang: "Rust", status: "In Development" },
];

const codeExample = `use fernlink::{FernlinkClient, Config, TransportType};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::builder()
        .transports(vec![
            TransportType::BLE,
            TransportType::WiFiDirect,
        ])
        .consensus_threshold(0.67)
        .max_hops(5)
        .build()?;

    let client = FernlinkClient::new(config).await?;
    
    // Request verification for a transaction
    let proof = client.verify_transaction(
        "5eykt4UsFv8P8NJd...signature"
    ).await?;
    
    println!("Verified: {}", proof.is_valid);
    Ok(())
}`;

export default function Docs() {
  return (
    <div className="mesh-bg">
      <div className="section-container py-16 md:py-24">
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 animate-fade-up">
          Technical <span className="text-gradient">Documentation</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mb-12 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Everything you need to understand, integrate, and contribute to the Fernlink protocol.
        </p>

        <Tabs defaultValue="overview" className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <TabsList className="bg-card/60 border border-border/50 mb-8 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="sdk">SDK</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="future">Future</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">System Overview</h2>
              <p className="text-muted-foreground mb-6">
                Fernlink operates in three core phases to distribute transaction verification across a local device mesh:
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { phase: "Request", desc: "A device needing verification broadcasts a signed request containing the transaction signature, requested confirmation level, and a TTL." },
                  { phase: "Verification", desc: "Nodes with RPC access verify the transaction against the Solana ledger, then sign a proof with their Ed25519 key and return it." },
                  { phase: "Propagation", desc: "Verified proofs spread through the mesh via a gossip protocol. Each hop is tracked, duplicates are filtered, and TTL prevents infinite propagation." },
                ].map((p, i) => (
                  <div key={i} className="rounded-lg bg-secondary/50 p-5">
                    <div className="text-xs text-primary font-medium mb-1">Phase {i + 1}</div>
                    <h3 className="font-display font-semibold mb-2">{p.phase}</h3>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Security & Trust Model</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>• <strong className="text-foreground">Proof Signing:</strong> Every verification proof is signed using the verifier's Ed25519 keypair, ensuring authenticity and non-repudiation.</p>
                <p>• <strong className="text-foreground">Multi-Validator Consensus:</strong> Configurable threshold (default 67%) — proofs are only accepted when enough independent verifiers agree.</p>
                <p>• <strong className="text-foreground">Attack Prevention:</strong> Replay attacks mitigated via nonce + timestamp. Sybil attacks addressed through reputation scoring and stake-weighted trust.</p>
                <p>• <strong className="text-foreground">Privacy:</strong> No private keys are shared. Only transaction signatures and verification proofs traverse the mesh.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-8">
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Transport Layer</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-display font-semibold">Transport</th>
                      <th className="text-left py-3 px-4 font-display font-semibold">Range</th>
                      <th className="text-left py-3 px-4 font-display font-semibold">Throughput</th>
                      <th className="text-left py-3 px-4 font-display font-semibold">Latency</th>
                      <th className="text-left py-3 px-4 font-display font-semibold">Power</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transports.map((t, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-3 px-4 font-medium text-primary">{t.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{t.range}</td>
                        <td className="py-3 px-4 text-muted-foreground">{t.throughput}</td>
                        <td className="py-3 px-4 text-muted-foreground">{t.latency}</td>
                        <td className="py-3 px-4 text-muted-foreground">{t.power}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Message Format</h2>
              <pre className="bg-background/80 rounded-lg p-4 overflow-x-auto text-sm text-muted-foreground">
{`{
  "type": "VERIFICATION_PROOF",
  "id": "uuid-v4",
  "tx_signature": "base58...",
  "status": "confirmed",
  "slot": 123456789,
  "verifier_pubkey": "base58...",
  "signature": "ed25519...",
  "timestamp": 1700000000,
  "hop_count": 2,
  "ttl": 5,
  "consensus": {
    "threshold": 0.67,
    "confirmations": 3
  }
}`}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="sdk" className="space-y-8">
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Platform Support</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-display font-semibold">Platform</th>
                      <th className="text-left py-3 px-4 font-display font-semibold">Language</th>
                      <th className="text-left py-3 px-4 font-display font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platforms.map((p, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{p.lang}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Quick Start (Rust)</h2>
              <pre className="bg-background/80 rounded-lg p-4 overflow-x-auto text-sm text-muted-foreground">
                <code>{codeExample}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-8">
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Optimizations</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { title: "Bandwidth", desc: "Compact binary serialization (MessagePack), delta compression for repeated proofs, and adaptive payload sizing based on transport." },
                  { title: "Battery", desc: "Intelligent duty cycling, transport selection based on power budget, and background operation modes for mobile devices." },
                  { title: "Latency", desc: "Parallel verification requests, pre-cached proofs for popular transactions, and optimistic proof acceptance with async validation." },
                  { title: "Scalability", desc: "Bloom filters for duplicate detection, geographic sharding of the gossip protocol, and adaptive TTL based on network density." },
                ].map((o, i) => (
                  <div key={i} className="rounded-lg bg-secondary/50 p-5">
                    <h3 className="font-display font-semibold mb-2">{o.title}</h3>
                    <p className="text-sm text-muted-foreground">{o.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="future" className="space-y-8">
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-4">Future Extensions</h2>
              <div className="space-y-4">
                {[
                  { title: "Token Incentives", desc: "Reward verifiers with micro-payments or governance tokens for providing verification services to the mesh." },
                  { title: "Cross-Chain Support", desc: "Extend the protocol to verify transactions on other blockchains — Ethereum, Polygon, and beyond." },
                  { title: "Hardware Modules", desc: "Dedicated Fernlink hardware for merchants and infrastructure operators — always-on verification nodes." },
                  { title: "Decentralized Governance", desc: "Community-driven protocol upgrades via on-chain voting and proposal mechanisms." },
                  { title: "AI-Powered Routing", desc: "Machine learning models that optimize proof propagation paths based on network topology and historical patterns." },
                ].map((f, i) => (
                  <div key={i} className="flex gap-4 items-start p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-display font-bold text-primary">{i + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-display font-semibold mb-1">{f.title}</h3>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
