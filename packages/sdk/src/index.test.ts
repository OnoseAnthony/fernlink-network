import { describe, it, expect, vi, beforeEach } from "vitest";
import { FernlinkClient, SimulatedPeer, verifyProof, signProof, generateKeypair, evaluate } from "./index.js";

// ── crypto ──────────────────────────────────────────────────────────────────

describe("crypto", () => {
  it("sign and verify roundtrip", () => {
    const kp = generateKeypair();
    const tx = "a".repeat(128);
    const proof = signProof(kp, tx, "confirmed", 1000, 0, 0);
    expect(verifyProof(proof)).toBe(true);
  });

  it("tampered proof fails verification", () => {
    const kp = generateKeypair();
    const proof = signProof(kp, "a".repeat(128), "confirmed", 1000, 0, 0);
    proof.slot = 9999;
    expect(verifyProof(proof)).toBe(false);
  });
});

// ── consensus ────────────────────────────────────────────────────────────────

describe("consensus", () => {
  it("single proof does not settle", () => {
    const kp = generateKeypair();
    const p = signProof(kp, "a".repeat(128), "confirmed", 100, 0, 0);
    expect(evaluate([p], 2).settled).toBe(false);
  });

  it("two matching proofs settle", () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const tx = "a".repeat(128);
    const p1 = signProof(kp1, tx, "confirmed", 100, 0, 0);
    const p2 = signProof(kp2, tx, "confirmed", 100, 0, 0);
    const result = evaluate([p1, p2], 2);
    expect(result.settled).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("conflicting proofs do not settle", () => {
    const kp1 = generateKeypair();
    const kp2 = generateKeypair();
    const tx = "a".repeat(128);
    const p1 = signProof(kp1, tx, "confirmed", 100, 0, 0);
    const p2 = signProof(kp2, tx, "failed",    100, 0, 1);
    expect(evaluate([p1, p2], 2).settled).toBe(false);
  });
});

// ── FernlinkClient (mocked RPC) ───────────────────────────────────────────

describe("FernlinkClient", () => {
  const RPC = "https://api.devnet.solana.com";
  const TX  = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQo";

  function mockFetch(status: "confirmed" | "failed" = "confirmed") {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        result: {
          value: [{ slot: 250, confirmationStatus: status, err: status === "failed" ? {} : null }],
        },
      }),
    }));
  }

  beforeEach(() => vi.unstubAllGlobals());

  it("settles via mesh when 2 peers agree", async () => {
    mockFetch("confirmed");

    const client = new FernlinkClient({ rpcEndpoint: RPC, minProofs: 2 });
    await client.start();

    client.addPeer(new SimulatedPeer(RPC));
    client.addPeer(new SimulatedPeer(RPC));

    const result = await client.verifyTransaction(TX, { timeoutMs: 5000 });
    expect(result.settled).toBe(true);
    expect(result.status).toBe("confirmed");
    expect(result.proofs.length).toBeGreaterThanOrEqual(2);
    expect(result.proofs.every(verifyProof)).toBe(true);
  });

  it("falls back to direct RPC when no peers connected", async () => {
    mockFetch("confirmed");
    const client = new FernlinkClient({ rpcEndpoint: RPC });
    await client.start();

    const result = await client.verifyTransaction(TX, { timeoutMs: 100 });
    expect(result.settled).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("exposes connectedPeers()", async () => {
    const client = new FernlinkClient({ rpcEndpoint: RPC });
    await client.start();
    client.addPeer(new SimulatedPeer(RPC));
    client.addPeer(new SimulatedPeer(RPC));
    expect(client.connectedPeers()).toHaveLength(2);
  });
});
