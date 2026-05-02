import { Button } from "@/components/ui/button";
import { FileText, Github, Download, BookOpen, Newspaper, Terminal, Package, Copy } from "lucide-react";
import { useState } from "react";

const GITHUB_ORG = "https://github.com/OnoseAnthony/fernlink-network";

const sdks = [
  {
    platform: "TypeScript / Node.js",
    pkg: "@fernlink/sdk",
    install: "npm install @fernlink/sdk",
    repo: `${GITHUB_ORG}/tree/main/packages/sdk`,
    status: "Available",
  },
  {
    platform: "Rust Core",
    pkg: "fernlink-core",
    install: "cargo add fernlink-core",
    repo: `${GITHUB_ORG}/tree/main/packages/fernlink-core`,
    status: "Available",
  },
  {
    platform: "iOS (Swift)",
    pkg: "fernlink-ios",
    install: null,
    repo: null,
    status: "In Development",
  },
  {
    platform: "Android (Kotlin)",
    pkg: "fernlink-android",
    install: null,
    repo: null,
    status: "In Development",
  },
];

const blogPosts = [
  { title: "Introducing Fernlink: A New Paradigm for Solana Verification", date: "Coming Soon" },
  { title: "How BLE Mesh Networks Can Reduce RPC Costs by 80%", date: "Coming Soon" },
  { title: "Building Offline-First Solana Applications", date: "Coming Soon" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-muted-foreground hover:text-primary transition-colors"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5" />
      {copied && <span className="sr-only">Copied!</span>}
    </button>
  );
}

export default function Downloads() {
  return (
    <div className="mesh-bg">
      <div className="section-container py-16 md:py-24">
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 animate-fade-up">
          Downloads & <span className="text-gradient">Resources</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-14 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Get the SDK, run the demo, read the whitepaper, and explore the source code.
        </p>

        {/* Quick-start */}
        <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8 mb-10 animate-fade-up" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-bold">Quick Start</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Install</p>
              <div className="flex items-center bg-secondary/60 rounded-lg px-4 py-3 font-mono text-sm">
                <span className="text-primary mr-2">$</span>
                <span>npm install @fernlink/sdk</span>
                <CopyButton text="npm install @fernlink/sdk" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Verify a transaction via the mesh</p>
              <pre className="bg-secondary/60 rounded-lg px-4 py-4 text-sm overflow-x-auto text-left leading-relaxed">
{`import { FernlinkClient, SimulatedPeer } from "@fernlink/sdk";

const fernlink = new FernlinkClient({
  rpcEndpoint: "https://api.mainnet-beta.solana.com",
});

await fernlink.start();

// In production: add real BLE peers via the native transport layer
fernlink.addPeer(new SimulatedPeer("https://api.mainnet-beta.solana.com"));

const result = await fernlink.verifyTransaction(txSignature, {
  commitment: "confirmed",
  timeoutMs: 30_000,
  minProofs: 2,           // require 2 peers to agree
});

console.log(result.status, result.slot, result.proofCount);`}
              </pre>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Try the live devnet demo</p>
              <div className="flex items-center bg-secondary/60 rounded-lg px-4 py-3 font-mono text-sm">
                <span className="text-primary mr-2">$</span>
                <span>npx @fernlink/demo</span>
                <CopyButton text="npx @fernlink/demo" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Whitepaper */}
          <div className="rounded-xl border-glow bg-card/60 p-8 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Whitepaper</h2>
            <p className="text-sm text-muted-foreground mb-6">
              The complete technical specification covering protocol design,
              security model, transport layers, and performance analysis.
            </p>
            <a href={`${GITHUB_ORG}/blob/main/whitepaper.md`} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <Download className="h-4 w-4" /> Read Whitepaper
              </Button>
            </a>
          </div>

          {/* GitHub */}
          <div className="rounded-xl border-glow bg-card/60 p-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <Github className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Source Code</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Full monorepo — Rust core, TypeScript SDK, and the devnet demo.
              Apache 2.0 licensed and open for contributions.
            </p>
            <a href={GITHUB_ORG} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
                <Github className="h-4 w-4" /> View on GitHub
              </Button>
            </a>
          </div>
        </div>

        {/* SDK Downloads */}
        <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8 mb-10 animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center gap-3 mb-6">
            <Package className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-bold">SDK & Packages</h2>
          </div>
          <div className="space-y-3">
            {sdks.map((sdk, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">
                <div className="min-w-0">
                  <span className="font-medium">{sdk.platform}</span>
                  {sdk.install && (
                    <div className="flex items-center mt-1">
                      <span className="text-xs font-mono text-muted-foreground">{sdk.install}</span>
                      <CopyButton text={sdk.install} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {sdk.repo ? (
                    <a href={sdk.repo} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 hover:bg-primary/10 text-xs h-7">
                        <Github className="h-3 w-3" /> Source
                      </Button>
                    </a>
                  ) : null}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    sdk.status === "Available"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {sdk.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blog */}
        <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-3 mb-6">
            <Newspaper className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-bold">Blog & Updates</h2>
          </div>
          <div className="space-y-3">
            {blogPosts.map((post, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-secondary/40">
                <span className="font-medium text-sm">{post.title}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-4">{post.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
