use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey, Verifier};
use rand::rngs::OsRng;

use crate::error::{FernlinkError, Result};
use crate::message::{TxStatus, VerificationProof};

pub struct Keypair {
    pub signing_key: SigningKey,
}

impl Keypair {
    /// Generate a fresh Ed25519 keypair using the OS RNG.
    pub fn generate() -> Self {
        Self { signing_key: SigningKey::generate(&mut OsRng) }
    }

    /// Load from a 32-byte secret seed.
    pub fn from_bytes(seed: &[u8; 32]) -> Self {
        Self { signing_key: SigningKey::from_bytes(seed) }
    }

    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.signing_key.verifying_key().to_bytes()
    }

    /// Sign and return a complete VerificationProof.
    pub fn sign_proof(
        &self,
        tx_signature: [u8; 64],
        status: TxStatus,
        slot: u64,
        block_time: u64,
        error_code: u16,
    ) -> VerificationProof {
        use crate::message::Header;
        use crate::message::MessageType;

        let verifier_pubkey = self.public_key_bytes();

        let mut proof = VerificationProof {
            header: Header::new(MessageType::Proof),
            tx_signature,
            status,
            slot,
            block_time,
            error_code,
            verifier_pubkey,
            signature: [0u8; 64],
        };

        let sig: Signature = self.signing_key.sign(&proof.signable_bytes());
        proof.signature = sig.to_bytes();
        proof
    }
}

/// Verify the Ed25519 signature on a VerificationProof.
pub fn verify_proof(proof: &VerificationProof) -> Result<()> {
    let verifying_key = VerifyingKey::from_bytes(&proof.verifier_pubkey)
        .map_err(|e| FernlinkError::InvalidSignature(e.to_string()))?;

    let signature = Signature::from_bytes(&proof.signature);

    verifying_key
        .verify(&proof.signable_bytes(), &signature)
        .map_err(|e| FernlinkError::InvalidSignature(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::TxStatus;

    #[test]
    fn sign_and_verify_roundtrip() {
        let kp = Keypair::generate();
        let tx_sig = [1u8; 64];
        let proof = kp.sign_proof(tx_sig, TxStatus::Confirmed, 100, 0, 0);
        assert!(verify_proof(&proof).is_ok());
    }

    #[test]
    fn tampered_proof_fails_verification() {
        let kp = Keypair::generate();
        let mut proof = kp.sign_proof([1u8; 64], TxStatus::Confirmed, 100, 0, 0);
        proof.slot = 999; // tamper
        assert!(verify_proof(&proof).is_err());
    }
}
