import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Menu } from "lucide-react";
import MatrixCanvas from "./MatrixCanvas";

const navLinks = [
  { label: "[ NETWORK ]",  to: "/about" },
  { label: "[ PROOFS ]",   to: "/docs" },
  { label: "[ PROTOCOL ]", to: "/use-cases" },
  { label: "[ ROADMAP ]",  to: "/downloads" },
  { label: "[ FAQ ]",      to: "/contact" },
];

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#064e3b] shadow-[0_0_20px_rgba(34,197,94,0.08)]">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-[1440px] mx-auto">
        <Link to="/" className="font-mono font-bold text-[#22C55E] tracking-[0.2em] text-xl data-glow">
          FERNLINK
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`font-mono uppercase tracking-tighter text-sm transition-colors ${
                pathname === l.to
                  ? "text-[#22C55E]"
                  : "text-[#166534] hover:text-[#22C55E]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <a
            href="https://github.com/OnoseAnthony/fernlink-network"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono uppercase tracking-tighter text-sm bg-[#22C55E] text-black px-4 py-2 hover:bg-black hover:text-[#22C55E] border border-[#22C55E] transition-all duration-200 active:scale-95"
          >
            EXEC: GITHUB_STAR
          </a>
          <span className="material-symbols-outlined text-[#22C55E] animate-pulse cursor-pointer select-none">
            terminal
          </span>
        </div>

        <button
          className="md:hidden text-[#22C55E]"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-[#064e3b] bg-black/95 backdrop-blur-xl">
          <div className="px-6 py-4 flex flex-col gap-3">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`font-mono text-sm uppercase tracking-tighter py-2 ${
                  pathname === l.to ? "text-[#22C55E]" : "text-[#166534]"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="https://github.com/OnoseAnthony/fernlink-network"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm uppercase tracking-tighter text-black bg-[#22C55E] px-4 py-2 text-center mt-2"
            >
              EXEC: GITHUB_STAR
            </a>
          </div>
        </nav>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-black border-t border-[#064e3b] mt-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-12 py-16 w-full max-w-[1440px] mx-auto">
        <div className="space-y-4">
          <div className="text-[#22C55E] font-bold font-mono tracking-[0.3em] text-xl data-glow">
            FERNLINK_CORE
          </div>
          <p className="font-mono text-[10px] leading-relaxed uppercase text-[#166534]">
            © 2025 FERNLINK // DECENTRALIZED RHIZOME NETWORK // SOLANA ECOSYSTEM PUBLIC GOOD // ENCRYPTION_LEVEL: MAX
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-2">
            <Link to="/docs" className="font-mono text-[10px] uppercase text-[#166534] hover:text-[#22C55E] hover:translate-x-1 transition-all">
              ./documentation
            </Link>
            <a href="https://github.com/OnoseAnthony/fernlink-network" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase text-[#166534] hover:text-[#22C55E] hover:translate-x-1 transition-all">
              ./whitepaper.pdf
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <a href="https://github.com/OnoseAnthony/fernlink-network" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase text-[#166534] hover:text-[#22C55E] hover:translate-x-1 transition-all">
              ./github_repo
            </a>
            <Link to="/downloads" className="font-mono text-[10px] uppercase text-[#166534] hover:text-[#22C55E] hover:translate-x-1 transition-all">
              ./sdk_downloads
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/contact" className="font-mono text-[10px] uppercase text-[#166534] hover:text-[#22C55E] hover:translate-x-1 transition-all">
              ./contact
            </Link>
            <Link to="/about" className="font-mono text-[10px] uppercase text-[#166534] hover:text-[#22C55E] hover:translate-x-1 transition-all">
              ./about
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <MatrixCanvas />
      <Header />
      <main className="flex-1 relative z-10">{children}</main>
      <Footer />
    </div>
  );
}
