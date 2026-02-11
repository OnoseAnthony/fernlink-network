import { Button } from "@/components/ui/button";
import { FileText, Github, Download, BookOpen, Newspaper } from "lucide-react";

const sdks = [
  { platform: "iOS (Swift)", repo: "fernlink/fernlink-ios", status: "In Development" },
  { platform: "Android (Kotlin)", repo: "fernlink/fernlink-android", status: "In Development" },
  { platform: "React Native", repo: "fernlink/fernlink-rn", status: "Planned" },
  { platform: "Rust Core", repo: "fernlink/fernlink-core", status: "In Development" },
];

const blogPosts = [
  { title: "Introducing Fernlink: A New Paradigm for Solana Verification", date: "Coming Soon" },
  { title: "How BLE Mesh Networks Can Reduce RPC Costs by 80%", date: "Coming Soon" },
  { title: "Building Offline-First Solana Applications", date: "Coming Soon" },
];

export default function Downloads() {
  return (
    <div className="mesh-bg">
      <div className="section-container py-16 md:py-24">
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 animate-fade-up">
          Downloads & <span className="text-gradient">Resources</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-14 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Get the SDK, read the whitepaper, and explore the source code.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Whitepaper */}
          <div className="rounded-xl border-glow bg-card/60 p-8 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Whitepaper</h2>
            <p className="text-sm text-muted-foreground mb-6">
              The complete technical specification covering protocol design,
              security model, transport layers, and performance analysis.
            </p>
            <Button className="gap-2">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>

          {/* GitHub */}
          <div className="rounded-xl border-glow bg-card/60 p-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <Github className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Source Code</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Explore the full source code, contribute to development,
              and report issues on our GitHub organization.
            </p>
            <a href="https://github.com/fernlink" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
                <Github className="h-4 w-4" /> View on GitHub
              </Button>
            </a>
          </div>
        </div>

        {/* SDK Downloads */}
        <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8 mb-12 animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-bold">SDK Downloads</h2>
          </div>
          <div className="space-y-3">
            {sdks.map((sdk, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">
                <div>
                  <span className="font-medium">{sdk.platform}</span>
                  <span className="text-xs text-muted-foreground ml-3">{sdk.repo}</span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{sdk.status}</span>
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
                <span className="text-xs text-muted-foreground">{post.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
