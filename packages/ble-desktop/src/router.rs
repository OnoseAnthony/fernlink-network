use std::sync::Arc;

use anyhow::Result;
use fernlink_core::{crypto::Keypair, message::TxStatus as CoreTxStatus};
use serde_json::Value;
use tracing::{info, warn};

use crate::rpc::{self, TxStatus};
use crate::transport::TransportHandle;

/// Drive the full message-routing loop for a single transport.
///
/// Spawns two tasks:
/// - request handler: for each incoming REQUEST, verify via RPC, sign and
///   send a proof, or forward with TTL-1 if no internet.
/// - proof collector: for each incoming PROOF, store it and forward upstream.
pub async fn run_router(handle: &mut TransportHandle, keypair: &Keypair, rpc_url: &str) {
    let seed = keypair.signing_key.to_bytes();

    // ── Request handler ───────────────────────────────────────────────────────
    if let Some(mut req_rx) = handle.request_rx.take() {
        let send_proof   = Arc::clone(&handle.send_proof);
        let send_request = Arc::clone(&handle.send_request);
        let url          = rpc_url.to_string();

        tokio::spawn(async move {
            let kp = Keypair::from_bytes(&seed);
            while let Some(payload) = req_rx.recv().await {
                let sp  = Arc::clone(&send_proof);
                let sr  = Arc::clone(&send_request);
                let u   = url.clone();
                let s   = kp.signing_key.to_bytes();
                tokio::spawn(async move {
                    let kp2 = Keypair::from_bytes(&s);
                    if let Err(e) = handle_request(payload, &kp2, &u, sp, sr).await {
                        warn!("request handler error: {e}");
                    }
                });
            }
        });
    }

    // ── Proof collector ───────────────────────────────────────────────────────
    {
        let mut proof_rx  = {
            // We can't move out of handle directly since we might call this
            // multiple times in future, so replace with a dummy channel.
            let (_, dummy_rx) = tokio::sync::mpsc::channel(1);
            std::mem::replace(&mut handle.proof_rx, dummy_rx)
        };
        let store      = Arc::clone(&handle.proof_store);
        let send_proof = Arc::clone(&handle.send_proof);

        tokio::spawn(async move {
            while let Some(proof_bytes) = proof_rx.recv().await {
                if let Ok(s) = std::str::from_utf8(&proof_bytes) {
                    store.lock().await.push(s.to_string());
                }
                if let Err(e) = (send_proof)(proof_bytes).await {
                    warn!("upstream proof forward error: {e}");
                }
            }
        });
    }
}

/// Handle one reassembled REQUEST payload:
/// 1. Verify via Solana RPC — sign and push a proof if successful.
/// 2. On RPC failure, forward the request with TTL-1.
pub async fn handle_request(
    payload:      Vec<u8>,
    keypair:      &Keypair,
    rpc_url:      &str,
    send_proof:   crate::transport::SendFn,
    send_request: crate::transport::SendFn,
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
            let proof = keypair.sign_proof(
                tx_sig_to_bytes(&tx_sig), core_status,
                status.slot, status.block_time, 0,
            );
            let proof_bytes = serde_json::to_vec(&proof)?;
            info!("verified {tx_sig}, sending proof");
            send_proof(proof_bytes).await?;
        }
        Err(e) => {
            warn!("RPC failed ({e}), forwarding request (ttl={ttl})");
            if ttl > 0 {
                let mut forwarded = json.clone();
                forwarded["ttl"] = Value::from(ttl - 1);
                send_request(forwarded.to_string().into_bytes()).await?;
            }
        }
    }
    Ok(())
}

/// Evaluate stored proofs for consensus. Returns a JSON summary or None.
pub async fn evaluate_proofs(store: &crate::transport::ProofStore, min_proofs: usize) -> Option<String> {
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
                "settled":    true,
                "status":     format!("{status:?}"),
                "slot":       slot,
                "blockTime":  block_time,
                "proofCount": verified.len(),
            }).to_string())
        }
        _ => None,
    }
}

fn tx_sig_to_bytes(sig: &str) -> [u8; 64] {
    let mut out = [0u8; 64];
    let b = sig.as_bytes();
    out[..b.len().min(64)].copy_from_slice(&b[..b.len().min(64)]);
    out
}
