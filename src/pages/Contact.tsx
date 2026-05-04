import { useState } from "react";
import { GITHUB } from "@/lib/constants";

const faqs = [
  {
    q: "How does Fernlink reduce RPC load?",
    a: "Instead of every device making its own RPC call, one device in the mesh verifies the transaction and shares the cryptographic proof with nearby peers. This can reduce RPC calls by 60-80% in dense environments.",
  },
  {
    q: "Is Fernlink secure?",
    a: "Yes. All proofs are Ed25519 signed, and the protocol uses multi-validator consensus (2+ matching proofs), UUID-based deduplication with TTL to prevent replays, and gossip-based propagation with hop limits.",
  },
  {
    q: "What happens when there's no internet?",
    a: "Fernlink uses TTL-based multi-hop routing, fully implemented across Android, iOS, and desktop. When your device has no connectivity, it sends the request to nearby peers over BLE. Each peer that also lacks internet decrements the TTL by one and forwards the request further into the mesh. The first device that can reach Solana RPC independently verifies the transaction, signs a cryptographic proof, and sends it back through the same chain. The proof travels from that device back through each intermediate hop until it reaches you. The TTL starts at 8, allowing up to 8 hops in each direction. If no peers are reachable at all, a store-and-forward queue holds your request and drains it automatically the moment a peer connects.",
  },
  {
    q: "Which transports are supported?",
    a: "BLE 5.0 is the primary transport, implemented natively on Android (GATT), iOS (CoreBluetooth), and desktop Linux/macOS/Windows (btleplug). Web browsers connect as BLE centrals via the Web Bluetooth API in Chrome and Edge. WiFi Direct and NFC are on the roadmap.",
  },
  {
    q: "Is Fernlink open source?",
    a: "Absolutely. Fernlink is released under the Apache 2.0 License. All source code, documentation, and specifications are available on GitHub.",
  },
  {
    q: "Is there a token?",
    a: "$Fern is a future aspiration. Community governance and verifier incentives are on the roadmap, but nothing is live yet. Protocol maturity comes first.",
  },
];

export default function Contact() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="pt-24 pb-20 px-6 max-w-[1440px] mx-auto">

      {/* Header */}
      <section className="pb-12 border-b border-[#064e3b]">
        <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-4">
          $ ./contact.sh
        </div>
        <h1 className="font-mono font-bold text-4xl sm:text-5xl text-[#22C55E] mb-4 data-glow">
          Get in Touch
        </h1>
        <p className="font-mono text-[#166534] text-lg max-w-2xl">
          Have questions, ideas, or want to contribute? We'd love to hear from you.
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-12 pt-12">

        {/* Contact */}
        <div className="space-y-6">
          <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-2">
            // REACH_OUT
          </div>

          <div className="bg-black border border-[#064e3b] p-6 terminal-border space-y-5">
            <a
              href="https://t.me/Stranger3145"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 group"
            >
              <span className="material-symbols-outlined text-[#22C55E] group-hover:scale-110 transition-transform">send</span>
              <div>
                <div className="font-mono text-[10px] uppercase text-[#166534] tracking-widest">Telegram</div>
                <div className="font-mono text-sm text-[#22C55E]">t.me/Stranger3145</div>
              </div>
            </a>

            <div className="border-t border-[#064e3b]" />

            <a
              href="mailto:oanthony590@gmail.com"
              className="flex items-center gap-4 group"
            >
              <span className="material-symbols-outlined text-[#22C55E] group-hover:scale-110 transition-transform">mail</span>
              <div>
                <div className="font-mono text-[10px] uppercase text-[#166534] tracking-widest">Email</div>
                <div className="font-mono text-sm text-[#22C55E]">oanthony590@gmail.com</div>
              </div>
            </a>
          </div>

          <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mt-8 mb-2">
            // COMMUNITY
          </div>

          <div className="bg-black border border-[#064e3b] p-6 terminal-border">
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 group"
            >
              <span className="material-symbols-outlined text-[#22C55E] group-hover:scale-110 transition-transform">code</span>
              <div>
                <div className="font-mono text-[10px] uppercase text-[#166534] tracking-widest">GitHub</div>
                <div className="font-mono text-sm text-[#22C55E]">Fernlink-Protocol/fernlink-network</div>
              </div>
            </a>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <div className="font-mono text-[#22C55E] text-sm uppercase tracking-widest mb-6">
            // FAQ
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-black border border-[#064e3b] terminal-border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left group"
                >
                  <span className="font-mono text-sm text-[#22C55E] group-hover:data-glow">{faq.q}</span>
                  <span className={`material-symbols-outlined text-[#166534] flex-shrink-0 ml-3 transition-transform ${openFaq === i ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 border-t border-[#064e3b] pt-3">
                    <p className="font-mono text-sm text-[#166534] leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
