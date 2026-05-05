import type { VerificationProof, ConsensusResult, TxStatus } from "./types.js";

/**
 * Evaluate a set of verified proofs against the consensus rules from whitepaper §6.2.
 * Two or more proofs agreeing on (status, slot) settle the result.
 */
export function evaluate(
  proofs: VerificationProof[],
  minProofs = 2
): ConsensusResult {
  if (proofs.length === 0) {
    return { settled: false, proofCount: 0 };
  }

  // One vote per distinct signer — prevents a single device from reaching threshold alone.
  const seenSigners = new Set<string>();
  const unique = proofs.filter(p => {
    if (!p.verifierPublicKey || seenSigners.has(p.verifierPublicKey)) return false;
    seenSigners.add(p.verifierPublicKey);
    return true;
  });

  const tally = new Map<string, { count: number; status: TxStatus; slot: number; blockTime: number }>();

  for (const p of unique) {
    const key = `${p.status}:${p.slot}`;
    const entry = tally.get(key);
    if (entry) {
      entry.count++;
    } else {
      tally.set(key, { count: 1, status: p.status, slot: p.slot, blockTime: p.blockTime });
    }
  }

  let best = { count: 0, status: "unknown" as TxStatus, slot: 0, blockTime: 0 };
  for (const v of tally.values()) {
    if (v.count > best.count) best = v;
  }

  if (best.count >= minProofs) {
    return {
      settled: true,
      status: best.status,
      slot: best.slot,
      blockTime: best.blockTime,
      proofCount: best.count,
    };
  }

  return { settled: false, proofCount: proofs.length };
}
