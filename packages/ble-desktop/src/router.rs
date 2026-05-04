use std::sync::Arc;

use anyhow::Result;
use fernlink_core::{crypto::Keypair, message::TxStatus as CoreTxStatus};
use serde_json::Value;
use tokio::sync::{mpsc, Mutex};
use tracing::{info, warn};

use crate::central::FernlinkCentral;
use crate::rpc::{self, TxStatus};

pub type ProofStore = Arc<Mutex<Vec<String>>>;

/// Handle one reassembled REQUEST payload from a peer:
/// 1. Verify via Solana RPC — sign and push a proof if successful.
/// 2. On RPC failure (no internet), forward the request with TTL - 1.
pub async fn handle_request(
    payload:  Vec<u8>,
    keypair:  &Keypair,
    rpc_url:  &str,
    central:  &Arc<FernlinkCentral>,
    #[cfg(target_os = "linux")]
    peripheral: &Arc<crate::peripheral::FernlinkPeripheral>,
) -> Result<()> {
    let json: Value = serde_json::from_slice(&payload)?;
    let tx_sig = json["txSignature"].as_str().unwrap_or("").to_string();
    let ttl    = json["ttl"].as_u64().unwrap_or(0);

    match rpc::get_signature_status(rpc_url, &tx_sig).await {
        Ok(status) => {
            let core_status = match status.status {
                TxStatus::Confirmed => CoreTxStatus::Confirmed,
                TxStatus::Failed    => CoreTxStatus::Failed,
                TxStatus::Unknown   => CoreTxStatus::Unknown,
            };
            let proof = keypair.sign_proof(tx_sig_to_bytes(&tx_sig), core_status, status.slot, status.block_time, 0);
            let proof_bytes = serde_json::to_vec(&proof)?;
            info!("verified {tx_sig}, sending proof");

            #[cfg(target_os = "linux")]
            peripheral.send_proof(&proof_bytes).await?;
        }
        Err(e) => {
            warn!("RPC failed ({e}), forwarding request (ttl={ttl})");
            if ttl > 0 {
                let mut forwarded = json.clone();
                forwarded["ttl"] = Value::from(ttl - 1);
                central.broadcast_request(forwarded.to_string().as_bytes()).await?;
            }
        }
    }
    Ok(())
}

/// Drive the proof collection loop. Runs until the sender side is dropped.
/// Stores each incoming proof and forwards it back upstream (multi-hop return).
pub async fn collect_proofs(
    mut proof_rx: mpsc::Receiver<Vec<u8>>,
    store: ProofStore,
    #[cfg(target_os = "linux")]
    peripheral: Arc<crate::peripheral::FernlinkPeripheral>,
) {
    while let Some(proof_bytes) = proof_rx.recv().await {
        if let Ok(s) = std::str::from_utf8(&proof_bytes) {
            store.lock().await.push(s.to_string());
        }
        // Forward the proof back upstream so multi-hop return (C → B → A) works.
        #[cfg(target_os = "linux")]
        if let Err(e) = peripheral.send_proof(&proof_bytes).await {
            warn!("upstream proof forward error: {e}");
        }
    }
}

/// Evaluate stored proofs for consensus. Returns a JSON summary or None.
pub async fn evaluate_proofs(store: &ProofStore, min_proofs: usize) -> Option<String> {
    use fernlink_core::{consensus, crypto, message::Commitment};

    let stored = store.lock().await.clone();
    if stored.is_empty() { return None; }

    let verified: Vec<_> = stored.iter()
        .filter_map(|s| serde_json::from_str(s).ok())
        .filter(|p| crypto::verify_proof(p).is_ok())
        .collect();

    if verified.len() < min_proofs { return None; }

    match consensus::evaluate(&verified, Commitment::Confirmed) {
        consensus::ConsensusResult::Settled { status, slot, block_time } => {
            Some(serde_json::json!({
                "settled":     true,
                "status":      format!("{status:?}"),
                "slot":        slot,
                "blockTime":   block_time,
                "proofCount":  verified.len(),
            }).to_string())
        }
        _ => None,
    }
}

/// Solana tx signatures are base58 ASCII strings (~88 chars). Pad/truncate to
/// the 64-byte array expected by the fernlink-core proof struct.
fn tx_sig_to_bytes(sig: &str) -> [u8; 64] {
    let mut out = [0u8; 64];
    let b = sig.as_bytes();
    out[..b.len().min(64)].copy_from_slice(&b[..b.len().min(64)]);
    out
}
