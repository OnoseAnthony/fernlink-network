use crate::message::{Commitment, TxStatus, VerificationProof};

/// Outcome returned by the consensus engine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConsensusResult {
    /// Enough matching proofs — transaction status is settled.
    Settled { status: TxStatus, slot: u64, block_time: u64 },
    /// Proofs disagree or count is below threshold — need more data.
    Pending,
    /// Finalized proof overrides anything else immediately.
    Finalized { slot: u64, block_time: u64 },
}

/// Stateless consensus evaluation over a slice of verified proofs.
///
/// Rules (from whitepaper §6.2):
/// 1. A single Finalized-commitment proof is immediately authoritative.
/// 2. Two or more proofs agreeing on (status, slot) are accepted.
/// 3. Anything else is Pending.
pub fn evaluate(proofs: &[VerificationProof], required_commitment: Commitment) -> ConsensusResult {
    if proofs.is_empty() {
        return ConsensusResult::Pending;
    }

    // Rule 1: a finalized proof is always trusted immediately.
    if required_commitment == Commitment::Finalized {
        if let Some(p) = proofs.iter().find(|p| p.status == TxStatus::Confirmed) {
            return ConsensusResult::Finalized { slot: p.slot, block_time: p.block_time };
        }
    }

    // Rule 2: one vote per distinct verifier — deduplicate by public key first.
    let mut seen_keys: std::collections::HashSet<[u8; 32]> = std::collections::HashSet::new();
    let unique: Vec<&VerificationProof> = proofs.iter()
        .filter(|p| seen_keys.insert(p.verifier_pubkey))
        .collect();

    let mut tally: std::collections::HashMap<(u8, u64), (u32, u64)> = std::collections::HashMap::new();
    for p in &unique {
        let key = (p.status as u8, p.slot);
        let entry = tally.entry(key).or_insert((0, p.block_time));
        entry.0 += 1;
    }

    if let Some((&(status_byte, slot), &(count, block_time))) = tally.iter().max_by_key(|(_, &(c, _))| c) {
        if count >= 2 {
            let status = match status_byte {
                0 => TxStatus::Confirmed,
                1 => TxStatus::Failed,
                _ => TxStatus::Unknown,
            };
            return ConsensusResult::Settled { status, slot, block_time };
        }
    }

    ConsensusResult::Pending
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::{Header, MessageType};

    fn make_proof(status: TxStatus, slot: u64) -> VerificationProof {
        make_proof_for(status, slot, 0x00)
    }

    fn make_proof_for(status: TxStatus, slot: u64, pubkey_seed: u8) -> VerificationProof {
        let mut pubkey = [0u8; 32];
        pubkey[0] = pubkey_seed;
        VerificationProof {
            header: Header::new(MessageType::Proof),
            tx_signature: [0u8; 64],
            status,
            slot,
            block_time: 0,
            error_code: 0,
            verifier_pubkey: pubkey,
            signature: [0u8; 64],
        }
    }

    #[test]
    fn two_matching_proofs_settle() {
        let proofs = vec![
            make_proof_for(TxStatus::Confirmed, 100, 0x01),
            make_proof_for(TxStatus::Confirmed, 100, 0x02),
        ];
        match evaluate(&proofs, Commitment::Confirmed) {
            ConsensusResult::Settled { status, slot, .. } => {
                assert_eq!(status, TxStatus::Confirmed);
                assert_eq!(slot, 100);
            }
            other => panic!("expected Settled, got {:?}", other),
        }
    }

    #[test]
    fn single_proof_is_pending() {
        let proofs = vec![make_proof(TxStatus::Confirmed, 100)];
        assert_eq!(evaluate(&proofs, Commitment::Confirmed), ConsensusResult::Pending);
    }

    #[test]
    fn duplicate_signer_does_not_settle() {
        // Same pubkey sending the same status twice must not reach threshold.
        let proofs = vec![
            make_proof_for(TxStatus::Confirmed, 100, 0x01),
            make_proof_for(TxStatus::Confirmed, 100, 0x01),
        ];
        assert_eq!(evaluate(&proofs, Commitment::Confirmed), ConsensusResult::Pending);
    }

    #[test]
    fn conflicting_proofs_are_pending() {
        let proofs = vec![
            make_proof(TxStatus::Confirmed, 100),
            make_proof(TxStatus::Failed, 100),
        ];
        assert_eq!(evaluate(&proofs, Commitment::Confirmed), ConsensusResult::Pending);
    }
}
