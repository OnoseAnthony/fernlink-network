import { useState } from "react";
import { Github, Twitter, MessageCircle, ChevronDown, Send, Mail } from "lucide-react";

const faqs = [
  {
    q: "How does Fernlink reduce RPC load?",
    a: "Instead of every device making its own RPC call, one device in the mesh verifies the transaction and shares the cryptographic proof with nearby peers. This can reduce RPC calls by 60-80% in dense environments.",
  },
  {
    q: "Is Fernlink secure?",
    a: "Yes. All proofs are Ed25519 signed, and the protocol uses multi-validator consensus (default 67% threshold), replay attack prevention via nonces, and reputation scoring to resist Sybil attacks.",
  },
  {
    q: "What happens when there's no internet?",
    a: "Devices can rely on cached proofs from the mesh and peer consensus. When connectivity returns, proofs can be re-validated against the Solana ledger for full confirmation.",
  },
  {
    q: "Which transports are supported?",
    a: "BLE 5.0 (~100m range), WiFi Direct (~200m range), and NFC (~10cm, ideal for POS). The protocol automatically selects the best transport based on availability and requirements.",
  },
  {
    q: "Is Fernlink open source?",
    a: "Absolutely. Fernlink is released under the Apache 2.0 License. All source code, documentation, and specifications are available on GitHub.",
  },
];

export default function Contact() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="mesh-bg">
      <div className="section-container py-16 md:py-24">
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 animate-fade-up">
          Get in <span className="text-gradient">Touch</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-14 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Have questions, ideas, or want to contribute? We'd love to hear from you.
        </p>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8 space-y-6">
              <h2 className="text-2xl font-display font-bold">Reach Out</h2>

              <a href="https://t.me/aaaa" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
                <Send className="h-5 w-5 text-primary" />
                <span className="text-sm">t.me/aaaa</span>
              </a>

              <a href="mailto:contact@fernlink.org" className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-sm">contact@fernlink.org</span>
              </a>
            </div>

            {/* Social */}
            <div className="mt-6 rounded-xl border-glow bg-card/60 p-6">
              <h3 className="font-display font-semibold mb-4">Join the Community</h3>
              <div className="flex gap-4">
                <a href="https://discord.gg/fernlink" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <MessageCircle className="h-5 w-5" /> Discord
                </a>
                <a href="https://twitter.com/fernlink" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Twitter className="h-5 w-5" /> Twitter/X
                </a>
                <a href="https://github.com/fernlink" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="h-5 w-5" /> GitHub
                </a>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="text-2xl font-display font-bold mb-6">FAQ</h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border-glow bg-card/60 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left text-sm font-medium hover:bg-secondary/30 transition-colors"
                  >
                    {faq.q}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm text-muted-foreground animate-fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
