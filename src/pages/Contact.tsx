import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Github, Twitter, MessageCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast({ title: "Message sent!", description: "We'll get back to you soon." });
    (e.target as HTMLFormElement).reset();
  };

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
          {/* Form */}
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="rounded-xl border-glow bg-card/60 p-6 md:p-8">
              <h2 className="text-2xl font-display font-bold mb-6">Send a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm font-medium mb-1.5 block">Name</label>
                  <Input id="name" placeholder="Your name" required className="bg-secondary/50 border-border/50" />
                </div>
                <div>
                  <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</label>
                  <Input id="email" type="email" placeholder="you@example.com" required className="bg-secondary/50 border-border/50" />
                </div>
                <div>
                  <label htmlFor="message" className="text-sm font-medium mb-1.5 block">Message</label>
                  <Textarea id="message" placeholder="Tell us what's on your mind..." rows={5} required className="bg-secondary/50 border-border/50" />
                </div>
                <Button type="submit" className="w-full">Send Message</Button>
              </form>
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
