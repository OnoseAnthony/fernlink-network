import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Github, Twitter, MessageCircle, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Docs", to: "/docs" },
  { label: "Use Cases", to: "/use-cases" },
  { label: "Downloads", to: "/downloads" },
  { label: "Contact", to: "/contact" },
];

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="section-container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="text-gradient">Fernlink</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                pathname === l.to
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <a href="https://github.com/fernlink" target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-2">
              <Github className="h-4 w-4" /> Star on GitHub
            </Button>
          </a>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl animate-fade-in">
          <div className="section-container py-4 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded-md text-sm ${
                  pathname === l.to ? "text-primary bg-primary/10" : "text-muted-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50">
      <div className="section-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold mb-3">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="text-gradient">Fernlink</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Decentralized peer-to-peer transaction verification for the Solana ecosystem.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold mb-3">Protocol</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
              <Link to="/use-cases" className="hover:text-foreground transition-colors">Use Cases</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold mb-3">Resources</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/downloads" className="hover:text-foreground transition-colors">Downloads</Link>
              <a href="https://github.com/fernlink" className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold mb-3">Community</h4>
            <div className="flex items-center gap-3 mt-2">
              <a href="https://github.com/fernlink" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com/fernlink" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://discord.gg/fernlink" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Discord">
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
          <p>© 2025 Fernlink Protocol. Apache 2.0 License.</p>
          <p>A public good for the Solana ecosystem.</p>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
