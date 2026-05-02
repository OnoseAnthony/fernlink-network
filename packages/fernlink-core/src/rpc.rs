use serde::Deserialize;

use crate::error::{FernlinkError, Result};
use crate::message::TxStatus;

#[derive(Debug)]
pub struct ConfirmationStatus {
    pub status:     TxStatus,
    pub slot:       u64,
    pub block_time: u64,
    pub error:      Option<String>,
}

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error:  Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    message: String,
}

#[derive(Deserialize)]
struct SignatureStatusResult {
    value: Vec<Option<SignatureStatus>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignatureStatus {
    slot:               u64,
    confirmation_status: Option<String>,
    err:                 Option<serde_json::Value>,
}

/// Query the Solana RPC for a transaction's confirmation status.
/// Uses a blocking HTTP call — wrap in `spawn_blocking` from async contexts.
pub fn get_signature_status(rpc_url: &str, signature_base58: &str) -> Result<ConfirmationStatus> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getSignatureStatuses",
        "params": [[signature_base58], { "searchTransactionHistory": true }]
    });

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| FernlinkError::RpcError(e.to_string()))?;

    let resp = client
        .post(rpc_url)
        .json(&body)
        .send()
        .map_err(|e| FernlinkError::RpcError(e.to_string()))?;

    let rpc: RpcResponse<SignatureStatusResult> = resp
        .json()
        .map_err(|e| FernlinkError::RpcError(e.to_string()))?;

    if let Some(err) = rpc.error {
        return Err(FernlinkError::RpcError(err.message));
    }

    let result = rpc.result.ok_or_else(|| FernlinkError::RpcError("empty result".into()))?;
    let status_opt = result.value.into_iter().next().flatten();

    match status_opt {
        None => Ok(ConfirmationStatus {
            status: TxStatus::Unknown,
            slot: 0,
            block_time: 0,
            error: None,
        }),
        Some(s) => {
            let tx_status = if s.err.is_some() {
                TxStatus::Failed
            } else {
                TxStatus::Confirmed
            };
            Ok(ConfirmationStatus {
                status: tx_status,
                slot: s.slot,
                block_time: 0,
                error: s.err.map(|e| e.to_string()),
            })
        }
    }
}
