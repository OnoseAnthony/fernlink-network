import { FernlinkSimulator } from "./simulator";

const TX = "5wHu1a8pgZFo9t5WNpV3BxHJy5PAV4HGBkr3BkqoR7oZeKMoPvAQRkb1ZmkJ";
const REQ = { txSignature: TX, statusByte: 0, slot: 123456789, blockTime: 1700000000 };

test("postRequest returns valid JSON with required fields", () => {
  const sim   = new FernlinkSimulator();
  const proof = sim.postRequest(REQ);
  const obj   = JSON.parse(proof);
  expect(obj.txSignature).toBe(TX);
  expect(obj.status).toBe("confirmed");
  expect(obj.signature).toMatch(/^[0-9a-f]{128}$/);
  expect(obj.verifierPublicKey).toMatch(/^[0-9a-f]{64}$/);
});

test("verify accepts own proof", () => {
  const sim   = new FernlinkSimulator();
  const proof = sim.postRequest(REQ);
  expect(FernlinkSimulator.verify(proof)).toBe(true);
});

test("verify rejects tampered signature", () => {
  const sim   = new FernlinkSimulator();
  const obj   = JSON.parse(sim.postRequest(REQ));
  obj.signature = "aa".repeat(64);
  expect(FernlinkSimulator.verify(JSON.stringify(obj))).toBe(false);
});

test("verify rejects tampered payload", () => {
  const sim   = new FernlinkSimulator();
  const obj   = JSON.parse(sim.postRequest(REQ));
  obj.slot = 999999;
  expect(FernlinkSimulator.verify(JSON.stringify(obj))).toBe(false);
});

test("evaluate settles with enough matching proofs", () => {
  const seed  = new Uint8Array(32).fill(7);
  const sim   = new FernlinkSimulator(seed);
  const p1    = sim.postRequest(REQ);
  const p2    = sim.postRequest(REQ);
  const result = FernlinkSimulator.evaluate([p1, p2], 2);
  expect(result.settled).toBe(true);
  expect(result.status).toBe("confirmed");
  expect(result.proofCount).toBe(2);
});

test("evaluate does not settle below minProofs threshold", () => {
  const sim    = new FernlinkSimulator();
  const p1     = sim.postRequest(REQ);
  const result = FernlinkSimulator.evaluate([p1], 2);
  expect(result.settled).toBe(false);
});

test("evaluate ignores proofs with tampered signatures", () => {
  const sim  = new FernlinkSimulator();
  const good = sim.postRequest(REQ);
  const bad  = JSON.stringify({ ...JSON.parse(sim.postRequest(REQ)), signature: "aa".repeat(64) });
  const result = FernlinkSimulator.evaluate([good, bad], 2);
  expect(result.settled).toBe(false);
  expect(result.proofCount).toBe(1);
});

test("deterministic keypair produces stable public key", () => {
  const seed = new Uint8Array(32).fill(42);
  const a    = new FernlinkSimulator(seed);
  const b    = new FernlinkSimulator(seed);
  expect(a.publicKeyHex).toBe(b.publicKeyHex);
});
